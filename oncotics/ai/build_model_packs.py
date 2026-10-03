#!/usr/bin/env python3
"""
Builds the Oncotics Imaging Workbench "trained cancer AI" model packs.

Each pack is a folder you upload to  public_html/assets/models/<pack-id>/  and contains:
  model.onnx   - the trained network, converted from the authors' official PyTorch weights
  pack.json    - schema "oncotics-model-pack/1": model card, labels, pre/post-processing,
                 SHA-256 of model.onnx and the numerical check against the original model
  LICENSE*.txt / README / metadata copied from the source where available

Packs
  cxr-xrv-densenet121        TorchXRayVision DenseNet-121 "all" (Apache-2.0), chest X-ray, 18 findings
                             including Mass, Nodule and Lung Lesion, plus class-activation maps.
  path-camelyon16-resnet18   MONAI model-zoo "pathology_tumor_detection" (Apache-2.0), H&E patch
                             classifier for metastatic tumour (Camelyon16).

Every pack is verified: the ONNX model run in ONNX Runtime must match the original PyTorch model
(including the authors' own post-processing) to within a small tolerance, or the build fails.

Usage
  python build_model_packs.py --out dist/models            # downloads official weights
  python build_model_packs.py --out /tmp/x --offline-random  # pipeline test only (untrained weights,
                                                             # packs are marked NOT FOR USE)
"""
import argparse, datetime, hashlib, json, os, shutil, sys, tempfile

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

TODAY = datetime.date.today().isoformat()


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def write_pack(folder, pack, onnx_path):
    pack['model'] = 'model.onnx'
    pack['sizeBytes'] = os.path.getsize(onnx_path)
    pack['sha256'] = sha256(onnx_path)
    pack['builtAt'] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    pack['builtWith'] = {'torch': torch.__version__, 'onnx': __import__('onnx').__version__, 'onnxruntime': __import__('onnxruntime').__version__}
    with open(os.path.join(folder, 'pack.json'), 'w') as f:
        json.dump(pack, f, indent=2)
    print('[pack] %s  %.1f MB  sha256=%s' % (pack['id'], pack['sizeBytes'] / 1048576, pack['sha256']))


def ort_session(path):
    import onnxruntime as ort
    return ort.InferenceSession(path, providers=['CPUExecutionProvider'])


# ---------------------------------------------------------------- chest X-ray (TorchXRayVision)
def build_cxr(out, offline):
    import torchxrayvision as xrv
    pid = 'cxr-xrv-densenet121'
    folder = os.path.join(out, pid); os.makedirs(folder, exist_ok=True)
    meta = xrv.models.model_urls['densenet121-res224-all']
    if offline:
        model = xrv.models.DenseNet(weights=None, num_classes=len(meta['labels']))
        model.op_threshs = torch.tensor(meta['op_threshs'])
        model.pathologies = meta['labels']
    else:
        model = xrv.models.DenseNet(weights='densenet121-res224-all')
    model.eval()
    labels = list(model.pathologies)
    op = model.op_threshs.detach().cpu().numpy().astype(float).tolist() if getattr(model, 'op_threshs', None) is not None else [None] * len(labels)

    class Export(nn.Module):
        """Raw logits + class-activation maps (classifier applied to every spatial feature)."""
        def __init__(self, m):
            super().__init__(); self.features = m.features; self.classifier = m.classifier
        def forward(self, x):
            feat = F.relu(self.features(x))                      # [N,1024,7,7]
            logits = self.classifier(feat.mean(dim=(2, 3)))       # [N,K]
            cam = torch.einsum('kc,nchw->nkhw', self.classifier.weight, feat) + self.classifier.bias[None, :, None, None]
            return logits, cam

    exp = Export(model).eval()
    onnx_path = os.path.join(folder, 'model.onnx')
    dummy = torch.zeros(1, 1, 224, 224)
    torch.onnx.export(exp, dummy, onnx_path, input_names=['image'], output_names=['logits', 'cam'],
                      dynamic_axes={'image': {0: 'n'}, 'logits': {0: 'n'}, 'cam': {0: 'n'}}, opset_version=17)

    # Verify against the library's own forward (sigmoid + operating-point normalisation).
    def post(logits):
        p = 1 / (1 + np.exp(-logits))
        out = np.full_like(p, 0.5)
        for j, t in enumerate(op):
            if t is None or (isinstance(t, float) and np.isnan(t)):
                out[:, j] = p[:, j]  # xrv leaves 0.5 for NaN thresholds; such outputs are unused labels
                continue
            lo = p[:, j] < t
            out[lo, j] = p[lo, j] / (t * 2)
            out[~lo, j] = 1.0 - (1.0 - p[~lo, j]) / ((1 - t) * 2)
        return out
    rng = np.random.default_rng(0)
    xs = np.clip(rng.normal(0, 400, size=(4, 1, 224, 224)), -1024, 1024).astype(np.float32)
    xs[0] = np.linspace(-1024, 1024, 224, dtype=np.float32)[None, None, :]   # smooth gradient
    with torch.no_grad():
        ref = model(torch.from_numpy(xs)).numpy()
        ref_logits, ref_cam = exp(torch.from_numpy(xs))
    sess = ort_session(onnx_path)
    lo, cam = sess.run(None, {'image': xs})
    used = [j for j, l in enumerate(labels) if l]
    d_prob = float(np.max(np.abs(post(lo)[:, used] - ref[:, used])))
    d_cam = float(np.max(np.abs(cam - ref_cam.numpy())))
    d_pool = float(np.max(np.abs(cam.mean(axis=(2, 3)) - lo)))
    print('[cxr] max |prob(onnx+post) - prob(torch)| = %.2e ; |cam| = %.2e ; |mean(cam) - logits| = %.2e' % (d_prob, d_cam, d_pool))
    if d_prob > 1e-4 or d_cam > 1e-3 or d_pool > 1e-3:
        sys.exit('CXR verification failed')

    pack = {
        'schema': 'oncotics-model-pack/1', 'id': pid, 'task': 'cxr-classification',
        'notForUse': bool(offline),
        'card': {
            'name': 'TorchXRayVision DenseNet-121 (all datasets)', 'version': 'densenet121-res224-all · torchxrayvision ' + xrv.__version__,
            'source': 'TorchXRayVision (Cohen et al.)', 'link': 'https://github.com/mlmed/torchxrayvision', 'license': 'Apache-2.0',
            'paper': 'https://arxiv.org/abs/2002.02497',
            'trainingData': meta.get('description', ''),
            'intendedUse': 'Research and education: scores frontal chest X-rays for 18 radiographic findings, including Mass, Nodule and Lung Lesion, and shows class-activation maps of the image regions that drove each score. It does not diagnose cancer.',
            'validationStatus': 'Research model evaluated by its authors on public datasets; not clinically validated or cleared.',
            'modality': ['Chest X-ray (frontal PA/AP)'], 'imageTypes': ['DICOM (CR/DX)', 'PNG', 'JPEG'],
            'limitations': ['Frontal chest X-rays only; other views or body parts give meaningless scores', 'Image is centre-cropped to a square and resized to 224 × 224', 'Dataset labels were mined from reports and are noisy', 'Activation maps are coarse (7 × 7) and are not lesion outlines'],
            'failureModes': ['Distribution shift between hospitals, devices and populations', 'Support devices, text and markers can influence scores', 'Small nodules are often missed at 224 px'],
            'calibrated': False,
            'confidenceMeaning': "Score normalised so that 0.5 is the authors' operating point for each finding (above 0.5 = above that point). It is not a probability of cancer.",
            'regulatoryStatus': 'None (research model)', 'lastVerified': TODAY
        },
        'input': {'name': 'image', 'channels': 1, 'width': 224, 'height': 224, 'centerCrop': True, 'scale': 2048.0 / 255.0, 'offset': -1024.0,
                  'note': 'gray value v in 0..255 -> (2*(v/255)-1)*1024, as xrv.utils.normalize(img, 255)'},
        'output': {'logits': 'logits', 'cam': 'cam', 'activation': 'sigmoid', 'operatingPointNorm': True},
        'labels': labels, 'opThresholds': [None if (t is None or np.isnan(t)) else float(t) for t in op],
        'focusLabels': ['Mass', 'Nodule', 'Lung Lesion'],
        'verification': {'maxAbsDiffProb': d_prob, 'maxAbsDiffCam': d_cam, 'samples': int(xs.shape[0]), 'reference': 'torchxrayvision DenseNet.forward (sigmoid + op_norm)'},
        'sourceWeights': meta.get('weights_url')
    }
    write_pack(folder, pack, onnx_path)
    # Licence of the code/weights distribution
    try:
        import importlib.metadata as md
        dist = md.distribution('torchxrayvision')
        lic = [f for f in (dist.files or []) if 'LICENSE' in str(f).upper()]
        if lic:
            shutil.copy(dist.locate_file(lic[0]), os.path.join(folder, 'LICENSE-torchxrayvision.txt'))
    except Exception as e:  # licence copy is best effort; the card states the licence
        print('[cxr] licence file not copied:', e)


