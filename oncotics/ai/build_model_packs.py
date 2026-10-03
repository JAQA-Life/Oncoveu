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


def get_bundle(name, work, offline):
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--only', choices=['cxr', 'pathology'])
    ap.add_argument('--offline-random', action='store_true', help='pipeline test with untrained weights (packs marked notForUse)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    torch.manual_seed(0)
    if a.only in (None, 'cxr'):
        build_cxr(a.out, a.offline_random)
    if a.only in (None, 'pathology'):
        build_pathology(a.out, a.offline_random)
    print('[done] packs in', a.out)


if __name__ == '__main__':
    main()
