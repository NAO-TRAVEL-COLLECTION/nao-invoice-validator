(function () {
  const STORAGE_KEY = 'nao_app_password';

  const lockScreen = document.getElementById('lock-screen');
  const app = document.getElementById('app');
  const lockForm = document.getElementById('lock-form');
  const passwordInput = document.getElementById('password-input');
  const lockError = document.getElementById('lock-error');
  const logoutBtn = document.getElementById('logout-btn');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const queueSection = document.getElementById('queue');
  const queueList = document.getElementById('queue-list');
  const validateBtn = document.getElementById('validate-btn');
  const resultsSection = document.getElementById('results');
  const resultsList = document.getElementById('results-list');
  const summaryEl = document.getElementById('summary');
  const globalError = document.getElementById('global-error');

  let selectedFiles = [];

  // ---------- Auth ----------

  function showApp() {
    lockScreen.hidden = true;
    app.hidden = false;
  }

  function showLock() {
    app.hidden = true;
    lockScreen.hidden = false;
    passwordInput.value = '';
    passwordInput.focus();
  }

  async function verifyPassword(password) {
    const res = await fetch('/api/check-auth', {
      method: 'POST',
      headers: { 'x-app-password': password },
    });
    return res.ok;
  }

  lockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    lockError.hidden = true;
    const password = passwordInput.value.trim();
    const ok = await verifyPassword(password);
    if (ok) {
      sessionStorage.setItem(STORAGE_KEY, password);
      showApp();
    } else {
      lockError.hidden = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE_KEY);
    showLock();
  });

  const storedPassword = sessionStorage.getItem(STORAGE_KEY);
  if (storedPassword) {
    showApp();
  } else {
    showLock();
  }

  // ---------- File selection ----------

  dropzone.addEventListener('click', () => fileInput.click());

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
    addFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  function addFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type === 'application/pdf');
    selectedFiles = selectedFiles.concat(incoming);
    renderQueue();
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderQueue();
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderQueue() {
    queueSection.hidden = selectedFiles.length === 0;
    queueList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.innerHTML = `
        <span class="file-name">${escapeHtml(file.name)}</span>
        <span class="file-size">${formatSize(file.size)}</span>
        <button class="remove-btn" aria-label="Quitar archivo" data-index="${index}">✕</button>
      `;
      li.querySelector('.remove-btn').addEventListener('click', () => removeFile(index));
      queueList.appendChild(li);
    });
  }

  // ---------- Validation ----------

  validateBtn.addEventListener('click', async () => {
    if (!selectedFiles.length) return;

    globalError.hidden = true;
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validando...';

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('files', file, file.name));

    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'x-app-password': sessionStorage.getItem(STORAGE_KEY) || '' },
        body: formData,
      });

      if (res.status === 401) {
        sessionStorage.removeItem(STORAGE_KEY);
        showLock();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al validar los archivos.');
      }

      renderResults(data.resultados);
    } catch (err) {
      globalError.hidden = false;
      globalError.textContent = err.message;
    } finally {
      validateBtn.disabled = false;
      validateBtn.textContent = 'Validar facturas';
    }
  });

  function docTypeLabel(tipo) {
    if (tipo === 'CFDI_NACIONAL') return 'CFDI nacional';
    if (tipo === 'INVOICE_EXTRANJERO') return 'Invoice extranjero';
    return 'Tipo no identificado';
  }

  function renderResults(resultados) {
    resultsSection.hidden = false;
    resultsList.innerHTML = '';

    const aprobadas = resultados.filter((r) => r.aprobado).length;
    summaryEl.textContent = `${aprobadas} de ${resultados.length} aprobadas`;

    resultados.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'result-card';

      if (r.error) {
        card.innerHTML = `
          <div class="result-summary">
            <div class="result-file-info">
              <div class="result-file-name">${escapeHtml(r.archivo)}</div>
              <div class="result-doc-type">Error de procesamiento</div>
            </div>
            <span class="badge bad">RECHAZADA</span>
          </div>
          <div class="result-error">${escapeHtml(r.error)}</div>
        `;
        resultsList.appendChild(card);
        return;
      }

      const badgeClass = r.aprobado ? 'ok' : 'bad';
      const badgeText = r.aprobado ? 'APROBADA' : 'RECHAZADA';

      const checksHtml = r.checks
        .map(
          (c) => `
        <div class="check-row">
          <span class="check-icon ${c.cumple ? 'ok' : 'bad'}">${c.cumple ? '✓' : '✕'}</span>
          <div class="check-text">
            <div class="req">${escapeHtml(c.requisito)}</div>
            <div class="detail">${escapeHtml(c.detalle)}</div>
          </div>
        </div>
      `
        )
        .join('');

      card.innerHTML = `
        <div class="result-summary">
          <div class="result-file-info">
            <div class="result-file-name">${escapeHtml(r.archivo)}</div>
            <div class="result-doc-type">${docTypeLabel(r.tipoDocumento)}</div>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="result-details">${checksHtml}</div>
      `;

      card.querySelector('.result-summary').addEventListener('click', () => {
        card.classList.toggle('open');
      });

      resultsList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
