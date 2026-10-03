#!/usr/bin/env python3
"""
Synthetic 3D test volumes and MONAI reference results for the Workbench end-to-end test.

  python reference_3d.py data <out_dir>
      writes synthetic_t1ce/t1/t2/flair.nii.gz (brain, 1 mm, LPS-style affine) and
      synthetic_chest_ct.nii.gz (CT in HU at the lung bundle spacing, LPS-style affine)
  python reference_3d.py dicom <ct.nii.gz> <out_dir>   (the same CT as a shuffled DICOM series)
  python reference_3d.py brain <pack_dir> <t1c> <t1> <t2> <flair> <threshold>
  python reference_3d.py lung  <pack_dir> <ct.nii.gz> <score_thresh>

The references use MONAI's own LoadImaged / NormalizeIntensityd / Orientationd / Spacingd /
ScaleIntensityRanged, sliding_window_inference and RetinaNetDetector, with the pack's
model.onnx as the network (build_model_packs.py has already checked model.onnx against the
original PyTorch weights). The browser result must match these.
"""
import json, os, sys

import numpy as np
import torch
import torch.nn as nn

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def onnx_fn(pack_dir):
    import onnxruntime as ort
    s = ort.InferenceSession(os.path.join(pack_dir, 'model.onnx'), providers=['CPUExecutionProvider'])
    return s, (lambda x: [torch.from_numpy(o) for o in s.run(None, {s.get_inputs()[0].name: x.detach().cpu().numpy().astype(np.float32)})])


def make_data(out):
    import nibabel as nib
    from build_model_packs import synthetic_brain, synthetic_ct
    os.makedirs(out, exist_ok=True)
    b = synthetic_brain((160, 150, 110), 11)
    aff = np.diag([-1.0, -1.0, 1.0, 1.0]); aff[:3, 3] = [80, 75, -55]
    for c, n in enumerate(['t1ce', 't1', 't2', 'flair']):
        nib.save(nib.Nifti1Image(b[c].astype(np.int16), aff), os.path.join(out, 'synthetic_%s.nii.gz' % n))
    ct = synthetic_ct((224, 208, 96), 12)
    aff = np.diag([-0.703125, -0.703125, 1.25, 1.0]); aff[:3, 3] = [78, 73, -60]
    nib.save(nib.Nifti1Image(np.round(ct).astype(np.int16), aff), os.path.join(out, 'synthetic_chest_ct.nii.gz'))
    print('written to', out)


def make_dicom(nii, out):
    """The synthetic CT as an axial DICOM series (LPS), files in shuffled order, so that the Workbench must
    sort slices by ImagePositionPatient and orient them from ImageOrientationPatient."""
    import nibabel as nib
    import pydicom
    from pydicom.dataset import Dataset, FileMetaDataset
    from pydicom.uid import ExplicitVRLittleEndian, generate_uid, CTImageStorage
    img = nib.load(nii); a = img.affine; v = np.asarray(img.dataobj).astype(np.int16)
    # NIfTI voxel (i, j, k) -> RAS a @ [i, j, k, 1]; LPS = (-x, -y, z)
    lps = lambda p: np.array([-p[0], -p[1], p[2]])
    row = lps(a[:3, 0]); col = lps(a[:3, 1]); sx, sy = np.linalg.norm(row), np.linalg.norm(col)
    os.makedirs(out, exist_ok=True)
    study, series = generate_uid(), generate_uid()
    order = np.random.default_rng(5).permutation(v.shape[2])
    for n, k in enumerate(order):
        meta = FileMetaDataset(); meta.MediaStorageSOPClassUID = CTImageStorage; meta.MediaStorageSOPInstanceUID = generate_uid(); meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds = Dataset(); ds.file_meta = meta; ds.SOPClassUID = CTImageStorage; ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
        ds.Modality = 'CT'; ds.StudyInstanceUID = study; ds.SeriesInstanceUID = series; ds.SeriesNumber = 1; ds.InstanceNumber = int(n + 1)
        ds.ImagePositionPatient = [float(x) for x in lps(a @ np.array([0, 0, k, 1.0]))]
        ds.ImageOrientationPatient = [float(x) for x in np.concatenate([row / sx, col / sy])]
        ds.PixelSpacing = [float(sy), float(sx)]; ds.SliceThickness = float(np.linalg.norm(a[:3, 2]))
        ds.Rows, ds.Columns = v.shape[1], v.shape[0]
        ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = 'MONOCHROME2'; ds.BitsAllocated = 16; ds.BitsStored = 16; ds.HighBit = 15; ds.PixelRepresentation = 1
        ds.RescaleIntercept = 0; ds.RescaleSlope = 1
        ds.PixelData = np.ascontiguousarray(v[:, :, k].T).tobytes()          # rows = j, columns = i
        ds.save_as(os.path.join(out, 'slice%03d.dcm' % n), enforce_file_format=True)
    print('written', v.shape[2], 'slices to', out)


