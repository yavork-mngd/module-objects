
let activityTagify = null;
let capabilityTagify = null;
let allActivities = [];

window.initManageMachines = function () {
    console.log("Initializing Manage Machines module...");
    const searchInput = document.getElementById('search_mapping');
    if (!searchInput) return;

    loadManageMachineOptions(); // Fetches data, then creates Tagify instances
    loadManageMachineMappings();

    // Real-time Search
    let searchTimeout;
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadManageMachineMappings(this.value.trim());
        }, 300);
    });
};

function loadManageMachineOptions() {
    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_machines_api.php?action=get_options`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const machineSelect = document.getElementById('machine_id');
                if (machineSelect) {
                    machineSelect.innerHTML = '<option value="" disabled selected>Изберете машина...</option>';
                    data.machines.forEach(machine => {
                        machineSelect.add(new Option(machine.machine_name, machine.id));
                    });
                }

                allActivities = data.activities.map(a => ({
                    value: `${a.activity_name} (${a.unit_of_measure})`,
                    id: String(a.id)
                }));

                // Initialize Tagify for Activity (with whitelist)
                const actInput = document.getElementById('activity_type_id');
                if (actInput && !actInput.hasAttribute('tagify-initialized')) {
                    if (activityTagify) activityTagify.destroy();
                    activityTagify = new Tagify(actInput, {
                        whitelist: allActivities,
                        enforceWhitelist: true,
                        dropdown: {
                            maxItems: 50,
                            enabled: 0,
                            closeOnSelect: false,
                            highlightFirst: true,
                            searchKeys: ["value"],
                            classname: "tags-look"
                        }
                    });
                    actInput.setAttribute('tagify-initialized', 'true');
                }

                // Initialize Tagify for Capabilities
                const capInput = document.getElementById('capability_name');
                if (capInput && !capInput.hasAttribute('tagify-initialized')) {
                    if (capabilityTagify) capabilityTagify.destroy();
                    capabilityTagify = new Tagify(capInput, {
                        delimiters: null
                    });
                    capInput.setAttribute('tagify-initialized', 'true');
                }
            } else {
                console.error("Failed to load options:", data);
            }
        })
        .catch(error => console.error('Error fetching options:', error));
}

function loadManageMachineMappings(searchTerm = '') {
    const tableBody = document.getElementById('mappingsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center p-5 mm-muted">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Зареждане...</span>
                </div>
            </td>
        </tr>
    `;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_machines_api.php?action=get_mappings&search=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderMappingsTable(data.data);
            } else {
                Swal.fire('Грешка', data.message || 'Възникна грешка при зареждане.', 'error');
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-danger">Грешка при зареждане.</td></tr>`;
            }
        })
        .catch(error => {
            console.error('Error fetching mappings:', error);
            Swal.fire('Грешка', 'Възникна мрежова грешка при зареждане.', 'error');
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-danger">Мрежова грешка при зареждане.</td></tr>`;
        });
}

