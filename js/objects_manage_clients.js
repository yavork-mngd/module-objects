// /modules/objects/js/objects_manage_clients.js

window.initManageClients = function () {
    loadClients();

    // Real-time Debounced Search
    const searchInput = document.getElementById('search_client');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadClients(this.value.trim());
            }, 300); // 300ms debounce
        });
    }

    // Handle Save Client Button Click
    const saveBtn = document.getElementById('saveClientBtn');
    if (saveBtn) {
        // Prevent multiple listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', saveClient);
    }
};

// Auto-init if ID is present (for backward compatibility or direct script load)
if (document.getElementById('objects-manage-clients-container')) {
    window.initManageClients();
}


// Function to reset the modal form
window.resetClientModal = function () {
    document.getElementById('clientForm').reset();
    document.getElementById('client_id').value = '0';
    document.getElementById('clientModalLabel').innerText = 'Добави нов клиент';
    const extraContainer = document.getElementById('extraContactsContainer');
    if (extraContainer) extraContainer.innerHTML = '';
};

// Function to add dynamic extra contact row
window.addExtraContactRow = function (name = '', phone = '', email = '', notes = '') {
    const container = document.getElementById('extraContactsContainer');
    if (!container) return;
    const rowId = 'contact_' + Date.now() + Math.floor(Math.random() * 1000);

    const html = `
        <div class="row g-3 mb-3 pb-3 border-bottom position-relative" id="${rowId}">
            <button type="button" class="btn btn-sm btn-outline-danger position-absolute top-0 end-0 mt-2 me-2 bg-body" style="width: 32px; height: 32px; padding: 0; z-index: 5;" onclick="removeExtraContactRow('${rowId}')" title="Премахни">
                <i class="bi bi-x-lg"></i>
            </button>
            <div class="col-md-12 pe-5">
                <label class="form-label text-muted small mb-1">Име</label>
                <input type="text" class="form-control form-control-sm" name="extra_contact_name[]" value="${escapeHtml(name)}" required placeholder="Име на контакт">
            </div>
            <div class="col-md-6">
                <label class="form-label text-muted small mb-1">Телефон</label>
                <input type="text" class="form-control form-control-sm" name="extra_contact_phone[]" value="${escapeHtml(phone)}" placeholder="Телефон">
            </div>
            <div class="col-md-6">
                <label class="form-label text-muted small mb-1">Имейл</label>
                <input type="email" class="form-control form-control-sm" name="extra_contact_email[]" value="${escapeHtml(email)}" placeholder="Имейл">
            </div>
            <div class="col-md-12">
                <label class="form-label text-muted small mb-1">Бележки</label>
                <textarea class="form-control form-control-sm" name="extra_contact_notes[]" rows="2" placeholder="Бележки за този контакт...">${escapeHtml(notes)}</textarea>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
};

window.removeExtraContactRow = function (rowId) {
    const confirmModal = document.getElementById('confirmationModal');
    const confirmText = document.getElementById('confirmationModalBody');
    const confirmBtn = document.getElementById('btn-confirm-action');

    if (confirmModal && confirmText && confirmBtn) {
        confirmText.innerText = "Сигурни ли сте, че искате да премахнете този допълнителен контакт?";

        // Remove old event listeners by cloning the button
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        const modalInstance = bootstrap.Modal.getInstance(confirmModal) || new bootstrap.Modal(confirmModal);

        newConfirmBtn.addEventListener('click', function () {
            const row = document.getElementById(rowId);
            if (row) row.remove();
            modalInstance.hide();
        });

        modalInstance.show();
    } else {
        if (confirm("Сигурни ли сте, че искате да премахнете този допълнителен контакт?")) {
            const row = document.getElementById(rowId);
            if (row) row.remove();
        }
    }
};

// Function to load all clients
function loadClients(searchTerm = '') {
    const tableBody = document.getElementById('clientsTableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center p-5 text-muted">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 mb-0">Зареждане на клиенти...</p>
            </td>
        </tr>
    `;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_clients_api.php?action=get_clients&search=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderClientsTable(data.data);
            } else {
                Swal.fire('Грешка', data.message || 'Възникна грешка при зареждане на клиентите.', 'error');
            }
        })
        .catch(error => {
            console.error('Error fetching clients:', error);
            Swal.fire('Грешка', 'Възникна мрежова грешка при зареждане на клиентите.', 'error');
        });
}

