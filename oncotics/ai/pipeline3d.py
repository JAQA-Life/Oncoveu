"""
NumPy reference of the 3D pipelines that the Imaging Workbench runs in the browser
(oncotics/imaging/47-ai-3d.js is a line-by-line port of this file).

build_model_packs.py checks these functions against the official MONAI implementations
(NormalizeIntensity, sliding_window_inference, RetinaNetDetector) so that the browser
code is tied to a verified reference rather than to a re-reading of MONAI's source.
"""
import math

import numpy as np


# ---------------------------------------------------------------- brain MRI (SegResNet)
def normalize_nonzero_channelwise(img):
    """MONAI NormalizeIntensity(nonzero=True, channel_wise=True): per channel, voxels != 0 get
    (v - mean) / std over those voxels (population std; std 0 -> 1); zeros stay 0."""
    out = img.astype(np.float32).copy()
    for c in range(out.shape[0]):
        ch = out[c]
        m = ch != 0
        if not m.any():
            continue
        v = ch[m].astype(np.float64)
        mean, std = v.mean(), v.std()
        ch[m] = ((v - mean) / (std if std != 0 else 1.0)).astype(np.float32)
    return out


def scan_starts(size, roi, overlap):
    """Window starts along one axis, as MONAI dense_patch_slices / _get_scan_interval
    (after the image has been padded to at least roi)."""
    if roi == size:
        return [0]
    interval = int(roi * (1 - overlap))
    interval = interval if interval > 0 else 1
    num = int(math.ceil(float(size - roi) / interval)) + 1
    return [min(i * interval, size - roi) for i in range(num)]