function renderMappingsTable(mappings) {
    const tableBody = document.getElementById('mappingsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!mappings || mappings.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center p-5 mm-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-3"></i>
                    Няма намерени записи.
                </td>
            </tr>
        `;
        return;
    }

    mappings.forEach(mapping => {
        const actIds = mapping.activity_ids ? mapping.activity_ids.split(',').map(s => s.trim()) : [];
        const actNames = mapping.activity_names ? mapping.activity_names.split('|||').map(s => s.trim()) : [];
        const capIds = mapping.ids ? mapping.ids.split('|||').map(s => s.trim()) : [];
        const capNames = mapping.capability_names ? mapping.capability_names.split('|||').map(s => s.trim()) : [];

        let actsHtml = '';
        for (let i = 0; i < actNames.length; i++) {
            if (!actNames[i]) continue;
            actsHtml += `
                <span class="badge mm-badge-act fs-6 me-2 mb-2 d-inline-flex align-items-center rounded-pill">
                    ${escapeHtml(actNames[i])}
                    <button type="button" class="btn-close ms-2" aria-label="Delete" style="font-size: 0.5rem;" onclick="deleteActivity(${mapping.machine_id}, ${actIds[i]}, '${escapeHtml(actNames[i]).replace(/'/g, "\\'")}')"></button>
                </span>
            `;
        }

        let capsHtml = '';
        for (let i = 0; i < capNames.length; i++) {
            if (!capNames[i]) continue;
            capsHtml += `
                <span class="badge bg-primary bg-opacity-75 fs-6 me-2 mb-2 d-inline-flex align-items-center rounded-pill">
                    ${escapeHtml(capNames[i])}
                    <button type="button" class="btn-close btn-close-white ms-2" aria-label="Delete" style="font-size: 0.5rem;" onclick="deleteMapping(${mapping.machine_id}, '${escapeHtml(capNames[i]).replace(/'/g, "\\'")}')" ></button>
                </span>
            `;
        }

        const tr = document.createElement('tr');
        tr.className = `hover-elevate-sm transition-all`;
        tr.innerHTML = `
            <td class="fw-bold text-primary px-4">
                <i class="bi bi-truck me-2"></i>${escapeHtml(mapping.machine_name)}
            </td>
            <td class="px-4">
                ${actsHtml}
            </td>
            <td class="px-4 fw-semibold text-body">
                ${capsHtml}
            </td>
            <td class="text-center px-4" style="white-space: nowrap; min-width: 100px;">
                <div class="d-flex flex-nowrap justify-content-center gap-1">
                <button class="btn btn-sm btn-outline-primary shadow-sm edit-group-btn"
                    data-machine-id="${mapping.machine_id}"
                    data-activity-ids="${escapeHtml(mapping.activity_ids)}"
                    data-cap-names="${escapeHtml(mapping.capability_names)}"
                    title="Редактирай групата">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger shadow-sm trash-machine-btn" title="Изтрий всички записи за тази машина">
                    <i class="bi bi-trash"></i>
                </button>
                </div>
            </td>
        `;

        tr.querySelector('.edit-group-btn').addEventListener('click', function () {
            openMappingModal(this.dataset.machineId, this.dataset.activityIds, this.dataset.capNames);
        });

        tr.querySelector('.trash-machine-btn').addEventListener('click', function () {
            deleteAllForMachine(mapping.machine_id, mapping.machine_name);
        });

        tableBody.appendChild(tr);
    });
}

window.openNewMappingModal = function () {
    openMappingModal('', '', '');
};

function openMappingModal(machine_id, actIdsStr, capNamesStr) {
    const form = document.getElementById('mappingForm');
    if (form) form.reset();

    const machineSelect = document.getElementById('machine_id');
    if (machineSelect) {
        if (machine_id) {
            machineSelect.value = machine_id;
            machineSelect.disabled = true;
        } else {
            machineSelect.value = '';
            machineSelect.disabled = false;
        }
    }

    if (activityTagify) activityTagify.removeAllTags();
    if (capabilityTagify) capabilityTagify.removeAllTags();

    if (actIdsStr) {
        const ids = actIdsStr.toString().split(',').map(id => id.trim()).filter(id => id !== '');
        const selectedTags = allActivities.filter(a => ids.includes(a.id));
        if (activityTagify) activityTagify.addTags(selectedTags);
    }

    if (capNamesStr) {
        const caps = capNamesStr.split('|||').map(cap => cap.trim()).filter(cap => cap !== '');
        if (capabilityTagify) capabilityTagify.addTags(caps);
    }

    const modalEl = document.getElementById('addMappingModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

window.saveMapping = function () {
    const machineSelectInput = document.getElementById('machine_id');
    const actInput = document.getElementById('activity_type_id');
    const capInput = document.getElementById('capability_name');

    if (machineSelectInput && !machineSelectInput.checkValidity()) {
        machineSelectInput.reportValidity();
        return;
    }

    if (actInput && !actInput.value) {
        Swal.fire('Грешка', 'Моля, изберете поне една дейност.', 'warning');
        return;
    }

    if (capInput && !capInput.value) {
        Swal.fire('Грешка', 'Моля, въведете спецификации.', 'warning');
        return;
    }

    let wasMachineDisabled = false;
    if (machineSelectInput) {
        wasMachineDisabled = machineSelectInput.disabled;
        machineSelectInput.disabled = false;
    }

    const form = document.getElementById('mappingForm');
    if (!form) return;
    const formData = new FormData(form);

    if (machineSelectInput) {
        machineSelectInput.disabled = wasMachineDisabled;
    }

    const saveBtn = document.getElementById('saveMappingBtn');
    if (!saveBtn) return;
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Запис...';
    saveBtn.disabled = true;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_machines_api.php`, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (typeof window.showToast === 'function') {
                    window.showToast({ message: data.message, type: 'success' });
                } else {
                    Swal.fire('Успех', data.message, 'success');
                }
                const modalEl = document.getElementById('addMappingModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                loadManageMachineMappings();
            } else {
                Swal.fire('Грешка', data.message || 'Възникна грешка.', 'error');
            }
        })
        .catch(error => {
            console.error('Error saving mapping:', error);
            Swal.fire('Грешка', 'Възникна мрежова грешка.', 'error');
        })
        .finally(() => {
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
        });
}

