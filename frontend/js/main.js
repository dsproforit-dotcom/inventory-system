// =========================================================
// 🚀 MAIN — აპლიკაციის მთავარი ლოგიკა
// =========================================================

let fullInventoryData = [];
let fullHistoryData = [];
let currentResults = [];
let currentHistoryResults = [];
let appSettings = { categories: [], locations: [] };

// =========================================================
// 🔐 AUTH — login/logout
// =========================================================
function showLoginPage() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const btn = document.getElementById('loginBtn');
    const error = document.getElementById('loginError');

    btn.innerText = '⏳ Logging in...';
    btn.disabled = true;
    error.style.display = 'none';

    try {
        const result = await api.login(username, password);

        if (result.access_token) {
            setToken(result.access_token);
            setCurrentUser(result.user);
            showMainApp();
            initApp();
        } else {
            error.innerText = result.detail || 'Invalid credentials';
            error.style.display = 'block';
        }
    } catch (e) {
        error.innerText = 'Connection error. Please try again.';
        error.style.display = 'block';
    } finally {
        btn.innerText = '🔐 Login';
        btn.disabled = false;
    }
}

function handleLogout() {
    removeToken();
    showLoginPage();
}

// =========================================================
// 📊 TABS
// =========================================================
function switchTab(tabName) {
    ['dashboard', 'inventory', 'history'].forEach(name => {
        document.getElementById('view-' + name).classList.remove('active');
        document.getElementById('btn-' + name).classList.remove('active');
    });
    document.getElementById('view-' + tabName).classList.add('active');
    document.getElementById('btn-' + tabName).classList.add('active');

    if (tabName === 'dashboard') loadDashboardData();
    if (tabName === 'history') {
        if (fullHistoryData.length === 0) {
            loadHistoryData();
        } else {
            searchHistory();
        }
    }
}

// =========================================================
// 📊 DASHBOARD
// =========================================================
async function loadDashboardData() {
    document.getElementById('dash-message').style.display = 'block';
    document.getElementById('kpi-section').style.display = 'none';
    document.getElementById('activity-section').style.display = 'none';

    try {
        const data = await api.getDashboard();
        if (!data) return;

        document.getElementById('dash-message').style.display = 'none';
        document.getElementById('kpi-unique').innerText = data.total_items;
        document.getElementById('kpi-total').innerText = data.total_qty;
        document.getElementById('kpi-low-it').innerText = data.low_stock_it;
        document.getElementById('kpi-low-floor').innerText = data.low_stock_floor;

        // ბოლო აქტივობა
        const actList = document.getElementById('activity-list');
        let actHtml = '<div class="table-container"><table style="margin:0;">';
        actHtml += '<thead><tr><th>Date</th><th>Action</th><th>Item</th><th>Qty</th><th>Route</th><th>By</th></tr></thead><tbody>';

        data.recent_history.forEach(r => {
            let route = '';
            if (r.action === 'ADD' || r.action === 'RESTOCK') route = `➔ ${r.to_location}`;
            else if (r.action === 'TRANSFER') route = `${r.from_location} ➔ ${r.to_location}`;
            else route = `From: ${r.from_location}`;

            actHtml += `<tr>
        <td data-label="Date" style="color:#7f8c8d;font-size:13px;">${formatDate(r.created_at)}</td>
        <td data-label="Action"><span class="badge ${r.action}">${r.action}</span></td>
        <td data-label="Item"><strong>${escapeHtml(r.item_name)}</strong><br>
          <span style="font-size:11px;color:#aaa;">${escapeHtml(r.item_id)}</span></td>
        <td data-label="Qty" style="font-weight:bold;">${r.quantity}</td>
        <td data-label="Route" style="color:#555;font-size:14px;">${route}</td>
        <td data-label="By" style="color:#777;font-size:13px;">${escapeHtml(r.responsible)}</td>
      </tr>`;
        });

        actHtml += '</tbody></table></div>';
        actList.innerHTML = actHtml;

        document.getElementById('kpi-section').style.display = 'grid';
        document.getElementById('activity-section').style.display = 'block';
    } catch (e) {
        document.getElementById('dash-message').innerText = '❌ Error loading dashboard';
    }
}

// =========================================================
// 🚀 APP INIT
// =========================================================
async function initApp() {
    // მომხმარებლის სახელი header-ში
    const user = getCurrentUser();
    if (user) {
        document.getElementById('userDisplay').innerText = `👤 ${user.full_name} (${user.role})`;
    }

    // Settings ჩატვირთვა
    try {
        appSettings = await api.getSettings();
        populateDropdowns();
    } catch (e) {
        console.error('Settings load failed', e);
    }

    // Inventory ჩატვირთვა
    await fetchFullInventory();

    // Dashboard
    loadDashboardData();
}

// =========================================================
// 🎯 APP START
// =========================================================
window.onload = function () {
    // login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // token შემოწმება
    const token = getToken();
    if (token) {
        showMainApp();
        initApp();
    } else {
        showLoginPage();
    }
};