def ref_brain(pack_dir, files, thr):
    from monai.transforms import Compose, LoadImaged, NormalizeIntensityd
    from monai.inferers import sliding_window_inference
    P = json.load(open(os.path.join(pack_dir, 'pack.json')))
    d = Compose([LoadImaged(keys='image', image_only=False), NormalizeIntensityd(keys='image', nonzero=True, channel_wise=True)])({'image': files})
    x = d['image'].as_tensor()[None].float()
    _, fn = onnx_fn(pack_dir)
    with torch.no_grad():
        logits = sliding_window_inference(x, P['inferer']['roi'], 1, lambda w: fn(w)[0], overlap=P['inferer']['overlap'], mode='constant')[0].numpy()
    prob = 1 / (1 + np.exp(-logits))
    out = {}
    for c, lab in enumerate(P['labels']):
        m = prob[c] > thr
        # band: counts if every probability moved by +-0.002 (float32 differences between ONNX Runtime builds)
        out[lab] = {'voxels': int(m.sum()), 'meanScore': float(prob[c][m].mean()) if m.any() else None,
                    'band': [int((prob[c] > thr + 0.002).sum()), int((prob[c] > thr - 0.002).sum())]}
    print(json.dumps(out))


def ref_lung(pack_dir, path, sthresh):
    from monai.transforms import Compose, LoadImaged, EnsureChannelFirstd, Orientationd, Spacingd, ScaleIntensityRanged
    from monai.inferers import SlidingWindowInferer
    from monai.apps.detection.networks.retinanet_detector import RetinaNetDetector
    from monai.apps.detection.utils.anchor_utils import AnchorGeneratorWithAnchorShape
    P = json.load(open(os.path.join(pack_dir, 'pack.json')))
    I = P['input']; it = I['intensity']
    d = Compose([LoadImaged(keys='image'), EnsureChannelFirstd(keys='image'), Orientationd(keys='image', axcodes=I['orientation']),
                 Spacingd(keys='image', pixdim=I['pixdimMm']),
                 ScaleIntensityRanged(keys='image', a_min=it['aMin'], a_max=it['aMax'], b_min=it['bMin'], b_max=it['bMax'], clip=it['clip'])])({'image': path})
    img = d['image'].as_tensor().float()
    sess, fn = onnx_fn(pack_dir)
    nl = len(P['output']['cls'])

    class OnnxRetina(nn.Module):
        spatial_dims, num_classes, cls_key, box_reg_key = 3, 1, 'classification', 'box_regression'
        size_divisible = tuple(I['sizeDivisible'])
        def forward(self, x):
            o = fn(x)
            return {self.cls_key: o[:nl], self.box_reg_key: o[nl:]}

    A = P['anchors']
    ag = AnchorGeneratorWithAnchorShape(feature_map_scales=A['featureMapScales'], base_anchor_shapes=A['baseAnchorShapes'])
    if not np.allclose(np.asarray([c.numpy() for c in ag.cell_anchors]), np.asarray(A['cellAnchors'])):
        sys.exit('anchor generator does not reproduce the pack cell anchors')
    det = RetinaNetDetector(OnnxRetina(), ag, spatial_dims=3, num_classes=1, size_divisible=I['sizeDivisible']).eval()
    sel = P['selector']
    det.set_box_selector_parameters(score_thresh=sthresh, topk_candidates_per_level=sel['topkPerLevel'], nms_thresh=sel['nmsThresh'], detections_per_img=sel['detectionsPerImage'])
    det.set_sliding_window_inferer(roi_size=P['inferer']['tile'], overlap=P['inferer']['overlap'], sw_batch_size=1, mode='constant')
    size = list(img.shape[1:])
    use_inferer = any(s > t for s, t in zip(size, P['inferer']['tile']))
    with torch.no_grad():
        r = det([img], use_inferer=use_inferer)[0]
    boxes, scores = r[det.target_box_key].numpy(), r[det.pred_score_key].numpy()
    o = np.argsort(-scores, kind='stable')
    print(json.dumps({'size': size, 'windowed': use_inferer, 'boxes': boxes[o].round(3).tolist(), 'scores': scores[o].round(6).tolist()}))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'data':
        make_data(sys.argv[2])
    elif cmd == 'dicom':
        make_dicom(sys.argv[2], sys.argv[3])
    elif cmd == 'brain':
        ref_brain(sys.argv[2], sys.argv[3:7], float(sys.argv[7]))
    elif cmd == 'lung':
        ref_lung(sys.argv[2], sys.argv[3], float(sys.argv[4]))
