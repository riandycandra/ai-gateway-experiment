import { showToast } from '../components/modal.js';

export function renderJobsPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-h">
        <div>
          <h2>Document Ingestion & Knowledge Bases</h2>
          <p>Upload legal regulation PDFs to partition and chunk via Unstructured.io Cloud directly into Qdrant Cloud.</p>
        </div>
      </div>

      <div style="display: grid; gap: 20px;">
        <!-- Ingestion Form Card -->
        <div class="card" style="border: 1px solid rgba(62, 207, 142, 0.3); box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
          <div class="card-h">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--brand-dim); border: 1px solid rgba(62,207,142,0.3); display: grid; place-items: center; color: var(--brand);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <div class="card-t" style="font-size: 15px; font-weight: 600;">Upload & Ingest PDF Document</div>
                <div class="card-s">Pipeline: Unstructured.io Cloud ➔ Mistral AI (1024-dim) ➔ Qdrant Cloud</div>
              </div>
            </div>
            <span class="badge green"><span class="dot"></span>Ready</span>
          </div>

          <div class="card-b">
            <!-- Dropzone Area -->
            <input type="file" id="pdfFileInput" accept=".pdf" style="display: none;" />
            <div id="dropzone" class="dropzone">
              <div class="dropzone-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="12" y2="12"/>
                  <line x1="15" y1="15" x2="12" y2="12"/>
                </svg>
              </div>
              <div style="font-weight: 500; font-size: 14px; color: var(--fg);">
                Click to browse or drag & drop PDF file here
              </div>
              <div style="font-size: 12px; color: var(--fg-3); margin-top: 4px;">
                Supports legal regulations, SOPs, decrees, and policies (Max 30 MB)
              </div>
              
              <!-- File Selected Info (Hidden by default) -->
              <div id="selectedFileInfo" class="file-selected-badge hidden">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span id="selectedFileName" style="font-weight: 500;">filename.pdf</span>
                <span id="selectedFileSize" style="color: var(--fg-3); font-size: 12px;">(0 KB)</span>
                <button type="button" id="btnRemoveFile" class="btn ghost" style="padding: 0 4px; height: 20px; font-size: 11px; color: var(--danger);">Change</button>
              </div>
            </div>

            <!-- Form Metadata Inputs -->
            <div class="ingest-grid">
              <div class="field" style="margin-bottom: 0;">
                <label class="lbl" for="docTitle">Document Title</label>
                <input class="input" id="docTitle" type="text" placeholder="e.g. Peraturan Perusahaan PT Example 2026" />
              </div>
              <div class="field" style="margin-bottom: 0;">
                <label class="lbl" for="docNumber">Document / Decree Number</label>
                <input class="input" id="docNumber" type="text" placeholder="e.g. PP-01/HR/2026 or UU No. 13/2003" />
              </div>
            </div>

            <div class="field" style="margin-top: 14px; margin-bottom: 0;">
              <label class="lbl" for="docCategory">Document Category</label>
              <select class="input" id="docCategory">
                <option value="Peraturan Perusahaan">Peraturan Perusahaan (Company Regulations)</option>
                <option value="Surat Keputusan Direksi">Surat Keputusan (SK) Direksi</option>
                <option value="Standard Operating Procedure (SOP)">Standard Operating Procedure (SOP)</option>
                <option value="Peraturan Pemerintah / UU">Peraturan Pemerintah / Undang-Undang</option>
                <option value="Kebijakan Umum">Kebijakan Umum & Pedoman Internal</option>
              </select>
            </div>

            <!-- Action Button & Status -->
            <div style="margin-top: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <button class="btn primary" id="btnStartIngest" style="height: 38px; padding: 0 18px; font-size: 13.5px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Upload & Ingest to Qdrant Cloud</span>
              </button>
              <div id="ingestHelperText" style="font-size: 12.5px; color: var(--fg-3);">
                Uses Unstructured.io smart title-aware boundary detection.
              </div>
            </div>

            <!-- Ingestion Live Progress & Result Banner -->
            <div id="ingestProgressBanner" class="hidden" style="margin-top: 18px; padding: 14px; border-radius: 6px; background: var(--panel-2); border: 1px solid var(--border);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 18px; height: 18px; border: 2px solid var(--brand); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <div id="ingestProgressText" style="font-size: 13px; color: var(--fg); font-weight: 500;">
                  Mengirim ke Unstructured.io Cloud untuk smart chunking...
                </div>
              </div>
            </div>

            <div id="ingestResultBanner" class="hidden" style="margin-top: 18px; padding: 16px; border-radius: 6px; background: rgba(62, 207, 142, 0.08); border: 1px solid rgba(62, 207, 142, 0.3);">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; color: var(--brand); font-weight: 600; font-size: 14px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Dokumen Berhasil Dipartisi & Tersimpan di Qdrant Cloud!</span>
                  </div>
                  <div id="resultSummary" style="margin-top: 8px; font-size: 13px; color: var(--fg-2); line-height: 1.6;">
                    <!-- Filled dynamically -->
                  </div>
                </div>
                <button class="btn primary" id="btnGoToPlayground" style="height: 32px; padding: 0 12px; font-size: 12px;">
                  Test in Playground ➔
                </button>
              </div>
            </div>

            <div id="ingestErrorBanner" class="hidden" style="margin-top: 18px; padding: 14px; border-radius: 6px; background: var(--danger-dim); border: 1px solid rgba(245, 101, 101, 0.3); color: var(--danger); font-size: 13px;">
              <!-- Filled dynamically -->
            </div>
          </div>
        </div>

        <!-- Target Knowledge Base Info -->
        <div class="card">
          <div class="card-h">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 34px; height: 34px; border-radius: 6px; background: var(--brand-dim); border: 1px solid rgba(62,207,142,0.24); display: grid; place-items: center; color: var(--brand);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h3"/></svg>
              </div>
              <div>
                <div class="card-t">JDIH — Legal Documents & Regulations</div>
                <div class="card-s">Tenant ID: <code>jdih</code> | Engine: Qdrant Cloud</div>
              </div>
            </div>
            <span class="badge green"><span class="dot"></span>Active (Qdrant Cloud)</span>
          </div>
          <div class="card-b">
            <p style="color: var(--fg-2); margin-top: 0; font-size: 13px; line-height: 1.6;">
              Indexes legal decree PDFs, standard operating procedures (SOP), and company regulations.
              Uses <strong>Unstructured.io Cloud Smart Chunking</strong> (BAB & Pasal boundary preservation) and stores dense vectors in <strong>Qdrant Cloud</strong>.
            </p>
            <div style="display: flex; gap: 24px; font-size: 12px; color: var(--fg-3); border-top: 1px solid var(--border); padding-top: 12px; margin-top: 14px; flex-wrap: wrap;">
              <div>Collection: <span class="mono" style="color: var(--brand);">jdih_documents</span></div>
              <div>Vector Metric: <span class="mono" style="color: var(--fg-2);">Cosine</span></div>
              <div>Dimension: <span class="mono" style="color: var(--fg-2);">1024</span></div>
              <div>Embeddings: <span class="mono" style="color: var(--fg-2);">mistral-embed</span></div>
              <div>Chunker: <span class="mono" style="color: var(--fg-2);">Unstructured.io (by_title)</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // --- Attach Interactive Event Handlers ---
  const fileInput = container.querySelector('#pdfFileInput');
  const dropzone = container.querySelector('#dropzone');
  const selectedFileInfo = container.querySelector('#selectedFileInfo');
  const selectedFileName = container.querySelector('#selectedFileName');
  const selectedFileSize = container.querySelector('#selectedFileSize');
  const btnRemoveFile = container.querySelector('#btnRemoveFile');
  const docTitleInput = container.querySelector('#docTitle');
  const docNumberInput = container.querySelector('#docNumber');
  const docCategorySelect = container.querySelector('#docCategory');
  const btnStartIngest = container.querySelector('#btnStartIngest');
  const progressBanner = container.querySelector('#ingestProgressBanner');
  const progressText = container.querySelector('#ingestProgressText');
  const resultBanner = container.querySelector('#ingestResultBanner');
  const resultSummary = container.querySelector('#resultSummary');
  const errorBanner = container.querySelector('#ingestErrorBanner');
  const btnGoToPlayground = container.querySelector('#btnGoToPlayground');

  let currentSelectedFile = null;

  function setSelectedFile(file) {
    if (!file) {
      currentSelectedFile = null;
      selectedFileInfo.classList.add('hidden');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Harap pilih file dokumen berformat PDF.');
      return;
    }

    currentSelectedFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    selectedFileInfo.classList.remove('hidden');

    // Auto-fill title if empty
    if (!docTitleInput.value.trim()) {
      docTitleInput.value = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
    }
  }

  // Click dropzone to open file picker
  dropzone.addEventListener('click', (e) => {
    if (e.target !== btnRemoveFile) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      setSelectedFile(fileInput.files[0]);
    }
  });

  btnRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value = '';
    setSelectedFile(null);
  });

  // Drag and drop handlers
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  });

  // Submit Ingestion
  btnStartIngest.addEventListener('click', async () => {
    if (!currentSelectedFile) {
      showToast('Pilih atau drop file PDF terlebih dahulu!');
      dropzone.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    errorBanner.classList.add('hidden');
    resultBanner.classList.add('hidden');
    progressBanner.classList.remove('hidden');
    btnStartIngest.disabled = true;
    btnStartIngest.style.opacity = '0.6';

    progressText.textContent = '1/3 Mengirim PDF ke Unstructured.io Cloud (partisi & smart chunking)...';

    const formData = new FormData();
    formData.append('file', currentSelectedFile);
    formData.append('title', docTitleInput.value.trim());
    formData.append('document_number', docNumberInput.value.trim());
    formData.append('category', docCategorySelect.value);

    // Dynamic progress simulation for UX
    const timer1 = setTimeout(() => {
      progressText.textContent = '2/3 Menghasilkan Vector Embeddings (1024-dim) via Mistral AI...';
    }, 3500);

    const timer2 = setTimeout(() => {
      progressText.textContent = '3/3 Menyimpan titik vektor & payload metadata ke Qdrant Cloud...';
    }, 7000);

    try {
      const response = await fetch('/v1/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Terjadi kesalahan saat memproses dokumen.');
      }

      // Success
      progressBanner.classList.add('hidden');
      resultBanner.classList.remove('hidden');

      resultSummary.innerHTML = `
        <strong>Judul Dokumen:</strong> ${data.document.title}<br>
        <strong>Total Chunks Terindeks:</strong> <span class="badge green" style="padding: 2px 6px;">${data.document.totalChunks} Chunks</span><br>
        <strong>Collection:</strong> <code>${data.qdrantCollection}</code> (Qdrant Cloud)<br>
        <strong>Waktu Pemrosesan:</strong> ${(data.processingTimeMs / 1000).toFixed(2)} detik
      `;

      showToast(`Sukses! ${data.document.totalChunks} chunks berhasil di-ingest ke Qdrant Cloud.`);
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      progressBanner.classList.add('hidden');
      errorBanner.classList.remove('hidden');
      errorBanner.innerHTML = `<strong>Gagal Mengunggah:</strong> ${err.message}`;
    } finally {
      btnStartIngest.disabled = false;
      btnStartIngest.style.opacity = '1';
    }
  });

  // Navigate to Playground
  btnGoToPlayground?.addEventListener('click', () => {
    const navPlayground = document.querySelector('.side a[data-nav="playground"]');
    if (navPlayground) {
      navPlayground.click();
    }
  });
}
