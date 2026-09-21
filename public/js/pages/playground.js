import { api } from '../api.js';
import { showToast } from '../components/modal.js';

let currentSessionId = `sess_${Date.now()}`;

export function renderPlaygroundPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-h">
        <div>
          <h2>Chat Playground</h2>
          <p>Test queries live against the AI Gateway, inspect reasoning intent, and view real citations.</p>
        </div>
        <button class="btn" id="btnNewChat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          New Chat
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 16px; align-items: start;">
        <!-- Left: Chat Panel -->
        <div class="card" style="display: flex; flex-direction: column; height: 600px;">
          <div class="card-h">
            <div>
              <span class="card-t">Conversation</span>
              <span class="mono" id="lblSessionId" style="font-size: 11px; color: var(--fg-3); margin-left: 8px;">${currentSessionId}</span>
            </div>
            <span class="badge green">Multi-Turn Memory</span>
          </div>
          <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="background: var(--panel-2); padding: 12px; border-radius: 6px; border: 1px solid var(--border); font-size: 13px;">
              <strong>System:</strong> Silakan ajukan pertanyaan terkait peraturan perusahaan (JDIH). Sesi ini memiliki ingatan konteks obrolan.
            </div>
          </div>
          <div style="padding: 12px; border-top: 1px solid var(--border); display: flex; gap: 8px;">
            <input class="input" id="chatInput" type="text" placeholder="Ketik pertanyaan... (e.g. Berapa hari cuti menikah?)" />
            <button class="btn primary" id="btnSendChat">Send</button>
          </div>
        </div>

        <!-- Right: Inspector Panel -->
        <div class="card">
          <div class="card-h">
            <span class="card-t">Execution Inspector</span>
          </div>
          <div class="card-b" id="inspectorContent">
            <p style="color: var(--fg-3); font-size: 12.5px;">Kirim pesan di sebelah kiri untuk melihat detail eksekusi, intent, latency, dan potongan pasal yang ditemukan.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('chatInput');
  const btnSend = document.getElementById('btnSendChat');
  const btnNew = document.getElementById('btnNewChat');

  btnNew?.addEventListener('click', () => {
    currentSessionId = `sess_${Date.now()}`;
    const lbl = document.getElementById('lblSessionId');
    if (lbl) lbl.textContent = currentSessionId;
    const chatContainer = document.getElementById('chatMessages');
    if (chatContainer) {
      chatContainer.innerHTML = `
        <div style="background: var(--panel-2); padding: 12px; border-radius: 6px; border: 1px solid var(--border); font-size: 13px;">
          <strong>System:</strong> Sesi baru dimulai (${currentSessionId}). Silakan ajukan pertanyaan baru.
        </div>
      `;
    }
    const inspector = document.getElementById('inspectorContent');
    if (inspector) {
      inspector.innerHTML = `<p style="color: var(--fg-3); font-size: 12.5px;">Kirim pesan di sebelah kiri untuk melihat detail eksekusi dan citations.</p>`;
    }
    showToast('Started new conversation session!');
  });

  btnSend.addEventListener('click', () => handleSend());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });
}