// Function to render the client data into the table
function renderClientsTable(clients) {
    const tableBody = document.getElementById('clientsTableBody');
    tableBody.innerHTML = '';

    if (clients.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center p-5 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                    Няма намерени клиенти.
                </td>
            </tr>
        `;
        return;
    }

    clients.forEach(client => {
        let contactsHtml = `
            <div class="mb-2">
                <div class="fw-semibold text-highlight mb-1">
                    ${escapeHtml(client.primary_contact_name)}
                </div>
                <div class="text-muted small ms-1">
                    <div class="d-flex align-items-center mb-1"><i class="bi bi-telephone text-primary me-2"></i>${escapeHtml(client.primary_contact_phone)}</div>
                    <div class="d-flex align-items-center"><i class="bi bi-envelope text-primary me-2"></i>${escapeHtml(client.primary_contact_email)}</div>
                    ${client.primary_contact_notes ? `<div class="mt-1 fst-italic" style="font-size: 0.85em;"><i class="bi bi-chat-left-text text-primary me-1"></i>${escapeHtml(client.primary_contact_notes)}</div>` : ''}
                </div>
            </div>
        `;

        if (client.additional_contacts) {
            try {
                let extraContacts = JSON.parse(client.additional_contacts);
                if (Array.isArray(extraContacts) && extraContacts.length > 0) {
                    contactsHtml += '<div class="mt-2 pt-2 border-top border-secondary border-opacity-25">';

                    extraContacts.forEach(contact => {
                        contactsHtml += `
                            <div class="mb-3">
                                <div class="fw-semibold text-highlight mb-1">
                                    <i class="bi bi-person me-1"></i>${escapeHtml(contact.name)}
                                </div>
                                <div class="text-muted small " style="font-size: 0.85em;">
                                    ${contact.phone ? `<div class="d-flex align-items-center mb-1"><i class="bi bi-telephone me-2"></i>${escapeHtml(contact.phone)}</div>` : ''}
                                    ${contact.email ? `<div class="d-flex align-items-center"><i class="bi bi-envelope me-2"></i>${escapeHtml(contact.email)}</div>` : ''}
                                    ${contact.notes ? `<div class="mt-1 fst-italic"><i class="bi bi-chat-left-text me-1"></i>${escapeHtml(contact.notes)}</div>` : ''}
                                </div>
                            </div>
                        `;
                    });

                    contactsHtml += '</div>';
                }
            } catch (e) {
                console.error("Error parsing additional contacts", e);
            }
        }

        const tr = document.createElement('tr');
        tr.className = 'hover-elevate-sm transition-all';
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-bold text-highlight">${escapeHtml(client.client_name)}</div>
            </td>
            <td>
                ${contactsHtml}
            </td>
            <td>
                <div class="text-muted small text-truncate" style="max-width: 200px;" title="${escapeHtml(client.client_address || '')}">
                    ${escapeHtml(client.client_address || '-')}
                </div>
            </td>
            <td>
                <div class="small" style="max-width: 250px;">
                    ${client.general_notes ? `<div class="mb-1 text-truncate" title="${escapeHtml(client.general_notes)}">${escapeHtml(client.general_notes)}</div>` : ''}
                    ${client.internal_notes ? `<div class="text-muted text-truncate" title="${escapeHtml(client.internal_notes)}"><i class="bi bi-lock-fill me-1" style="font-size: 0.9em;"></i>${escapeHtml(client.internal_notes)}</div>` : ''}
                    ${!client.general_notes && !client.internal_notes ? '<span class="text-muted">-</span>' : ''}
                </div>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-sm btn-outline-primary" onclick="editClient(${client.client_id})" title="Редактирай">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteClient(${client.client_id})" title="Изтрий">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// Function to save (add/update) a client
function saveClient() {
    const form = document.getElementById('clientForm');

    // Basic frontend validation
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);

    // Disable save button and show loading state
    const saveBtn = document.getElementById('saveClientBtn');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Запазване...';
    saveBtn.disabled = true;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_clients_api.php`, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message, type: 'success' });
                } else {
                    alert(data.message);
                }

                // Close modal safely
                const modalEl = document.getElementById('clientModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();

                // Reload table
                const searchTerm = document.getElementById('search_client').value;
                loadClients(searchTerm);
            } else {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message || 'Възникна грешка при запазване.', type: 'error' });
                } else {
                    alert(data.message || 'Възникна грешка при запазване.');
                }
            }
        })
        .catch(error => {
            console.error('Error saving client:', error);
            if (typeof showToast === 'function') {
                showToast({ message: 'Възникна мрежова грешка при запазване на клиента.', type: 'error' });
            } else {
                alert('Възникна мрежова грешка при запазване на клиента.');
            }
        })
        .finally(() => {
            // Restore button state
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
        });
}

