/**
 * planning_modals.js
 * Modal logic and form submission handlers for the Machine Planning module.
 */

window.resetEstimateModal = function () {
    const form = document.getElementById('estimateForm');
    if (form) form.reset();

    const estId = document.getElementById('estimate_id');
    if (estId) estId.value = '0';
    const reqId = document.getElementById('est_request_id');
    if (reqId) reqId.value = '0';
    const schedId = document.getElementById('est_schedule_id');
    if (schedId) schedId.value = '0';

    setSafeDate('start_date', '');
    setSafeDate('end_date', '');

    if (PlanningState.tagifyObjectName && typeof PlanningState.tagifyObjectName.removeAllTags === 'function') {
        PlanningState.tagifyObjectName.removeAllTags();
    }
    if (PlanningState.tagifyEstimateMachine && typeof PlanningState.tagifyEstimateMachine.removeAllTags === 'function') {
        PlanningState.tagifyEstimateMachine.removeAllTags();
    }

    const deleteBtn = document.getElementById('deleteEstimateBtn');
    if (deleteBtn) deleteBtn.classList.add('d-none');

    // Restore full machine list on reset (so other modals start fresh)
    if (typeof PlanningState !== 'undefined' && PlanningState.allMachinesData) {
        if (typeof populateModalMachineSelect === 'function') {
            populateModalMachineSelect(PlanningState.allMachinesData);
        }
    }

    const estActSelect = document.getElementById('est_activity_type_id');
    if (estActSelect && typeof PlanningState !== 'undefined' && PlanningState.allActivitiesData) {
        let html = '<option value="" disabled selected>Изберете дейност...</option>';
        PlanningState.allActivitiesData.forEach(a => {
            html += `<option value="${a.id}">${escapeHtml(a.activity_name)}</option>`;
        });
        estActSelect.innerHTML = html;
        estActSelect._capabilityData = null;
    }

    const estCapSelect = document.getElementById('est_capability_name');
    if (estCapSelect) estCapSelect.innerHTML = '<option value="">— Изберете —</option>';

    const estSubSelect = document.getElementById('est_activity_subtype');
    if (estSubSelect) estSubSelect.value = '';

    const capWarning = document.getElementById('estimateCapWarning');
    if (capWarning) capWarning.classList.add('d-none');

    PlanningState.desiredActivityId = null;
    PlanningState.desiredCapabilityName = null;
    PlanningState.desiredActivitySubtype = null;

    if (typeof updateEstimateObjectAutocomplete === 'function') {
        updateEstimateObjectAutocomplete(null);
    }
};

