(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const queueSection = document.getElementById('queue');
  const queueList = document.getElementById('queue-list');
  const validateBtn = document.getElementById('validate-btn');
  const resultsSection = document.getElementById('results');
  const resultsList = document.getElementById('results-list');
  const statTotal = document.getElementById('stat-total');
  const statAprobadas = document.getElementById('stat-aprobadas');
  const statRechazadas = document.getElementById('stat-rechazadas');
  const progressOk = document.getElementById('progress-ok');
  const progressBad = document.getElementById('progress-bad');
  const globalError = document.getElementById('global-error');

  const pdfModal = document.getElementById('pdf-modal');
  const pdfModalTitle = document.getElementById('pdf-modal-title');
  const pdfModalFrame = document.getElementById('pdf-modal-frame');
  const pdfModalClose = document.getElementById('pdf-modal-close');
  const pdfModalBackdrop = pdfModal.querySelector('.pdf-modal-backdrop');

  let selectedFiles = [];
  let objectUrls = [];

  // ---------- PDF preview modal ----------

  function openPdfModal(url, name) {
    pdfModalTitle.textContent = name;
    pdfModalFrame.src = url;
    pdfModal.hidden = false;
  }

  function closePdfModal() {
    pdfModal.hidden = true;
    pdfModalFrame.src = '';
  }

  pdfModalClose.addEventListener('click', closePdfModal);
  pdfModalBackdrop.addEventListener('click', closePdfModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pdfModal.hidden) closePdfModal();
  });

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

    const filesForThisRun = selectedFiles.slice();
    const formData = new FormData();
    filesForThisRun.forEach((file) => formData.append('files', file, file.name));

    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al validar los archivos.');
      }

      renderResults(data.resultados, filesForThisRun);
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

  function renderResults(resultados, files) {
    resultsSection.hidden = false;
    resultsList.innerHTML = '';

    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];

    const total = resultados.length;
    const aprobadas = resultados.filter((r) => r.aprobado).length;
    const rechazadas = total - aprobadas;

    statTotal.textContent = total;
    statAprobadas.textContent = aprobadas;
    statRechazadas.textContent = rechazadas;
    progressOk.style.width = `${total ? (aprobadas / total) * 100 : 0}%`;
    progressBad.style.width = `${total ? (rechazadas / total) * 100 : 0}%`;

    resultados.forEach((r, index) => {
      const card = document.createElement('div');
      card.className = 'result-card';

      const file = files && files[index];
      let pdfUrl = null;
      if (file) {
        pdfUrl = URL.createObjectURL(file);
        objectUrls.push(pdfUrl);
      }
      const fileNameHtml = pdfUrl
        ? `<button type="button" class="result-file-name">${escapeHtml(r.archivo)}</button>`
        : `<div class="result-file-name">${escapeHtml(r.archivo)}</div>`;

      if (r.error) {
        card.innerHTML = `
          <div class="result-summary">
            <div class="result-file-info">
              ${fileNameHtml}
              <div class="result-doc-type">Error de procesamiento</div>
            </div>
            <span class="badge bad">RECHAZADA</span>
          </div>
          <div class="result-error">${escapeHtml(r.error)}</div>
        `;
        const fileBtn = card.querySelector('button.result-file-name');
        if (fileBtn) {
          fileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPdfModal(pdfUrl, r.archivo);
          });
        }
        resultsList.appendChild(card);
        return;
      }

      const badgeClass = r.aprobado ? 'ok' : 'bad';
      const badgeText = r.aprobado ? 'APROBADA' : 'RECHAZADA';

      const checksHtml = r.checks
        .map((c) => {
          const iconClass = c.informativo ? 'info' : c.cumple ? 'ok' : 'bad';
          const icon = c.informativo ? 'i' : c.cumple ? '✓' : '✕';
          return `
        <div class="check-row">
          <span class="check-icon ${iconClass}">${icon}</span>
          <div class="check-text">
            <div class="req">${escapeHtml(c.requisito)}${c.informativo ? ' <span class="info-tag">informativo</span>' : ''}</div>
            <div class="detail">${escapeHtml(c.detalle)}</div>
          </div>
        </div>
      `;
        })
        .join('');

      card.innerHTML = `
        <div class="result-summary">
          <div class="result-file-info">
            ${fileNameHtml}
            <div class="result-doc-type">${docTypeLabel(r.tipoDocumento)}</div>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="result-details">${checksHtml}</div>
      `;

      card.querySelector('.result-summary').addEventListener('click', () => {
        card.classList.toggle('open');
      });

      const fileBtn = card.querySelector('button.result-file-name');
      if (fileBtn) {
        fileBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openPdfModal(pdfUrl, r.archivo);
        });
      }

      resultsList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
