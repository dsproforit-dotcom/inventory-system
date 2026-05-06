// =========================================================
// 📜 HISTORY — ოპერაციების ისტორია
// =========================================================

const HISTORY_PAGE_SIZE = 200;

async function loadHistoryData() {
    const tbody = document.getElementById('historyResultsBody');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;" class="loading">⏳ Fetching Full History...</td></tr>';

    try {
        const [histData, usersData] = await Promise.all([
            api.getHistory({ limit: HISTORY_PAGE_SIZE, offset: 0 }),
            isManager() ? api.getUsers() : Promise.resolve(null)
        ]);
        if (!histData) return;
        fullHistoryData = histData.history;

        // User dropdown-ის populate (manager+-ისთვის)
        const select = document.getElementById('historyUser');
        select.innerHTML = '<option value="ALL">All Users</option>';
        if (usersData) {
            usersData.forEach(u => {
                select.add(new Option(u.username, u.username));
            });
        }

        updateLoadMoreButton(histData.history.length);
        searchHistory();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:red;">❌ Error: ${e.message}</td></tr>`;
    }
}

async function loadMoreHistory() {
    const btn = document.getElementById('loadMoreHistoryBtn');
    btn.disabled = true;
    btn.innerText = '⏳ Loading...';
    try {
        const data = await api.getHistory({ limit: HISTORY_PAGE_SIZE, offset: fullHistoryData.length });
        if (data && data.history.length > 0) {
            fullHistoryData = fullHistoryData.concat(data.history);
            searchHistory();
        }
        updateLoadMoreButton(data ? data.history.length : 0);
    } catch (e) {
        showMessage('❌ ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = '⬇️ Load More';
    }
}

function updateLoadMoreButton(lastBatchSize) {
    const btn = document.getElementById('loadMoreHistoryBtn');
    if (!btn) return;
    btn.style.display = lastBatchSize >= HISTORY_PAGE_SIZE ? 'inline-block' : 'none';
}

function searchHistory() {
    const q = (document.getElementById('historySearch')?.value || '').toLowerCase().trim();
    const actionType = document.getElementById('historyAction')?.value || '';
    const dateFilter = document.getElementById('historyDate')?.value || '';
    const userFilter = document.getElementById('historyUser')?.value || 'ALL';

    const searchTerms = q.split(' ').filter(t => t.length > 0);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart); monthStart.setMonth(monthStart.getMonth() - 1);

    let results = fullHistoryData.filter(row => {
        const searchableText = [
            row.item_id, row.item_name, row.action,
            row.from_location, row.to_location, row.responsible, row.comment
        ].join(' ').toLowerCase();

        const matchQ = searchTerms.every(term => searchableText.includes(term));
        const matchAction = !actionType || actionType === 'ALL' || row.action === actionType;
        const matchUser = userFilter === 'ALL' || row.responsible === userFilter;

        let matchDate = true;
        if (dateFilter && dateFilter !== 'ALL') {
            const rowDate = new Date(row.created_at);
            if (dateFilter === 'TODAY') matchDate = rowDate >= todayStart;
            else if (dateFilter === 'WEEK') matchDate = rowDate >= weekStart;
            else if (dateFilter === 'MONTH') matchDate = rowDate >= monthStart;
        }
        return matchQ && matchAction && matchDate && matchUser;
    });

    currentHistoryResults = results;
    drawHistoryTable(results);
}

const ACTION_DEFAULT_NOTES = {
    ADD: 'Item added',
    UPDATE: 'Item updated',
    DELETE: 'Item deleted',
    TRANSFER: 'Item transferred',
    ISSUE: 'Item issued',
    RESTOCK: 'Stock replenished',
    'WRITE-OFF': 'Item written off',
    ERROR: 'Operation failed'
};

function getDisplayNote(row) {
    if (row.comment && row.comment.trim()) return escapeHtml(row.comment);
    const fallback = ACTION_DEFAULT_NOTES[row.action];
    return fallback ? `<span style="color:#999;font-style:italic;">${fallback}</span>` : '-';
}

function drawHistoryTable(data) {
    const tbody = document.getElementById('historyResultsBody');

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">🔍 No history records found</td></tr>';
        return;
    }

    let html = '';
    data.forEach(row => {
        html += `<tr>
      <td data-label="Date" style="font-size:12px;color:#555;">${formatDate(row.created_at)}</td>
      <td data-label="Item ID"><strong>${escapeHtml(row.item_id)}</strong></td>
      <td data-label="Name">${escapeHtml(row.item_name)}</td>
      <td data-label="Action"><span class="badge ${escapeHtml(row.action)}">${escapeHtml(row.action)}</span></td>
      <td data-label="From">${escapeHtml(row.from_location) || '-'}</td>
      <td data-label="To">${escapeHtml(row.to_location) || '-'}</td>
      <td data-label="Qty">${row.quantity}</td>
      <td data-label="User">${escapeHtml(row.responsible) || '-'}</td>
      <td data-label="Note">${getDisplayNote(row)}</td>
    </tr>`;
    });
    tbody.innerHTML = html;
}

function clearHistoryFilters() {
    document.getElementById('historySearch').value = '';
    document.getElementById('historyAction').value = 'ALL';
    document.getElementById('historyDate').value = 'ALL';
    document.getElementById('historyUser').value = 'ALL';
    searchHistory();
}

function downloadHistoryCSV() {
    if (!currentHistoryResults || currentHistoryResults.length === 0) {
        return alert("No history data to export!");
    }

    let csvContent = "\ufeffDate,Item ID,Name,Action,From,To,Qty,User,Note\n";
    currentHistoryResults.forEach(row => {
        const r = [
            formatDate(row.created_at), row.item_id, row.item_name,
            row.action, row.from_location, row.to_location,
            row.quantity, row.responsible, row.comment || ''
        ].map(cell => `"${String(cell || '').replace(/"/g, '""')}"`);
        csvContent += r.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `History_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}