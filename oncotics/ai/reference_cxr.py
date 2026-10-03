#!/usr/bin/env python3
"""Official TorchXRayVision prediction for one chest X-ray image (reference for the browser test)."""
import json, sys
import numpy as np, skimage.io, torch, torchvision, torchxrayvision as xrv
img = skimage.io.imread(sys.argv[1])
if img.ndim == 3:
    img = img[..., :3].mean(2) if img.shape[2] >= 3 else img[..., 0]
img = xrv.datasets.normalize(img.astype(np.float32), 255)[None, ...]          # [-1024, 1024]
img = torchvision.transforms.Compose([xrv.datasets.XRayCenterCrop(), xrv.datasets.XRayResizer(224)])(img)
model = xrv.models.DenseNet(weights='densenet121-res224-all').eval()
with torch.no_grad():
    out = model(torch.from_numpy(img)[None, ...])[0].numpy()
print(json.dumps({l: float(v) for l, v in zip(model.pathologies, out) if l}))