# ---------------------------------------------------------------- pathology (MONAI model zoo)
def find_targets(node, name, acc=None):
    acc = [] if acc is None else acc
    if isinstance(node, dict):
        if str(node.get('_target_', '')).split('.')[-1] == name:
            acc.append(node)
        for v in node.values():
            find_targets(v, name, acc)
    elif isinstance(node, list):
        for v in node:
            find_targets(v, name, acc)
    return acc


def get_bundle(name, work, offline, zoo=None):
    if offline and zoo and os.path.isdir(os.path.join(zoo, name, 'configs')):
        # pipeline test with the real bundle configs (e.g. a git checkout of Project-MONAI/model-zoo/models) and untrained weights
        b = os.path.join(work, name); shutil.copytree(os.path.join(zoo, name), b); os.makedirs(os.path.join(b, 'models'), exist_ok=True)
        return b, None
    if offline:
        b = os.path.join(work, name); os.makedirs(os.path.join(b, 'configs'), exist_ok=True); os.makedirs(os.path.join(b, 'models'), exist_ok=True)
        cfg = {'network_def': {'_target_': 'TorchVisionFCModel', 'model_name': 'resnet18', 'num_classes': 1, 'use_conv': True, 'pretrained': False},
               'preprocessing': {'_target_': 'Compose', 'transforms': [{'_target_': 'ScaleIntensityRanged', 'keys': 'image', 'a_min': 0.0, 'a_max': 255.0, 'b_min': -1.0, 'b_max': 1.0}]},
               'postprocessing': {'_target_': 'Compose', 'transforms': [{'_target_': 'Activationsd', 'keys': 'pred', 'sigmoid': True}]}}
        json.dump(cfg, open(os.path.join(b, 'configs', 'inference.json'), 'w'))
        json.dump({'version': 'offline-test', 'description': 'OFFLINE TEST BUNDLE (random weights)', 'network_data_format': {'inputs': {'image': {'num_channels': 3, 'spatial_shape': [224, 224]}}}}, open(os.path.join(b, 'configs', 'metadata.json'), 'w'))
        return b, None
    from monai.bundle import download
    last = None
    for source in ('monaihosting', 'github', 'huggingface_hub'):
        try:
            kw = {'name': name, 'bundle_dir': work, 'source': source}
            if source == 'huggingface_hub':
                kw['repo'] = 'MONAI/' + name
            download(**kw)
            b = os.path.join(work, name)
            if os.path.isdir(b):
                print('[bundle] %s downloaded from %s' % (name, source)); return b, source
        except Exception as e:
            last = e; print('[bundle] %s from %s failed: %s' % (name, source, e))
    sys.exit('Could not download MONAI bundle %s: %s' % (name, last))


