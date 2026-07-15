if (typeof CONFIG === 'undefined' || !CONFIG.HF_TOKEN) {
  document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('enhance-status');
    if (statusEl) statusEl.textContent = 'Configuration error: HF_TOKEN not found. Try hard refresh (Ctrl+F5).';
  });
} else {

let setStatus = (msg) => {};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const INPAINTING_MODEL = 'runwayml/stable-diffusion-v1-5-inpainting';

async function hfRequest(model, imageBlob, { maskBlob, prompt } = {}) {
  const url = `${CONFIG.HF_API_BASE_URL}/${model}?api_key=${CONFIG.HF_TOKEN}`;
  const maxRetries = 3;
  const retryDelay = 6000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const formData = new FormData();
    formData.set('image', imageBlob, 'image.png');
    if (maskBlob) formData.set('mask', maskBlob, 'mask.png');
    if (prompt) formData.set('prompt', prompt);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        body: formData,
        redirect: 'error',
      });
    } catch (fetchErr) {
      if (attempt < maxRetries) {
        setStatus(`Connection issue — retrying (${attempt + 1}/${maxRetries})…`);
        await sleep(retryDelay);
        continue;
      }
      throw new Error('Cannot reach Hugging Face API. The model may not exist or the server is down.');
    }

    if (res.ok) return res.blob();

    if (res.status === 503 && attempt < maxRetries) {
      setStatus('Model is loading — waiting 6s…');
      await sleep(retryDelay);
      continue;
    }

    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 200) : ''}`);
  }
  throw new Error('Model failed to load after retries');
}

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

function imageToBlobScaled(img, scale, type = 'image/png') {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth * scale;
  c.height = img.naturalHeight * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, type));
}

function expandCanvas(img, expandPx, direction) {
  const c = document.createElement('canvas');
  const dw = img.naturalWidth + expandPx * 2;
  const dh = img.naturalHeight + expandPx * 2;
  c.width = dw;
  c.height = dh;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(img, expandPx, expandPx);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = dw;
  maskCanvas.height = dh;
  const mCtx = maskCanvas.getContext('2d');
  mCtx.fillStyle = '#000000';
  mCtx.fillRect(0, 0, dw, dh);
  mCtx.fillStyle = '#ffffff';
  mCtx.fillRect(expandPx, expandPx, img.naturalWidth, img.naturalHeight);
  if (direction === 'left') {
    mCtx.fillStyle = '#ffffff';
    mCtx.fillRect(0, 0, expandPx, dh);
  }

  return { canvas: c, maskCanvas };
}

function createWhiteMask(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  return c;
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
    setStatus('Preparing image…');
    downloadBtn.disabled = true;
    resultBlob = null;

    try {
      const img = await loadImage(currentFile);

      if (currentTab === 'outpainting') {
        const expandPx = Math.round(Math.min(img.naturalWidth, img.naturalHeight) * 0.3);
        const prompt = document.getElementById('outpaint-prompt').value.trim() || 'extend the background naturally';
        setStatus('Expanding canvas and creating mask…');
        const { canvas, maskCanvas } = expandCanvas(img, expandPx, 'left');
        const imageBlob = await new Promise(r => canvas.toBlob(r));
        const maskBlob = await new Promise(r => maskCanvas.toBlob(r));
        setStatus('Sending to Stable Diffusion inpainting…');
        const result = await hfRequest(INPAINTING_MODEL, imageBlob, { maskBlob, prompt });
        resultBlob = result;
        const url = URL.createObjectURL(result);
        afterEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
        setStatus('Done');
      } else if (currentTab === 'upscale') {
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
        const url = URL.createObjectURL(resultBlob);
        afterEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
        setStatus('Done');
      } else if (currentTab === 'restore') {
        setStatus('Sending to AI for restoration…');
        const imageBlob = await imageToBlob(img);
        const maskCanvas = createWhiteMask(img.naturalWidth, img.naturalHeight);
        const maskBlob = await new Promise(r => maskCanvas.toBlob(r));
        const prompt = 'Restore this damaged photo, fix scratches and artifacts, repair faces, smooth skin, natural textures, clean image, high quality, sharp details, realistic';
        const result = await hfRequest(INPAINTING_MODEL, imageBlob, { maskBlob, prompt });
        resultBlob = result;
        const url = URL.createObjectURL(result);
        afterEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
        setStatus('Done');
      } else if (currentTab === 'colorize') {
        setStatus('Sending to AI for colorization…');
        const imageBlob = await imageToBlob(img);
        const maskCanvas = createWhiteMask(img.naturalWidth, img.naturalHeight);
        const maskBlob = await new Promise(r => maskCanvas.toBlob(r));
        const prompt = 'Colorize this black and white photo naturally, realistic accurate colors, natural skin tones, vibrant yet realistic lighting, preserve details, high quality';
        const result = await hfRequest(INPAINTING_MODEL, imageBlob, { maskBlob, prompt });
        resultBlob = result;
        const url = URL.createObjectURL(result);
        afterEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
        setStatus('Done');
      }

      downloadBtn.disabled = false;
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
}
