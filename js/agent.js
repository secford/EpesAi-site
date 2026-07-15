document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.querySelector('.chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.querySelector('.btn-primary');
  const modelSelect = document.getElementById('chat-model');
  const statusSpan = document.querySelector('.tool-panel span');

  chatMessages.innerHTML = '';
  addMessage('Hello! How can I help you today?', 'bot');

  let messageCount = 0;

  function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `chat-message ${sender}`;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = sender === 'bot' ? 'A' : 'You';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (sender === 'bot' && window.marked) {
      bubble.innerHTML = marked.parse(text);
    } else {
      bubble.textContent = text;
    }
    div.appendChild(avatar);
    div.appendChild(bubble);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function updateMessageCount() {
    const remaining = Math.max(0, 20 - messageCount);
    statusSpan.textContent = `Free — ${remaining} messages left today`;
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    if (!CONFIG.OPENROUTER_API_KEY) {
      addMessage('API key not configured. Copy js/config.local.example.js to js/config.local.js and add your key.', 'bot');
      return;
    }

    addMessage(text, 'user');
    chatInput.value = '';
    messageCount++;
    updateMessageCount();

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message bot';
    loadingDiv.id = 'loading-message';
    loadingDiv.innerHTML = '<div class="avatar">A</div><div class="bubble"><span class="spinner"></span> Thinking...</div>';
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    sendBtn.disabled = true;

    const messages = [{ role: 'system', content: 'You are a helpful AI assistant named Epes. Respond concisely and accurately. Format your answers in markdown when appropriate — use code blocks, lists, tables, **bold**, etc.' }];
    chatMessages.querySelectorAll('.chat-message:not(#loading-message)').forEach(msg => {
      const role = msg.classList.contains('user') ? 'user' : 'assistant';
      const bubble = msg.querySelector('.bubble');
      if (bubble) messages.push({ role, content: bubble.textContent });
    });

    const modelKey = modelSelect.value;
    const model = CONFIG.CHAT_MODELS[modelKey];

    try {
      const response = await fetch(`${CONFIG.OPENROUTER_API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
          'HTTP-Referer': CONFIG.SITE_URL,
          'X-Title': CONFIG.SITE_NAME,
        },
        body: JSON.stringify({ model, messages }),
      });

      document.getElementById('loading-message')?.remove();

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const reply = data.choices[0].message.content;
      addMessage(reply, 'bot');
    } catch (err) {
      document.getElementById('loading-message')?.remove();
      addMessage(`Error: ${err.message}. Please try again.`, 'bot');
    } finally {
      sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
});
