import { api } from '../api.js';
import { showToast, showModal, closeModal } from '../components/modal.js';

export async function renderRunsPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-h">
        <div>
          <h2>Runs & Evaluation Logs</h2>
          <p>Real-time audit log of all model executions, latency tracking, human ratings, and LLM-as-a-Judge scores.</p>
        </div>
        <button class="btn" id="btnRefreshRuns">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh Data
        </button>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>ID & Session</th>
              <th>App / Intent</th>
              <th>User Query</th>
              <th>Latency</th>
              <th>Human Review</th>
              <th>LLM Judge Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="runsTableBody">
            <tr>
              <td colspan="7" style="text-align: center; padding: 24px; color: var(--fg-3);">Loading audit logs from database...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btnRefreshRuns').addEventListener('click', () => loadRunsTable());
  await loadRunsTable();
}

async function loadRunsTable() {
  const tbody = document.getElementById('runsTableBody');
  if (!tbody) return;

  try {
    const { data: runs } = await api.getChatLogs(30);

    if (!runs || runs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px;">No runs recorded yet. Try testing in Playground!</td></tr>`;
      return;
    }

    tbody.innerHTML = runs.map(run => {
      const intentBadge = run.intent === 'MALICIOUS_ATTEMPT'
        ? `<span class="badge red"><span class="dot"></span>Blocked</span>`
        : run.intent === 'GREETING'
        ? `<span class="badge gray">Greeting</span>`
        : `<span class="badge green"><span class="dot"></span>${run.app.toUpperCase()} RAG</span>`;

      const latencyBadge = run.latency_ms > 2000
        ? `<span style="color: var(--warn); font-family: var(--mono);">${(run.latency_ms / 1000).toFixed(1)}s</span>`
        : `<span style="color: var(--brand); font-family: var(--mono);">${run.latency_ms}ms</span>`;

      const scoreHtml = run.llm_judge_score
        ? `<span class="badge ${run.llm_judge_score >= 4 ? 'green' : 'amber'}">${run.llm_judge_score} / 5</span>`
        : `<span style="color: var(--fg-3); font-size: 11.5px;">Unscored</span>`;

      const currentRating = run.rating || '';

      return `
        <tr data-log-id="${run.id}">
          <td class="strong mono">
            #${run.id}
            <div style="font-size: 11px; color: var(--fg-3);">${run.session_id}</div>
          </td>
          <td>${intentBadge}</td>
          <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(run.user_message)}">
            ${escapeHtml(run.user_message)}
          </td>
          <td>${latencyBadge}</td>
          <td>
            <div class="stars" data-id="${run.id}">
              ${renderStarButtons(run.id, run.llm_judge_score || 0)}
            </div>
          </td>
          <td>${scoreHtml}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn ghost btn-view-detail" data-id="${run.id}" title="View Answer & Citations">Inspect</button>
              <button class="btn primary btn-judge" data-id="${run.id}" title="Run LLM Judge Audit">Evaluate</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach inspect click handlers
    document.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(btn.dataset.id, 10);
        const log = runs.find(r => r.id === id);
        if (log) showDetailModal(log);
      });
    });

    // Attach judge click handlers
    document.querySelectorAll('.btn-judge').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        btn.disabled = true;
        btn.textContent = 'Judging...';
        try {
          const res = await api.triggerLLMJudge(id);
          showToast(`Evaluated! Judge score: ${res.data.evaluation.score}/5`);
          await loadRunsTable();
        } catch (err) {
          showToast(`Evaluation error: ${err.message}`);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Evaluate';
        }
      });
    });

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: var(--danger); text-align: center;">Failed to load logs: ${error.message}</td></tr>`;
  }
}

function renderStarButtons(logId, score) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const active = i <= score ? 'on' : '';
    html += `
      <button class="${active}" onclick="window.__rateLog(${logId}, ${i})" title="Rate ${i} star">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </button>
    `;
  }
  return html;
}

window.__rateLog = async (logId, stars) => {
  try {
    const rating = stars >= 4 ? 'thumbs_up' : 'thumbs_down';
    await api.submitHumanFeedback({
      chatLogId: logId,
      rating,
      feedback: `Rated ${stars} stars via Runs Dashboard`,
    });
    showToast(`Rated ${stars} stars! Saved to audit evaluations.`);
    loadRunsTable();
  } catch (err) {
    showToast(`Failed to rate: ${err.message}`);
  }
};

function showDetailModal(log) {
  const citations = Array.isArray(log.citations) ? log.citations : JSON.parse(log.citations || '[]');
  const citationsHtml = citations.length > 0 ? citations.map(c => `
    <div style="background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-weight: 500; font-size: 12px; margin-bottom: 4px;">
        <span style="color: var(--brand);">${escapeHtml(c.heading || 'Article')}</span>
        <span class="mono" style="color: var(--fg-3);">Similarity: ${c.similarityScore || 'N/A'}</span>
      </div>
      <div style="font-size: 11.5px; color: var(--fg-3); margin-bottom: 6px;">${escapeHtml(c.documentTitle || '')} (${escapeHtml(c.documentNumber || '')})</div>
      <div style="font-size: 12.5px; color: var(--fg-2); white-space: pre-wrap; font-family: var(--mono);">${escapeHtml(c.fullText || c.snippet || '')}</div>
    </div>
  `).join('') : '<p style="color: var(--fg-3);">No document citations retrieved (e.g., fast greeting or blocked).</p>';

  const judgeInfoHtml = log.llm_judge_score ? `
    <div style="background: var(--brand-dim); border: 1px solid rgba(62,207,142,0.3); border-radius: 6px; padding: 12px; margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <strong style="color: var(--brand);">LLM-as-a-Judge Score: ${log.llm_judge_score} / 5</strong>
      </div>
      <div style="font-size: 12.5px; color: var(--fg-2);">${escapeHtml(log.llm_judge_reasoning || '')}</div>
    </div>
  ` : '';

  showModal({
    title: `Run Details #${log.id} (${log.app.toUpperCase()})`,
    subtitle: `Executed at ${new Date(log.created_at).toLocaleString()} | Latency: ${log.latency_ms}ms`,
    contentHtml: `
      ${judgeInfoHtml}
      <div style="margin-bottom: 14px;">
        <label class="lbl">User Question</label>
        <div style="background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid var(--border); font-size: 13.5px;">${escapeHtml(log.user_message)}</div>
      </div>
      <div style="margin-bottom: 14px;">
        <label class="lbl">AI Response</label>
        <div style="background: #1a1a1a; padding: 12px; border-radius: 6px; border: 1px solid var(--border); font-size: 13.5px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(log.ai_response)}</div>
      </div>
      <div>
        <label class="lbl">Retrieved Citations (${citations.length})</label>
        ${citationsHtml}
      </div>
    `,
    footerHtml: `
      <button class="btn" onclick="document.getElementById('modalContainer').classList.add('hidden')">Close</button>
    `,
  });
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