def build_pathology(out, offline):
    from monai.bundle import ConfigParser
    pid = 'path-camelyon16-resnet18'
    folder = os.path.join(out, pid); os.makedirs(folder, exist_ok=True)
    work = tempfile.mkdtemp()
    bdir, source = get_bundle('pathology_tumor_detection', work, offline)
    cfg_path = os.path.join(bdir, 'configs', 'inference.json')
    meta_path = os.path.join(bdir, 'configs', 'metadata.json')
    cfg = json.load(open(cfg_path)); meta = json.load(open(meta_path))
    print('[path] bundle version:', meta.get('version'))
    print('[path] network_def:', json.dumps(cfg.get('network_def')))
    parser = ConfigParser(); parser.read_config(cfg_path); parser.read_meta(meta_path)
    net = parser.get_parsed_content('network_def')
    if not offline:
        wpath = os.path.join(bdir, 'models', 'model.pt')
        sd = torch.load(wpath, map_location='cpu')
        if isinstance(sd, dict) and 'model' in sd and not any(k.startswith('features') or k.startswith('fc') for k in sd):
            sd = sd['model']
        net.load_state_dict(sd)
    net.eval()

    # Pre/post-processing exactly as declared by the bundle (fail loudly if it is not what we implement).
    scales = find_targets(cfg, 'ScaleIntensityRanged') + find_targets(cfg, 'ScaleIntensityRange')
    norms = find_targets(cfg, 'NormalizeIntensityd') + find_targets(cfg, 'NormalizeIntensity')
    acts = find_targets(cfg, 'Activationsd') + find_targets(cfg, 'Activations')
    print('[path] intensity transforms:', json.dumps(scales + norms))
    print('[path] activation transforms:', json.dumps(acts))
    if len(scales) != 1 or norms:
        sys.exit('Unexpected pathology preprocessing in the bundle; update build_pathology to match: %s' % json.dumps(scales + norms))
    s = scales[0]
    a_min, a_max, b_min, b_max = (float(parser.get_parsed_content(k) if isinstance(s.get(k), str) and s.get(k).startswith('@') else s.get(k)) for k in ('a_min', 'a_max', 'b_min', 'b_max'))
    scale = (b_max - b_min) / (a_max - a_min); offset = b_min - a_min * scale
    sigmoid = any(a.get('sigmoid') in (True, 'true', 'True') for a in acts)
    if not sigmoid:
        sys.exit('Bundle postprocessing has no sigmoid; update build_pathology: %s' % json.dumps(acts))
    shape = (((meta.get('network_data_format') or {}).get('inputs') or {}).get('image') or {}).get('spatial_shape') or [224, 224]
    P = int(shape[0])

    class Export(nn.Module):
        def __init__(self, m):
            super().__init__(); self.m = m
        def forward(self, x):
            return self.m(x).reshape(x.shape[0], -1)[:, :1]     # [N,1] logit
    exp = Export(net).eval()
    onnx_path = os.path.join(folder, 'model.onnx')
    torch.onnx.export(exp, torch.zeros(1, 3, P, P), onnx_path, input_names=['patch'], output_names=['logit'],
                      dynamic_axes={'patch': {0: 'n'}, 'logit': {0: 'n'}}, opset_version=17)
    rng = np.random.default_rng(1)
    xs = (rng.uniform(0, 255, size=(4, 3, P, P)) * scale + offset).astype(np.float32)
    with torch.no_grad():
        ref = exp(torch.from_numpy(xs)).numpy()
    got = ort_session(onnx_path).run(None, {'patch': xs})[0]
    d = float(np.max(np.abs(got - ref)))
    print('[path] max |logit(onnx) - logit(torch)| = %.2e' % d)
    if d > 1e-3:
        sys.exit('Pathology verification failed')

    pack = {
        'schema': 'oncotics-model-pack/1', 'id': pid, 'task': 'pathology-patch',
        'notForUse': bool(offline),
        'card': {
            'name': 'MONAI pathology tumour detection (ResNet-18)', 'version': 'pathology_tumor_detection ' + str(meta.get('version')),
            'source': 'MONAI Model Zoo (Project MONAI)', 'link': 'https://github.com/Project-MONAI/model-zoo/tree/dev/models/pathology_tumor_detection',
            'license': str(meta.get('license') or 'Apache-2.0 (see LICENSE in this pack)'),
            'trainingData': str(meta.get('data_source') or 'Camelyon16 challenge (H&E whole-slide images of sentinel lymph nodes, breast cancer metastases)'),
            'intendedUse': 'Research and education: scores %d × %d px patches of H&E-stained lymph-node tissue for metastatic tumour and shows a tumour-probability heatmap. It does not diagnose cancer.' % (P, P),
            'validationStatus': 'Research model from the MONAI Model Zoo; not clinically validated or cleared.',
            'modality': ['Digital pathology, H&E (lymph node)'], 'imageTypes': ['PNG', 'JPEG', 'TIFF tile (RGB)'],
            'limitations': ['Trained on lymph-node sections at the highest magnification of Camelyon16 slides; other tissues, stains or magnifications give unreliable scores', 'Works on image tiles you upload, not on whole-slide files', 'Patches are scored independently, without slide context'],
            'failureModes': ['Stain and scanner differences', 'Tissue folds, blur and ink', 'Isolated tumour cells and micrometastases'],
            'calibrated': False, 'confidenceMeaning': 'Model sigmoid output per patch (0–1). It is not a calibrated probability of cancer.',
            'regulatoryStatus': 'None (research model)', 'lastVerified': TODAY,
            'bundleDescription': str(meta.get('description') or '')
        },
        'input': {'name': 'patch', 'channels': 3, 'patch': P, 'layout': 'NCHW', 'scale': scale, 'offset': offset,
                  'note': 'RGB value v in 0..255 -> v*scale + offset (bundle ScaleIntensityRanged a_min=%g a_max=%g b_min=%g b_max=%g)' % (a_min, a_max, b_min, b_max)},
        'output': {'logit': 'logit', 'activation': 'sigmoid'},
        'labels': ['Tumour (metastasis)'],
        'verification': {'maxAbsDiffLogit': d, 'samples': int(xs.shape[0]), 'reference': 'bundle network_def + models/model.pt in PyTorch'},
        'sourceBundle': {'name': 'pathology_tumor_detection', 'version': meta.get('version'), 'downloadedFrom': source}
    }
    write_pack(folder, pack, onnx_path)
    for f in ('LICENSE', 'docs/README.md', 'docs/data_license.txt', 'configs/metadata.json'):
        p = os.path.join(bdir, f)
        if os.path.exists(p):
            shutil.copy(p, os.path.join(folder, f.replace('/', '-')))