window.loadEstimateMachineCapabilities = function (machineId, prefix = '') {
    const actSelect = document.getElementById(prefix + 'est_activity_type_id');
    const capSelect = document.getElementById(prefix + 'est_capability_name');
    const capWarning = document.getElementById(prefix + 'estimateCapWarning');
    if (!actSelect || !capSelect) return;

    actSelect.innerHTML = '<option value="">— Изберете —</option>';
    capSelect.innerHTML = '<option value="">— Изберете —</option>';
    if (!machineId) {
        if (capWarning) capWarning.classList.add('d-none');
        return;
    }

    return fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=get_machine_year_matrix&machine_id=${machineId}&year=${document.getElementById('ganttYearPicker')?.value || new Date().getFullYear()}`)
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                const caps = response.capabilities || [];
                if (caps.length === 0) {
                    if (capWarning) capWarning.classList.remove('d-none');
                } else {
                    if (capWarning) capWarning.classList.add('d-none');
                    caps.forEach(group => {
                        actSelect.innerHTML += `<option value="${group.activity_type_id}">${escapeHtml(group.activity_name)}</option>`;
                    });

                    // Persist desired activity from PlanningState (e.g. from Unplanned projects)
                    if (prefix === '' && typeof PlanningState !== 'undefined' && PlanningState.desiredActivityId) {
                        const targetId = String(PlanningState.desiredActivityId);
                        const exists = caps.some(g => String(g.activity_type_id) === targetId);
                        if (exists) {
                            actSelect.value = targetId;
                            // Trigger capability population for this activity
                            actSelect._capabilityData = caps;
                            populateEstCapabilityDropdown(targetId, prefix);
                        }
                    } else if (caps.length === 1) {
                        // AUTO-SELECT FEATURE: If only one activity, select it and populate caps
                        actSelect.value = caps[0].activity_type_id;
                        actSelect._capabilityData = caps; // Ensure it's set before calling populate
                        populateEstCapabilityDropdown(caps[0].activity_type_id, prefix);
                    }
                }
                actSelect._capabilityData = caps;
                return response;
            }
            return response;
        });
}

window.populateEstCapabilityDropdown = function (activityTypeId, prefix = '') {
    const actSelect = document.getElementById(prefix + 'est_activity_type_id');
    const capSelect = document.getElementById(prefix + 'est_capability_name');
    if (!capSelect || !actSelect) return;

    capSelect.innerHTML = '<option value="">— Изберете —</option>';
    if (!activityTypeId || !actSelect._capabilityData) return;
    const group = actSelect._capabilityData.find(g => String(g.activity_type_id) === String(activityTypeId));
    if (group) {
        group.capabilities.forEach(cap => {
            capSelect.innerHTML += `<option value="${cap}">${escapeHtml(cap)}</option>`;
        });

        // Persist desired capability from PlanningState (e.g. from Unplanned projects)
        if (prefix === '' && typeof PlanningState !== 'undefined' && (PlanningState.desiredCapabilityName || PlanningState.desiredActivitySubtype)) {
            if (PlanningState.desiredCapabilityName) {
                const target = PlanningState.desiredCapabilityName.toLowerCase().trim();
                const match = group.capabilities.find(c => c.toLowerCase().trim() === target);
                if (match) {
                    capSelect.value = match;
                }
            }
            if (PlanningState.desiredActivitySubtype) {
                const subInput = document.getElementById('est_activity_subtype');
                if (subInput) subInput.value = PlanningState.desiredActivitySubtype;
            }
        } else if (group.capabilities.length === 1) {
            // AUTO-SELECT FEATURE: If only one specification, select it automatically
            capSelect.value = group.capabilities[0];
        }
    }
}

window.openNewEstimate = function (startDate, machineId, event) {
    if (event) event.stopPropagation();
    PlanningState.tempActionData.startDate = startDate;
    PlanningState.tempActionData.machineId = machineId;

    const modalEl = document.getElementById('actionSelectorModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

window.proceedToEstimate = function () {
    const selectorEl = document.getElementById('actionSelectorModal');
    if (selectorEl) {
        const selModal = bootstrap.Modal.getInstance(selectorEl);
        if (selModal) selModal.hide();
    }

    resetEstimateModal();
    const midInput = document.getElementById('machine_id');
    if (PlanningState.tagifyEstimateMachine) {
        const tag = PlanningState.tagifyEstimateMachine.settings.whitelist.find(i => String(i.id) === String(PlanningState.tempActionData.machineId));
        if (tag) PlanningState.tagifyEstimateMachine.addTags([tag]);
    } else if (midInput) {
        midInput.value = PlanningState.tempActionData.machineId || '';
    }

    setSafeDate('start_date', PlanningState.tempActionData.startDate);
    setSafeDate('end_date', PlanningState.tempActionData.startDate);

    if (PlanningState.tempActionData.machineId) {
        loadEstimateMachineCapabilities(PlanningState.tempActionData.machineId);
    }

    if (typeof updateEstimateObjectAutocomplete === 'function') {
        updateEstimateObjectAutocomplete(PlanningState.tempActionData.machineId);
    }

    const modalEl = document.getElementById('estimateModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

window.openEstimateEditor = function (id, event) {
    if (event) event.stopPropagation();
    resetEstimateModal();

    // Show modal immediately to indicate action
    const modalEl = document.getElementById('estimateModal');
    if (!modalEl) { console.warn("estimateModal not found"); return; }
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=get_estimate&estimate_id=${id}`)
        .then(res => res.json())
        .then(response => {
            if (response.success && response.data) {
                const est = response.data;
                document.getElementById('estimate_id').value = est.id;
                if (PlanningState.tagifyEstimateMachine) {
                    const tag = PlanningState.tagifyEstimateMachine.settings.whitelist.find(i => String(i.id) === String(est.machine_id));
                    if (tag) PlanningState.tagifyEstimateMachine.addTags([tag]);
                } else {
                    document.getElementById('machine_id').value = est.machine_id;
                }
                document.getElementById('object_name').value = est.object_name;
                setSafeDate('start_date', est.start_date);
                setSafeDate('end_date', est.end_date);
                document.getElementById('notes').value = est.notes || '';
                if (document.getElementById('est_activity_subtype')) {
                    document.getElementById('est_activity_subtype').value = est.activity_subtype || '';
                }

                if (typeof PlanningState !== 'undefined' && PlanningState.tagifyObjectName) {
                    try {
                        PlanningState.tagifyObjectName.removeAllTags();
                        if (est.object_name) PlanningState.tagifyObjectName.addTags([est.object_name]);
                    } catch (e) { console.warn("Tagify error", e); }
                }

                const deleteBtn = document.getElementById('deleteEstimateBtn');
                if (deleteBtn) deleteBtn.classList.remove('d-none');

                if (typeof updateEstimateObjectAutocomplete === 'function') {
                    updateEstimateObjectAutocomplete(est.machine_id);
                }

                // Load capabilities and pre-select
                const actSelect = document.getElementById('est_activity_type_id');
                const capSelect = document.getElementById('est_capability_name');
                const capWarning = document.getElementById('estimateCapWarning');

                const currentYear = document.getElementById('ganttYearPicker')?.value || new Date().getFullYear();
                fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=get_machine_year_matrix&machine_id=${est.machine_id}&year=${currentYear}`)
                    .then(res => res.json())
                    .then(capRes => {
                        if (capRes.success) {
                            const caps = capRes.capabilities || [];
                            if (caps.length === 0) {
                                if (capWarning) capWarning.classList.remove('d-none');
                            } else {
                                if (capWarning) capWarning.classList.add('d-none');
                                if (actSelect) {
                                    actSelect.innerHTML = '<option value="">— Изберете —</option>';
                                    caps.forEach(group => {
                                        const selected = String(group.activity_type_id) === String(est.activity_type_id) ? 'selected' : '';
                                        actSelect.innerHTML += `<option value="${group.activity_type_id}" ${selected}>${escapeHtml(group.activity_name)}</option>`;
                                    });
                                    actSelect._capabilityData = caps;
                                }

                                if (est.activity_type_id && capSelect) {
                                    const group = caps.find(g => String(g.activity_type_id) === String(est.activity_type_id));
                                    if (group) {
                                        capSelect.innerHTML = '<option value="">— Изберете —</option>';
                                        group.capabilities.forEach(c => {
                                            const selected = String(c) === String(est.capability_name) ? 'selected' : '';
                                            capSelect.innerHTML += `<option value="${c}" ${selected}>${escapeHtml(c)}</option>`;
                                        });

                                        // Set subtype field (#27)
                                        const subInput = document.getElementById('est_activity_subtype');
                                        if (subInput) subInput.value = est.activity_subtype || '';
                                    }
                                }
                            }
                        }
                    }).catch(err => console.warn("Cap fetch error", err));
            }
        }).catch(err => console.warn("Estimate fetch error", err));
}

window.resetMovementModal = function () {
    const form = document.getElementById('movementForm');
    if (form) form.reset();
    const midInput = document.getElementById('movement_id');
    if (midInput) midInput.value = '0';

    try {
        if (PlanningState.tagifyMovementObject) {
            PlanningState.tagifyMovementObject.removeAllTags();
            // Restore all objects on reset
            if (PlanningState.movementOptions && PlanningState.movementOptions.schedules) {
                const allObjectOptions = [];
                const seenObjects = new Set();
                PlanningState.movementOptions.schedules.forEach(s => {
                    if (s.request_id && !seenObjects.has(s.request_id)) {
                        allObjectOptions.push({ value: s.обект_име, id: s.request_id });
                        seenObjects.add(s.request_id);
                    }
                });
                PlanningState.tagifyMovementObject.settings.whitelist = allObjectOptions;
            }
        }
        if (PlanningState.tagifyMovementSchedule) {
            PlanningState.tagifyMovementSchedule.removeAllTags();
            PlanningState.tagifyMovementSchedule.settings.whitelist = [];
        }
        if (PlanningState.tagifyMovementMachine) PlanningState.tagifyMovementMachine.removeAllTags();
        if (PlanningState.tagifyFromSite) PlanningState.tagifyFromSite.removeAllTags();
        if (PlanningState.tagifyToSite) PlanningState.tagifyToSite.removeAllTags();

        // Re-add default From Site
        if (PlanningState.tagifyFromSite) {
            PlanningState.tagifyFromSite.addTags([{ value: "База", id: "" }]);
        }

        const infoContainer = document.getElementById('forecastInfoContainer');
        if (infoContainer) {
            infoContainer.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-info-circle display-4 d-block mb-2"></i>
                    Изберете дейност и машина, за да видите прогнозираните дати.
                </div>`;
        }
    } catch (e) {
        console.warn("Error resetting Tagify in movement modal:", e);
    }
};