// Function to fetch and open the modal for editing a client
window.editClient = function (clientId) {
    // Show loading state by disabling the button temporarily
    const btn = document.querySelector(`button[onclick="editClient(${clientId})"]`);
    const originalIcon = btn ? btn.innerHTML : '<i class="bi bi-pencil"></i>';
    if (btn) {
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        btn.disabled = true;
    }

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_clients_api.php?action=get_client&client_id=${clientId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const client = data.data;
                const form = document.getElementById('clientForm');

                // Clear extra container
                const extraContainer = document.getElementById('extraContactsContainer');
                if (extraContainer) extraContainer.innerHTML = '';

                // Populate form fields
                document.getElementById('client_id').value = client.client_id;
                document.getElementById('client_name').value = client.client_name || '';
                document.getElementById('client_address').value = client.client_address || '';
                document.getElementById('primary_contact_name').value = client.primary_contact_name || '';
                document.getElementById('primary_contact_phone').value = client.primary_contact_phone || '';
                document.getElementById('primary_contact_email').value = client.primary_contact_email || '';
                document.getElementById('primary_contact_notes').value = client.primary_contact_notes || '';
                document.getElementById('general_notes').value = client.general_notes || '';
                document.getElementById('internal_notes').value = client.internal_notes || '';

                if (client.additional_contacts) {
                    try {
                        let extraContacts = JSON.parse(client.additional_contacts);
                        if (Array.isArray(extraContacts)) {
                            extraContacts.forEach(contact => {
                                if (typeof window.addExtraContactRow === 'function') {
                                    window.addExtraContactRow(contact.name || '', contact.phone || '', contact.email || '', contact.notes || '');
                                }
                            });
                        }
                    } catch (e) {
                        console.error("Error parsing additional contacts during load", e);
                    }
                }

                document.getElementById('clientModalLabel').innerText = 'Редактирай клиент';

                // Show modal
                const modalEl = document.getElementById('clientModal');
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            } else {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message || 'Клиентът не беше намерен.', type: 'error' });
                } else {
                    alert(data.message || 'Клиентът не беше намерен.');
                }
            }
        })
        .catch(error => {
            console.error('Error fetching client details:', error);
            if (typeof showToast === 'function') {
                showToast({ message: 'Възникна мрежова грешка при зареждане детайлите на клиента.', type: 'error' });
            } else {
                alert('Възникна мрежова грешка при зареждане детайлите на клиента.');
            }
        })
        .finally(() => {
            if (btn) {
                btn.innerHTML = originalIcon;
                btn.disabled = false;
            }
        });
};

// Function to delete a client
window.deleteClient = function (clientId) {
    // Use the native confirmation modal from layout.php
    const confirmModal = document.getElementById('confirmationModal');
    const confirmText = document.getElementById('confirmationModalBody');
    const confirmBtn = document.getElementById('btn-confirm-action');

    if (confirmModal && confirmText && confirmBtn) {
        confirmText.innerText = "Сигурни ли сте? Тази операция е необратима. Клиентът ще бъде изтрит!";

        // Remove old event listeners by cloning the button
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        const modalInstance = new bootstrap.Modal(confirmModal);

        newConfirmBtn.addEventListener('click', function () {
            modalInstance.hide();

            const formData = new FormData();
            formData.append('action', 'delete_client');
            formData.append('client_id', clientId);

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_clients_api.php`, {
                method: 'POST',
                body: formData
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        if (typeof showToast === 'function') {
                            showToast({ message: data.message || 'Изтрит!', type: 'success' });
                        } else {
                            alert(data.message || 'Изтрит!');
                        }
                        const searchTerm = document.getElementById('search_client').value;
                        loadClients(searchTerm);
                    } else {
                        if (typeof showToast === 'function') {
                            showToast({ message: data.message || 'Възникна грешка при изтриването.', type: 'error' });
                        } else {
                            alert(data.message || 'Възникна грешка при изтриването.');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error deleting client:', error);
                    if (typeof showToast === 'function') {
                        showToast({ message: 'Възникна мрежова грешка при изтриването на клиента.', type: 'error' });
                    } else {
                        alert('Възникна мрежова грешка при изтриването на клиента.');
                    }
                });
        });

        modalInstance.show();
    } else {
        // Fallback to basic window.confirm if custom modal isn't present
        if (confirm("Сигурни ли сте? Тази операция е необратима. Клиентът ще бъде изтрит!")) {
            const formData = new FormData();
            formData.append('action', 'delete_client');
            formData.append('client_id', clientId);

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_clients_api.php`, {
                method: 'POST',
                body: formData
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        if (typeof showToast === 'function') {
                            showToast({ message: data.message || 'Изтрит!', type: 'success' });
                        } else {
                            alert(data.message || 'Изтрит!');
                        }
                        const searchTerm = document.getElementById('search_client').value;
                        loadClients(searchTerm);
                    } else {
                        if (typeof showToast === 'function') {
                            showToast({ message: data.message || 'Възникна грешка при изтриването.', type: 'error' });
                        } else {
                            alert(data.message || 'Възникна грешка при изтриването.');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error deleting client:', error);
                    if (typeof showToast === 'function') {
                        showToast({ message: 'Възникна мрежова грешка при изтриването на клиента.', type: 'error' });
                    } else {
                        alert('Възникна мрежова грешка при изтриването на клиента.');
                    }
                });
        }
    }
};

// Helper function to escape HTML to prevent XSS
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