# ---------------------------------------------------------------- shared helpers for the MONAI 3D bundles
def load_bundle_weights(net, bdir, offline, tag):
    if offline:
        return
    sd = torch.load(os.path.join(bdir, 'models', 'model.pt'), map_location='cpu')
    if isinstance(sd, dict) and 'model' in sd and isinstance(sd['model'], dict):
        sd = sd['model']                                   # CheckpointLoader(load_dict={"model": network})
    net.load_state_dict(sd, strict=True)
    print('[%s] weights loaded (%d tensors)' % (tag, len(sd)))


def tval(parser, node, key, default=None):
    v = node.get(key, default)
    if isinstance(v, str) and v.startswith('@'):
        return parser.get_parsed_content(v[1:])
    return v


def copy_bundle_docs(bdir, folder):
    for f in ('LICENSE', 'docs/README.md', 'docs/data_license.txt', 'configs/metadata.json', 'configs/inference.json'):
        p = os.path.join(bdir, f)
        if os.path.exists(p):
            shutil.copy(p, os.path.join(folder, f.replace('/', '-')))


# ---------------------------------------------------------------- brain MRI tumour segmentation (MONAI model zoo)
BRAIN_BROWSER_ROI = [128, 128, 128]


def synthetic_brain(shape, seed):
    """Zero background + ellipsoid 'brain' + a bright lesion: exercises nonzero normalisation, padding and windows."""
    rng = np.random.default_rng(seed)
    X, Y, Z = np.meshgrid(*[np.linspace(-1, 1, n) for n in shape], indexing='ij')
    brain = (X / 0.85) ** 2 + (Y / 0.9) ** 2 + (Z / 0.8) ** 2 < 1
    les = ((X - 0.25) / 0.22) ** 2 + ((Y + 0.1) / 0.2) ** 2 + ((Z - 0.1) / 0.25) ** 2 < 1
    ring = les & ~(((X - 0.25) / 0.14) ** 2 + ((Y + 0.1) / 0.12) ** 2 + ((Z - 0.1) / 0.16) ** 2 < 1)
    edema = ((X - 0.25) / 0.35) ** 2 + ((Y + 0.1) / 0.33) ** 2 + ((Z - 0.1) / 0.38) ** 2 < 1
    img = np.zeros((4,) + tuple(shape), np.float32)
    base = [400, 500, 600, 450]
    for c in range(4):
        img[c][brain] = base[c] + rng.normal(0, 40, int(brain.sum()))
    img[0][ring & brain] += 700                                 # T1c enhancing rim
    img[2][edema & brain] += 500                                # T2 bright
    img[3][edema & brain] += 600                                # FLAIR bright
    img[1][les & brain] -= 150                                  # T1 hypointense
    return np.clip(img, 0, None) * brain[None]


