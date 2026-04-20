// =========================================================
// 📦 INVENTORY — ნივთების სია და ფილტრაცია
// =========================================================

async function fetchFullInventory(silent = false) {
    const messageDiv = document.getElementById('message');
    if (messageDiv && !silent) {
        messageDiv.style.display = 'block';
        messageDiv.className = 'message loading';
        messageDiv.innerText = '⏳ Loading Database...';
    }

    try {
        const data = await api.getItems();
        if (!data) return;
        fullInventoryData = data.items;
        search();
    } catch (e) {
        displayError(e);
    }
}

function populateDropdowns() {
    const selects = {
        filterCategory: document.getElementById('filterCategory'),
        filterLocation: document.getElementById('filterLocation'),
        addCategory: document.getElementById('addCategory'),
        addLocation: document.getElementById('addLocation'),
        editCategory: document.getElementById('editCategory'),
        editLocation: document.getElementById('editLocation'),
        transFromLoc: document.getElementById('transFromLoc'),
        transToLoc: document.getElementById('transToLoc'),
    };

    // ფილტრების გასუფთავება
    if (selects.filterCategory) selects.filterCategory.innerHTML = '<option value="">All Categories</option>';
    if (selects.filterLocation) selects.filterLocation.innerHTML = '<option value="">All Locations</option>';
    if (selects.addCategory) selects.addCategory.innerHTML = '';
    if (selects.addLocation) selects.addLocation.innerHTML = '';
    if (selects.editCategory) selects.editCategory.innerHTML = '';
    if (selects.editLocation) selects.editLocation.innerHTML = '';
    if (selects.transFromLoc) selects.transFromLoc.innerHTML = '';
    if (selects.transToLoc) selects.transToLoc.innerHTML = '';

    appSettings.categories.forEach(c => {
        if (selects.filterCategory) selects.filterCategory.add(new Option(c, c));
        if (selects.addCategory) selects.addCategory.add(new Option(c, c));
        if (selects.editCategory) selects.editCategory.add(new Option(c, c));
    });

    appSettings.locations.forEach(l => {
        if (selects.filterLocation) selects.filterLocation.add(new Option(l, l));
        if (selects.addLocation) selects.addLocation.add(new Option(l, l));
        if (selects.editLocation) selects.editLocation.add(new Option(l, l));
        if (selects.transFromLoc) selects.transFromLoc.add(new Option(l, l));
        if (selects.transToLoc) selects.transToLoc.add(new Option(l, l));
    });
}

function search() {
    const q = (document.getElementById('search')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('filterCategory')?.value || '';
    const loc = document.getElementById('filterLocation')?.value || '';
    const dateFilter = document.getElementById('filterDate')?.value || '';

    const searchTerms = q.split(' ').filter(t => t.length > 0);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart); monthStart.setMonth(monthStart.getMonth() - 1);

    let results = fullInventoryData.filter(item => {
        const searchableText = [item.item_id, item.name, item.category, item.location, item.notes].join(' ').toLowerCase();
        const matchQ = searchTerms.every(term => searchableText.includes(term));
        const matchCat = !cat || item.category === cat;
        const matchLoc = !loc || item.location === loc;

        let matchDate = true;
        if (dateFilter && dateFilter !== 'ALL') {
            const rowDate = new Date(item.created_at);
            if (dateFilter === 'TODAY') matchDate = rowDate >= todayStart;
            else if (dateFilter === 'WEEK') matchDate = rowDate >= weekStart;
            else if (dateFilter === 'MONTH') matchDate = rowDate >= monthStart;
        }
        return matchQ && matchCat && matchLoc && matchDate;
    });

    displayResults(results);
}

function displayResults(results) {
    currentResults = results;
    const messageDiv = document.getElementById('message');
    const tbody = document.getElementById('resultsBody');

    if (!results || results.length === 0) {
        if (messageDiv) {
            messageDiv.innerHTML = '🔍 No items match these filters';
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
        }
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No items found</td></tr>';
        return;
    }

    if (messageDiv) {
        messageDiv.innerHTML = `✅ Found ${results.length} items`;
        messageDiv.className = 'message success';
        messageDiv.style.display = 'block';
    }

    let html = '';
    results.forEach((item, index) => {
        const photoHtml = (item.picture_url && item.picture_url.startsWith('http'))
            ? `<a href="${item.picture_url}" target="_blank">🖼️</a>` : '-';

        html += `<tr>
      <td data-label="Select"><input type="checkbox" class="row-select" value="${index}" style="width:16px;height:16px;"></td>
      <td data-label="ID"><strong>${escapeHtml(item.item_id)}</strong></td>
      <td data-label="Name">${escapeHtml(item.name)}</td>
      <td data-label="Category">${escapeHtml(item.category)}</td>
      <td data-label="Qty">${item.quantity}</td>
      <td data-label="Location">${escapeHtml(item.location)}</td>
      <td data-label="Pic">${photoHtml}</td>
      <td data-label="Note">${escapeHtml(item.notes) || '-'}</td>
      <td data-label="Action">
        <div style="display:flex;gap:4px;">
          <button class="copy-btn" onclick="copyId('${escapeHtml(item.item_id)}', this)" style="padding:6px 8px;min-width:unset;font-size:14px;">📋</button>
          <button class="copy-btn" onclick="openQrModal(${index})" style="padding:6px 8px;min-width:unset;font-size:14px;background:#6f42c1;color:white;border-color:#6f42c1;">🔳</button>
          <button class="copy-btn" onclick="openEditModalByIndex(${index})" style="padding:6px 8px;min-width:unset;font-size:14px;background:#007bff;color:white;border-color:#007bff;">✏️</button>
        </div>
      </td>
    </tr>`;
    });
    tbody.innerHTML = html;
}