async function handleSend() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  const chatContainer = document.getElementById('chatMessages');
  const inspector = document.getElementById('inspectorContent');

  // 1. Append user message bubble
  chatContainer.innerHTML += `
    <div style="align-self: flex-end; background: var(--brand-dim); border: 1px solid rgba(62,207,142,0.3); padding: 10px 14px; border-radius: 6px; font-size: 13px; max-width: 80%;">
      ${escapeHtml(message)}
    </div>
  `;
  input.value = '';
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // 2. Create AI bubble with streaming cursor
  const aiBubbleId = `ai_msg_${Date.now()}`;
  chatContainer.innerHTML += `
    <div id="${aiBubbleId}" style="align-self: flex-start; background: var(--panel-2); border: 1px solid var(--border); padding: 12px 14px; border-radius: 6px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; max-width: 85%;">
      <span class="stream-text">Thinking & searching knowledge base...</span><span class="stream-cursor" style="display:inline-block; width:6px; height:14px; background:var(--brand); margin-left:3px; vertical-align:middle; animation:blink 0.8s infinite;"></span>
    </div>
  `;
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const response = await fetch('/v1/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'jdih',
        message,
        session_id: currentSessionId,
        user_id: localStorage.getItem('userEmail') || 'dana@northwind.co',
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      document.getElementById(aiBubbleId).innerHTML = `
        <div style="color: var(--danger);">
          <strong>Blocked / Error:</strong> ${escapeHtml(errJson.error || 'Failed to process request.')}
        </div>
      `;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';
    let isFirstToken = true;

    const streamTextElem = document.querySelector(`#${aiBubbleId} .stream-text`);
    const cursorElem = document.querySelector(`#${aiBubbleId} .stream-cursor`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Sisa buffer yang belum selesai

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.replace(/^data: /, '').trim();
        if (!dataStr) continue;

        try {
          const payload = JSON.parse(dataStr);

          // Event Meta (Citations & Intent)
          if (payload.type === 'meta') {
            updateInspectorMeta(payload.intent, payload.citations);
          }

          // Event Token (Teks baru dari LLM)
          if (payload.type === 'token') {
            if (isFirstToken) {
              streamTextElem.innerHTML = '';
              isFirstToken = false;
            }
            accumulatedText += payload.token;
            if (window.marked) {
              streamTextElem.innerHTML = window.marked.parse(accumulatedText);
            } else {
              streamTextElem.textContent = accumulatedText;
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }

          // Event Done (Selesai & tercatat di database)
          if (payload.type === 'done') {
            cursorElem?.remove();
            if (window.marked) {
              streamTextElem.innerHTML = window.marked.parse(accumulatedText);
            }
            updateInspectorDone(payload.chatLogId, payload.latencyMs);
          }
        } catch (e) {
          // ignore parsing error for chunk fragments
        }
      }
    }

    cursorElem?.remove();
    if (window.marked) {
      streamTextElem.innerHTML = window.marked.parse(accumulatedText);
    }

  } catch (err) {
    document.getElementById(aiBubbleId).innerHTML = `<span style="color: var(--danger);">Error: ${escapeHtml(err.message)}</span>`;
    showToast(`Streaming failed: ${err.message}`);
  }
}

function updateInspectorMeta(intent, citations = []) {
  const inspector = document.getElementById('inspectorContent');
  if (!inspector) return;

  inspector.innerHTML = `
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: var(--fg-3); text-transform: uppercase;">Intent</div>
      <div style="margin-top: 4px;">
        <span class="badge green">${intent || 'RAG'}</span>
      </div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: var(--fg-3); text-transform: uppercase;">Latency</div>
      <div class="mono" id="inspectorLatency" style="color: var(--warn); font-size: 15px; margin-top: 2px;">Streaming...</div>
    </div>
    <div>
      <div style="font-size: 11px; color: var(--fg-3); text-transform: uppercase; margin-bottom: 6px;">Citations Retrieved (${citations.length})</div>
      ${citations.map(c => `
        <div style="background: var(--panel-2); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; margin-bottom: 6px; font-size: 11.5px;">
          <div style="font-weight: 500; color: var(--brand);">${escapeHtml(c.heading || '')}</div>
          <div style="color: var(--fg-3); margin-top: 2px;">Sim: ${c.similarityScore}</div>
        </div>
      `).join('') || '<p style="color: var(--fg-3); font-size: 12px;">No citations.</p>'}
    </div>
  `;
}

function updateInspectorDone(chatLogId, latencyMs) {
  const latElem = document.getElementById('inspectorLatency');
  if (latElem) {
    latElem.textContent = `${latencyMs} ms`;
    latElem.style.color = 'var(--brand)';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[tag] || tag));
}
