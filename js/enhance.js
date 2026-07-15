let setStatus = (msg) => {};

async function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function imageToBlob(img, type = 'image/png') {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return new Promise(r => c.toBlob(r, type));
}

function applyUnsharpMask(canvas, amount, radius, threshold) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  const copy = new Uint8ClampedArray(data);

  const kSize = Math.max(3, Math.round(radius) * 2 + 1);
  const half = Math.floor(kSize / 2);
  const kernel = new Float32Array(kSize * kSize);
  let sum = 0;
  const sigma = radius / 2;
  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      const v = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel[(y + half) * kSize + (x + half)] = v;
      sum += v;
    }
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  function gauss(idx) {
    let r = 0, g = 0, b = 0;
    for (let ky = 0; ky < kSize; ky++) {
      for (let kx = 0; kx < kSize; kx++) {
        const px = ((idx / 4 | 0) % w) + kx - half;
        const py = ((idx / 4 | 0) / w | 0) + ky - half;
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        const pik = (py * w + px) * 4;
        const kVal = kernel[ky * kSize + kx];
        r += copy[pik] * kVal;
        g += copy[pik + 1] * kVal;
        b += copy[pik + 2] * kVal;
      }
    }
    return [r, g, b];
  }

  for (let i = 0; i < data.length; i += 4) {
    const [gr, gg, gb] = gauss(i);
    const dr = data[i] - gr;
    const dg = data[i + 1] - gg;
    const db = data[i + 2] - gb;
    if (Math.abs(dr) < threshold && Math.abs(dg) < threshold && Math.abs(db) < threshold) continue;
    data[i] = Math.max(0, Math.min(255, data[i] + dr * amount));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + dg * amount));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + db * amount));
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyContrastBrightness(canvas, contrast, brightness) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128 + brightness));
    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128 + brightness));
    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128 + brightness));
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyMedianFilter(canvas, radius) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const copy = new Uint8ClampedArray(data);
  const r = Math.max(1, radius);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rs = [], gs = [], bs = [];
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || px >= w || py < 0 || py >= h) continue;
          const idx = (py * w + px) * 4;
          rs.push(copy[idx]);
          gs.push(copy[idx + 1]);
          bs.push(copy[idx + 2]);
        }
      }
      rs.sort((a, b) => a - b);
      gs.sort((a, b) => a - b);
      bs.sort((a, b) => a - b);
      const mid = Math.floor(rs.length / 2);
      const idx = (y * w + x) * 4;
      data[idx] = rs[mid];
      data[idx + 1] = gs[mid];
      data[idx + 2] = bs[mid];
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function applySaturation(canvas, amount) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = Math.max(0, Math.min(255, gray + amount * (r - gray)));
    data[i + 1] = Math.max(0, Math.min(255, gray + amount * (g - gray)));
    data[i + 2] = Math.max(0, Math.min(255, gray + amount * (b - gray)));
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyColorTint(canvas, tintR, tintG, tintB, strength) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i] * (1 - strength) + tintR * strength));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * (1 - strength) + tintG * strength));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * (1 - strength) + tintB * strength));
  }
  ctx.putImageData(imageData, 0, 0);
}

function outpaintingMirror(img, expandPx) {
  const dw = img.naturalWidth + expandPx * 2;
  const dh = img.naturalHeight + expandPx * 2;
  const c = document.createElement('canvas');
  c.width = dw;
  c.height = dh;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, expandPx, expandPx);

  const getPixel = (x, y) => {
    if (x >= expandPx && x < expandPx + img.naturalWidth &&
        y >= expandPx && y < expandPx + img.naturalHeight) return null;
    let sx = x - expandPx, sy = y - expandPx;
    if (sx < 0) sx = Math.min(-sx, img.naturalWidth - 1);
    else if (sx >= img.naturalWidth) sx = Math.max(2 * img.naturalWidth - sx - 2, 0);
    if (sy < 0) sy = Math.min(-sy, img.naturalHeight - 1);
    else if (sy >= img.naturalHeight) sy = Math.max(2 * img.naturalHeight - sy - 2, 0);
    return { x: expandPx + sx, y: expandPx + sy };
  };

  const temp = document.createElement('canvas');
  temp.width = img.naturalWidth;
  temp.height = img.naturalHeight;
  const tCtx = temp.getContext('2d');
  tCtx.drawImage(img, 0, 0);
  const srcData = tCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
  const outData = ctx.getImageData(0, 0, dw, dh);

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      if (x >= expandPx && x < expandPx + img.naturalWidth &&
          y >= expandPx && y < expandPx + img.naturalHeight) continue;
      const p = getPixel(x, y);
      if (!p) continue;
      const si = ((p.y - expandPx) * img.naturalWidth + (p.x - expandPx)) * 4;
      const oi = (y * dw + x) * 4;
      const dx = Math.min(Math.abs(x - expandPx), Math.abs(x - (expandPx + img.naturalWidth - 1)));
      const dy = Math.min(Math.abs(y - expandPx), Math.abs(y - (expandPx + img.naturalHeight - 1)));
      const dist = Math.max(dx, dy);
      const maxDist = Math.max(expandPx, img.naturalWidth);
      const blur = Math.max(1, (dist / maxDist) * 10);
      outData[oi] = srcData[si];
      outData[oi + 1] = srcData[si + 1];
      outData[oi + 2] = srcData[si + 2];
      outData[oi + 3] = 255;
    }
  }
  ctx.putImageData(outData, 0, 0);

  applyGaussianBlurCanvas(c, expandPx * 0.15);

  ctx.drawImage(img, expandPx, expandPx);

  return c;
}