def build_brain(out, offline, zoo):
    from monai.bundle import ConfigParser
    from monai.inferers import sliding_window_inference
    from monai.transforms import NormalizeIntensity
    import pipeline3d as P3
    pid = 'brain-mri-brats-segresnet'
    folder = os.path.join(out, pid); os.makedirs(folder, exist_ok=True)
    work = tempfile.mkdtemp()
    bdir, source = get_bundle('brats_mri_segmentation', work, offline, zoo)
    cfg_path = os.path.join(bdir, 'configs', 'inference.json'); meta_path = os.path.join(bdir, 'configs', 'metadata.json')
    cfg = json.load(open(cfg_path)); meta = json.load(open(meta_path))
    print('[brain] bundle version:', meta.get('version'))
    print('[brain] network_def:', json.dumps(cfg.get('network_def')))
    print('[brain] preprocessing:', json.dumps(cfg.get('preprocessing')))
    print('[brain] inferer:', json.dumps(cfg.get('inferer')))
    print('[brain] postprocessing:', json.dumps(cfg.get('postprocessing')))
    parser = ConfigParser(); parser.read_config(cfg_path); parser.read_meta(meta_path)

    # The browser implements exactly: LoadImage (voxel order as stored) -> NormalizeIntensity(nonzero, channel_wise)
    # -> sliding window -> sigmoid -> threshold. Anything else in the bundle stops the build.
    tr = [t.get('_target_', '').split('.')[-1] for t in cfg['preprocessing']['transforms']]
    if tr != ['LoadImaged', 'NormalizeIntensityd']:
        sys.exit('Unexpected brain preprocessing %s; update build_brain and 47-ai-3d.js' % tr)
    ni = cfg['preprocessing']['transforms'][1]
    if not (tval(parser, ni, 'nonzero') is True and tval(parser, ni, 'channel_wise') is True):
        sys.exit('Brain NormalizeIntensityd is not nonzero+channel_wise: %s' % json.dumps(ni))
    inf = cfg['inferer']
    if inf.get('_target_', '').split('.')[-1] != 'SlidingWindowInferer' or inf.get('mode', 'constant') != 'constant':
        sys.exit('Unexpected brain inferer %s' % json.dumps(inf))
    bundle_roi = [int(v) for v in tval(parser, inf, 'roi_size')]
    overlap = float(tval(parser, inf, 'overlap', 0.25))
    acts = find_targets(cfg['postprocessing'], 'Activationsd'); disc = find_targets(cfg['postprocessing'], 'AsDiscreted')
    if not (acts and acts[0].get('sigmoid') is True and disc and float(disc[0].get('threshold')) == 0.5):
        sys.exit('Unexpected brain postprocessing: %s' % json.dumps(cfg['postprocessing']))
    spatial_post = [t for t in ('Orientationd', 'Spacingd', 'Resized', 'CropForegroundd') if find_targets(cfg, t)]
    if spatial_post:
        sys.exit('Brain bundle has spatial transforms %s; the browser pipeline does not implement them' % spatial_post)
    nd = meta.get('network_data_format') or {}
    in_def = ((nd.get('inputs') or {}).get('image') or {}).get('channel_def') or {}
    out_def = ((nd.get('outputs') or {}).get('pred') or {}).get('channel_def') or {}
    channels = [in_def[str(i)] for i in range(len(in_def))]
    labels = [out_def[str(i)] for i in range(len(out_def))]
    print('[brain] input channels:', channels, ' output labels:', labels, ' bundle roi:', bundle_roi, ' overlap:', overlap)
    if len(channels) != 4 or len(labels) != 3:
        sys.exit('Unexpected brain channel definitions')

    net = parser.get_parsed_content('network_def')
    load_bundle_weights(net, bdir, offline, 'brain')
    net.eval()
    onnx_path = os.path.join(folder, 'model.onnx')
    torch.onnx.export(net, torch.zeros(1, 4, 96, 96, 96), onnx_path, input_names=['image'], output_names=['logits'],
                      dynamic_axes={'image': {0: 'n', 2: 'x', 3: 'y', 4: 'z'}, 'logits': {0: 'n', 2: 'x', 3: 'y', 4: 'z'}}, opset_version=17)
    sess = ort_session(onnx_path)

    # 1. ONNX network == PyTorch network (two window sizes)
    rng = np.random.default_rng(2); d_net = 0.0
    for shp in ([1, 4, 96, 96, 96], [1, 4] + BRAIN_BROWSER_ROI):
        xs = rng.normal(0, 1, size=shp).astype(np.float32)
        with torch.no_grad():
            ref = net(torch.from_numpy(xs)).numpy()
        got = sess.run(None, {'image': xs})[0]
        d_net = max(d_net, float(np.max(np.abs(got - ref))))
    print('[brain] max |logits(onnx) - logits(torch)| = %.2e' % d_net)
    if d_net > 2e-3:
        sys.exit('Brain network verification failed')

    # 2. Browser pipeline (pipeline3d + ONNX) == MONAI NormalizeIntensity + sliding_window_inference + sigmoid
    vol = synthetic_brain((150, 140, 100), 3)
    with torch.no_grad():
        x_t = NormalizeIntensity(nonzero=True, channel_wise=True)(torch.from_numpy(vol.copy()))
        ref_logits = sliding_window_inference(x_t[None].float(), BRAIN_BROWSER_ROI, 1, net, overlap=overlap, mode='constant')[0].numpy()
    ref_prob = 1 / (1 + np.exp(-ref_logits))
    with torch.no_grad():
        algo = P3.sliding_window(P3.normalize_nonzero_channelwise(vol), BRAIN_BROWSER_ROI, overlap, lambda w: net(torch.from_numpy(w)).numpy())
    d_algo = float(np.max(np.abs(algo - ref_logits)))         # same network: the pipeline code alone
    prob, masks = P3.brain_pipeline(vol, BRAIN_BROWSER_ROI, overlap, lambda w: sess.run(None, {'image': w})[0])
    d_norm = float(np.max(np.abs(P3.normalize_nonzero_channelwise(vol) - np.asarray(x_t))))
    d_prob = float(np.max(np.abs(prob - ref_prob)))
    flips = int(np.sum(masks != (ref_prob > 0.5)))
    clear_flips = int(np.sum((masks != (ref_prob > 0.5)) & (np.abs(ref_logits) > 0.05)))   # not at the 0.5 boundary
    print('[brain] pipeline: |norm| = %.2e  |logits, same network| = %.2e  |prob, onnx| = %.2e  mask voxels differing = %d of %d (%d away from the threshold)' % (d_norm, d_algo, d_prob, flips, masks.size, clear_flips))
    if d_norm > 1e-4 or d_algo > 1e-4 or d_prob > 1e-2 or clear_flips:
        sys.exit('Brain pipeline verification failed')

    # 3. Informational: browser window (128^3) vs the bundle's own window on the same synthetic volume
    with torch.no_grad():
        big = sliding_window_inference(x_t[None].float(), bundle_roi, 1, net, overlap=overlap, mode='constant')[0].numpy() > 0
    small = ref_logits > 0
    dice = [float(2 * np.sum(big[c] & small[c]) / max(1, np.sum(big[c]) + np.sum(small[c]))) if (big[c].any() or small[c].any()) else 1.0 for c in range(3)]
    print('[brain] Dice(browser window, bundle window) on the synthetic volume:', dice)

    pack = {
        'schema': 'oncotics-model-pack/1', 'id': pid, 'task': 'brain-mri-seg-3d', 'notForUse': bool(offline),
        'card': {
            'name': 'MONAI BraTS brain tumour segmentation (SegResNet, 3D)', 'version': 'brats_mri_segmentation ' + str(meta.get('version')),
            'source': 'MONAI Model Zoo (Project MONAI)', 'link': 'https://github.com/Project-MONAI/model-zoo/tree/dev/models/brats_mri_segmentation',
            'license': str(meta.get('license') or 'Apache-2.0 (see LICENSE in this pack)'),
            'paper': 'https://arxiv.org/abs/1810.11654',
            'trainingData': str(meta.get('data_source') or 'BraTS 2018 challenge'),
            'intendedUse': 'Research and education: segments the three nested BraTS glioma sub-regions (tumour core, whole tumour, enhancing tumour) on four co-registered, skull-stripped 3D brain MRI volumes (T1 post-contrast, T1, T2, FLAIR) and reports their volumes. It does not diagnose cancer.',
            'validationStatus': 'Research model from the MONAI Model Zoo, evaluated by its authors on a held-out BraTS 2018 split; not clinically validated or cleared.',
            'modality': ['Brain MRI: T1c, T1, T2, FLAIR (all four required)'], 'imageTypes': ['NIfTI (.nii / .nii.gz), e.g. BraTS files', 'DICOM series on the same voxel grid'],
            'limitations': ['Needs all four sequences co-registered to the same voxel grid, skull-stripped and at about 1 mm isotropic, as in BraTS. Raw scanner series give unreliable output', 'Trained on adult gliomas (BraTS 2018); metastases, paediatric and post-surgical brains are out of scope', 'The browser runs 128 mm windows; the bundle uses 240 × 240 × 160 windows, so borders between windows can differ slightly'],
            'failureModes': ['Mis-registration between sequences', 'Residual skull or scalp', 'Motion and intensity artefacts', 'Small or non-enhancing lesions'],
            'calibrated': False, 'confidenceMeaning': 'Mean sigmoid output inside each region. It is not a calibrated probability of cancer.',
            'regulatoryStatus': 'None (research model)', 'lastVerified': TODAY, 'bundleDescription': str(meta.get('description') or '')
        },
        'input': {'name': 'image', 'channels': channels, 'channelOrder': 'as in the bundle metadata (network_data_format.inputs.image.channel_def)',
                  'normalize': {'nonzero': True, 'channelWise': True}, 'voxelOrder': 'as stored in the file (no reorientation, as the bundle LoadImaged)',
                  'expectedSpacingMm': [1, 1, 1], 'divisibleBy': 8},
        'inferer': {'roi': BRAIN_BROWSER_ROI, 'overlap': overlap, 'mode': 'constant', 'bundleRoi': bundle_roi},
        'output': {'name': 'logits', 'activation': 'sigmoid', 'threshold': 0.5},
        'labels': labels,
        'labelNotes': {'Tumor core': 'TC: enhancing tumour + necrotic and non-enhancing core', 'Whole tumor': 'WT: tumour core + peritumoural oedema', 'Enhancing tumor': 'ET: enhancing tumour'},
        'verification': {'maxAbsDiffLogits': d_net, 'pipelineMaxAbsDiffLogitsSameNetwork': d_algo, 'pipelineMaxAbsDiffProb': d_prob, 'pipelineMaskVoxelsDiffering': flips, 'pipelineMaskVoxels': int(masks.size),
                         'reference': 'bundle network_def + models/model.pt in PyTorch; MONAI NormalizeIntensity + sliding_window_inference',
                         'diceBrowserVsBundleWindowSynthetic': dice},
        'sourceBundle': {'name': 'brats_mri_segmentation', 'version': meta.get('version'), 'downloadedFrom': source}
    }
    write_pack(folder, pack, onnx_path)
    copy_bundle_docs(bdir, folder)


