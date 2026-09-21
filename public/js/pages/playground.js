import { api } from '../api.js';
import { showToast } from '../components/modal.js';

export function renderPlaygroundPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-h">
        <div>
          <h2>Chat Playground</h2>
          <p>Test queries live against the AI Gateway, inspect reasoning intent, and view real citations.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 16px; align-items: start;">
        <!-- Left: Chat Panel -->
        <div class="card" style="display: flex; flex-direction: column; height: 600px;">
          <div class="card-h">
            <span class="card-t">Conversation</span>
            <span class="badge green">Live API</span>
          </div>
          <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="background: var(--panel-2); padding: 12px; border-radius: 6px; border: 1px solid var(--border); font-size: 13px;">
              <strong>System:</strong> Silakan ajukan pertanyaan terkait peraturan perusahaan (JDIH) atau sapa asisten virtual.
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

  // Append user message
  chatContainer.innerHTML += `
    <div style="align-self: flex-end; background: var(--brand-dim); border: 1px solid rgba(62,207,142,0.3); padding: 10px 14px; border-radius: 6px; font-size: 13px; max-width: 80%;">
      ${escapeHtml(message)}
    </div>
  `;
  input.value = '';
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Placeholder thinking message
  const loadingId = `load_${Date.now()}`;
  chatContainer.innerHTML += `
    <div id="${loadingId}" style="align-self: flex-start; background: var(--panel-2); border: 1px solid var(--border); padding: 10px 14px; border-radius: 6px; font-size: 13px; color: var(--fg-3);">
      Thinking & searching knowledge base...
    </div>
  `;
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const res = await api.sendChat({
      app: 'jdih',
      message,
      userId: localStorage.getItem('userEmail') || 'dana@northwind.co',
    });

    document.getElementById(loadingId)?.remove();

    if (!res.success) {
      chatContainer.innerHTML += `
        <div style="align-self: flex-start; background: var(--danger-dim); border: 1px solid rgba(245,101,101,0.3); color: var(--danger); padding: 10px 14px; border-radius: 6px; font-size: 13px;">
          <strong>Blocked:</strong> ${escapeHtml(res.error || 'Request blocked by safety guardrail.')}
        </div>
      `;
      return;
    }

    const answer = res.data?.answer || '';
    chatContainer.innerHTML += `
      <div style="align-self: flex-start; background: var(--panel-2); border: 1px solid var(--border); padding: 12px 14px; border-radius: 6px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; max-width: 85%;">
        ${escapeHtml(answer)}
      </div>
    `;
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Update Inspector
    const citations = res.data?.citations || [];
    inspector.innerHTML = `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; color: var(--fg-3); text-transform: uppercase;">Run ID & Intent</div>
        <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
          <span class="mono strong">#${res.chatLogId || 'N/A'}</span>
          <span class="badge green">${res.intent || 'RAG'}</span>
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; color: var(--fg-3); text-transform: uppercase;">Latency</div>
        <div class="mono" style="color: var(--brand); font-size: 16px; margin-top: 2px;">${res.latencyMs} ms</div>
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

  } catch (err) {
    document.getElementById(loadingId)?.remove();
    showToast(`Error: ${err.message}`);
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
