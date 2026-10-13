// Safe Notification helper
window.safeAlert = (title, message, type = 'info') => {
    if (typeof Swal !== 'undefined') {
        Swal.fire(title, message, type);
    } else if (typeof showToast === 'function') {
        showToast({ message: `${title}: ${message}`, type: type === 'error' ? 'error' : 'success' });
    } else {
        alert(`${title}: ${message}`);
    }
};

var tagifyRequest = null;
var tagifyNewRequest = null;
var tagifyClient = null;
var tagifyNewClient = null;
var tagifyChangeClient = null;
var tagifyMachines = null; // Added for multi-machine support
var currentSchedules = [];

// Track expanded object groups to persist state across reloads
var expandedGroups = new Set();
window.currentSchedules = [];

window.initProjectSchedules = function () {
    loadOptions();
    loadSchedules();

    if (typeof window.initProjectSchedulesMatrix === 'function') {
        window.initProjectSchedulesMatrix();
    }

    // Event listeners for dynamic dropdowns
    const activitySelect = document.getElementById('activity_type_id');
    if (activitySelect) {
        activitySelect.addEventListener('change', () => {
            if (typeof updateMachineOptions === 'function') updateMachineOptions();
        });
    }

    const machineInput = document.getElementById('machine_ids');
    if (machineInput) {
        machineInput.addEventListener('change', () => {
            if (typeof updateActivityOptions === 'function') updateActivityOptions();
        });
    }

    // Initialize flatpickr for dates
    flatpickr("#start_date", {
        dateFormat: "d.m.Y",
        allowInput: true,
        locale: {
            firstDayOfWeek: 1
        }
    });


    flatpickr("#end_date", {
        dateFormat: "d.m.Y",
        allowInput: true,
        locale: {
            firstDayOfWeek: 1
        }
    });

    // Real-time Debounced Search
    const searchInput = document.getElementById('search_schedule');
    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        let searchTimeout;
        newSearchInput.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadSchedules(this.value.trim());
            }, 300); // 300ms debounce
        });
    }

    // Handle Save Schedule Button Click
    const saveBtn = document.getElementById('saveScheduleBtn');
    if (saveBtn) {
        console.log('[Objects] Binding saveSchedule to saveScheduleBtn');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        if (typeof window.saveSchedule === 'function') {
            newSaveBtn.addEventListener('click', window.saveSchedule);
        } else {
            console.error('[Objects] window.saveSchedule is not a function during init!');
        }
    }

    // Handle Save Log Button Click
    const saveLogBtn = document.getElementById('saveLogBtn');
    if (saveLogBtn) {
        const newSaveLogBtn = saveLogBtn.cloneNode(true);
        saveLogBtn.parentNode.replaceChild(newSaveLogBtn, saveLogBtn);
        newSaveLogBtn.addEventListener('click', saveLog);
    }

    // Handle Save New Object Button Click
    const saveNewObjectBtn = document.getElementById('saveNewObjectBtn');
    if (saveNewObjectBtn) {
        const newSaveNewObjectBtn = saveNewObjectBtn.cloneNode(true);
        saveNewObjectBtn.parentNode.replaceChild(newSaveNewObjectBtn, saveNewObjectBtn);
        newSaveNewObjectBtn.addEventListener('click', saveNewObject);
    }

    // Auto-calculate planned days if plan and total are given (optional UX enhancement)
    const quantityInput = document.getElementById('total_quantity');
    const planInput = document.getElementById('daily_productivity_plan');
    const daysInput = document.getElementById('planned_days');

    function calcDays() {
        const q = parseFloat(quantityInput.value) || 0;
        const p = parseFloat(planInput.value) || 0;
        if (p > 0) {
            daysInput.value = Math.ceil(q / p);
        }
        if (typeof window.updateEndDateFromDays === 'function') window.updateEndDateFromDays();
    }

    if (quantityInput) quantityInput.addEventListener('input', calcDays);
    if (planInput) planInput.addEventListener('input', calcDays);

    const startDateInput = document.getElementById('start_date');
    if (startDateInput) {
        startDateInput.addEventListener('change', () => {
            if (typeof window.updateEndDateFromDays === 'function') window.updateEndDateFromDays();
        });
    }

    // Auto-expand note fields when editing and interacting with monitored fields
    const noteMappings = {
        'total_quantity': 'note_quantity_container',
        'planned_days': 'note_plan_container',
        'start_date': 'note_period_container',
        'estimated_start_date': 'note_estimated_start_container',
        'estimated_end_date': 'note_estimated_end_container',
        'end_date': 'note_end_container',
        'status': 'note_status_container'
    };

    Object.keys(noteMappings).forEach(inputId => {
        const inputEl = document.getElementById(inputId);
        const containerId = noteMappings[inputId];
        if (inputEl) {
            const showNote = (e) => {
                const scheduleId = document.getElementById('schedule_id').value;
                if (scheduleId !== '0') { // Only auto-expand in edit mode
                    // Compare current value with stored original value to see if it changed
                    const originalValue = inputEl.getAttribute('data-original-value') || '';
                    const currentValue = inputEl.value || '';

                    if (currentValue !== originalValue) {
                        const container = document.getElementById(containerId);
                        if (container && container.classList.contains('d-none')) {
                            container.classList.remove('d-none');
                        }
                    }
                }
            };
            inputEl.addEventListener('change', showNote);
            inputEl.addEventListener('input', showNote);
        }
    });

    // Deep Linking: Auto-expand based on request_id in URL
    const urlParams = new URLSearchParams(window.location.search);
    const targetRequestId = urlParams.get('request_id');
    if (targetRequestId) {
        window.targetRequestId = targetRequestId;
    }
};

