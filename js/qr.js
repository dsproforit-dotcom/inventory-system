// =========================================================
// 🔳 QR CODE — გენერირება და ბეჭდვა
// =========================================================

function openQrModal(index) {
    const item = currentResults[index];

    document.getElementById('qrItemName').innerText = item.name;
    document.getElementById('qrItemId').innerText = item.item_id;

    // ძველი QR-ის გასუფთავება
    const qrDiv = document.getElementById('qrcode');
    qrDiv.innerHTML = '';

    // ახალი QR-ის გენერირება
    new QRCode(qrDiv, {
        text: item.item_id,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
    });

    document.getElementById('qrModal').style.display = 'block';
}

function closeQrModal() {
    document.getElementById('qrModal').style.display = 'none';
    document.getElementById('qrcode').innerHTML = '';
}

function printQR() {
    const itemName = document.getElementById('qrItemName').innerText;
    const itemId = document.getElementById('qrItemId').innerText;
    const qrHtml = document.getElementById('qrcode').innerHTML;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
    <html><head><title>QR - ${itemId}</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; text-align: center; padding: 40px; }
      h2 { margin-bottom: 5px; }
      p { color: #666; margin-top: 0; }
    </style></head>
    <body>
      <h2>${itemName}</h2>
      <p>${itemId}</p>
      ${qrHtml}
      <script>window.onload = function() { window.print(); window.close(); }<\/script>
    </body></html>
  `);
    printWindow.document.close();
}

// =========================================================
// ✅ SELECT ALL & PRINT SHEET
// =========================================================
function toggleSelectAll(masterCheckbox) {
    document.querySelectorAll('.row-select').forEach(cb => {
        cb.checked = masterCheckbox.checked;
    });
}

function printSelectedQR() {
    const selected = [];
    document.querySelectorAll('.row-select:checked').forEach(cb => {
        const index = parseInt(cb.value);
        const item = currentResults[index];
        selected.push({ id: item.item_id, name: item.name });
    });

    if (selected.length === 0) return alert('Please select at least one item!');
    if (selected.length > 36) return alert(`Too many selected (${selected.length}). Max 36.`);

    const printWindow = window.open('', '_blank');

    const itemDivs = selected.map(item => `
    <div class="qr-item">
      <div id="qr-${item.id.replace(/[^a-zA-Z0-9]/g, '_')}"></div>
      <div class="qr-label">
        <strong>${item.name}</strong>
        <span>${item.id}</span>
      </div>
    </div>
  `).join('');

    const qrScripts = selected.map(item => {
        const safeId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
        return `new QRCode(document.getElementById('qr-${safeId}'), {
      text: '${item.id}',
      width: 120,
      height: 120,
      colorDark: '#000000',
      colorLight: '#ffffff'
    });`;
    }).join('\n');

  printWindow.document.write(`
    <html>
    <head>
      <title>QR Sheet</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: white; }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding: 8px;
          width: 210mm;
        }
        .qr-item {
          border: 1px dashed #aaa;
          border-radius: 4px;
          padding: 6px 4px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          page-break-inside: avoid;
        }
        .qr-item img { max-width: 100%; height: auto; }
        .qr-label { margin-top: 4px; }
        .qr-label strong {
          display: block;
          font-size: 9px;
          max-width: 120px;
          word-break: break-word;
          line-height: 1.2;
        }
        .qr-label span {
          font-size: 8px;
          color: #555;
        }
        @media print {
          body { margin: 0; padding: 0; }
          .grid { padding: 5mm; gap: 3px; }
        }
      </style>
    </head>
    <body>
      <div class="grid">${itemDivs}</div>
      <script>
        window.onload = function() {
          ${qrScripts}
          setTimeout(function() { window.print(); }, 800);
        };
      <\/script>
    </body>
    </html>
  `);
    printWindow.document.close();
}