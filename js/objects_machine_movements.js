// /modules/objects/js/objects_machine_movements.js

let tagifyFromSite = null;
let tagifyToSite = null;
let tagifyMachine = null;
let tagifyMovementSchedule = null;
let tagifyMovementClient = null;
let tagifyMovementObject = null;
let movementOptions = null;

window.initMachineMovements = function () {
    loadMachineMovementsOptions();
    loadMovements();

    // Initialize flatpickr for modal
    flatpickr("#arrival_date", {
        dateFormat: "d.m.Y",
        allowInput: true,
        locale: { firstDayOfWeek: 1 }
    });
    flatpickr("#departure_date", {
        dateFormat: "d.m.Y",
        allowInput: true,
        locale: { firstDayOfWeek: 1 }
    });

    // Real-time Debounced Search
    const searchInput = document.getElementById('search_movement');
    if (searchInput) {
        // Prevent adding multiple listeners if re-initialized
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        let searchTimeout;
        newSearchInput.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadMovements(this.value.trim());
            }, 300); // 300ms debounce
        });
    }

    // Handle Save Movement Button Click
    const saveBtn = document.getElementById('saveMovementBtn');
    if (saveBtn) {
        // Prevent adding multiple listeners if re-initialized
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', saveMovement);
    }
};

// Only define page-specific functions on the actual movements page.
// The planning page defines its own versions in planning_modals.js.
if (document.getElementById('objects-machine-movements-container')) {

    // Function to fetch Select Options (Machines & Sites)
    function loadMachineMovementsOptions() {
        fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php?action=get_options`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    movementOptions = data;
                    const scheduleInput = document.getElementById('schedule_id');
                    const machineInput = document.getElementById('machine_id');
                    const fromInput = document.getElementById('from_site_id');
                    const toInput = document.getElementById('to_site_id');
                    const clientInput = document.getElementById('client_select');
                    const objectInput = document.getElementById('object_select');

                    // Prepare Machines for Tagify
                    const originalMachineOptions = data.machines.map(m => ({
                        value: m.machine_name,
                        id: m.id,
                        allowed_activities: m.allowed_activities || [],
                        capabilities_map: m.capabilities_map || {}
                    }));

                    // Initialize Tagify for Machine
                    if (machineInput && !machineInput.hasAttribute('tagify-initialized')) {
                        if (tagifyMachine) tagifyMachine.destroy();
                        tagifyMachine = new Tagify(machineInput, {
                            mode: "select",
                            whitelist: [...originalMachineOptions],
                            enforceWhitelist: true,
                            dropdown: {
                                maxItems: 50,
                                classname: "tags-look",
                                enabled: 0,
                                closeOnSelect: true
                            }
                        });
                        machineInput.setAttribute('tagify-initialized', 'true');

                        tagifyMachine.on('change', function (e) {
                            const val = e.detail.value;
                            if (val && val !== '[]') {
                                const arrivalInput = document.getElementById('arrival_date');
                                if (arrivalInput && !arrivalInput.value) {
                                    const d = new Date();
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                    const yyyy = d.getFullYear();
                                    const today = `${dd}.${mm}.${yyyy}`;

                                    if (arrivalInput._flatpickr) {
                                        arrivalInput._flatpickr.setDate(today);
                                    } else {
                                        arrivalInput.value = today;
                                    }
                                }
                            }
                        });
                    }

                    // Prepare Sites for Tagify
                    const siteOptions = [{ value: "База", id: "" }];
                    data.sites.forEach(site => {
                        siteOptions.push({ value: site.обект_име, id: site.request_id });
                    });


                    // Initialize Tagify for From Site
                    if (fromInput && !fromInput.hasAttribute('tagify-initialized')) {
                        if (tagifyFromSite) tagifyFromSite.destroy();
                        tagifyFromSite = new Tagify(fromInput, {
                            mode: "select",
                            whitelist: siteOptions,
                            enforceWhitelist: true,
                            dropdown: {
                                maxItems: 50,
                                classname: "tags-look",
                                enabled: 0,
                                closeOnSelect: true
                            }
                        });
                        fromInput.setAttribute('tagify-initialized', 'true');
                        tagifyFromSite.addTags([{ value: "База", id: "" }]);
                    }

                    // Prepare Clients for Tagify - Filter only those who have objects/schedules
                    const clientsWithSchedules = new Set(data.schedules.map(s => String(s.client_id)));
                    const clientOptions = data.clients
                        .filter(c => clientsWithSchedules.has(String(c.client_id)))
                        .map(c => ({
                            value: c.client_name,
                            id: c.client_id
                        }));

                    if (clientInput && !clientInput.hasAttribute('tagify-initialized')) {
                        tagifyMovementClient = new Tagify(clientInput, {
                            mode: "select",
                            whitelist: clientOptions,
                            enforceWhitelist: true,
                            dropdown: { maxItems: 50, enabled: 0, closeOnSelect: true }
                        });
                        clientInput.setAttribute('tagify-initialized', 'true');

                        tagifyMovementClient.on('change', function (e) {
                            const val = e.detail.value;
                            if (val) {
                                try {
                                    const clientId = JSON.parse(val)[0].id;
                                    const filteredObjects = [];
                                    const seen = new Set();
                                    data.schedules.forEach(s => {
                                        if (s.client_id == clientId && !seen.has(s.request_id)) {
                                            filteredObjects.push({ value: s.обект_име, id: s.request_id });
                                            seen.add(s.request_id);
                                        }
                                    });
                                    tagifyMovementObject.settings.whitelist = filteredObjects;
                                } catch (err) { }
                            } else {
                                tagifyMovementObject.settings.whitelist = [];
                            }
                            tagifyMovementObject.removeAllTags();
                            tagifyMovementSchedule.removeAllTags();
                        });
                    }

                    if (objectInput && !objectInput.hasAttribute('tagify-initialized')) {
                        tagifyMovementObject = new Tagify(objectInput, {
                            mode: "select",
                            whitelist: [],
                            enforceWhitelist: true,
                            dropdown: { maxItems: 50, enabled: 0, closeOnSelect: true }
                        });
                        objectInput.setAttribute('tagify-initialized', 'true');

                        tagifyMovementObject.on('change', function (e) {
                            const val = e.detail.value;
                            if (val) {
                                try {
                                    const requestId = JSON.parse(val)[0].id;
                                    const filteredSchedules = data.schedules
                                        .filter(s => s.request_id == requestId)
                                        .map(s => ({
                                            value: s.activity_name + (s.capability_name ? ` (${s.capability_name})` : '') + (s.activity_subtype ? ` - ${s.activity_subtype}` : ''),
                                            id: s.schedule_id,
                                            request_id: s.request_id,
                                            site_name: s.обект_име,
                                            activity_type_id: s.activity_type_id ? parseInt(s.activity_type_id) : null,
                                            capability_name: s.capability_name
                                        }));
                                    tagifyMovementSchedule.settings.whitelist = filteredSchedules;
                                } catch (err) { }
                            } else {
                                tagifyMovementSchedule.settings.whitelist = [];
                            }
                            tagifyMovementSchedule.removeAllTags();
                        });
                    }

                    if (scheduleInput && !scheduleInput.hasAttribute('tagify-initialized')) {
                        tagifyMovementSchedule = new Tagify(scheduleInput, {
                            mode: "select",
                            whitelist: [], // Initially empty, populated by object selection
                            enforceWhitelist: true,
                            dropdown: {
                                maxItems: 50,
                                classname: "tags-look",
                                enabled: 0,
                                closeOnSelect: true
                            }
                        });

                        tagifyMovementSchedule.on('change', function (e) {
                            const val = e.detail.value;
                            if (val) {
                                try {
                                    const parsed = JSON.parse(val);
                                    if (parsed && parsed[0]) {
                                        // Use the whitelist of tagifyMovementSchedule as it contains the filtered options
                                        const selected = tagifyMovementSchedule.settings.whitelist.find(s => s.id == parsed[0].id);
                                        if (selected) {
                                            // Auto-fill To Site
                                            if (tagifyToSite) {
                                                tagifyToSite.removeAllTags();
                                                tagifyToSite.addTags([{ value: selected.site_name, id: selected.request_id }]);
                                            }

                                            // Filter Machines based on capability
                                            if (tagifyMachine) {
                                                let filteredMachines = originalMachineOptions;
                                                if (selected.activity_type_id) {
                                                    filteredMachines = originalMachineOptions.filter(m => {
                                                        // Check if activity is allowed
                                                        if (!m.allowed_activities.includes(selected.activity_type_id)) {
                                                            return false;
                                                        }
                                                        // Check capability if specified
                                                        if (selected.capability_name && m.capabilities_map[selected.activity_type_id]) {
                                                            if (!m.capabilities_map[selected.activity_type_id].includes(selected.capability_name)) {
                                                                return false;
                                                            }
                                                        }
                                                        return true;
                                                    });
                                                }

                                                tagifyMachine.settings.whitelist = filteredMachines;

                                                // Clear selected machine if it's no longer valid
                                                const currentMachine = tagifyMachine.value[0];
                                                if (currentMachine && !filteredMachines.find(m => m.id == currentMachine.id)) {
                                                    tagifyMachine.removeAllTags();
                                                }
                                            }
                                        }
                                    }
                                } catch (err) { }
                            } else {
                                // If schedule is cleared, restore all machines
                                if (tagifyMachine) {
                                    tagifyMachine.settings.whitelist = [...originalMachineOptions];
                                }
                            }
                        });
                        scheduleInput.setAttribute('tagify-initialized', 'true');
                    }

                    // Initialize Tagify for To Site
                    if (toInput && !toInput.hasAttribute('tagify-initialized')) {
                        if (tagifyToSite) tagifyToSite.destroy();
                        tagifyToSite = new Tagify(toInput, {
                            mode: "select",
                            whitelist: siteOptions,
                            enforceWhitelist: true,
                            dropdown: {
                                maxItems: 50,
                                classname: "tags-look",
                                enabled: 0,
                                closeOnSelect: true
                            }
                        });
                        toInput.setAttribute('tagify-initialized', 'true');
                        tagifyToSite.addTags([{ value: "База", id: "" }]);
                    }

                } else {
                    console.error("Failed to load options");
                }
            })
            .catch(error => {
                console.error('Error fetching options:', error);
            });
    }


    // Function to reset the modal form
    window.resetMovementModal = function () {
        const form = document.getElementById('movementForm');
        form.reset();

        if (tagifyMovementClient) {
            tagifyMovementClient.removeAllTags();
        }
        if (tagifyMovementObject) {
            tagifyMovementObject.removeAllTags();
            tagifyMovementObject.settings.whitelist = [];
        }
        if (tagifyMovementSchedule) {
            tagifyMovementSchedule.removeAllTags();
            tagifyMovementSchedule.settings.whitelist = [];
        }
        if (tagifyMachine) {
            tagifyMachine.removeAllTags();
        }
        if (tagifyFromSite) {
            tagifyFromSite.removeAllTags();
            tagifyFromSite.addTags([{ value: "База", id: "" }]);
        }
        if (tagifyToSite) {
            tagifyToSite.removeAllTags();
            tagifyToSite.addTags([{ value: "База", id: "" }]);
        }

        document.getElementById('movement_id').value = '0';
        document.getElementById('movementModalLabel').innerText = 'Ново Движение';

        // Set default date to today
        const fpArr = document.getElementById('arrival_date')._flatpickr;
        if (fpArr) fpArr.clear();
        const fpDep = document.getElementById('departure_date')._flatpickr;
        if (fpDep) fpDep.clear();
    };

    // Function to load all movements
    function loadMovements(searchTerm = '') {
        const tableBody = document.getElementById('movementsTableBody');
        tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center p-5 text-muted">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 mb-0">Зареждане...</p>
            </td>
        </tr>
    `;

        let url = `${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php?action=get_movements`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderMovementsTable(data.data);
                } else {
                    Swal.fire('Грешка', data.message || 'Възникна грешка при зареждане.', 'error');
                }
            })
            .catch(error => {
                console.error('Error fetching movements:', error);
                Swal.fire('Грешка', 'Възникна мрежова грешка при зареждане.', 'error');
            });
    }

    // Formatting Helper
    function formatDateDisplay(dateString) {
        if (!dateString) return '-';
        const parts = dateString.split('-');
        if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        return dateString;
    }

    // Function to render data into the table
    function renderMovementsTable(movements) {
        const tableBody = document.getElementById('movementsTableBody');
        tableBody.innerHTML = '';

        if (movements.length === 0) {
            tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center p-5 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                    Няма намерени записи.
                </td>
            </tr>
        `;
            return;
        }

        // Helper to get month-year string in BG
        const getMonthYear = (dateString) => {
            if (!dateString) return 'Неизвестна дата';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Неизвестна дата';
            const formatter = new Intl.DateTimeFormat('bg-BG', { month: 'long', year: 'numeric' });
            const parts = formatter.formatToParts(date);
            let monthStr = formatter.format(date);
            // Capitalize first letter to look nice
            return monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
        };

        let currentMonthYear = '';

        movements.forEach(movement => {
            const movementMonthYear = getMonthYear(movement.movement_date);

            // Check if we need a new month header
            if (movementMonthYear !== currentMonthYear) {
                currentMonthYear = movementMonthYear;

                const headerRow = document.createElement('tr');
                // 'bg-body-tertiary' gives a subtle, theme-aware background color in modern Bootstrap
                headerRow.className = 'bg-body-tertiary shadow-sm';
                headerRow.innerHTML = `
                <td colspan="7" class="fw-bold text-primary py-3 px-4 border-bottom border-2">
                    <i class="bi bi-calendar3-range me-2"></i> ${currentMonthYear}
                </td>
            `;
                tableBody.appendChild(headerRow);
            }

            const tr = document.createElement('tr');
            tr.className = 'hover-elevate-sm transition-all';

            let fromHtml = movement.from_site_id ? escapeHtml(movement.from_site_name || movement.departure_from) : `<span class="badge bg-secondary px-2 py-1"><i class="bi bi-building me-1"></i>База</span>`;
            let toHtml = movement.to_site_id ? escapeHtml(movement.to_site_name || movement.arrive_to) : `<span class="badge bg-secondary px-2 py-1"><i class="bi bi-building me-1"></i>База</span>`;

            tr.innerHTML = `
            <td class="ps-4">
                <div>${formatDateDisplay(movement.movement_date)}</div>
            </td>
            <td>
                <div class="fw-bold text-highlight">${escapeHtml(movement.machine_name)}</div>
            </td>
            <td>
                ${fromHtml}
            </td>
            <td>
                ${toHtml}
            </td>
            <td>
                <div class="small">
                    ${movement.arrival_date ? `<div><i class="bi bi-play-circle me-1 opacity-75"></i>${formatDateDisplay(movement.arrival_date)}</div>` : ''}
                    ${movement.departure_date ? `<div><i class="bi bi-stop-circle me-1 opacity-75"></i>${formatDateDisplay(movement.departure_date)}</div>` : ''}
                    ${!movement.arrival_date && !movement.departure_date ? '-' : ''}
                </div>
            </td>
            <td>
                <div class="text-muted"><i class="bi bi-truck me-2 text-primary"></i>${escapeHtml(movement.carrier)}</div>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-sm btn-outline-primary" onclick="editMovement(${movement.id})" title="Редактирай">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteMovement(${movement.id})" title="Изтрий">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
            tableBody.appendChild(tr);
        });
    }

    // Function to save
    function saveMovement() {
        const form = document.getElementById('movementForm');

        // Basic frontend validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);

        const saveBtn = document.getElementById('saveMovementBtn');
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Запазване...';
        saveBtn.disabled = true;

        fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php`, {
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

                    const modalEl = document.getElementById('movementModal');
                    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    modal.hide();

                    const searchInput = document.getElementById('search_movement');
                    const searchTerm = searchInput ? searchInput.value.trim() : '';
                    loadMovements(searchTerm);
                } else {
                    if (typeof showToast === 'function') {
                        showToast({ message: data.message || 'Възникна грешка при запазване.', type: 'error' });
                    } else {
                        alert(data.message || 'Възникна грешка при запазване.');
                    }
                }
            })
            .catch(error => {
                console.error('Error saving movement:', error);
                if (typeof showToast === 'function') {
                    showToast({ message: 'Възникна мрежова грешка при запазване.', type: 'error' });
                } else {
                    alert('Възникна мрежова грешка при запазване.');
                }
            })
            .finally(() => {
                saveBtn.innerHTML = originalBtnText;
                saveBtn.disabled = false;
            });
    }

    // Function to fetch and open the modal for editing
    window.editMovement = function (movementId) {
        const btn = document.querySelector(`button[onclick="editMovement(${movementId})"]`);
        const originalIcon = btn ? btn.innerHTML : '<i class="bi bi-pencil"></i>';
        if (btn) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
            btn.disabled = true;
        }

        fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php?action=get_movement&movement_id=${movementId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const movement = data.data;
                    document.getElementById('movement_id').value = movement.id;

                    if (movement.schedule_id) {
                        // Populate Client
                        if (tagifyMovementClient && movement.client_id) {
                            tagifyMovementClient.addTags([{ value: movement.client_name, id: movement.client_id }]);

                            // Populate object whitelist based on client
                            if (movementOptions) {
                                const filteredObjects = [];
                                const seen = new Set();
                                movementOptions.schedules.forEach(s => {
                                    if (s.client_id == movement.client_id && !seen.has(s.request_id)) {
                                        filteredObjects.push({ value: s.обект_име, id: s.request_id });
                                        seen.add(s.request_id);
                                    }
                                });
                                tagifyMovementObject.settings.whitelist = filteredObjects;
                            }
                        }

                        // Populate Object
                        if (tagifyMovementObject && movement.request_id) {
                            tagifyMovementObject.addTags([{ value: movement.schedule_site_name, id: movement.request_id }]);

                            // Populate activity whitelist based on object
                            if (movementOptions) {
                                const filteredSchedules = movementOptions.schedules
                                    .filter(s => s.request_id == movement.request_id)
                                    .map(s => ({
                                        value: s.activity_name + (s.capability_name ? ` (${s.capability_name})` : '') + (s.activity_subtype ? ` - ${s.activity_subtype}` : ''),
                                        id: s.schedule_id,
                                        request_id: s.request_id,
                                        site_name: s.обект_име,
                                        activity_type_id: s.activity_type_id ? parseInt(s.activity_type_id) : null,
                                        capability_name: s.capability_name
                                    }));
                                tagifyMovementSchedule.settings.whitelist = filteredSchedules;
                            }
                        }

                        if (tagifyMovementSchedule) {
                            let vid = movement.s_cap || '';
                            if (movement.s_sub) {
                                vid = (vid ? vid + ' — ' : '') + movement.s_sub;
                            }
                            let display = (movement.s_activity || 'Без дейност');
                            if (vid) display += ' (' + vid + ')';

                            tagifyMovementSchedule.addTags([{
                                value: display,
                                id: movement.schedule_id
                            }]);
                        }
                    }

                    if (tagifyMachine) {
                        tagifyMachine.removeAllTags();
                        if (movement.machine_id) {
                            tagifyMachine.addTags([{ value: movement.machine_name, id: movement.machine_id }]);
                        }
                    }

                    const fpArr = document.getElementById('arrival_date')._flatpickr;
                    if (fpArr && movement.arrival_date) {
                        fpArr.setDate(formatDateDisplay(movement.arrival_date));
                    } else {
                        document.getElementById('arrival_date').value = movement.arrival_date || '';
                    }

                    const fpDep = document.getElementById('departure_date')._flatpickr;
                    if (fpDep && movement.departure_date) {
                        fpDep.setDate(formatDateDisplay(movement.departure_date));
                    } else {
                        document.getElementById('departure_date').value = movement.departure_date || '';
                    }

                    // Update Tagify values
                    if (tagifyFromSite) {
                        tagifyFromSite.removeAllTags();
                        if (movement.from_site_id) {
                            tagifyFromSite.addTags([{ value: movement.from_site_name, id: movement.from_site_id }]);
                        } else if (movement.departure_from === 'База' || !movement.from_site_id) {
                            tagifyFromSite.addTags([{ value: "База", id: "" }]);
                        }
                    }
                    if (tagifyToSite) {
                        tagifyToSite.removeAllTags();
                        if (movement.to_site_id) {
                            tagifyToSite.addTags([{ value: movement.to_site_name, id: movement.to_site_id }]);
                        } else if (movement.arrive_to === 'База') {
                            tagifyToSite.addTags([{ value: 'База', id: '' }]);
                        }
                    }

                    document.getElementById('carrier').value = movement.carrier || '';
                    document.getElementById('notes').value = movement.notes || '';

                    document.getElementById('movementModalLabel').innerText = 'Редактирай Движение';

                    const modalEl = document.getElementById('movementModal');
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                } else {
                    if (typeof showToast === 'function') {
                        showToast({ message: data.message || 'Не беше намерено.', type: 'error' });
                    } else {
                        alert(data.message || 'Не беше намерено.');
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching details:', error);
                if (typeof showToast === 'function') {
                    showToast({ message: 'Възникна мрежова грешка при зареждане детайлите.', type: 'error' });
                } else {
                    alert('Възникна мрежова грешка при зареждане детайлите.');
                }
            })
            .finally(() => {
                if (btn) {
                    btn.innerHTML = originalIcon;
                    btn.disabled = false;
                }
            });
    };

    // Function to delete
    window.deleteMovement = function (movementId) {
        const confirmModal = document.getElementById('confirmationModal');
        const confirmText = document.getElementById('confirmationModalText');
        const confirmBtn = document.getElementById('confirmationModalBtn');

        if (confirmModal && confirmText && confirmBtn) {
            confirmText.innerText = "Сигурни ли сте? Тази операция е необратима. Записът ще бъде изтрит!";

            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            const modalInstance = new bootstrap.Modal(confirmModal);

            newConfirmBtn.addEventListener('click', function () {
                modalInstance.hide();

                const formData = new FormData();
                formData.append('action', 'delete_movement');
                formData.append('movement_id', movementId);

                fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php`, {
                    method: 'POST',
                    body: formData
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            if (typeof showToast === 'function') {
                                showToast({ message: data.message || 'Изтрито!', type: 'success' });
                            } else {
                                alert(data.message || 'Изтрито!');
                            }
                            const searchInput = document.getElementById('search_movement');
                            const searchTerm = searchInput ? searchInput.value.trim() : '';
                            loadMovements(searchTerm);
                        } else {
                            if (typeof showToast === 'function') {
                                showToast({ message: data.message || 'Грешка при изтриването.', type: 'error' });
                            } else {
                                alert(data.message || 'Грешка при изтриването.');
                            }
                        }
                    })
                    .catch(error => console.error('Error:', error));
            });

            modalInstance.show();
        } else {
            if (confirm("Сигурни ли сте? Тази операция е необратима.")) {
                const formData = new FormData();
                formData.append('action', 'delete_movement');
                formData.append('movement_id', movementId);

                fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php`, {
                    method: 'POST',
                    body: formData
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            const searchInput = document.getElementById('search_movement');
                            const searchTerm = searchInput ? searchInput.value.trim() : '';
                            loadMovements(searchTerm);
                        }
                    });
            }
        }
    };

} // end guard: objects-machine-movements-container

// Helper function to escape HTML
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

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