// Global mapping variables
window.machineActivitiesMapping = [];
window.machinesList = [];
window.activitiesList = [];

// Mapping rows (machine / activity / capability) that belong to an activity.
// "Сондиране" is a virtual activity: it uses every capability that contains "Сондаж" (drilling), whatever activity they are mapped to.
window.getActivityMappingRows = function (activityId) {
    const rows = window.machineActivitiesMapping || [];
    if (!activityId) return rows;
    const activity = (window.activitiesList || []).find(a => String(a.id) === String(activityId));
    if (activity && (activity.activity_name || '').trim().toLowerCase() === 'сондиране') {
        return rows.filter(m => /сондаж/i.test(m.capability_name || ''));
    }
    return rows.filter(m => String(m.activity_type_id) === String(activityId));
};

window.updateMachineOptions = function () {
    const activitySelect = document.getElementById('activity_type_id');
    if (!activitySelect || !window.tagifyMachines) return;

    const selectedActivityId = activitySelect.value;

    // Get capability filter from Tagify if initialized
    let filterCapability = '';
    if (window.tagifyCapability && window.tagifyCapability.value.length > 0) {
        filterCapability = window.tagifyCapability.value[0].value;
        if (filterCapability.includes(' — ')) {
            filterCapability = filterCapability.split(' — ')[0].trim();
        }
    }

    let filteredMachines = [];
    if (!selectedActivityId) {
        filteredMachines = window.machinesList.map(m => ({ value: m.machine_name, id: m.id }));
    } else {
        const allowedMachineIds = new Set(
            window.getActivityMappingRows(selectedActivityId)
                .filter(m => !filterCapability || m.capability_name === filterCapability)
                .map(m => String(m.machine_id))
        );

        filteredMachines = window.machinesList
            .filter(machine => allowedMachineIds.has(String(machine.id)))
            .map(m => ({ value: m.machine_name, id: m.id }));
    }

    // Update Tagify whitelist
    window.tagifyMachines.settings.whitelist = filteredMachines;

    if (typeof window.updateSubtypeOptions === 'function') window.updateSubtypeOptions();
};

