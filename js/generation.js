function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('generateForm');
  const promptInput = document.getElementById('prompt');
  const generateBtn = document.getElementById('generateBtn');
  const resultsGrid = document.getElementById('resultsGrid');
  const statusEl = document.getElementById('generationStatus');
  const modelSelect = document.getElementById('model');
  const ratioSelect = document.getElementById('ratio');
  const batchSelect = document.getElementById('batch');

  const RATIO_MAP = {
    '1:1 (Square)': { w: 1024, h: 1024 },
    '16:9 (Wide)': { w: 1024, h: 576 },
    '9:16 (Portrait)': { w: 576, h: 1024 },
    '3:2': { w: 1024, h: 683 },
    '2:3': { w: 683, h: 1024 },
    '4:3': { w: 1024, h: 768 },
  };

  function getDimensions() {
    return RATIO_MAP[ratioSelect.value] || { w: CONFIG.DEFAULT_WIDTH, h: CONFIG.DEFAULT_HEIGHT };
  }

  function getBatchCount() {
    const m = batchSelect.value.match(/\d+/);
    return m ? parseInt(m[0], 10) : 1;
  }

  function getEngineConfig() {
    return CONFIG.ENGINE_MAP[modelSelect.value] || { model: 'flux', style: '' };
  }

  function buildUrls(prompt) {
    const negativeInput = document.getElementById('negativePrompt');
    const negativePrompt = negativeInput ? negativeInput.value.trim() : '';
    const { w, h } = getDimensions();
    const { model, style } = getEngineConfig();
    const enhancedPrompt = style ? `${style}, ${prompt}` : prompt;
    const encoded = encodeURIComponent(enhancedPrompt);
    const count = getBatchCount();
    const baseSeed = Math.floor(Math.random() * 900000) + 100000;

    return Array.from({ length: count }, (_, i) => {
      let url = `${CONFIG.API_BASE_URL}${encoded}?width=${w}&height=${h}&model=${model}&seed=${baseSeed + i}`;
      if (negativePrompt) {
        url += `&negative_prompt=${encodeURIComponent(negativePrompt)}`;
      }
      return url;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const prompt = promptInput.value.trim();
    if (!prompt) return;

    setLoading(true);
    resultsGrid.innerHTML = '';
    statusEl.textContent = '';

    const urls = buildUrls(prompt);
    const results = [];

    for (let i = 0; i < urls.length; i++) {
      statusEl.textContent = `Generating ${i + 1} of ${urls.length}…`;

      try {
        const blob = await fetchWithRetry(urls[i]);
        results.push({ ok: true, data: blob });
      } catch (err) {
        results.push({ ok: false, error: err.message });
      }
    }

    renderResults(results, prompt);
    setLoading(false);
    statusEl.textContent = '';
  });

  async function fetchWithRetry(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(url);

      if (response.status === 429) {
        statusEl.textContent = 'Rate limited — waiting 15s…';
        await sleep(15000);
        continue;
      }

      if (!response.ok) {
        let msg = `HTTP ${response.status}`;
        try {
          const text = await response.text();
          if (text) msg += ` — ${text.slice(0, 300)}`;
        } catch {}
        throw new Error(msg);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        let body = '';
        try { body = await response.text(); } catch {}
        throw new Error(`API returned ${contentType}: ${body.slice(0, 300)}`);
      }

      return response.blob();
    }

    throw new Error('Rate limited — try again later');
  }

  function renderResults(results, prompt) {
    const { w, h } = getDimensions();
    const pb = `${(h / w) * 100}%`;

    for (const r of results) {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.style.paddingBottom = pb;

      if (r.ok) {
        const img = document.createElement('img');
        img.alt = prompt;
        img.src = URL.createObjectURL(r.data);
        item.appendChild(img);
      } else {
        const errDiv = document.createElement('div');
        errDiv.className = 'result-status';
        errDiv.style.color = '#ef4444';
        errDiv.textContent = r.error;
        item.appendChild(errDiv);
      }

      resultsGrid.appendChild(item);
    }
  }

  function setLoading(loading) {
    generateBtn.disabled = loading;
    if (loading) {
      generateBtn.innerHTML = '<span class="spinner"></span> Generating…';
      promptInput.disabled = true;
    } else {
      generateBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Generate';
      promptInput.disabled = false;
      promptInput.focus();
    }
  }
});
