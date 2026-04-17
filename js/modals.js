// =========================================================
// 🗂️ MODALS — Add, Edit, Delete, Transfer
// =========================================================

let currentEditItem = null;

// =========================================================
// ➕ ADD MODAL
// =========================================================
function openModal() {
    document.getElementById('addModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('addModal').style.display = 'none';
    ['addId', 'addName', 'addQty', 'addPic', 'addNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

async function submitNewItem() {
    const btn = document.getElementById('submitBtn');
    const name = document.getElementById('addName').value.trim();
    const qty = document.getElementById('addQty').value.trim();

    if (!name || !qty) return alert("Please fill Name and Quantity!");

    const payload = {
        item_id: document.getElementById('addId').value.trim() || null,
        name: name,
        category: document.getElementById('addCategory').value,
        quantity: parseInt(qty),
        location: document.getElementById('addLocation').value,
        picture_url: document.getElementById('addPic').value.trim() || null,
        notes: document.getElementById('addNotes').value.trim() || null
    };

    btn.innerText = "⏳ Saving...";
    btn.disabled = true;

    try {
        const response = await api.createItem(payload);
        btn.innerText = "Save Item";
        btn.disabled = false;
        closeModal();
        showMessage(`✅ ${response.message}`, 'success');
        await fetchFullInventory();
        loadDashboardData();
        fullHistoryData = [];
    } catch (e) {
        btn.innerText = "Save Item";
        btn.disabled = false;
        alert("Error: " + e.message);
    }
}

// =========================================================
// ✏️ EDIT MODAL
// =========================================================
function openEditModalByIndex(index) {
    currentEditItem = currentResults[index];

    document.getElementById('editId').value = currentEditItem.item_id;
    document.getElementById('editName').value = currentEditItem.name;
    document.getElementById('editCategory').value = currentEditItem.category;
    document.getElementById('editQty').value = currentEditItem.quantity;
    document.getElementById('editLocation').value = currentEditItem.location;
    document.getElementById('editPic').value = currentEditItem.picture_url || '';
    document.getElementById('editNotes').value = currentEditItem.notes || '';
    
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditItem = null;
    
}

async function submitEditItem() {
    const btn = document.getElementById('btnEditSubmit');
    const name = document.getElementById('editName').value.trim();
    const qty = document.getElementById('editQty').value;

    if (!name || qty === '') return alert("Name and Qty are required!");

    const payload = {
        name: name,
        category: document.getElementById('editCategory').value,
        quantity: parseInt(qty),
        location: document.getElementById('editLocation').value,
        picture_url: document.getElementById('editPic').value.trim() || null,
        notes: document.getElementById('editNotes').value.trim() || null
    };

    btn.innerText = "⏳ Saving...";
    btn.disabled = true;

    try {
        const response = await api.updateItem(currentEditItem.item_id, payload);
        btn.innerText = "💾 Save Changes";
        btn.disabled = false;
        closeEditModal();
        showMessage(`✅ ${response.message}`, 'success');
        await fetchFullInventory();
        loadDashboardData();
        fullHistoryData = [];
    } catch (e) {
        btn.innerText = "💾 Save Changes";
        btn.disabled = false;
        alert("Error: " + e.message);
    }
}

async function deleteItem() {
    if (!currentEditItem) return;

    if (!confirm(`⚠️ DELETE will permanently remove [ ${currentEditItem.item_id} ] from the database!\n\nFor partial quantity removal, use ACTION → WRITE-OFF instead.\n\nAre you sure?`)) return;

    const btn = document.getElementById('btnDeleteSubmit');
    btn.innerText = "⏳ Deleting...";
    btn.disabled = true;

    try {
        const response = await api.deleteItem(currentEditItem.item_id);
        btn.innerText = "🗑️ Delete";
        btn.disabled = false;
        closeEditModal();
        showMessage(`✅ ${response.message}`, 'success');
        await fetchFullInventory();
        loadDashboardData();
        fullHistoryData = [];
    } catch (e) {
        btn.innerText = "🗑️ Delete";
        btn.disabled = false;
        alert("Error: " + e.message);
    }
}

// =========================================================
// 🔄 TRANSFER MODAL
// =========================================================
function openTransferModal() {
    document.getElementById('transferModal').style.display = 'block';
    toggleToLocation();
}

function closeTransferModal() {
    document.getElementById('transferModal').style.display = 'none';
    ['transItemId', 'transQty', 'transNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('transAction').value = 'TRANSFER';
    toggleToLocation();
}

function toggleToLocation() {
    const action = document.getElementById('transAction').value;
    document.getElementById('toLocContainer').style.display =
        action === 'TRANSFER' ? 'block' : 'none';
    const lblFrom = document.getElementById('lblFromLoc');
    if (lblFrom) lblFrom.innerText = action === 'RESTOCK' ? 'Add To Location *' : 'From Location *';
}

async function submitTransfer() {
    const btn = document.getElementById('btnTransSubmit');
    const itemId = document.getElementById('transItemId').value.trim();
    const qty = document.getElementById('transQty').value.trim();
    const action = document.getElementById('transAction').value;
    const fromLoc = document.getElementById('transFromLoc').value;
    const toLoc = action === 'TRANSFER' ? document.getElementById('transToLoc').value : null;

    if (!itemId || !qty) return alert("Please fill Item ID and Quantity!");
    if (action === 'TRANSFER' && fromLoc === toLoc) return alert("Locations cannot be the same!");

    const payload = {
        item_id: itemId,
        action: action,
        quantity: parseInt(qty),
        from_location: fromLoc,
        to_location: toLoc,
        notes: document.getElementById('transNotes').value.trim() || null
    };

    btn.innerText = "⏳ Processing...";
    btn.disabled = true;

    try {
        const response = await api.transfer(payload);
        btn.innerText = "Execute Action";
        btn.disabled = false;
        closeTransferModal();
        showMessage(`✅ ${response.message}`, 'success');
        await fetchFullInventory();
        loadDashboardData();
        fullHistoryData = [];
    } catch (e) {
        btn.innerText = "Execute Action";
        btn.disabled = false;
        alert("Error: " + e.message);
    }
}

// modal-ის გარეთ კლიკით დახურვა
window.addEventListener('click', function (event) {
    if (event.target === document.getElementById('addModal')) closeModal();
    if (event.target === document.getElementById('transferModal')) closeTransferModal();
    if (event.target === document.getElementById('editModal')) closeEditModal();
    if (event.target === document.getElementById('qrModal')) closeQrModal();
    if (event.target === document.getElementById('profileModal')) closeProfileModal();
});