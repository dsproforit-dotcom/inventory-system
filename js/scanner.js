// =========================================================
// 📷 QR SCANNER — კამერით სკანირება
// =========================================================
let html5QrCode;
let isScannerRunning = false;

function startScanner(targetInputId) {
    document.getElementById('scannerModal').style.display = 'block';
    if (!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");

    html5QrCode.start(
        { facingMode: "environment" },
        {
            fps: 15,
            qrbox: { width: 250, height: 150 },
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
            ]
        },
        (decodedText) => {
            document.getElementById(targetInputId).value = decodedText;
            stopScanner();
            if (targetInputId === 'search') search();
            if (targetInputId === 'historySearch') searchHistory();
        },
        (errorMessage) => { }
    ).then(() => {
        isScannerRunning = true;
    }).catch(err => {
        alert("Camera initialization failed!");
        stopScanner();
    });
}

function stopScanner() {
    document.getElementById('scannerModal').style.display = 'none';
    if (html5QrCode && isScannerRunning) {
        html5QrCode.stop()
            .then(() => { isScannerRunning = false; })
            .catch(err => console.log(err));
    }
}

function checkScannerClick(e) {
    if (e.target.id === 'scannerModal') stopScanner();
}