window.updateActivityOptions = function () {
    const activitySelect = document.getElementById('activity_type_id');
    if (!activitySelect || !window.tagifyMachines) return;

    const selectedMachineIds = window.tagifyMachines.value.map(tag => String(tag.id));
    const currentActivityId = activitySelect.value;

    activitySelect.innerHTML = '<option value="" disabled selected>Изберете дейност...</option>';

    if (selectedMachineIds.length === 0) {
        window.activitiesList.forEach(activity => {
            activitySelect.add(new Option(`${activity.activity_name} (${activity.unit_of_measure})`, activity.id));
        });
    } else {
        // If multiple machines are selected, show activities supported by ALL of them (Intersection)
        let allowedActivityIds = null;

        selectedMachineIds.forEach(mId => {
            const machineActivities = new Set(
                window.machineActivitiesMapping
                    .filter(m => String(m.machine_id) === String(mId))
                    .map(m => String(m.activity_type_id))
            );

            if (allowedActivityIds === null) {
                allowedActivityIds = machineActivities;
            } else {
                allowedActivityIds = new Set([...allowedActivityIds].filter(x => machineActivities.has(x)));
            }
        });

        window.activitiesList.forEach(activity => {
            // A machine supports the virtual activity "Сондиране" when it has at least one drilling ("Сондаж") capability
            const supported = allowedActivityIds && (allowedActivityIds.has(String(activity.id)) ||
                ((activity.activity_name || '').trim().toLowerCase() === 'сондиране' &&
                    selectedMachineIds.every(mId => window.getActivityMappingRows(activity.id).some(m => String(m.machine_id) === String(mId)))));
            if (supported) {
                activitySelect.add(new Option(`${activity.activity_name} (${activity.unit_of_measure})`, activity.id));
            }
        });
    }

    if (currentActivityId && Array.from(activitySelect.options).some(opt => opt.value === currentActivityId)) {
        activitySelect.value = currentActivityId;
    }

    if (typeof window.syncActivityTagify === 'function') window.syncActivityTagify();

    if (typeof window.updateSubtypeOptions === 'function') window.updateSubtypeOptions();
};


