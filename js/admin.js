// =========================================================
// ⚙️ ADMIN PANEL
// =========================================================

// =========================================================
// 🔐 ACCESS CHECK
// =========================================================
window.onload = async function () {
    const token = getToken();
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // backend-ზე token-ის ვალიდაცია
    try {
        const me = await api.me();
        if (!me) {
            window.location.href = 'index.html';
            return;
        }
        setCurrentUser(me);

        // admin არ არის — access denied
        if (me.role !== 'admin') {
            document.getElementById('accessDenied').style.display = 'block';
            return;
        }

        // admin-ია — პანელი გავხსნათ
        document.getElementById('adminApp').style.display = 'block';
        document.getElementById('adminUserDisplay').innerText = `👤 ${me.full_name} (${me.role})`;

        await loadUsers();
        await loadSettings();
    } catch (e) {
        removeToken();
        window.location.href = 'index.html';
    }
};

// =========================================================
// 📊 TABS
// =========================================================
function switchAdminTab(tabName) {
    ['users', 'settings'].forEach(name => {
        document.getElementById('view-' + name).classList.remove('active');
        document.getElementById('btn-' + name).classList.remove('active');
    });
    document.getElementById('view-' + tabName).classList.add('active');
    document.getElementById('btn-' + tabName).classList.add('active');
}

// =========================================================
// 👥 USERS
// =========================================================
async function loadUsers() {
    try {
        const data = await fetchAPI('GET', '/admin/users');
        if (!data) return;
        drawUsersTable(data);
    } catch (e) {
        document.getElementById('usersBody').innerHTML =
            `<tr><td colspan="6" style="text-align:center;color:red;">❌ ${e.message}</td></tr>`;
    }
}

