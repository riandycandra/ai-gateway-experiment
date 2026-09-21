export function renderJobsPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-h">
        <div>
          <h2>Knowledge Jobs (Tenants)</h2>
          <p>Managed knowledge bases and integration targets for internal corporate applications.</p>
        </div>
      </div>

      <div style="display: grid; gap: 16px;">
        <!-- Job 1: JDIH -->
        <div class="card">
          <div class="card-h">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 34px; height: 34px; border-radius: 6px; background: var(--brand-dim); border: 1px solid rgba(62,207,142,0.24); display: grid; place-items: center; color: var(--brand);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h3"/></svg>
              </div>
              <div>
                <div class="card-t">JDIH — Legal Documents & Regulations</div>
                <div class="card-s">Tenant ID: <code>jdih</code> | Type: Vector RAG</div>
              </div>
            </div>
            <span class="badge green"><span class="dot"></span>Active</span>
          </div>
          <div class="card-b">
            <p style="color: var(--fg-2); margin-top: 0; font-size: 13px; line-height: 1.6;">
              Indexes legal decree PDFs, standard operating procedures (SOP), and company regulations.
              Uses <strong>Structure-Aware Chunking</strong> (BAB & Pasal boundary preservation) stored in <code>pgvector</code>.
            </p>
            <div style="display: flex; gap: 24px; font-size: 12px; color: var(--fg-3); border-top: 1px solid var(--border); padding-top: 12px; margin-top: 14px;">
              <div>Vector Index: <span class="mono" style="color: var(--fg-2);">HNSW Cosine</span></div>
              <div>Dimension: <span class="mono" style="color: var(--fg-2);">1024</span></div>
              <div>Embeddings: <span class="mono" style="color: var(--fg-2);">mistral-embed</span></div>
              <div>Target Model: <span class="mono" style="color: var(--fg-2);">open-mistral-7b</span></div>
            </div>
          </div>
        </div>

        <!-- Job 2: HC -->
        <div class="card">
          <div class="card-h">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 34px; height: 34px; border-radius: 6px; background: var(--warn-dim); border: 1px solid rgba(245,166,35,0.24); display: grid; place-items: center; color: var(--warn);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <div class="card-t">HC — Human Capital & Employee Records</div>
                <div class="card-s">Tenant ID: <code>hc</code> | Type: Tool Calling / Structured DB</div>
              </div>
            </div>
            <span class="badge amber"><span class="dot"></span>Planned</span>
          </div>
          <div class="card-b">
            <p style="color: var(--fg-2); margin-top: 0; font-size: 13px; line-height: 1.6;">
              Queries relational PostgreSQL replicas to retrieve user-specific records (e.g. personal leave balance, attendance history).
              Protected with strict parameter validation and authenticated <code>user_id</code> enforcement.
            </p>
            <div style="display: flex; gap: 24px; font-size: 12px; color: var(--fg-3); border-top: 1px solid var(--border); padding-top: 12px; margin-top: 14px;">
              <div>Integration: <span class="mono" style="color: var(--fg-2);">PostgreSQL Read-Only Replica</span></div>
              <div>Pattern: <span class="mono" style="color: var(--fg-2);">Function / Tool Calling</span></div>
              <div>Status: <span class="mono" style="color: var(--fg-2);">Phase 2 Development</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