def sliding_window(img, roi, overlap, predict):
    """img [C,X,Y,Z] -> averaged prediction [K,X,Y,Z] (MONAI sliding_window_inference, constant mode,
    zero padding to roi when the image is smaller)."""
    C = img.shape[0]
    size = list(img.shape[1:])
    pad = [max(r - s, 0) for r, s in zip(roi, size)]
    lo = [p // 2 for p in pad]
    padded = np.zeros([C] + [s + p for s, p in zip(size, pad)], np.float32)
    padded[:, lo[0]:lo[0] + size[0], lo[1]:lo[1] + size[1], lo[2]:lo[2] + size[2]] = img
    ps = padded.shape[1:]
    acc = None
    cnt = np.zeros(ps, np.float32)
    for x in scan_starts(ps[0], roi[0], overlap):
        for y in scan_starts(ps[1], roi[1], overlap):
            for z in scan_starts(ps[2], roi[2], overlap):
                win = padded[None, :, x:x + roi[0], y:y + roi[1], z:z + roi[2]]
                out = predict(np.ascontiguousarray(win))[0]
                if acc is None:
                    acc = np.zeros([out.shape[0]] + list(ps), np.float32)
                acc[:, x:x + roi[0], y:y + roi[1], z:z + roi[2]] += out
                cnt[x:x + roi[0], y:y + roi[1], z:z + roi[2]] += 1
    acc /= cnt[None]
    return acc[:, lo[0]:lo[0] + size[0], lo[1]:lo[1] + size[1], lo[2]:lo[2] + size[2]]


def brain_pipeline(img, roi, overlap, predict, threshold=0.5):
    """[4,X,Y,Z] raw MRI -> (probabilities [3,X,Y,Z], binary masks [3,X,Y,Z])."""
    x = normalize_nonzero_channelwise(img)
    logits = sliding_window(x, roi, overlap, predict)
    prob = 1 / (1 + np.exp(-logits))
    return prob, prob > threshold


# ---------------------------------------------------------------- lung CT (RetinaNet)
def divisible(size, k):
    return [int(math.ceil(s / d) * d) for s, d in zip(size, k)]


def lung_tiles(padded_size, tile, overlap):
    """Tiles over the padded image. tile per axis = min(tile, size); starts as MONAI's scan."""
    t = [min(a, b) for a, b in zip(tile, padded_size)]
    return t, [(x, y, z) for x in scan_starts(padded_size[0], t[0], overlap)
               for y in scan_starts(padded_size[1], t[1], overlap)
               for z in scan_starts(padded_size[2], t[2], overlap)]


def lung_heads(image, size_divisible, tile, overlap, predict, num_levels=3):
    """image [X,Y,Z] intensity-scaled -> (padded size, per-level averaged cls maps, box maps).
    predict(win[1,1,x,y,z]) -> list of 2*num_levels arrays (cls..., box...)."""
    size = list(image.shape)
    psize = divisible(size, size_divisible)
    padded = np.zeros(psize, np.float32)
    padded[:size[0], :size[1], :size[2]] = image                      # pad at the end with 0 (pad_images)
    t, starts = lung_tiles(psize, tile, overlap)
    acc = None
    cnt = None
    for (x, y, z) in starts:
        outs = predict(np.ascontiguousarray(padded[None, None, x:x + t[0], y:y + t[1], z:z + t[2]]))
        if acc is None:
            acc, cnt = [], []
            for o in outs:
                st = [t[i] // o.shape[2 + i] for i in range(3)]
                acc.append(np.zeros([o.shape[1]] + [psize[i] // st[i] for i in range(3)], np.float32))
                cnt.append(np.zeros([psize[i] // st[i] for i in range(3)], np.float32))
        for l, o in enumerate(outs):
            st = [t[i] // o.shape[2 + i] for i in range(3)]
            ox, oy, oz = x // st[0], y // st[1], z // st[2]
            sx, sy, sz = o.shape[2:]
            acc[l][:, ox:ox + sx, oy:oy + sy, oz:oz + sz] += o[0]
            cnt[l][ox:ox + sx, oy:oy + sy, oz:oz + sz] += 1
    maps = [a / c[None] for a, c in zip(acc, cnt)]
    return psize, maps[:num_levels], maps[num_levels:]


def anchors_for_level(cell, grid, stride):
    """cell [A,6] (x1,y1,z1,x2,y2,z2 around 0), grid (gx,gy,gz), stride (sx,sy,sz) ->
    [gx*gy*gz*A, 6] in the order of MONAI AnchorGenerator.grid_anchors."""
    gx, gy, gz = grid
    ix, iy, iz = np.meshgrid(np.arange(gx) * stride[0], np.arange(gy) * stride[1], np.arange(gz) * stride[2], indexing='ij')
    sh = np.stack([ix.ravel(), iy.ravel(), iz.ravel()] * 2, axis=1).astype(np.float32)
    return (sh[:, None, :] + np.asarray(cell, np.float32)[None, :, :]).reshape(-1, 6)


def reshape_level(m, A, ch):
    """[A*ch, X, Y, Z] -> [X*Y*Z*A, ch] (RetinaNetDetector._reshape_maps)."""
    s = m.shape[1:]
    return m.reshape(A, ch, *s).transpose(2, 3, 4, 0, 1).reshape(-1, ch)


def decode(rel, anc, weights, clip):
    w = anc[:, 3:] - anc[:, :3]
    c = (anc[:, :3] + anc[:, 3:]) / 2
    d = rel[:, :3] / np.asarray(weights[:3], np.float32)
    dw = np.minimum(rel[:, 3:] / np.asarray(weights[3:], np.float32), clip)
    pc = d * w + c
    pw = np.exp(dw) * w
    return np.concatenate([pc - 0.5 * pw, pc + 0.5 * pw], axis=1)


def iou_one(b, bs):
    lt = np.maximum(bs[:, :3], b[:3])
    rb = np.minimum(bs[:, 3:], b[3:])
    inter = np.prod(np.clip(rb - lt, 0, None), axis=1)
    va = np.prod(b[3:] - b[:3])
    vb = np.prod(bs[:, 3:] - bs[:, :3], axis=1)
    return inter / (va + vb - inter + np.finfo(np.float32).eps)


def nms(boxes, scores, thresh, max_det):
    order = np.argsort(-scores, kind='stable')
    bs = boxes[order]
    idx = np.arange(len(order))
    pick = []
    while len(idx):
        i = idx[0]
        pick.append(i)
        if len(pick) >= max_det >= 1:
            break
        ov = iou_one(bs[i], bs[idx])
        keep = ov <= thresh
        keep[0] = False
        idx = idx[keep]
    return order[pick]


def lung_detect(psize, cls_maps, box_maps, image_size, cells, A, weights, clip, score_thresh, topk, nms_thresh, max_det):
    """Per-level averaged maps -> boxes [N,6] (voxel x1,y1,z1,x2,y2,z2), scores [N]."""
    all_b, all_s = [], []
    for l in range(len(cls_maps)):
        grid = cls_maps[l].shape[1:]
        stride = [psize[i] // grid[i] for i in range(3)]
        anc = anchors_for_level(cells[l], grid, stride)
        logit = reshape_level(cls_maps[l], A, 1)[:, 0]
        rel = reshape_level(box_maps[l], A, 6)
        sc = 1 / (1 + np.exp(-logit.astype(np.float32)))
        keep = np.where(sc > score_thresh)[0]
        keep = keep[np.argsort(-sc[keep], kind='stable')][:topk]
        b = decode(rel[keep], anc[keep], weights, clip)
        s = sc[keep]
        for a in range(3):
            b[:, a] = np.clip(b[:, a], 0, image_size[a])
            b[:, a + 3] = np.clip(b[:, a + 3], 0, image_size[a])
        ok = np.all(b[:, 3:] >= b[:, :3] + 1, axis=1)
        all_b.append(b[ok]); all_s.append(s[ok])
    B = np.concatenate(all_b) if all_b else np.zeros((0, 6), np.float32)
    Sc = np.concatenate(all_s) if all_s else np.zeros((0,), np.float32)
    if not len(B):
        return B, Sc
    k = nms(B, Sc, nms_thresh, max_det)
    return B[k], Sc[k]