# ---------------------------------------------------------------- lung CT nodule detection (MONAI model zoo)
LUNG_TILE = [192, 192, 96]       # browser window; starts are multiples of the coarsest stride (16, 16, 8)
LUNG_OVERLAP = 0.25


def synthetic_ct(shape, seed):
    """Air/body/lungs with a few spheres, in HU."""
    rng = np.random.default_rng(seed)
    X, Y, Z = np.meshgrid(*[np.arange(n) for n in shape], indexing='ij')
    cx, cy = shape[0] / 2, shape[1] / 2
    v = np.full(shape, -1000.0, np.float32)
    body = ((X - cx) / (0.47 * shape[0])) ** 2 + ((Y - cy) / (0.47 * shape[1])) ** 2 < 1   # body fills the field (< 10 mm of air at the sides)
    v[body] = 40
    for sx in (-1, 1):
        lung = ((X - cx - sx * 0.2 * shape[0]) / (0.16 * shape[0])) ** 2 + ((Y - cy) / (0.28 * shape[1])) ** 2 < 1
        v[lung] = -850
    for (px, py, pz, r) in [(0.33, 0.45, 0.5, 8), (0.66, 0.55, 0.4, 6), (0.3, 0.6, 0.7, 5)]:
        s = ((X - px * shape[0]) ** 2 + (Y - py * shape[1]) ** 2 + ((Z - pz * shape[2]) * 1.8) ** 2) < r * r
        v[s] = 30
    return v + rng.normal(0, 15, shape).astype(np.float32)


