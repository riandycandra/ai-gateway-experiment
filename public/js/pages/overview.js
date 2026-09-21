import { api } from '../api.js';

export async function renderOverviewPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-h">
        <div>
          <h2>System Overview & Analytics</h2>
          <p>Real-time metrics on AI gateway throughput, latency performance, and safety guardrails.</p>
        </div>
      </div>

      <div class="stats" id="statsGrid">
        <div class="stat">
          <div class="k">Total Executions</div>
          <div class="v" id="statTotalRuns">-</div>
          <div class="d">Queries handled by Gateway</div>
        </div>
        <div class="stat">
          <div class="k">Avg Latency</div>
          <div class="v" id="statAvgLatency">-</div>
          <div class="d">End-to-end response time</div>
        </div>
        <div class="stat">
          <div class="k">Success Rate</div>
          <div class="v up" id="statSuccessRate">-</div>
          <div class="d">Grounded queries completed</div>
        </div>
        <div class="stat">
          <div class="k">Blocked Injections</div>
          <div class="v down" id="statBlocked">-</div>
          <div class="d">Stopped by Guardrail L1</div>
        </div>
      </div>

      <div class="card" style="margin-top: 20px;">
        <div class="card-h">
          <div>
            <div class="card-t">Enterprise AI Pipeline Architecture</div>
            <div class="card-s">Connected Services & Models</div>
          </div>
        </div>
        <div class="card-b">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;">
            <div style="background: var(--panel-2); padding: 14px; border-radius: 6px; border: 1px solid var(--border);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--brand); font-weight: 600; margin-bottom: 6px;">Vector Database</div>
              <div style="font-size: 15px; font-weight: 500;">PostgreSQL 16</div>
              <div style="font-size: 12px; color: var(--fg-3); margin-top: 4px;">pgvector + HNSW Indexing (1024-dim)</div>
            </div>
            <div style="background: var(--panel-2); padding: 14px; border-radius: 6px; border: 1px solid var(--border);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--brand); font-weight: 600; margin-bottom: 6px;">Embeddings Model</div>
              <div style="font-size: 15px; font-weight: 500;">Mistral Embed</div>
              <div style="font-size: 12px; color: var(--fg-3); margin-top: 4px;">mistral-embed API (Cloud)</div>
            </div>
            <div style="background: var(--panel-2); padding: 14px; border-radius: 6px; border: 1px solid var(--border);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--brand); font-weight: 600; margin-bottom: 6px;">Reasoning & LLM</div>
              <div style="font-size: 15px; font-weight: 500;">open-mistral-7b</div>
              <div style="font-size: 12px; color: var(--fg-3); margin-top: 4px;">Strict RAG Synthesis + LLM Judge</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const { data: stats } = await api.getAnalyticsStats();
    if (stats) {
      document.getElementById('statTotalRuns').textContent = stats.totalRuns || 0;
      document.getElementById('statAvgLatency').textContent = `${stats.avgLatencyMs || 0}ms`;
      document.getElementById('statSuccessRate').textContent = stats.successRate || '100%';
      document.getElementById('statBlocked').textContent = stats.blockedRuns || 0;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}
