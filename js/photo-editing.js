document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('editor-file-input');
  const uploadZone = document.getElementById('editor-upload-zone');
  const beforeEl = document.getElementById('editor-before');
  const afterEl = document.getElementById('editor-after');
  const statusEl = document.getElementById('editor-status');
  const processBtn = document.getElementById('editor-btn');
  const downloadBtn = document.getElementById('editor-download');

  let currentFile = null;
  let resultBlob = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  function setLoading(loading) {
    processBtn.disabled = loading;
    processBtn.textContent = loading ? 'Processing…' : 'Remove Background';
  }

  uploadZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentFile = file;
    const url = URL.createObjectURL(file);
    beforeEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
    afterEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><br>Result will appear here';
    downloadBtn.disabled = true;
    resultBlob = null;
    setStatus('');
  });

  processBtn.addEventListener('click', async () => {
    if (!currentFile) {
      setStatus('Please upload an image first');
      return;
    }

    if (!window.imglyBackgroundRemoval) {
      setStatus('Background removal library is still loading. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setStatus('Removing background…');
    downloadBtn.disabled = true;
    resultBlob = null;

    try {
      const blob = await window.imglyBackgroundRemoval.removeBackground(currentFile);
      resultBlob = blob;
      const url = URL.createObjectURL(blob);
      afterEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
      setStatus('Done');
      downloadBtn.disabled = false;
    } catch (err) {
      setStatus('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!resultBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(resultBlob);
    a.download = 'no-bg.png';
    a.click();
  });
});