function loadMachineMovementsOptions() {
    const objectInput = document.getElementById('object_select');
    const scheduleInput = document.getElementById('schedule_id');
    const machineInput = document.getElementById('move_machine_id');
    const fromInput = document.getElementById('from_site_id');
    const toInput = document.getElementById('to_site_id');

    return PlanningState.loadMachineOptionsPromise = fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php?action=get_options&v=${Date.now()}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                PlanningState.movementOptions = data;

                const siteOptions = [{ value: "База", id: "" }];
                if (data.sites) {
                    data.sites.forEach(site => siteOptions.push({ value: site.обект_име, id: site.request_id }));
                }

                const machineOptions = (data.machines || []).map(m => ({
                    value: m.machine_name,
                    id: m.id,
                    allowed_activities: m.allowed_activities || [],
                    capabilities_map: m.capabilities_map || {}
                }));

                const allObjectOptions = [];
                const seenObjects = new Set();
                data.schedules.forEach(s => {
                    if (s.request_id && !seenObjects.has(s.request_id)) {
                        allObjectOptions.push({ value: s.обект_име, id: s.request_id });
                        seenObjects.add(s.request_id);
                    }
                });

                if (typeof Tagify !== 'undefined') {
                    // Object Tagify
                    if (objectInput && !objectInput.hasAttribute('tagify-initialized')) {
                        PlanningState.tagifyMovementObject = new Tagify(objectInput, {
                            mode: "select",
                            whitelist: allObjectOptions,
                            enforceWhitelist: true,
                            dropdown: {
                                maxItems: 50,
                                classname: "tags-look",
                                enabled: 0,
                                closeOnSelect: true
                            }
                        });
                        objectInput.setAttribute('tagify-initialized', 'true');

                        PlanningState.tagifyMovementObject.on('change', e => {
                            if (PlanningState.autoFillingMovement) return;
                            const val = e.detail.value;
                            if (val) {
                                try {
                                    const requestId = JSON.parse(val)[0].id;
                                    const filteredSchedules = data.schedules
                                        .filter(s => String(s.request_id) === String(requestId))
                                        .map(s => {
                                            let vid = s.capability_name || '';
                                            if (s.activity_subtype) vid = (vid ? vid + ' — ' : '') + s.activity_subtype;
                                            let display = (s.activity_name || 'Без дейност');
                                            if (vid) display += ' (' + vid + ')';

                                            const qtyStr = parseFloat(s.total_quantity || 0);
                                            const dimStr = parseFloat(s.dimension_info || 0);
                                            display += ' | ' + qtyStr;
                                            if (dimStr > 0) display += ' / ' + dimStr;
                                            return {
                                                value: display,
                                                id: s.schedule_id,
                                                request_id: s.request_id,
                                                site_name: s.обект_име,
                                                activity_type_id: s.activity_type_id ? parseInt(s.activity_type_id) : null,
                                                capability_name: s.capability_name
                                            };
                                        });
                                    PlanningState.tagifyMovementSchedule.settings.whitelist = filteredSchedules;
                                } catch (err) { }
                            } else {
                                PlanningState.tagifyMovementSchedule.settings.whitelist = [];
                            }
                            PlanningState.tagifyMovementSchedule.removeAllTags();
                        });
                    } else if (PlanningState.tagifyMovementObject) {
                        PlanningState.tagifyMovementObject.settings.whitelist = allObjectOptions;
                    }

                    // Schedule Tagify
                    if (scheduleInput && !scheduleInput.hasAttribute('tagify-initialized')) {
                        PlanningState.tagifyMovementSchedule = new Tagify(scheduleInput, {
                            mode: "select",
                            whitelist: [],
                            enforceWhitelist: true,
                            dropdown: {
                                maxItems: 50,
                                classname: "tags-look",
                                enabled: 0,
                                closeOnSelect: true
                            }
                        });
                        scheduleInput.setAttribute('tagify-initialized', 'true');
                        PlanningState.tagifyMovementSchedule.on('change', e => {
                            if (PlanningState.autoFillingMovement) return;
                            const val = e.detail.value;
                            if (val) {
                                try {
                                    const parsed = JSON.parse(val);
                                    if (parsed && parsed[0]) {
                                        const selected = PlanningState.tagifyMovementSchedule.settings.whitelist.find(s => s.id == parsed[0].id);
                                        if (selected) {
                                            // Auto-fill To Site
                                            if (PlanningState.tagifyToSite) {
                                                PlanningState.tagifyToSite.removeAllTags();
                                                PlanningState.tagifyToSite.addTags([{ value: selected.site_name, id: selected.request_id }]);
                                            }

                                            // Filter Machines based on activity and capability
                                            if (PlanningState.tagifyMovementMachine) {
                                                let filteredMachines = machineOptions;
                                                if (selected.activity_type_id) {
                                                    filteredMachines = machineOptions.filter(m => {
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

                                                PlanningState.tagifyMovementMachine.settings.whitelist = filteredMachines;

                                                // Clear selected machine if it's no longer valid
                                                const currentMachine = PlanningState.tagifyMovementMachine.value[0];
                                                if (currentMachine && !filteredMachines.find(m => m.id == currentMachine.id)) {
                                                    PlanningState.tagifyMovementMachine.removeAllTags();
                                                }
                                            }
                                        }
                                    }
                                } catch (err) { }
                            } else {
                                // If schedule is cleared, restore all machines
                                if (PlanningState.tagifyMovementMachine) {
                                    PlanningState.tagifyMovementMachine.settings.whitelist = [...machineOptions];
                                }
                            }
                            updateForecastInfo();
                        });
                    }

                    // Machine Tagify
                    if (machineInput) {
                        if (!machineInput.hasAttribute('tagify-initialized')) {
                            PlanningState.tagifyMovementMachine = new Tagify(machineInput, {
                                mode: "select",
                                whitelist: [...machineOptions],
                                enforceWhitelist: true,
                                dropdown: {
                                    maxItems: 50,
                                    classname: "tags-look",
                                    enabled: 0,
                                    closeOnSelect: true
                                }
                            });
                            machineInput.setAttribute('tagify-initialized', 'true');
                            PlanningState.tagifyMovementMachine.on('change', () => {
                                if (PlanningState.autoFillingMovement) return;
                                updateForecastInfo();
                            });
                        } else if (PlanningState.tagifyMovementMachine) {
                            PlanningState.tagifyMovementMachine.settings.whitelist = machineOptions;
                        }
                    }

                    // From/To Sites
                    if (fromInput && !fromInput.hasAttribute('tagify-initialized')) {
                        PlanningState.tagifyFromSite = new Tagify(fromInput, {
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
                    }
                    if (toInput && !toInput.hasAttribute('tagify-initialized')) {
                        PlanningState.tagifyToSite = new Tagify(toInput, {
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
                    }
                }
            }
        });
}

window.proceedToMovement = function () {
    const selModal = bootstrap.Modal.getInstance(document.getElementById('actionSelectorModal'));
    if (selModal) selModal.hide();

    resetMovementModal();

    setSafeDate('arrival_date', PlanningState.tempActionData.startDate);
    setSafeDate('departure_date', PlanningState.tempActionData.startDate);

    const modalEl = document.getElementById('movementModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    loadMachineMovementsOptions().then(() => {
        if (PlanningState.tagifyMovementMachine && PlanningState.tempActionData.machineId) {
            const mId = PlanningState.tempActionData.machineId;
            const tag = PlanningState.tagifyMovementMachine.settings.whitelist.find(i => i.id == mId);

            PlanningState.tagifyMovementMachine.removeAllTags();
            if (tag) {
                PlanningState.tagifyMovementMachine.addTags([tag]);
            } else {
                // Fallback search in all machines data
                const mData = (PlanningState.allMachinesData || []).find(m => String(m.id) === mId);
                if (mData) {
                    PlanningState.tagifyMovementMachine.addTags([mData.machine_name]);
                }
            }
        }
    }).catch(err => console.warn("Error loading machine options:", err));
}

window.editMovement = function (movementId, event) {
    if (event) event.stopPropagation();
    resetMovementModal();
    PlanningState.autoFillingMovement = true;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php?action=get_movement&movement_id=${movementId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const movement = data.data;
                document.getElementById('movement_id').value = movement.id;
                setSafeDate('arrival_date', movement.arrival_date || '');
                setSafeDate('departure_date', movement.departure_date || '');

                const modalEl = document.getElementById('movementModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                    modal.show();
                }

                loadMachineMovementsOptions().then(() => {
                    setTimeout(() => {
                        // Populate Machine
                        if (PlanningState.tagifyMovementMachine && movement.machine_id) {
                            const mId = movement.machine_id;
                            const tag = PlanningState.tagifyMovementMachine.settings.whitelist.find(i => String(i.id) === String(mId));

                            PlanningState.tagifyMovementMachine.settings.enforceWhitelist = false;
                            PlanningState.tagifyMovementMachine.removeAllTags();
                            if (tag) {
                                PlanningState.tagifyMovementMachine.addTags([tag], true, true);
                            } else if (movement.machine_name) {
                                PlanningState.tagifyMovementMachine.addTags([movement.machine_name], true, true);
                            }
                            PlanningState.tagifyMovementMachine.settings.enforceWhitelist = true;
                        }

                        // Populate Cascading Fields
                        if (PlanningState.tagifyMovementObject && movement.request_id) {
                            const oTag = PlanningState.tagifyMovementObject.settings.whitelist.find(o => String(o.id) === String(movement.request_id));
                            PlanningState.tagifyMovementObject.settings.enforceWhitelist = false;
                            PlanningState.tagifyMovementObject.removeAllTags();
                            if (oTag) {
                                PlanningState.tagifyMovementObject.addTags([oTag], true, true);
                            } else {
                                PlanningState.tagifyMovementObject.addTags([{ value: movement.schedule_site_name, id: movement.request_id }], true, true);
                            }
                            PlanningState.tagifyMovementObject.settings.enforceWhitelist = true;

                            // Populate schedule whitelist based on object
                            if (PlanningState.movementOptions) {
                                const filteredSchedules = PlanningState.movementOptions.schedules
                                    .filter(s => String(s.request_id) === String(movement.request_id))
                                    .map(s => {
                                        let vid = s.capability_name || '';
                                        if (s.activity_subtype) vid = (vid ? vid + ' — ' : '') + s.activity_subtype;
                                        let display = (s.activity_name || 'Без дейност');
                                        if (vid) display += ' (' + vid + ')';

                                        const qtyStr = parseFloat(s.total_quantity || 0);
                                        const dimStr = parseFloat(s.dimension_info || 0);
                                        display += ' | ' + qtyStr;
                                        if (dimStr > 0) display += ' / ' + dimStr;
                                        return {
                                            value: display,
                                            id: s.schedule_id,
                                            request_id: s.request_id,
                                            site_name: s.обект_име,
                                            activity_type_id: s.activity_type_id ? parseInt(s.activity_type_id) : null,
                                            capability_name: s.capability_name
                                        };
                                    });

                                // Ensure current schedule is in whitelist even if it has dates (and thus filtered out from options)
                                if (movement.schedule_id && !filteredSchedules.find(s => String(s.id) === String(movement.schedule_id))) {
                                    let vid = movement.s_cap || '';
                                    if (movement.s_sub) vid = (vid ? vid + ' — ' : '') + movement.s_sub;
                                    let display = (movement.s_activity || 'Без дейност');
                                    if (vid) display += ' (' + vid + ')';

                                    const qtyStr = parseFloat(movement.total_quantity || 0);
                                    const dimStr = parseFloat(movement.dimension_info || 0);
                                    display += ' | ' + qtyStr;
                                    if (dimStr > 0) display += ' / ' + dimStr;

                                    filteredSchedules.push({
                                        value: display,
                                        id: movement.schedule_id,
                                        request_id: movement.request_id,
                                        site_name: movement.schedule_site_name,
                                        activity_type_id: movement.activity_type_id ? parseInt(movement.activity_type_id) : null,
                                        capability_name: movement.s_cap
                                    });
                                }

                                PlanningState.tagifyMovementSchedule.settings.whitelist = filteredSchedules;
                                PlanningState.tagifyMovementSchedule.whitelist = filteredSchedules;

                                if (movement.schedule_id) {
                                    let vid = movement.s_cap || '';
                                    if (movement.s_sub) vid = (vid ? vid + ' — ' : '') + movement.s_sub;
                                    let display = (movement.s_activity || 'Без дейност');
                                    if (vid) display += ' (' + vid + ')';

                                    const qtyStr = parseFloat(movement.total_quantity || 0);
                                    const dimStr = parseFloat(movement.dimension_info || 0);
                                    display += ' | ' + qtyStr;
                                    if (dimStr > 0) display += ' / ' + dimStr;

                                    const sTag = filteredSchedules.find(s => String(s.id) === String(movement.schedule_id));
                                    PlanningState.tagifyMovementSchedule.settings.enforceWhitelist = false;
                                    PlanningState.tagifyMovementSchedule.removeAllTags();
                                    if (sTag) {
                                        PlanningState.tagifyMovementSchedule.addTags([sTag], true, true);
                                    } else {
                                        PlanningState.tagifyMovementSchedule.addTags([{ value: display, id: movement.schedule_id }], true, true);
                                    }
                                    PlanningState.tagifyMovementSchedule.settings.enforceWhitelist = true;
                                }
                            }
                        }

                        // Populate From/To
                        if (PlanningState.tagifyFromSite) {
                            PlanningState.tagifyFromSite.settings.enforceWhitelist = false;
                            PlanningState.tagifyFromSite.removeAllTags();
                            if (movement.from_site_id) PlanningState.tagifyFromSite.addTags([{ value: movement.from_site_name, id: movement.from_site_id }], true, true);
                            else PlanningState.tagifyFromSite.addTags([{ value: "База", id: "" }], true, true);
                            PlanningState.tagifyFromSite.settings.enforceWhitelist = true;
                        }
                        if (PlanningState.tagifyToSite) {
                            PlanningState.tagifyToSite.settings.enforceWhitelist = false;
                            PlanningState.tagifyToSite.removeAllTags();
                            if (movement.to_site_id) PlanningState.tagifyToSite.addTags([{ value: movement.to_site_name, id: movement.to_site_id }], true, true);
                            else PlanningState.tagifyToSite.addTags([{ value: "База", id: "" }], true, true);
                            PlanningState.tagifyToSite.settings.enforceWhitelist = true;
                        }

                        document.getElementById('carrier').value = movement.carrier || '';
                        document.getElementById('notes').value = movement.notes || '';
                        setTimeout(() => {
                            PlanningState.autoFillingMovement = false;
                        }, 100);
                    }, 300);
                }).catch(err => {
                    PlanningState.autoFillingMovement = false;
                    console.warn("Error loading machine options:", err);
                });
            }
        });
}

window.openLocationModal = function (encodedLocData, event) {
    if (event) event.stopPropagation();
    let locData = {};
    try { locData = JSON.parse(decodeURIComponent(atob(encodedLocData))); } catch (e) { return; }

    // Update Modal Title based on status
    const modalLabel = document.getElementById('locationModalLabel');
    if (modalLabel) {
        const status = (locData.status || '').toLowerCase();
        const isPlanned = status.includes('планиран') || status.includes('не старт') || status.includes('upcoming');
        modalLabel.innerText = isPlanned ? 'Данни за планирана дейност' : 'Данни за реална позиция';
    }

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('loc_object_name', locData.location_name);
    setVal('loc_start_date', formatDateBG(locData.start_date));
    setVal('loc_end_date', formatDateBG(locData.end_date));
    setVal('loc_activity_name', locData.activity_name);
    setVal('loc_activity_subtype', locData.activity_subtype);
    setVal('loc_status', locData.status);
    setVal('loc_total_completed', locData.total_completed);
    setVal('loc_total_quantity', locData.total_quantity);

    // Update Scoreboard Display
    const completed = parseFloat(locData.total_completed) || 0;
    const total = parseFloat(locData.total_quantity) || 0;
    const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

    const compDisp = document.getElementById('loc_completed_display');
    const totalDisp = document.getElementById('loc_total_display');
    const barDisp = document.getElementById('loc_progress_bar');
    const badgeDisp = document.getElementById('loc_percent_badge');
    const unitDisp = document.getElementById('loc_unit_display');

    if (compDisp) compDisp.innerText = completed.toFixed(2);
    if (totalDisp) totalDisp.innerText = total.toFixed(2);
    if (barDisp) barDisp.style.width = percent + '%';
    if (badgeDisp) badgeDisp.innerText = percent + '%';
    if (unitDisp) unitDisp.innerText = locData.unit_of_measure || 'бр.';

    const unitEl = document.getElementById('loc_unit_of_measure');
    if (unitEl) unitEl.innerText = locData.unit_of_measure || 'бр.';
    const modalEl = document.getElementById('locationModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

window.openFindMachineModal = function () {
    const modalEl = document.getElementById('findMachineModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

window.searchAvailableMachines = function () {
    const start = document.getElementById('find_start_date').value;
    const end = document.getElementById('find_end_date').value;
    const activity = document.getElementById('find_activity_type').value;

    if (!start || !end) {
        showToast({ message: 'Моля, изберете начална и крайна дата.', type: 'warning' });
        return;
    }

    const resultsContainer = document.getElementById('findMachineResults');
    resultsContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Търсене на свободни машини...</p></div>';

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=find_available_machines&start_date=${start}&end_date=${end}&activity_type_id=${activity}`)
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                renderFindMachineResults(response.data);
            } else {
                resultsContainer.innerHTML = `<div class="alert alert-danger">${response.message}</div>`;
            }
        });
}

function renderFindMachineResults(machines) {
    const container = document.getElementById('findMachineResults');
    if (machines.length === 0) {
        container.innerHTML = '<div class="alert alert-info text-center py-4">Не бяха намерени машини за избрания период и дейност.</div>';
        return;
    }

    let html = `
    <div class="table-responsive">
        <table class="table table-hover align-middle">
            <thead class="bg-light">
                <tr>
                    <th>Машина</th>
                    <th>Дейности и възможности</th>
                    <th>Текуща локация</th>
                    <th>Статус</th>
                    <th class="text-center">Действие</th>
                </tr>
            </thead>
            <tbody>`;

    machines.forEach(m => {
        const capsHtml = m.capabilities.map(c => `<span class="badge bg-light text-dark border rounded-pill me-1 mb-1">${escapeHtml(c)}</span>`).join('');
        const statusBadge = m.is_busy ? '<span class="badge bg-danger">Заета</span>' : '<span class="badge bg-success">Свободна</span>';
        const rowClass = m.is_busy ? 'find-machine-row is-busy' : 'find-machine-row';

        html += `
            <tr class="${rowClass}">
                <td class="fw-bold">${escapeHtml(m.machine_name)}</td>
                <td><div class="d-flex flex-wrap">${capsHtml}</div></td>
                <td><small class="text-muted"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(m.current_location)}</small></td>
                <td>${statusBadge}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-primary rounded-pill px-3" onclick="selectFoundMachine(${m.id})">Избери</button>
                </td>
            </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

window.selectFoundMachine = function (machineId) {
    const modalEl = document.getElementById('findMachineModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    resetEstimateModal();
    const midInput = document.getElementById('machine_id');
    if (midInput) midInput.value = machineId;

    const startInput = document.getElementById('find_start_date');
    if (startInput) setSafeDate('start_date', startInput.value);

    const endInput = document.getElementById('find_end_date');
    if (endInput) setSafeDate('end_date', endInput.value);

    loadEstimateMachineCapabilities(machineId);

    if (typeof updateEstimateObjectAutocomplete === 'function') {
        updateEstimateObjectAutocomplete(machineId);
    }

    const estModalEl = document.getElementById('estimateModal');
    if (estModalEl) {
        const estModal = bootstrap.Modal.getOrCreateInstance(estModalEl);
        estModal.show();
    }
}

window.confirmPlanningAction = function ({ title, message, onConfirm, confirmBtnText = 'Изтрий', confirmBtnClass = 'btn-danger' }) {
    const modalEl = document.getElementById('confirmModal');
    if (!modalEl) return;

    document.getElementById('confirmModalTitle').innerText = title || 'Потвърждение';
    document.getElementById('confirmModalMessage').innerText = message || 'Сигурни ли сте?';

    const confirmBtn = document.getElementById('confirmModalBtn');
    confirmBtn.innerText = confirmBtnText;
    confirmBtn.className = `btn rounded-pill px-4 ${confirmBtnClass}`;

    // Remove old listeners to avoid multiple triggers
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', function () {
        if (typeof onConfirm === 'function') onConfirm();
        bootstrap.Modal.getInstance(modalEl).hide();
    });

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

window.openDayEventsModal = function (encodedItems, dateStr, event) {
    if (event) event.stopPropagation();

    let items = [];
    try {
        items = JSON.parse(decodeURIComponent(atob(encodedItems)));
    } catch (e) {
        console.warn("Error decoding items:", e);
        return;
    }

    const modalBody = document.getElementById('dayEventsModalBody');
    if (!modalBody) return;

    if (items.length === 0) {
        modalBody.innerHTML = '<div class="text-center py-4 text-muted">Няма събития за избрания ден.</div>';
    } else {
        let html = '<div class="list-group list-group-flush">';
        items.forEach((item, index) => {
            let itemHtml = '';
            const b64 = btoa(encodeURIComponent(JSON.stringify(item.data)));

            if (item.type === 'location') {
                const loc = item.data;
                const dbLocName = loc.location_name || 'База';
                const status = (loc.status || '').toLowerCase().trim();
                const isPlanned = status.includes('планиран') || status.includes('не') || status.includes('upcoming');
                const isPreStart = (loc.start_date && loc.start_date !== '0000-00-00' && dateStr < loc.start_date);
                const sInfo = getStatusInfo({ status: isPreStart ? 'планиран' : loc.status, type: 'location' });

                itemHtml = `
                    <div class="list-group-item bg-transparent px-0 py-3 border-secondary-subtle">
                        <div class="d-flex w-100 justify-content-between align-items-center flex-wrap">
                            <div>
                                <h6 class="mb-1 fw-bold text-primary-emphasis">
                                    <i class="bi bi-geo-alt-fill me-1"></i>График на обекта: ${escapeHtml(dbLocName)}
                                </h6>
                                <p class="mb-1 small"><strong>Дейност:</strong> ${escapeHtml(loc.activity_name || '-')}</p>
                                <p class="mb-1 small"><strong>Вид:</strong> ${escapeHtml(loc.display_vid || '-')}</p>
                                <p class="mb-0 small">
                                    <strong>Статус:</strong> 
                                    <span class="badge ${sInfo.popoverBadgeClass}">${escapeHtml(isPreStart ? 'Мобилизация' : sInfo.label)}</span>
                                </p>
                            </div>
                            <div class="mt-2 mt-md-0 d-flex gap-2">
                                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="openAndHideModal('location', '${b64}', event)">
                                    <i class="bi ${(isPlanned || isPreStart) ? 'bi-pencil-square' : 'bi-info-circle'} me-1"></i>${(isPlanned || isPreStart) ? 'Редактирай' : 'Информация'}
                                </button>
                                ${(isPlanned || isPreStart) ? `
                                <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deleteAndReload('location', '${loc.assignment_id || loc.id || loc.schedule_id}', event)">
                                    <i class="bi bi-trash-fill me-1"></i>Изтрий
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>`;
            } else if (item.type === 'estimate') {
                const est = item.data;
                const sInfo = getStatusInfo({ status: est.status, type: 'estimate' });

                itemHtml = `
                    <div class="list-group-item bg-transparent px-0 py-3 border-secondary-subtle">
                        <div class="d-flex w-100 justify-content-between align-items-center flex-wrap">
                            <div>
                                <h6 class="mb-1 fw-bold text-info-emphasis">
                                    <i class="bi bi-graph-up-arrow me-1"></i>Прогноза: ${escapeHtml(est.object_name)}
                                </h6>
                                <p class="mb-1 small"><strong>Дейност:</strong> ${escapeHtml(est.est_activity_name || '-')}</p>
                                <p class="mb-1 small"><strong>Вид:</strong> ${escapeHtml(est.display_vid || '-')}</p>
                                <p class="mb-1 small"><strong>Период:</strong> ${formatDateBG(est.start_date)} - ${formatDateBG(est.end_date)}</p>
                                <p class="mb-0 small">
                                    <strong>Статус:</strong> 
                                    <span class="badge ${sInfo.popoverBadgeClass}">${escapeHtml(sInfo.label)}</span>
                                </p>
                            </div>
                            <div class="mt-2 mt-md-0 d-flex gap-2">
                                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="openAndHideModal('estimate', '${est.estimate_id}', event)">
                                    <i class="bi bi-pencil-square me-1"></i>Редактирай
                                </button>
                                <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deleteAndReload('estimate', '${est.estimate_id}', event)">
                                    <i class="bi bi-trash-fill me-1"></i>Изтрий
                                </button>
                            </div>
                        </div>
                    </div>`;
            } else if (item.type === 'movement') {
                const m = item.data;
                const fromL = m.manual_departure_from || (m.from_site_name && m.from_site_name !== 'База' ? m.from_site_name : 'База');
                const toL = m.manual_arrive_to || (m.to_site_name && m.to_site_name !== 'База' ? m.to_site_name : 'База');
                const actObj = m.object_name || (toL !== 'База' ? toL : fromL);

                const hasDates = (m.arrival_date && m.arrival_date !== '0000-00-00') && (m.departure_date && m.departure_date !== '0000-00-00');
                const isArrival = m.arrival_date === dateStr;
                const isDeparture = m.departure_date === dateStr || m.movement_date === dateStr;
                const isMiddle = hasDates && !isArrival && !isDeparture;

                let activityInfo = m.activity_name || '';
                if (m.activity_subtype) {
                    activityInfo += (activityInfo ? ' — ' : '') + m.activity_subtype;
                }

                itemHtml = `
                    <div class="list-group-item bg-transparent px-0 py-3 border-secondary-subtle">
                        <div class="d-flex w-100 justify-content-between align-items-center flex-wrap">
                            <div>
                                <h6 class="mb-1 fw-bold text-warning-emphasis">
                                    <i class="bi bi-truck me-1"></i>Обект: ${escapeHtml(actObj)}
                                </h6>
                                ${activityInfo ? `<p class="mb-1 small"><strong>Дейност:</strong> ${escapeHtml(activityInfo)}</p>` : ''}
                                <p class="mb-1 small"><strong>Период:</strong> ${formatRange(m.arrival_date, m.departure_date)}</p>
                                <p class="mb-0 small">
                                    <strong>Статус:</strong> 
                                    <span class="badge rounded-pill pop-badge-planned small py-1 px-2">Мобилизиран</span>
                                </p>
                            </div>
                            <div class="mt-2 mt-md-0 d-flex gap-2">
                                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="openAndHideModal('movement', '${m.id || m.movement_id}', event)">
                                    <i class="bi bi-pencil-square me-1"></i>Редактирай
                                </button>
                                <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deleteAndReload('movement', '${m.id || m.movement_id}', event)">
                                    <i class="bi bi-trash-fill me-1"></i>Изтрий
                                </button>
                            </div>
                        </div>
                    </div>`;
            }
            html += itemHtml;
        });
        html += '</div>';
        modalBody.innerHTML = html;
    }

    const modalEl = document.getElementById('dayEventsModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
};

window.openAndHideModal = function (type, idOrData, event) {
    if (event) event.stopPropagation();

    // Close dayEventsModal
    const modalEl = document.getElementById('dayEventsModal');
    if (modalEl) {
        const inst = bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
    }

    setTimeout(() => {
        if (type === 'location') {
            openLocationModal(idOrData, event);
        } else if (type === 'estimate') {
            openEstimateEditor(idOrData, event);
        } else if (type === 'movement') {
            editMovement(idOrData, event);
        }
    }, 350);
};

window.deleteAndReload = function (type, id, event) {
    if (event) event.stopPropagation();

    if (type === 'location') {
        if (confirm("Машината ще бъде изтрита/премахната от този обект! Сигурни ли сте?")) {
            const machineId = document.getElementById('ganttMachinePicker') ? document.getElementById('ganttMachinePicker').value : '';
            if (!machineId) {
                showToast({ message: 'Грешка: не е избрана машина.', type: 'danger' });
                return;
            }

            const params = new URLSearchParams();
            params.append('action', 'delete_assignment');
            params.append('assignment_id', id);
            params.append('schedule_id', id);
            params.append('machine_id', machineId);

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php`, {
                method: 'POST',
                body: params
            }).then(res => res.json()).then(res => {
                if (res.success) {
                    showToast({ message: res.message, type: 'success' });
                    const modalEl = document.getElementById('dayEventsModal');
                    if (modalEl) {
                        const inst = bootstrap.Modal.getInstance(modalEl);
                        if (inst) inst.hide();
                    }
                    loadYearMatrix();
                    loadUnplannedProjects();
                } else {
                    showToast({ message: res.message, type: 'danger' });
                }
            }).catch(() => showToast({ message: 'Сървърна грешка.', type: 'danger' }));
        }
    } else if (type === 'estimate') {
        if (confirm("Тази прогноза ще бъде изтрита трайно! Сигурни ли сте?")) {
            const params = new URLSearchParams();
            params.append('action', 'delete_estimate');
            params.append('estimate_id', id);

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php`, {
                method: 'POST',
                body: params
            }).then(res => res.json()).then(res => {
                if (res.success) {
                    showToast({ message: res.message, type: 'success' });
                    const modalEl = document.getElementById('dayEventsModal');
                    if (modalEl) {
                        const inst = bootstrap.Modal.getInstance(modalEl);
                        if (inst) inst.hide();
                    }
                    loadYearMatrix();
                    loadUnplannedProjects();
                } else {
                    showToast({ message: res.message, type: 'danger' });
                }
            }).catch(() => showToast({ message: 'Сървърна грешка.', type: 'danger' }));
        }
    } else if (type === 'movement') {
        if (confirm("Това движение ще бъде изтрито трайно! Сигурни ли сте?")) {
            const params = new URLSearchParams();
            params.append('action', 'delete_movement');
            params.append('movement_id', id);

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php`, {
                method: 'POST',
                body: params
            }).then(res => res.json()).then(res => {
                if (res.success) {
                    showToast({ message: res.message, type: 'success' });
                    const modalEl = document.getElementById('dayEventsModal');
                    if (modalEl) {
                        const inst = bootstrap.Modal.getInstance(modalEl);
                        if (inst) inst.hide();
                    }
                    loadYearMatrix();
                } else {
                    showToast({ message: res.message, type: 'danger' });
                }
            }).catch(() => showToast({ message: 'Сървърна грешка.', type: 'danger' }));
        }
    }
};

window.updateForecastInfo = function () {
    const infoContainer = document.getElementById('forecastInfoContainer');
    if (!infoContainer) return;

    const scheduleTag = PlanningState.tagifyMovementSchedule ? PlanningState.tagifyMovementSchedule.value[0] : null;
    const machineTag = PlanningState.tagifyMovementMachine ? PlanningState.tagifyMovementMachine.value[0] : null;

    if (!scheduleTag || !machineTag) {
        infoContainer.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-info-circle display-4 d-block mb-2"></i>
                Изберете дейност и машина, за да видите прогнозираните дати.
            </div>`;
        return;
    }

    const scheduleId = scheduleTag.id;
    const machineId = machineTag.id;

    const scheduleData = (PlanningState.movementOptions.schedules || []).find(s => String(s.schedule_id) === String(scheduleId));
    if (!scheduleData) return;

    infoContainer.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-info" role="status"></div></div>`;

    const params = new URLSearchParams({
        action: 'get_forecast_dates',
        machine_id: machineId,
        request_id: scheduleData.request_id,
        activity_type_id: scheduleData.activity_type_id || 0,
        capability_name: scheduleData.capability_name || '',
        activity_subtype: scheduleData.activity_subtype || ''
    });

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?${params.toString()}`)
        .then(res => res.json())
        .then(res => {
            if (res.success && res.data && res.data.length > 0) {
                let html = '<div class="d-flex flex-column gap-4 mt-2">';

                // Group by month
                const monthsToShow = new Set();
                res.data.forEach(f => {
                    if (!f.start_date || !f.end_date) return;

                    const [yS, mS] = f.start_date.split('-').map(Number);
                    const [yE, mE] = f.end_date.split('-').map(Number);

                    let currY = yS;
                    let currM = mS - 1; // 0-indexed

                    const endY = yE;
                    const endM = mE - 1;

                    while (currY < endY || (currY === endY && currM <= endM)) {
                        monthsToShow.add(`${currY}-${currM}`);
                        currM++;
                        if (currM > 11) {
                            currM = 0;
                            currY++;
                        }
                    }
                });

                // Sort months
                const sortedMonths = Array.from(monthsToShow).sort((a, b) => {
                    const [yA, mA] = a.split('-').map(Number);
                    const [yB, mB] = b.split('-').map(Number);
                    return yA !== yB ? yA - yB : mA - mB;
                });

                sortedMonths.forEach(mStr => {
                    const [year, month] = mStr.split('-').map(Number);
                    html += generateMonthHtml(year, month, res.data);
                });

                // Summary details at the bottom with better contrast
                html += '<div class="mt-2 border-top pt-3">';
                res.data.forEach(f => {
                    html += `
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="badge bg-primary-subtle text-primary-emphasis rounded-pill border border-primary-subtle px-3">Период</span>
                                <small class="text-dark fw-bold">${formatDate(f.start_date)} - ${formatDate(f.end_date)}</small>
                            </div>
                            ${f.notes ? `<div class="bg-primary bg-opacity-10 p-3 rounded-4 text-dark-emphasis small border-start border-primary border-4 shadow-sm" style="font-size: 0.85rem; font-weight: 500;">${escapeHtml(f.notes)}</div>` : ''}
                        </div>`;
                });
                html += '</div></div>';

                infoContainer.innerHTML = html;
            } else {
                infoContainer.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="bi bi-calendar-x display-4 d-block mb-2"></i>
                        Няма открита прогноза за тази комбинация.
                    </div>`;
            }
        })
        .catch(() => {
            infoContainer.innerHTML = `<div class="alert alert-danger small">Грешка при зареждане.</div>`;
        });
};

function generateMonthHtml(year, month, forecasts) {
    const monthNames = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];
    const dayNames = ["По", "Вт", "Ср", "Че", "Пе", "Съ", "Не"];

    let html = `<div class="mini-calendar-container shadow-sm">
                    <div class="mini-calendar-header">${monthNames[month]} ${year}</div>`;

    dayNames.forEach(d => html += `<div class="mini-calendar-weekday">${d}</div>`);

    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Adjust to Monday start
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < offset; i++) {
        html += `<div class="mini-calendar-day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        let statusClass = '';
        forecasts.forEach(f => {
            if (dateStr >= f.start_date && dateStr <= f.end_date) {
                statusClass = (dateStr === f.start_date || dateStr === f.end_date) ? 'forecasted' : 'forecasted-range';
            }
        });

        const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
        const weekendClass = isWeekend ? 'weekend' : '';

        html += `<div class="mini-calendar-day ${statusClass} ${weekendClass}">${d}</div>`;
    }

    html += `</div>`;
    return html;
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '0000-00-00') return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
}