// Visible "Дейност" control: Tagify (same look as "Вид дейност") backed by the native #activity_type_id select
window.syncActivityTagify = function () {
    const select = document.getElementById('activity_type_id');
    const input = document.getElementById('activity_tagify');
    if (!select || !input || typeof Tagify === 'undefined') return;

    const whitelist = Array.from(select.options)
        .filter(o => o.value !== '')
        .map(o => ({ value: o.text, id: o.value }));

    if (!window.tagifyActivity) {
        window.tagifyActivity = new Tagify(input, {
            mode: 'select',
            delimiters: null,
            whitelist: whitelist,
            enforceWhitelist: true,
            dropdown: { maxItems: 50, classname: 'tags-look', enabled: 0, closeOnSelect: true }
        });
        window.tagifyActivity.on('change', () => {
            if (window._syncingActivity) return;
            const tag = window.tagifyActivity.value[0];
            select.value = tag ? tag.id : '';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    } else {
        window.tagifyActivity.settings.whitelist = whitelist;
    }

    // Reflect the current select value in the Tagify control
    window._syncingActivity = true;
    try {
        window.tagifyActivity.removeAllTags();
        const current = whitelist.find(w => String(w.id) === String(select.value));
        if (current) window.tagifyActivity.addTags([current]);
    } finally {
        window._syncingActivity = false;
    }
};

window.updateSubtypeOptions = function () {
    const activitySelect = document.getElementById('activity_type_id');
    const capabilityInput = document.getElementById('capability_name');
    if (!activitySelect || !capabilityInput) return;

    const selectedActivityId = activitySelect.value;

    // Get possible capabilities for this activity from mapping
    const capabilityWhitelist = [...new Set(
        window.getActivityMappingRows(selectedActivityId)
            .map(m => m.capability_name)
            .filter(c => c && c.trim() !== '')
    )].sort();

    if (!window.tagifyCapability) {
        window.tagifyCapability = new Tagify(capabilityInput, {
            mode: "select",
            delimiters: null,
            whitelist: capabilityWhitelist,
            enforceWhitelist: false, // Allow custom text/subtypes
            dropdown: {
                maxItems: 50,
                classname: "tags-look",
                enabled: 0,
                closeOnSelect: true
            }
        });

        window.tagifyCapability.on('change', () => {
            // Re-trigger machine filtering when capability changes
            window.updateMachineOptions();
        });

        // Also handle manual typing/clearing
        window.tagifyCapability.on('input', (e) => {
            if (!e.detail.value) {
                window.updateMachineOptions();
            }
        });
    } else {
        // Update whitelist for existing instance
        window.tagifyCapability.settings.whitelist = capabilityWhitelist;
    }
};


// Function to fetch Select Options
function loadOptions() {
    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php?action=get_options`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const clientInput = document.getElementById('client_id');
                const requestInput = document.getElementById('request_id');

                window.machinesList = data.machines || [];
                window.activitiesList = data.activities || [];
                window.machineActivitiesMapping = data.machine_activities || [];

                window.updateMachineOptions();
                window.updateActivityOptions();

                // Prepare Clients for Tagify
                const clientOptions = [];
                if (data.clients) {
                    data.clients.forEach(client => {
                        clientOptions.push({ value: client.client_name, id: client.client_id });
                    });
                }
                const requestOptions = [];
                data.requests.forEach(req => {
                    requestOptions.push({ value: req.обект_име, id: req.request_id });
                });

                // Whitelist for machine movements "To Site"
                window.allSitesWhitelist = [...requestOptions, { value: "База", id: "" }];

                // Initialize Tagify for Requests
                if (requestInput && !requestInput.hasAttribute('tagify-initialized')) {
                    if (tagifyRequest) tagifyRequest.destroy();
                    tagifyRequest = new Tagify(requestInput, {
                        mode: "select",
                        delimiters: null,
                        whitelist: requestOptions,
                        enforceWhitelist: true,
                        dropdown: {
                            maxItems: 50,
                            classname: "tags-look",
                            enabled: 0,
                            closeOnSelect: true
                        }
                    });
                    tagifyRequest.on('change', () => {
                        const reqId = tagifyRequest.value && tagifyRequest.value[0] ? tagifyRequest.value[0].id : null;
                        if (typeof window.loadRequestRecords === 'function') window.loadRequestRecords(reqId);
                    });
                    requestInput.setAttribute('tagify-initialized', 'true');
                }

                // Initialize Tagify for Clients
                if (clientInput && !clientInput.hasAttribute('tagify-initialized')) {
                    if (tagifyClient) tagifyClient.destroy();
                    tagifyClient = new Tagify(clientInput, {
                        mode: "select",
                        delimiters: null,
                        whitelist: clientOptions,
                        enforceWhitelist: true,
                        dropdown: {
                            maxItems: 50,
                            classname: "tags-look",
                            enabled: 0,
                            closeOnSelect: true
                        }
                    });
                    clientInput.setAttribute('tagify-initialized', 'true');
                }

                // Prepare new request for the simplified modal
                const newRequestInput = document.getElementById('new_request_id');
                const changeClientInput = document.getElementById('change_client_id');

                // Initialize Tagify for Change Client modal
                if (changeClientInput && !changeClientInput.hasAttribute('tagify-initialized')) {
                    if (tagifyChangeClient) tagifyChangeClient.destroy();
                    tagifyChangeClient = new Tagify(changeClientInput, {
                        mode: "select",
                        delimiters: null,
                        whitelist: clientOptions,
                        enforceWhitelist: true,
                        dropdown: {
                            maxItems: 50,
                            classname: "tags-look",
                            enabled: 0,
                            closeOnSelect: true
                        }
                    });
                    changeClientInput.setAttribute('tagify-initialized', 'true');
                }

                // Initialize Tagify for New Request modal
                if (newRequestInput && !newRequestInput.hasAttribute('tagify-initialized')) {
                    if (tagifyNewRequest) tagifyNewRequest.destroy();
                    tagifyNewRequest = new Tagify(newRequestInput, {
                        mode: "select",
                        delimiters: null,
                        whitelist: requestOptions,
                        enforceWhitelist: false,
                        dropdown: {
                            maxItems: 50,
                            classname: "tags-look",
                            enabled: 0,
                            closeOnSelect: true
                        }
                    });
                    newRequestInput.setAttribute('tagify-initialized', 'true');
                }

                // Initialize Tagify for Machines (Multi-select)
                const machineInput = document.getElementById('machine_ids');
                if (machineInput && !machineInput.hasAttribute('tagify-initialized')) {
                    if (tagifyMachines) tagifyMachines.destroy();

                    const machineOptions = window.machinesList.map(m => ({
                        value: m.machine_name,
                        id: m.id
                    }));

                    tagifyMachines = new Tagify(machineInput, {
                        delimiters: null,
                        whitelist: machineOptions,
                        enforceWhitelist: true,
                        dropdown: {
                            maxItems: 50,
                            classname: "tags-look",
                            enabled: 0,
                            closeOnSelect: false // Allow multiple selection without closing
                        }
                    });

                    tagifyMachines.on('add', (e) => {
                        if (!window.currentMachineAssignments) window.currentMachineAssignments = [];

                        const alreadyExists = window.currentMachineAssignments.some(a => a.machine_id == e.detail.data.id);
                        if (!alreadyExists) {

                            window.currentMachineAssignments.push({
                                id: 0,
                                machine_id: e.detail.data.id,
                                machine_name: e.detail.data.value,
                                start_date: document.getElementById('estimated_start_date')?.value || '',
                                end_date: document.getElementById('estimated_end_date')?.value || ''
                            });
                            if (typeof window.renderMachineAssignments === 'function') window.renderMachineAssignments();
                        }
                        if (typeof window.updateActivityOptions === 'function') window.updateActivityOptions();
                    });

                    tagifyMachines.on('remove', (e) => {
                        if (window.currentMachineAssignments) {
                            window.currentMachineAssignments = window.currentMachineAssignments.filter(a => a.machine_id != e.detail.data.id);
                            if (typeof window.renderMachineAssignments === 'function') window.renderMachineAssignments();
                        }
                        if (typeof window.updateActivityOptions === 'function') window.updateActivityOptions();
                    });

                    machineInput.setAttribute('tagify-initialized', 'true');
                    window.tagifyMachines = tagifyMachines; // Export to global for modal reset
                }

                // Machines are ready now, so the activity list can be built and shown in Tagify
                if (typeof window.updateActivityOptions === 'function') window.updateActivityOptions();

            } else {
                console.error("Failed to load options");
            }
        })
        .catch(error => {
            console.error('Error fetching options:', error);
        });
}

// Function to load all schedules
function loadSchedules(searchTerm = '') {
    const tableBody = document.getElementById('schedulesTableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="11" class="text-center p-5 text-muted">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 mb-0">Зареждане...</p>
            </td>
        </tr>
    `;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php?action=get_schedules&search=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                let schedules = data.data || [];

                // If we have a targetRequestId from deep-link, filter the data
                if (window.targetRequestId) {
                    schedules = schedules.filter(s => String(s.request_id) === String(window.targetRequestId));

                    // Update search UI to show filter is active
                    const searchInput = document.getElementById('search_schedule');
                    if (searchInput && schedules.length > 0) {
                        searchInput.value = schedules[0].обект_име;
                    }
                }

                window.currentSchedules = schedules;
                renderSchedulesTable(schedules);
            } else {
                safeAlert('Грешка', data.message || 'Възникна грешка при зареждане.', 'error');
            }
        })
        .catch(error => {
            console.error('Error fetching schedules:', error);
            safeAlert('Грешка', 'Възникна мрежова грешка при зареждане.', 'error');
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
function renderSchedulesTable(schedules) {
    const tableBody = document.getElementById('schedulesTableBody');
    tableBody.innerHTML = '';

    if (schedules.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center p-5 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                    Няма намерени записи.
                </td>
            </tr>
        `;
        return;
    }

    // Group schedules by Object Name (and Client Name as secondary factor)
    const groupedSchedules = {};
    schedules.forEach(schedule => {
        // Use a composite key just in case, or default to object name
        const groupKey = `${schedule.обект_име}|${schedule.client_name}`;
        if (!groupedSchedules[groupKey]) {
            groupedSchedules[groupKey] = {
                objectName: schedule.обект_име,
                clientName: schedule.client_name,
                items: []
            };
        }
        groupedSchedules[groupKey].items.push(schedule);
    });

    let groupId = 0;
    let targetRow = null;

    Object.values(groupedSchedules).forEach(group => {
        groupId++;
        // Use a stable key for expansion persistence: client_id + request_id
        const requestId = group.items[0].request_id;
        const groupKey = `${group.items[0].client_id}-${requestId}`;
        const currentGroupId = 'group-' + groupId;

        // Auto-expand if this is the target from URL
        if (window.targetRequestId && String(window.targetRequestId) === String(requestId)) {
            expandedGroups.add(groupKey);
        }

        const isExpanded = expandedGroups.has(groupKey);

        // Group Header Row (will update the action buttons after checking items)
        const groupHeader = document.createElement('tr');
        groupHeader.className = 'bg-transparent border-bottom border-top hover-elevate-sm transition-all';
        groupHeader.setAttribute('data-group-key', groupKey);
        groupHeader.style.cursor = 'pointer';
        tableBody.appendChild(groupHeader);

        if (window.targetRequestId && String(window.targetRequestId) === String(requestId)) {
            targetRow = groupHeader;
        }

        // Group Items
        let hasVisibleItems = false;
        let placeholderScheduleId = null;

        group.items.forEach(schedule => {
            // Check if this is just a placeholder object (no activity assigned yet)
            if (!schedule.activity_type_id && !schedule.activity_name) {
                placeholderScheduleId = schedule.schedule_id;
                return; // Skip rendering a row for the placeholder
            }
            hasVisibleItems = true;

            const tr = document.createElement('tr');
            tr.className = `hover-elevate-sm transition-all schedule-item-${currentGroupId} ${isExpanded ? '' : 'd-none'}`;
            tr.style.opacity = isExpanded ? '1' : '0';
            tr.style.transition = 'opacity 0.2s ease-in-out';

            let statusBadgeClass = 'bg-secondary';
            if (schedule.status.includes('приключен')) {
                statusBadgeClass = 'bg-success';
            } else if (schedule.status.includes('стартирали')) {
                statusBadgeClass = 'bg-primary';
            } else if (schedule.status.includes('проблем') || schedule.status.includes('спрян')) {
                statusBadgeClass = 'bg-danger';
            } else if (schedule.status.includes('пауза')) {
                statusBadgeClass = 'bg-warning text-dark';
            }

            let startDateColorClass = 'text-body-emphasis'; // Default neutral color

            tr.innerHTML = `
                <td title="Машини">
                    <div class="d-flex flex-column gap-1">
                        ${schedule.machine_name ? String(schedule.machine_name).split(',').map(m => `<div><i class="bi bi-truck text-primary me-1"></i> ${escapeHtml(m.trim())}</div>`).join('') : '<span class="text-muted small">Няма машина</span>'}
                    </div>
                </td>
                <td title="Дейност">
                    <div class="text-body">${escapeHtml(schedule.activity_name)}</div>
                </td>
                <td title="Вид дейност">
                    <div class="text-body">
                        ${schedule.capability_name ? escapeHtml(schedule.capability_name) : ''}
                        ${schedule.activity_subtype ? (schedule.capability_name ? ' — ' : '') + `<small class="text-body-secondary">${escapeHtml(schedule.activity_subtype)}</small>` : (schedule.capability_name ? '' : '-')}
                    </div>
                </td>
                <td title="Мярка">
                    <div>${escapeHtml(schedule.unit_of_measure)}</div>
                </td>
                <td title="Количество и размер">
                    <div class="fw-bold fs-6">${schedule.total_quantity}</div>
                    ${schedule.dimension_info ? `<div class="small text-muted">Размер: ${schedule.dimension_info}</div>` : ''}
                </td>
                <td title="Дневен План / Общо Дни">
                    <div><i class="bi bi-graph-up text-primary me-1"></i> ${schedule.daily_productivity_plan}</div>
                    <div class="small text-muted"><i class="bi bi-clock me-1"></i> ${schedule.planned_days} дни</div>
                </td>
                <td title="Период">
                    <div class="fw-bold mb-1" title="Начална дата"><i class="bi bi-play-circle me-1"></i>${formatDateDisplay(schedule.start_date)}</div>
                    ${schedule.end_date ? `<div class="fw-bold" title="Крайна дата"><i class="bi bi-stop-circle me-1"></i>${formatDateDisplay(schedule.end_date)}</div>` : '<div class="text-muted small opacity-50"><i class="bi bi-stop-circle me-1"></i>-</div>'}
                </td>
                 <td title="Статус">
                    <span class="badge ${statusBadgeClass} px-2 py-1">${escapeHtml(schedule.status)}</span>
                </td>
                <td title="Изпълнено к-во" style="min-width: 150px;">
                    ${renderProgressBar(schedule.total_completed, schedule.total_quantity)}
                </td>
                <td title="Действия" class="text-center">
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-sm btn-outline-primary shadow-sm" onclick="openTimelineModal(${schedule.schedule_id}, '${escapeHtml(schedule.обект_име)}')" title="Хронология & Бележки">
                            <i class="bi bi-clock-history"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary shadow-sm" onclick="openLogsModal(${schedule.schedule_id}, '${escapeHtml(schedule.обект_име)}')" title="Отчети за изпълнение">
                            <i class="bi bi-journal-text"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary shadow-sm" onclick="editSchedule(${schedule.schedule_id})" title="Редактирай">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary shadow-sm" onclick="deleteSchedule(${schedule.schedule_id})" title="Изтрий">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // If no visible items were added (only placeholder was present), show a "no activities" row
        if (!hasVisibleItems) {
            const tr = document.createElement('tr');
            tr.className = `schedule-item-${currentGroupId} ${isExpanded ? '' : 'd-none'}`;
            tr.style.opacity = isExpanded ? '1' : '0';
            tr.style.transition = 'opacity 0.2s ease-in-out';
            tr.innerHTML = `
                <td colspan="10" class="text-center p-3 text-muted fst-italic">
                    Все още няма добавени дейности за този обект. Използвайте бутона "Добави дейност", за да създадете първата.
                </td>
            `;
            tableBody.appendChild(tr);
        }

        // Update Header HTML now that we know if it has items
        let actionButtons = `
            <button class="btn btn-sm btn-success shadow-sm" data-bs-toggle="tooltip" title="Добави нова дейност" onclick="openNewScheduleForObject(${group.items[0].client_id}, '${escapeHtml(group.clientName).replace(/'/g, "\\'")}', ${group.items[0].request_id}, '${escapeHtml(group.objectName).replace(/'/g, "\\'")}')">
                <i class="bi bi-plus-circle"></i> Добави дейност
            </button>
            <button class="btn btn-sm btn-info shadow-sm" data-bs-toggle="tooltip" title="Смени клиент" onclick="openChangeClientModal(${group.items[0].client_id}, '${escapeHtml(group.clientName).replace(/'/g, "\\'")}', ${group.items[0].request_id}, '${escapeHtml(group.objectName).replace(/'/g, "\\'")}')">
                <i class="bi bi-person-lines-fill text-white"></i>
            </button>
            <button class="btn btn-sm btn-primary shadow-sm" data-bs-toggle="tooltip" title="Календарен изглед" onclick="openObjectMatrix(${group.items[0].request_id}, '${escapeHtml(group.objectName).replace(/'/g, "\\'")}')">
                <i class="bi bi-calendar-range"></i>
            </button>
        `;

        if (!hasVisibleItems && placeholderScheduleId) {
            actionButtons += `
                <button class="btn btn-sm btn-danger shadow-sm" data-bs-toggle="tooltip" title="Изтрий обекта" onclick="deleteSchedule(${placeholderScheduleId})">
                    <i class="bi bi-trash"></i>
                </button>
            `;
        }

        // Calculate group statistics & dates
        let totalActivities = 0;
        let totalProgressPct = 0;

        let gMinEstStart = null;
        let gMaxEstEnd = null;
        let gMinStart = null;
        let gMaxEnd = null;

        group.items.forEach(schedule => {
            if (schedule.activity_type_id || schedule.activity_name) {
                totalActivities++;
                const comp = parseFloat(schedule.total_completed) || 0;
                const quant = parseFloat(schedule.total_quantity) || 1;
                totalProgressPct += Math.min(100, (comp / quant) * 100);

                // Date comparisons
                const updateRange = (curMin, curMax, valS, valE) => {
                    let min = curMin;
                    let max = curMax;
                    if (valS && valS !== '0000-00-00') {
                        if (!min || valS < min) min = valS;
                    }
                    if (valE && valE !== '0000-00-00') {
                        if (!max || valE > max) max = valE;
                    }
                    // Also check start for max and end for min just in case data is sparse
                    if (valS && valS !== '0000-00-00' && (!max || valS > max)) max = valS;
                    if (valE && valE !== '0000-00-00' && (!min || valE < min)) min = valE;

                    return [min, max];
                };

                [gMinEstStart, gMaxEstEnd] = updateRange(gMinEstStart, gMaxEstEnd, schedule.estimated_start_date, schedule.estimated_end_date);
                [gMinStart, gMaxEnd] = updateRange(gMinStart, gMaxEnd, schedule.start_date, schedule.end_date);
            }
        });

        let avgProgress = 0;
        if (totalActivities > 0) {
            avgProgress = Math.round(totalProgressPct / totalActivities);
        }

        let progressColor = 'bg-primary';
        if (avgProgress >= 100) progressColor = 'bg-success';
        else if (avgProgress < 30) progressColor = 'bg-warning';

        let statsHtml = '';
        if (totalActivities > 0) {
            statsHtml = `
                <div class="d-flex align-items-center gap-4 ms-2 ps-4" style="height: 48px;">
                    <div class="d-flex flex-column justify-content-center">
                        <span class="small text-muted mb-1" style="font-size: 0.75rem;">Дейности</span>
                        <span class="badge bg-secondary bg-opacity-75 rounded-pill fs-7 align-items-center" style="font-weight: 500;">${totalActivities}</span>
                    </div>
                    <div class="d-flex flex-column justify-content-center" style="min-width: 140px;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="small fw-semibold text-muted" style="font-size: 0.75rem;">Общ прогрес:</span>
                            <span class="small fw-bold" style="font-size: 0.75rem;">${avgProgress}%</span>
                        </div>
                        <div class="progress" style="height: 6px; background-color: var(--bs-secondary-bg-subtle);">
                            <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${avgProgress}%"></div>
                        </div>
                    </div>
                    <div class="d-flex flex-column justify-content-center border-start ps-4" style="min-width: 140px;">
                        <span class="small text-muted mb-1" style="font-size: 0.7rem;"><i class="bi bi-calendar-check me-1"></i>Реален период</span>
                        <div class="small fw-bold text-primary-emphasis d-flex flex-column" style="font-size: 0.75rem; line-height: 1.2;">
                            <div><i class="bi bi-play-circle me-1"></i>${gMinStart ? formatDateDisplay(gMinStart) : '-'}</div>
                            <div><i class="bi bi-stop-circle me-1"></i>${gMaxEnd ? formatDateDisplay(gMaxEnd) : '-'}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        groupHeader.innerHTML = `
            <td colspan="10" class="py-3 px-3">
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div class="d-flex align-items-center">
                        <div class="d-flex align-items-center justify-content-center me-3" style="width: 24px;">
                            <i class="bi bi-chevron-down text-primary transition-all fs-5" id="icon-${currentGroupId}" style="display: inline-block; transition: transform 0.3s; ${isExpanded ? 'transform: rotate(-180deg);' : ''}"></i>
                        </div>
                        <div class="d-flex flex-column justify-content-center">
                            <span class="fs-5 fw-bold text-primary-emphasis mb-1 d-flex align-items-center">
                                <i class="bi bi-building me-2"></i>${escapeHtml(group.objectName)}
                            </span>
                            <span class="text-body-secondary small fw-semibold"><i class="bi bi-person-badge me-1"></i>Клиент: ${escapeHtml(group.clientName)}</span>
                        </div>
                        ${statsHtml}
                    </div>
                    <div class="d-flex gap-2" onclick="event.stopPropagation();">
                        ${actionButtons}
                    </div>
                </div>
            </td>
        `;

        groupHeader.onclick = function () {
            const items = document.querySelectorAll('.schedule-item-' + currentGroupId);
            const icon = document.getElementById('icon-' + currentGroupId);

            if (items.length === 0) return;
            const isExpanding = items[0].classList.contains('d-none');

            if (isExpanding) {
                // Expand
                expandedGroups.add(groupKey);
                icon.style.transform = 'rotate(-180deg)';
                items.forEach((item, index) => {
                    item.classList.remove('d-none');
                    // force reflow
                    void item.offsetWidth;
                    // Stagger the animation
                    setTimeout(() => {
                        item.style.opacity = '1';
                    }, index * 20);
                });
            } else {
                // Collapse
                expandedGroups.delete(groupKey);
                icon.style.transform = 'rotate(0deg)';
                items.forEach(item => {
                    item.style.opacity = '0';
                });
                setTimeout(() => {
                    items.forEach(item => {
                        item.classList.add('d-none');
                    });
                }, 200);
            }
        };

    });

    // If we had a deep link target, scroll to it
    if (targetRow) {
        setTimeout(() => {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRow.classList.add('bg-primary', 'bg-opacity-10');
            setTimeout(() => targetRow.classList.remove('bg-primary', 'bg-opacity-10'), 2000);

            // Clear the target to prevent re-expansion on search/filter if not needed
            // but we usually want it expanded until the page is reloaded.
            window.targetRequestId = null;
        }, 300);
    }
}
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

// Helper to render progress bar
function renderProgressBar(completed, total) {
    const c = parseFloat(completed) || 0;
    const t = parseFloat(total) || 1; // Prevent division by zero
    const pct = Math.min(100, Math.round((c / t) * 100));

    let colorClass = 'bg-primary';
    if (pct >= 100) colorClass = 'bg-success';
    else if (pct < 30) colorClass = 'bg-warning';

    return `
        <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="small fw-bold">${c} / ${total}</span>
            <span class="small text-muted">${pct}%</span>
        </div>
        <div class="progress" style="height: 6px;">
            <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${pct}%" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
    `;
}
