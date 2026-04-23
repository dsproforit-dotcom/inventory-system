// =========================================================
// 🛠️ UTILS — დამხმარე ფუნქციები
// =========================================================

// HTML სიმბოლოების დაცვა XSS-ისგან
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ID-ის კლიპბოარდში კოპირება
function copyId(id, btn) {
    navigator.clipboard.writeText(id).then(() => {
        const old = btn.innerText;
        btn.innerText = '✅ OK';
        setTimeout(() => btn.innerText = old, 1500);
    });
}

// შეტყობინების ჩვენება
function showMessage(text, type) {
    const msg = document.getElementById('message');
    if (!msg) return;
    msg.style.display = 'block';
    msg.className = 'message ' + type;
    msg.innerText = text;

    // timeout მხოლოდ success/error-ზე, არა loading-ზე
    if (type !== 'loading') {
        setTimeout(() => msg.style.display = 'none', 4000);
    }
}

// შეცდომის ჩვენება
function displayError(e) {
    showMessage('❌ Error: ' + e.message, 'error');
}

// ცხრილის სორტირება
const sortColumnMap = { 1: 'name', 2: 'category', 3: 'quantity', 4: 'location' };
let sortDirection = true;
function sortTable(columnIndex) {
    if (currentResults.length === 0) return;
    const key = sortColumnMap[columnIndex];
    if (!key) return;
    sortDirection = !sortDirection;
    currentResults.sort((a, b) => {
        let valA = a[key], valB = b[key];
        if (typeof valA === 'number' && typeof valB === 'number') return sortDirection ? valA - valB : valB - valA;
        valA = String(valA ?? '').toLowerCase();
        valB = String(valB ?? '').toLowerCase();
        return sortDirection ? (valA < valB ? -1 : 1) : (valA < valB ? 1 : -1);
    });
    displayResults(currentResults);
}

// =========================================================
// 🌙 DARK MODE
// =========================================================
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) toggleBtn.innerText = '☀️';
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('themeToggle');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        btn.innerText = '☀️';
    } else {
        localStorage.setItem('theme', 'light');
        btn.innerText = '🌙';
    }
}

// თარიღის ფორმატირება
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// როლის შემოწმება
function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

function isManager() {
    const user = getCurrentUser();
    return user && ['admin', 'manager'].includes(user.role);
}

function showLoginPage() {
    window.location.href = 'index.html';
}