window.deleteActivity = function (machine_id, activity_type_id, activity_name) {
    const confirmModalEl = document.getElementById('confirmationModal');
    if (!confirmModalEl) return;

    const modalText = document.getElementById('confirmationModalBody');
    if (modalText) {
        modalText.innerHTML = `Сигурни ли сте, че искате да изтриете дейност <b>${escapeHtml(activity_name)}</b> и всички нейни спецификации за тази машина?`;
    }

    const modalBtn = document.getElementById('btn-confirm-action');
    const newModalBtn = modalBtn.cloneNode(true);
    modalBtn.parentNode.replaceChild(newModalBtn, modalBtn);

    const modal = bootstrap.Modal.getInstance(confirmModalEl) || new bootstrap.Modal(confirmModalEl);

    newModalBtn.addEventListener('click', () => {
        newModalBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Изтриване...';
        newModalBtn.disabled = true;

        const formData = new FormData();
        formData.append('action', 'delete_mapping');
        formData.append('machine_id', machine_id);
        formData.append('activity_type_id', activity_type_id);

        fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_machines_api.php`, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (typeof window.showToast === 'function') {
                        window.showToast({ message: data.message, type: 'success' });
                    }
                    loadManageMachineMappings();
                } else {
                    Swal.fire('Грешка', data.message || 'Възникна грешка.', 'error');
                }
            })
            .finally(() => {
                modal.hide();
            });
    });
    modal.show();
}

window.deleteMapping = function (machine_id, capName) {
    const confirmModalEl = document.getElementById('confirmationModal');
    if (!confirmModalEl) return;

    const modalText = document.getElementById('confirmationModalBody');
    if (modalText) {
        modalText.innerHTML = `Сигурни ли сте, че искате да изтриете спецификацията <b>${escapeHtml(capName)}</b>?`;
    }

    const modalBtn = document.getElementById('btn-confirm-action');
    const newModalBtn = modalBtn.cloneNode(true);
    modalBtn.parentNode.replaceChild(newModalBtn, modalBtn);

    const modal = bootstrap.Modal.getInstance(confirmModalEl) || new bootstrap.Modal(confirmModalEl);

    newModalBtn.addEventListener('click', () => {
        const formData = new FormData();
        formData.append('action', 'delete_mapping');
        formData.append('machine_id', machine_id);
        formData.append('capability_name', capName);

        fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_machines_api.php`, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (typeof window.showToast === 'function') {
                        window.showToast({ message: data.message, type: 'success' });
                    }
                    loadManageMachineMappings();
                } else {
                    Swal.fire('Грешка', data.message || 'Възникна грешка.', 'error');
                }
            })
            .finally(() => {
                modal.hide();
            });
    });
    modal.show();
}

window.deleteAllForMachine = function (machine_id, machine_name) {
    const confirmModalEl = document.getElementById('confirmationModal');
    if (!confirmModalEl) return;

    const modalText = document.getElementById('confirmationModalBody');
    if (modalText) {
        modalText.innerHTML = `Сигурни ли сте, че искате да изтриете <b>ВСИЧКИ</b> записи за машина <b>${escapeHtml(machine_name)}</b>?`;
    }

    const modalBtn = document.getElementById('btn-confirm-action');
    const newModalBtn = modalBtn.cloneNode(true);
    modalBtn.parentNode.replaceChild(newModalBtn, modalBtn);

    const modal = bootstrap.Modal.getInstance(confirmModalEl) || new bootstrap.Modal(confirmModalEl);

    newModalBtn.addEventListener('click', () => {
        const formData = new FormData();
        formData.append('action', 'delete_mapping');
        formData.append('machine_id', machine_id);

        fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_machines_api.php`, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (typeof window.showToast === 'function') {
                        window.showToast({ message: data.message, type: 'success' });
                    }
                    loadManageMachineMappings();
                } else {
                    Swal.fire('Грешка', data.message, 'error');
                }
            })
            .finally(() => {
                modal.hide();
            });
    });
    modal.show();
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
