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
    
    try {
        const data = await api.getDashboard();
        if (!data) return;

        document.getElementById('dash-message').style.display = 'none';
        document.getElementById('kpi-unique').innerText = data.total_items;
        document.getElementById('kpi-total').innerText = data.total_qty;
        document.getElementById('kpi-low-it').innerText = data.low_stock_it;
        document.getElementById('kpi-low-floor').innerText = data.low_stock_floor;

        document.getElementById('kpi-section').style.display = 'grid';
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
        document.getElementById('userDisplay').innerText = `👤 ${user.username} (${user.role})`;
    }

    // როლის მიხედვით ღილაკების მართვა
    if (user) {
        if (user.role === 'viewer') {
            // viewer-ს ეს ღილაკები არ ჩანს
            document.querySelector('[onclick="openModal()"]')?.style.setProperty('display', 'none');
            document.querySelector('[onclick="openTransferModal()"]')?.style.setProperty('display', 'none');
            document.querySelector('[onclick="deleteSelected()"]')?.style.setProperty('display', 'none');
            document.querySelector('[onclick*="excelImport"]')?.style.setProperty('display', 'none');
            document.querySelector('[onclick="downloadExcelTemplate()"]')?.style.setProperty('display', 'none');
            document.querySelector('[onclick="printSelectedQR()"]')?.style.setProperty('display', 'none');
        }

        if (user.role === 'admin') {
            // admin-ს admin პანელის ლინკი ჩანს
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = 'inline-block';            
        }
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
window.onload = async function () {
    // login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // token შემოწმება — backend-ზე ვალიდაცია
    const token = getToken();
    if (token) {
        try {
            const me = await api.me();
            if (me) {
                setCurrentUser(me);
                showMainApp();
                initApp();
            } else {
                showLoginPage();
            }
        } catch (e) {
            removeToken();
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
};



// =========================================================
// 👤 PROFILE MODAL
// =========================================================
function openProfileModal() {
    const user = getCurrentUser();
    if (user) {
        document.getElementById('profileInfo').innerHTML = `
            <p><strong>👤 Username:</strong> ${user.username}</p>
            <p><strong>🎭 Role:</strong> ${user.role}</p>
        `;
    }
    document.getElementById('profileModal').style.display = 'block';
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('profileMessage').style.display = 'none';
}

async function submitChangePassword() {
    const current = document.getElementById('currentPassword').value.trim();
    const newPass = document.getElementById('newPassword').value.trim();
    const confirm = document.getElementById('confirmPassword').value.trim();
    const msg = document.getElementById('profileMessage');

    if (!current || !newPass || !confirm) {
        msg.style.display = 'block';
        msg.className = 'message error';
        msg.innerText = '❌ Please fill all fields!';
        return;
    }

    if (newPass !== confirm) {
        msg.style.display = 'block';
        msg.className = 'message error';
        msg.innerText = '❌ Passwords do not match!';
        return;
    }

    if (newPass.length < 6) {
        msg.style.display = 'block';
        msg.className = 'message error';
        msg.innerText = '❌ Password must be at least 6 characters!';
        return;
    }

    try {
        await api.changePassword({
            current_password: current,
            new_password: newPass
        });
        msg.style.display = 'block';
        msg.className = 'message success';
        msg.innerText = '✅ Password changed successfully!';
        ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
            document.getElementById(id).value = '';
        });
    } catch (e) {
        msg.style.display = 'block';
        msg.className = 'message error';
        msg.innerText = '❌ ' + e.message;
    }
}