function clearFilters() {
    document.getElementById('search').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterLocation').value = '';
    document.getElementById('filterDate').value = '';
    search();
}

function filterSpecial(type) {
    switchTab('inventory');
    document.getElementById('search').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterLocation').value = '';
    document.getElementById('filterDate').value = '';

    if (type === 'lowStockIT') {
        displayResults(fullInventoryData.filter(item =>
            item.category === 'Consumables' && item.location === 'IT Warehouse' && item.quantity <= 3
        ));
    } else if (type === 'lowStockFloor') {
        displayResults(fullInventoryData.filter(item =>
            item.category === 'Consumables' && item.location === "Floor's Cabinet" && item.quantity <= 1
        ));
    }
}

function downloadCSV() {
    if (!currentResults || currentResults.length === 0) return alert("No data to export!");

    const checked = [...document.querySelectorAll('.row-select:checked')];
    const dataToExport = checked.length > 0
        ? checked.map(cb => currentResults[parseInt(cb.value)])
        : currentResults;

    let csvContent = "\ufeffID,Name,Category,Qty,Location,Picture,Notes,Created\n";
    dataToExport.forEach(item => {
        const row = [item.item_id, item.name, item.category, item.quantity,
        item.location, item.picture_url || '', item.notes || '', item.created_at]
            .map(cell => `"${String(cell).replace(/"/g, '""')}"`);
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventory_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function toggleSelectAll(masterCheckbox) {
    document.querySelectorAll('.row-select').forEach(cb => {
        cb.checked = masterCheckbox.checked;
    });
}


// =========================================================
// 📂 EXCEL IMPORT
// =========================================================
async function importExcel(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) return alert('No data found in file!');

            const confirm_import = confirm(`Found ${rows.length} items. Import all?`);
            if (!confirm_import) return;

            let success = 0;
            let failed = 0;
            let errors = [];

            showMessage(`⏳ Importing 0 / ${rows.length} items...`, 'loading');

            for (const row of rows) {
                try {
                    const payload = {
                        item_id: String(row['Item ID'] || '').trim() || null,
                        name: String(row['Name'] || '').trim(),
                        category: String(row['Category'] || '').trim(),
                        quantity: parseInt(row['Quantity'] || row['Qty'] || 0),
                        location: String(row['Location'] || '').trim(),
                        picture_url: String(row['Picture'] || '').trim() || null,
                        notes: String(row['Notes'] || '').trim() || null
                    };

                    if (!payload.name) {
                        failed++;
                        continue;
                    }

                    await api.createItem(payload);
                    success++;
                } catch (e) {
                    failed++;
                    errors.push(row['Name'] || 'Unknown');
                }

                // progress განახლება
                showMessage(`⏳ Importing ${success + failed} / ${rows.length} items...`, 'loading');
            }

            // input გასუფთავება
            input.value = '';
            
            await fetchFullInventory(true);
            loadDashboardData();
            fullHistoryData = [];

            showMessage(
                `✅ Import complete! Success: ${success}, Failed: ${failed}`,
                failed > 0 ? 'error' : 'success'
            );

            

        } catch (e) {
            alert('Error reading file: ' + e.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

async function deleteSelected() {
    const checked = [...document.querySelectorAll('.row-select:checked')];
    if (checked.length === 0) return alert('Please select at least one item!');

    if (!confirm(`⚠️ DELETE ${checked.length} selected items permanently?\n\nAre you sure?`)) return;

    let success = 0;
    let failed = 0;

    showMessage(`⏳ Deleting 0 / ${checked.length} items...`, 'loading');

    for (const cb of checked) {
        const item = currentResults[parseInt(cb.value)];
        try {
            await api.deleteItem(item.item_id, item.location);
            success++;
        } catch (e) {
            failed++;
        }
        showMessage(`⏳ Deleting ${success + failed} / ${checked.length} items...`, 'loading');
    }

    await fetchFullInventory(true);
    loadDashboardData();
    fullHistoryData = [];

    showMessage(
        `✅ Deleted: ${success}, Failed: ${failed}`,
        failed > 0 ? 'error' : 'success'
    );

    
}


function downloadExcelTemplate() {
    const template = [
        {
            'Item ID': 'ITM-001 (optional)',
            'Name': 'Example: Cisco Switch',
            'Category': 'Example: Networking Gear',
            'Quantity': 5,
            'Location': 'Example: IT Warehouse',
            'Picture': 'https://... (optional)',
            'Notes': 'Any notes (optional)'
        }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    XLSX.writeFile(wb, 'inventory_template.xlsx');
}