function applyGaussianBlurCanvas(canvas, sigma) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);
  const r = Math.max(1, Math.round(sigma * 2));
  const kSize = r * 2 + 1;
  const kernel = new Float32Array(kSize);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < kSize; i++) kernel[i] /= sum;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rAcc = 0, gAcc = 0, bAcc = 0;
      for (let kx = 0; kx < kSize; kx++) {
        const px = x + kx - r;
        if (px < 0 || px >= w) continue;
        const idx = (y * w + px) * 4;
        rAcc += copy[idx] * kernel[kx];
        gAcc += copy[idx + 1] * kernel[kx];
        bAcc += copy[idx + 2] * kernel[kx];
      }
      const idx = (y * w + x) * 4;
      data[idx] = rAcc;
      data[idx + 1] = gAcc;
      data[idx + 2] = bAcc;
    }
  }
  const copy2 = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rAcc = 0, gAcc = 0, bAcc = 0;
      for (let ky = 0; ky < kSize; ky++) {
        const py = y + ky - r;
        if (py < 0 || py >= h) continue;
        const idx = (py * w + x) * 4;
        rAcc += copy2[idx] * kernel[ky];
        gAcc += copy2[idx + 1] * kernel[ky];
        bAcc += copy2[idx + 2] * kernel[ky];
      }
      const idx = (y * w + x) * 4;
      data[idx] = rAcc;
      data[idx + 1] = gAcc;
      data[idx + 2] = bAcc;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('#enhance-tabs .tool-tab');
  const fileInput = document.getElementById('enhance-file-input');
  const uploadZone = document.getElementById('enhance-upload-zone');
  const beforeEl = document.getElementById('enhance-before');
  const afterEl = document.getElementById('enhance-after');
  const statusEl = document.getElementById('enhance-status');
  const enhanceBtn = document.getElementById('enhance-btn');
  const downloadBtn = document.getElementById('enhance-download');
  const optionScale = document.getElementById('option-scale');
  const optionOutpainting = document.getElementById('option-outpainting');

  let currentTab = 'upscale';
  let currentFile = null;
  let resultBlob = null;

  setStatus = (msg) => { statusEl.textContent = msg; };

  function setLoading(loading) {
    enhanceBtn.disabled = loading;
    if (loading) {
      enhanceBtn.innerHTML = '<span class="spinner"></span> Processing…';
    } else {
      enhanceBtn.textContent = 'Enhance';
    }
  }

  const placeholderSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><br>After';

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      optionScale.style.display = currentTab === 'upscale' ? 'block' : 'none';
      optionOutpainting.style.display = currentTab === 'outpainting' ? 'block' : 'none';
      afterEl.innerHTML = placeholderSvg;
      downloadBtn.disabled = true;
      resultBlob = null;
    });
  });

  uploadZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentFile = file;
    const url = URL.createObjectURL(file);
    beforeEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
    afterEl.innerHTML = placeholderSvg;
    downloadBtn.disabled = true;
    resultBlob = null;
    setStatus('');
  });

  enhanceBtn.addEventListener('click', async () => {
    if (!currentFile) {
      setStatus('Please upload an image first');
      return;
    }

    setLoading(true);
    setStatus('Processing…');
    downloadBtn.disabled = true;
    resultBlob = null;

    try {
      const img = await loadImage(currentFile);

      if (currentTab === 'upscale') {
        const scaleFactor = parseInt(document.getElementById('upscale-factor').value, 10) || 4;
        setStatus(`Upscaling ${scaleFactor}x…`);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth * scaleFactor;
        canvas.height = img.naturalHeight * scaleFactor;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        applyUnsharpMask(canvas, 0.6, 2, 10);
        resultBlob = await new Promise(r => canvas.toBlob(r));
      } else if (currentTab === 'restore') {
        setStatus('Applying restoration filters…');
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        applyMedianFilter(canvas, 1);
        applyContrastBrightness(canvas, 20, 5);
        applyUnsharpMask(canvas, 0.8, 1.5, 8);
        resultBlob = await new Promise(r => canvas.toBlob(r));
      } else if (currentTab === 'colorize') {
        setStatus('Applying color tint…');
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        applySaturation(canvas, 1.3);
        applyColorTint(canvas, 230, 200, 180, 0.12);
        applyContrastBrightness(canvas, 15, 0);
        resultBlob = await new Promise(r => canvas.toBlob(r));
      } else if (currentTab === 'outpainting') {
        const expandPx = Math.round(Math.min(img.naturalWidth, img.naturalHeight) * 0.3);
        setStatus(`Expanding canvas by ${expandPx}px (mirror+blur)…`);
        const canvas = outpaintingMirror(img, expandPx);
        resultBlob = await new Promise(r => canvas.toBlob(r));
      }

      if (resultBlob) {
        const url = URL.createObjectURL(resultBlob);
        afterEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
        setStatus('Done');
        downloadBtn.disabled = false;
      }
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!resultBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(resultBlob);
    a.download = `enhanced-${currentTab}.png`;
    a.click();
  });
});