def build_lung(out, offline, zoo):
    from monai.bundle import ConfigParser
    from monai.inferers import SlidingWindowInferer
    from monai.apps.detection.utils.predict_utils import predict_with_inferer
    import pipeline3d as P3
    pid = 'lung-ct-luna16-retinanet'
    folder = os.path.join(out, pid); os.makedirs(folder, exist_ok=True)
    work = tempfile.mkdtemp()
    bdir, source = get_bundle('lung_nodule_ct_detection', work, offline, zoo)
    cfg_path = os.path.join(bdir, 'configs', 'inference.json'); meta_path = os.path.join(bdir, 'configs', 'metadata.json')
    cfg = json.load(open(cfg_path)); meta = json.load(open(meta_path))
    print('[lung] bundle version:', meta.get('version'))
    for k in ('network_def', 'backbone', 'feature_extractor', 'anchor_generator', 'detector_ops', 'preprocessing', 'size_divisible', 'infer_patch_size'):
        print('[lung] %s: %s' % (k, json.dumps(cfg.get(k))))
    sys.path.insert(0, bdir)                                   # the bundle's own scripts/ (detector inferer)
    parser = ConfigParser(); parser.read_config(cfg_path); parser.read_meta(meta_path)

    # Preprocessing the browser implements: Orientation RAS -> Spacing (trilinear) -> ScaleIntensityRange (clip)
    ori = find_targets(cfg['preprocessing'], 'Orientationd'); spc = find_targets(cfg['preprocessing'], 'Spacingd'); sca = find_targets(cfg['preprocessing'], 'ScaleIntensityRanged')
    if len(ori) != 1 or ori[0].get('axcodes') != 'RAS' or len(spc) != 1 or len(sca) != 1:
        sys.exit('Unexpected lung preprocessing; update build_lung and 47-ai-3d.js: %s' % json.dumps(cfg['preprocessing']))
    pixdim = [float(v) for v in tval(parser, spc[0], 'pixdim')]
    if spc[0].get('mode', 'bilinear') != 'bilinear':
        sys.exit('Lung Spacingd mode is not bilinear')
    a_min, a_max, b_min, b_max = (float(tval(parser, sca[0], k)) for k in ('a_min', 'a_max', 'b_min', 'b_max'))
    clip = tval(parser, sca[0], 'clip', False) is True
    others = [t for t in ('NormalizeIntensityd', 'CropForegroundd', 'Resized') if find_targets(cfg['preprocessing'], t)]
    if others:
        sys.exit('Lung preprocessing has %s; not implemented in the browser' % others)

    detector = parser.get_parsed_content('detector')
    parser.get_parsed_content('detector_ops')                  # sets box selector + sliding-window parameters on the detector
    net = detector.network
    load_bundle_weights(net, bdir, offline, 'lung')
    net.eval(); detector.eval()
    ag = detector.anchor_generator
    cells = [c.detach().cpu().numpy().astype(float).tolist() for c in ag.cell_anchors]
    A = int(detector.num_anchors_per_loc)
    sel = detector.box_selector
    sd = [int(v) for v in detector.size_divisible]
    params = {'scoreThresh': float(sel.score_thresh), 'topkPerLevel': int(sel.topk_candidates_per_level), 'nmsThresh': float(sel.nms_thresh), 'detectionsPerImage': int(sel.detections_per_img)}
    weights = [float(w) for w in detector.box_coder.weights]; xclip = float(detector.box_coder.boxes_xform_clip)
    bundle_roi = [int(v) for v in detector.inferer.roi_size]; bundle_overlap = float(detector.inferer.overlap)
    print('[lung] pixdim', pixdim, 'intensity', (a_min, a_max, b_min, b_max, clip), 'anchors/loc', A, 'size_divisible', sd, 'selector', params, 'coder', weights, xclip, 'bundle roi', bundle_roi, bundle_overlap)
    if int(detector.num_classes) != 1 or not sel.apply_sigmoid:
        sys.exit('Lung detector is not single-class sigmoid')
    if any(LUNG_TILE[i] % sd[i] or int(LUNG_TILE[i] * (1 - LUNG_OVERLAP)) % sd[i] for i in range(3)):
        sys.exit('LUNG_TILE/LUNG_OVERLAP are not aligned to size_divisible %s' % sd)

    class Export(nn.Module):
        def __init__(self, m):
            super().__init__(); self.m = m
        def forward(self, x):
            o = self.m(x)
            return tuple(o[self.m.cls_key]) + tuple(o[self.m.box_reg_key])
    exp = Export(net).eval()
    with torch.no_grad():
        nlev = len(exp(torch.zeros(1, 1, 64, 64, 32))) // 2
    names = ['cls%d' % i for i in range(nlev)] + ['box%d' % i for i in range(nlev)]
    onnx_path = os.path.join(folder, 'model.onnx')
    dyn = {'image': {0: 'n', 2: 'x', 3: 'y', 4: 'z'}}
    for n in names:
        dyn[n] = {0: 'n', 2: 'x', 3: 'y', 4: 'z'}
    torch.onnx.export(exp, torch.zeros(1, 1, 128, 128, 64), onnx_path, input_names=['image'], output_names=names, dynamic_axes=dyn, opset_version=17)
    sess = ort_session(onnx_path)
    run_onnx = lambda w: sess.run(None, {'image': w})

    # 1. ONNX heads == PyTorch heads on a browser window
    vol = synthetic_ct((288, 256, 176), 4)
    scaled = (np.clip(vol, a_min, a_max) if clip else vol) - a_min
    scaled = (scaled / (a_max - a_min) * (b_max - b_min) + b_min).astype(np.float32)
    win = np.ascontiguousarray(scaled[None, None, :LUNG_TILE[0], :LUNG_TILE[1], :LUNG_TILE[2]])
    with torch.no_grad():
        ref = [t.numpy() for t in exp(torch.from_numpy(win))]
    got = run_onnx(win)
    d_heads = max(float(np.max(np.abs(a - b))) for a, b in zip(got, ref))
    # relative to each output's own range: trained heads reach magnitudes of 10+, where float32
    # differences between ONNX Runtime and PyTorch grow with the 50-layer depth of the backbone
    rel = [float(np.max(np.abs(a - b)) / max(1.0, float(np.max(np.abs(b))))) for a, b in zip(got, ref)]
    for n_, a, b, r in zip(names, got, ref, rel):
        print('[lung]   %s: max|torch| = %.2f  max|diff| = %.2e  relative = %.2e' % (n_, float(np.max(np.abs(b))), float(np.max(np.abs(a - b))), r))
    print('[lung] max |heads(onnx) - heads(torch)| = %.2e (relative %.2e)' % (d_heads, max(rel)))
    if max(rel) > 1e-3:
        sys.exit('Lung network verification failed')

    def compare(tag, img, use_inferer, sthresh):
        """Browser pipeline (pipeline3d + ONNX) vs the MONAI RetinaNetDetector on the same scaled volume."""
        detector.set_box_selector_parameters(score_thresh=sthresh, topk_candidates_per_level=params['topkPerLevel'], nms_thresh=params['nmsThresh'], detections_per_img=params['detectionsPerImage'])
        if use_inferer:
            detector.inferer = SlidingWindowInferer(roi_size=LUNG_TILE, overlap=LUNG_OVERLAP, sw_batch_size=1, mode='constant')
        with torch.no_grad():
            det = detector([torch.from_numpy(img[None].copy())], use_inferer=use_inferer)[0]
        rb, rs = det[detector.target_box_key].numpy(), det[detector.pred_score_key].numpy()
        psize, cm, bm = P3.lung_heads(img, sd, LUNG_TILE if use_inferer else divisible_full(img.shape, sd), LUNG_OVERLAP, run_onnx, nlev)
        gb, gs = P3.lung_detect(psize, cm, bm, list(img.shape), cells, A, weights, xclip, sthresh, params['topkPerLevel'], params['nmsThresh'], params['detectionsPerImage'])
        n = min(len(rb), len(gb), 50)
        o1, o2 = np.argsort(-rs, kind='stable')[:n], np.argsort(-gs, kind='stable')[:n]
        db = float(np.max(np.abs(rb[o1] - gb[o2]))) if n else 0.0
        ds = float(np.max(np.abs(rs[o1] - gs[o2]))) if n else 0.0
        print('[lung] %s: MONAI %d boxes, browser pipeline %d boxes; top-%d |box| = %.2e voxel, |score| = %.2e' % (tag, len(rb), len(gb), n, db, ds))
        if abs(len(rb) - len(gb)) > max(2, 0.02 * len(rb)) or db > 0.25 or ds > 5e-3:
            sys.exit('Lung pipeline verification failed (%s)' % tag)
        return {'monaiBoxes': int(len(rb)), 'browserBoxes': int(len(gb)), 'maxAbsDiffBoxVoxel': db, 'maxAbsDiffScore': ds}

    def divisible_full(shape, k):
        return P3.divisible(list(shape), k)

    # 2. single window (MONAI detector forward without sliding window) and 3. tiled (MONAI SlidingWindowInferer)
    one = scaled[:176, :160, :80]
    v_single = compare('single window', one, False, 0.001)
    v_tiled = compare('tiled %s overlap %.2f' % (LUNG_TILE, LUNG_OVERLAP), scaled, True, 0.001)
    v_bundle = compare('single window, bundle score threshold', one, False, params['scoreThresh'])
    detector.set_box_selector_parameters(score_thresh=params['scoreThresh'], topk_candidates_per_level=params['topkPerLevel'], nms_thresh=params['nmsThresh'], detections_per_img=params['detectionsPerImage'])

    pack = {
        'schema': 'oncotics-model-pack/1', 'id': pid, 'task': 'lung-ct-detection-3d', 'notForUse': bool(offline),
        'card': {
            'name': 'MONAI lung nodule detection (RetinaNet, 3D CT)', 'version': 'lung_nodule_ct_detection ' + str(meta.get('version')),
            'source': 'MONAI Model Zoo (Project MONAI)', 'link': 'https://github.com/Project-MONAI/model-zoo/tree/dev/models/lung_nodule_ct_detection',
            'license': str(meta.get('license') or 'Apache-2.0 (see LICENSE in this pack)'),
            'paper': 'https://arxiv.org/abs/1708.02002',
            'trainingData': str(meta.get('data_source') or 'LUNA16 (LIDC-IDRI subset)'),
            'intendedUse': 'Research and education: detects candidate lung nodules as 3D boxes on chest CT and reports their size and position. It does not say whether a nodule is benign or malignant and does not diagnose cancer.',
            'validationStatus': 'Research model from the MONAI Model Zoo, evaluated by its authors on LUNA16 (fold 0); not clinically validated or cleared.',
            'modality': ['Chest CT (axial series, Hounsfield units)'], 'imageTypes': ['DICOM CT series', 'NIfTI (.nii / .nii.gz)'],
            'limitations': ['Detects nodules; it does not grade malignancy', 'Trained on LUNA16 (nodules of 3 mm or more agreed by radiologists); other populations, scanners and reconstruction kernels shift performance', 'The browser resamples the scan to %s mm and runs %s-voxel windows; very large regions take many minutes' % (pixdim, LUNG_TILE), 'Boxes are axis-aligned and approximate'],
            'failureModes': ['Vessels seen end-on', 'Scarring, atelectasis and pleural plaques', 'Ground-glass and juxta-pleural nodules', 'Motion and streak artefacts'],
            'calibrated': False, 'confidenceMeaning': 'Detector classification score (sigmoid). It is not a calibrated probability that a nodule is present or malignant.',
            'regulatoryStatus': 'None (research model)', 'lastVerified': TODAY, 'bundleDescription': str(meta.get('description') or '')
        },
        'input': {'name': 'image', 'orientation': 'RAS', 'pixdimMm': pixdim, 'resample': 'trilinear, voxel 0 aligned (MONAI Spacing)',
                  'intensity': {'aMin': a_min, 'aMax': a_max, 'bMin': b_min, 'bMax': b_max, 'clip': clip}, 'sizeDivisible': sd, 'pad': 'zeros at the end'},
        'inferer': {'tile': LUNG_TILE, 'overlap': LUNG_OVERLAP, 'merge': 'average of overlapping head maps (constant mode)', 'bundleRoi': bundle_roi, 'bundleOverlap': bundle_overlap},
        'output': {'cls': names[:nlev], 'box': names[nlev:], 'anchorsPerLocation': A, 'numClasses': 1, 'activation': 'sigmoid'},
        'anchors': {'cellAnchors': cells, 'featureMapScales': [float(v) for v in tval(parser, cfg['anchor_generator'], 'feature_map_scales')], 'baseAnchorShapes': [[float(x) for x in v] for v in tval(parser, cfg['anchor_generator'], 'base_anchor_shapes')], 'order': 'location-major (x, y, z), then anchor', 'stride': 'padded image size // feature map size'},
        'boxCoder': {'weights': weights, 'clip': xclip},
        'selector': params,
        'labels': ['Lung nodule candidate'],
        'verification': {'maxAbsDiffHeads': d_heads, 'maxRelDiffHeads': max(rel), 'singleWindow': v_single, 'tiled': v_tiled, 'bundleThreshold': v_bundle,
                         'reference': 'bundle network_def + models/model.pt in PyTorch; MONAI RetinaNetDetector (forward and SlidingWindowInferer)'},
        'sourceBundle': {'name': 'lung_nodule_ct_detection', 'version': meta.get('version'), 'downloadedFrom': source}
    }
    write_pack(folder, pack, onnx_path)
    copy_bundle_docs(bdir, folder)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--only', choices=['cxr', 'pathology', 'brain', 'lung'])
    ap.add_argument('--zoo', help='offline tests: a Project-MONAI/model-zoo/models checkout for the real bundle configs')
    ap.add_argument('--offline-random', action='store_true', help='pipeline test with untrained weights (packs marked notForUse)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    torch.manual_seed(0)
    if a.only in (None, 'cxr'):
        build_cxr(a.out, a.offline_random)
    if a.only in (None, 'pathology'):
        build_pathology(a.out, a.offline_random)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    if a.only in (None, 'brain'):
        build_brain(a.out, a.offline_random, a.zoo)
    if a.only in (None, 'lung'):
        build_lung(a.out, a.offline_random, a.zoo)
    print('[done] packs in', a.out)


if __name__ == '__main__':
    main()