function drawUsersTable(users) {
    const tbody = document.getElementById('usersBody');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users found</td></tr>';
        return;
    }

    const currentUser = getCurrentUser();
    let html = '';
    users.forEach(u => {
        const roleColors = { admin: '#dc3545', manager: '#fd7e14', viewer: '#28a745' };
        const color = roleColors[u.role] || '#6c757d';
        const isSelf = u.username === currentUser.username;

        html += `<tr>
            <td data-label="Username"><strong>${escapeHtml(u.username)}</strong></td>
            <td data-label="Full Name">${escapeHtml(u.full_name)}</td>
            <td data-label="Role">
                <select onchange="changeRole('${u.username}', this.value)" ${isSelf ? 'disabled' : ''}>
                    <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                    <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td data-label="Status">
                <span style="color:${u.is_active ? '#28a745' : '#dc3545'}">
                    ${u.is_active ? '✅ Active' : '❌ Inactive'}
                </span>
            </td>
            <td data-label="Action">
                ${!isSelf ? `
                <div style="display:flex;gap:4px;">
                    <button onclick="toggleUser('${u.username}', ${u.is_active})"
                        style="padding:6px 8px;min-width:unset;font-size:12px;background:${u.is_active ? '#fd7e14' : '#28a745'};">
                        ${u.is_active ? '🔒 Disable' : '🔓 Enable'}
                    </button>
                    <button onclick="resetPassword('${u.username}')"
                        style="padding:6px 8px;min-width:unset;font-size:12px;background:#1a73e8;">
                        🔑
                    </button>
                    <button onclick="deleteUser('${u.username}')"
                        style="padding:6px 8px;min-width:unset;font-size:12px;background:#dc3545;">
                        🗑️
                    </button>
                </div>` : '<span style="color:#aaa;font-size:12px;">Current user</span>'}
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

async function createUser() {
    const username = document.getElementById('newUsername').value.trim();
    const fullName = document.getElementById('newFullName').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const role = document.getElementById('newRole').value;

    if (!username || !fullName || !password) {
        return alert('Please fill all required fields!');
    }

    try {
        await fetchAPI('POST', '/auth/register', {
            username,
            full_name: fullName,
            email: username + '@inventory.local',
            password,
            role
        });
        showAdminMessage('✅ User created successfully!', 'success');
        ['newUsername', 'newFullName', 'newPassword'].forEach(id => {
            document.getElementById(id).value = '';
        });
        await loadUsers();
    } catch (e) {
        showAdminMessage('❌ ' + e.message, 'error');
    }
}

async function changeRole(username, newRole) {
    try {
        await fetchAPI('PUT', `/admin/users/${username}/role`, { role: newRole });
        showAdminMessage(`✅ Role updated for ${username}`, 'success');
        await loadUsers();
    } catch (e) {
        showAdminMessage('❌ ' + e.message, 'error');
        await loadUsers();
    }
}

async function toggleUser(username, isActive) {
    const action = isActive ? 'disable' : 'enable';
    if (!confirm(`${action.toUpperCase()} user "${username}"?`)) return;

    try {
        await fetchAPI('PUT', `/admin/users/${username}/toggle`);
        showAdminMessage(`✅ User ${action}d`, 'success');
        await loadUsers();
    } catch (e) {
        showAdminMessage('❌ ' + e.message, 'error');
    }
}

async function resetPassword(username) {
    const newPassword = prompt(`New password for "${username}":`);
    if (!newPassword) return;
    if (newPassword.length < 6) return alert('Password must be at least 6 characters!');

    try {
        await fetchAPI('PUT', `/admin/users/${username}/reset-password`, { new_password: newPassword });
        showAdminMessage(`✅ Password reset for ${username}`, 'success');
    } catch (e) {
        showAdminMessage('❌ ' + e.message, 'error');
    }
}

async function deleteUser(username) {
    if (!confirm(`⚠️ DELETE user "${username}" permanently?`)) return;

    try {
        await fetchAPI('DELETE', `/admin/users/${username}`);
        showAdminMessage('✅ User deleted', 'success');
        await loadUsers();
    } catch (e) {
        showAdminMessage('❌ ' + e.message, 'error');
    }
}

// =========================================================
// ⚙️ SETTINGS
// =========================================================
async function loadSettings() {
    try {
        const data = await api.getSettings();
        if (!data) return;
        drawCategoriesTable(data.categories, data.category_ids);
        drawLocationsTable(data.locations, data.location_ids);
    } catch (e) {
        console.error('Settings load failed', e);
    }
}

function drawCategoriesTable(categories, ids = []) {
    const tbody = document.getElementById('categoriesBody');
    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No categories</td></tr>';
        return;
    }
    tbody.innerHTML = categories.map((cat, i) => `
        <tr>
            <td data-label="Category">${escapeHtml(cat)}</td>
            <td data-label="Action">
                <button onclick="deleteSetting('${ids[i]}')"
                    style="padding:6px 8px;min-width:unset;font-size:12px;background:#dc3545;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function drawLocationsTable(locations, ids = []) {
    const tbody = document.getElementById('locationsBody');
    if (locations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No locations</td></tr>';
        return;
    }
    tbody.innerHTML = locations.map((loc, i) => `
        <tr>
            <td data-label="Location">${escapeHtml(loc)}</td>
            <td data-label="Action">
                <button onclick="deleteSetting('${ids[i]}')"
                    style="padding:6px 8px;min-width:unset;font-size:12px;background:#dc3545;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function addSetting(type) {
    const inputId = type === 'category' ? 'newCategory' : 'newLocation';
    const value = document.getElementById(inputId).value.trim();
    if (!value) return alert('Please enter a value!');

    try {
        await api.addSetting({ type, value });
        document.getElementById(inputId).value = '';
        showAdminMessage(`✅ ${type} added!`, 'success');
        await loadSettings();
    } catch (e) {
        showAdminMessage('❌ ' + e.message, 'error');
    }
}

async function deleteSetting(id) {
    if (!confirm('Delete this item?')) return;
    try {
        await api.deleteSetting(id);
        showAdminMessage('✅ Deleted!', 'success');
        await loadSettings();
    } catch (e) {
        showAdminMessage('❌ ' + e.message, 'error');
    }
}

// =========================================================
// 🔧 HELPERS
// =========================================================
function showAdminMessage(text, type) {
    const msg = document.getElementById('usersMessage');
    msg.style.display = 'block';
    msg.className = 'message ' + type;
    msg.innerText = text;
    setTimeout(() => msg.style.display = 'none', 4000);
}