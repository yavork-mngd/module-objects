/**
 * planning_api.js
 * API interaction functions for the Machine Planning module.
 */

function loadObjectFilter() {
    return fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=get_planning_objects`)
        .then(res => res.json())
        .then(response => {
            if (response.success && response.data) {
                const objectFilter = document.getElementById('objectFilter');
                if (objectFilter) {
                    let html = `<option value="0">Всички обекти</option>`;
                    response.data.forEach(obj => {
                        html += `<option value="${obj.request_id}">${escapeHtml(obj.object_name)}</option>`;
                    });
                    objectFilter.innerHTML = html;
                }
            }
        })
        .catch(err => console.warn("Could not load objects", err));
}

function loadActivityFilter(requestId = 0) {
    return fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=get_all_activities&request_id=${requestId}`)
        .then(res => res.json())
        .then(response => {
            if (response.success && response.data) {
                PlanningState.allActivitiesData = response.data;

                const activityOptions = (placeholder) => {
                    let html = `<option value="0">${placeholder}</option>`;
                    response.data.forEach(a => {
                        html += `<option value="${a.id}">${escapeHtml(a.activity_name)}</option>`;
                    });
                    return html;
                };

                // Main Filter
                const af = document.getElementById('activityFilter');
                if (af) af.innerHTML = activityOptions('Всички дейности');

                // Find Machine Filter
                const faf = document.getElementById('find_activity_type');
                if (faf) faf.innerHTML = activityOptions('Всички');

                // Estimate Modals
                const eaf = document.getElementById('est_activity_type_id');
                if (eaf) eaf.innerHTML = '<option value="" disabled selected>Изберете дейност...</option>' + activityOptions('---').replace('<option value="0">---</option>', '');

                const seaf = document.getElementById('standalone_est_activity_type_id');
                if (seaf) seaf.innerHTML = '<option value="" disabled selected>Изберете дейност...</option>' + activityOptions('---').replace('<option value="0">---</option>', '');
            }
        })
        .catch(err => console.warn("Could not load activities", err));
}

function loadMachinesDropdown(activityTypeId = 0, capabilityName = '', updateMainFilter = true, requestId = 0) {
    let url = `${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=get_machines_by_activity&activity_type_id=${activityTypeId}&v=${Date.now()}`;

    if (capabilityName && typeof capabilityName === 'string' && capabilityName.trim() !== '') {
        url += `&capability_name=${encodeURIComponent(capabilityName.trim())}`;
    }
    if (requestId > 0) {
        url += `&request_id=${requestId}`;
    }
    return fetch(url)
        .then(res => res.json())
        .then(response => {
            let options = '<option value="" disabled selected>Изберете машина...</option>';
            if (response.success && response.data) {
                const decodedData = response.data.map(m => {
                    let name = String(m.machine_name || '').trim();
                    if (name.startsWith('[') && name.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(name);
                            if (Array.isArray(parsed) && parsed[0] && parsed[0].value) {
                                name = String(parsed[0].value).trim();
                            }
                        } catch (e) { }
                    }
                    return { ...m, machine_name: name, id: String(m.id || '') };
                });

                // Store globally for other usages
                if (activityTypeId === 0 || PlanningState.allMachinesData.length === 0) {
                    PlanningState.allMachinesData = decodedData;
                    populateModalMachineSelect(decodedData);
                }

                decodedData.forEach(function (machine) {
                    options += `<option value="${machine.id}">${escapeHtml(machine.machine_name)}</option>`;
                });
            }

            // Update the filter machine picker ONLY if requested
            const filterMid = document.getElementById('ganttMachinePicker');
            if (updateMainFilter && filterMid) {
                const previousValue = filterMid.value;
                filterMid.innerHTML = options;

                if (previousValue) {
                    const optionExists = Array.from(filterMid.options).some(opt => opt.value === previousValue);
                    if (optionExists) filterMid.value = previousValue;
                    else if (response.data && response.data.length > 0) filterMid.value = response.data[0].id;
                } else if (response.data && response.data.length > 0) {
                    filterMid.value = response.data[0].id;
                }
                loadYearMatrix();
            }

            return response.data;
        })
        .catch(err => console.warn("Could not load machines", err));
}

function populateModalMachineSelect(machines) {
    const selectors = ['#machine_id', '#standalone_machine_id', '#move_machine_id'];
    selectors.forEach(sel => {
        const mid = document.querySelector(sel);
        if (!mid) return;

        // If it's an INPUT, it's handled by Tagify, update its whitelist
        if (mid.tagName === 'INPUT') {
            const tagifyMap = {
                '#machine_id': 'tagifyEstimateMachine',
                '#standalone_machine_id': 'tagifyObjectNameStandalone', // Wait, standalone is usually object name but here it's machine?
                '#move_machine_id': 'tagifyMovementMachine'
            };
            const stateKey = tagifyMap[sel];
            if (stateKey && PlanningState[stateKey]) {
                PlanningState[stateKey].settings.whitelist = machines.map(m => ({ value: m.machine_name, id: m.id }));
            }
            return;
        }

        let options = '<option value="" disabled selected>Изберете машина...</option>';
        machines.forEach(function (machine) {
            options += `<option value="${machine.id}">${escapeHtml(machine.machine_name)}</option>`;
        });
        mid.innerHTML = options;
    });
}

function loadYearMatrix() {
    const container = document.getElementById('ganttContainer');
    const machinePicker = document.getElementById('ganttMachinePicker');
    const yearPicker = document.getElementById('ganttYearPicker');

    if (!container || !machinePicker || !yearPicker) return;

    if (!machinePicker.value) {
        container.innerHTML = `<div class="col-12 text-center p-5 text-muted"><p class="mt-2 text-dark fs-5">Моля, изберете машина от филтъра горе.</p></div>`;
        hideMachineInfoCard();
        return;
    }

    container.innerHTML = `<div class="col-12 text-center p-5 text-muted"><div class="spinner-border text-primary"></div><p class="mt-2 text-dark">Зареждане на график...</p></div>`;

    const refreshBtn = document.getElementById('refreshMatrixBtn');
    if (refreshBtn) refreshBtn.classList.add('spinning');

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=get_machine_year_matrix&machine_id=${machinePicker.value}&year=${yearPicker.value}`)
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                // Render Machine Info Card (#1)
                renderMachineInfoCard(
                    machinePicker.options[machinePicker.selectedIndex].text,
                    response.capabilities || [],
                    response.current_location || 'База',
                    response.unplanned_queue || [],
                    machinePicker.value
                );

                // Cache capabilities for estimate modal
                PlanningState.currentMachineCapabilities = response.capabilities || [];

                renderYearMatrix(
                    response.matrix,
                    response.estimates,
                    response.locations,
                    response.movements,
                    yearPicker.value,
                    machinePicker.value,
                    response.object_envelopes || {}
                );
            } else {
                container.innerHTML = `<tr><td class="alert alert-danger mx-3 mt-3">${response.message}</td></tr>`;
            }
        })
        .catch(err => {
            container.innerHTML = `<tr><td class="alert alert-danger mx-3 mt-3">Network error: ${err.message}</td></tr>`;
        })
        .finally(() => {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        });
}
