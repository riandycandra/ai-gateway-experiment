/**
 * Reusable modal and toast utilities
 */
export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

export function showModal({ title, subtitle, contentHtml, footerHtml }) {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="mdl">
      <div class="mdl-h">
        <div>
          <h4>${title}</h4>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
        <button class="btn ghost" id="btnCloseModal" style="padding: 2px 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="mdl-b">${contentHtml}</div>
      ${footerHtml ? `<div class="mdl-f">${footerHtml}</div>` : ''}
    </div>
  `;

  container.classList.remove('hidden');

  document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
  container.onclick = (e) => {
    if (e.target === container) closeModal();
  };
}

export function closeModal() {
  const container = document.getElementById('modalContainer');
  if (container) {
    container.classList.add('hidden');
    container.innerHTML = '';
  }
}
