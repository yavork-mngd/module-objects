/**
 * planning_unplanned.js
 * Logic for managing and assigning unplanned objects (objects without a start date).
 * Updated to show per-row machine dropdown and subtype filter.
 */

// Storing data locally to allow instant filtering without re-fetching
window.rawUnplannedData = [];

window.loadUnplannedProjects = function () {
    const container = document.getElementById('unplannedProjectsContainer');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div> Зареждане на обекти...</div>`;

    // Initialize Tagify if not already done
    initUnplannedTagify();
    initObjectNameTagify();

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php?action=get_unplanned_projects`)
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                window.rawUnplannedData = response.data || [];
                // Update Tagify whitelist
                updateUnplannedAutocomplete();
                // Update Estimate Object Autocomplete list (#21)
                updateEstimateObjectAutocomplete();
                // Apply any existing filter value automatically
                filterUnplannedBySubtype();
            } else {
                container.innerHTML = `<div class="alert alert-danger">${response.message}</div>`;
            }
        })
        .catch(err => {
            container.innerHTML = `<div class="alert alert-danger">Грешка при зареждане: ${err.message}</div>`;
        });
}

window.initUnplannedTagify = function () {
    const input = document.getElementById('unplannedSubtypeFilter');
    if (!input || PlanningState.tagifySubtypeFilter) return;

    if (typeof Tagify === 'undefined') {
        console.error('Tagify is not loaded');
        return;
    }

    PlanningState.tagifySubtypeFilter = new Tagify(input, {
        classname: "unplanned-tagify-filter",
        whitelist: [],
        dropdown: {
            enabled: 0,
            closeOnSelect: true,
            maxItems: 20
        }
    });

    PlanningState.tagifySubtypeFilter.on('change', () => {
        filterUnplannedBySubtype();
    });
}

window.updateUnplannedAutocomplete = function () {
    if (!PlanningState.tagifySubtypeFilter) return;

    const subtypes = new Set();
    window.rawUnplannedData.forEach(p => {
        if (p.capability_name && p.capability_name.trim()) {
            subtypes.add(p.capability_name.trim());
        }
    });

    PlanningState.tagifySubtypeFilter.settings.whitelist = Array.from(subtypes).sort().map(s => ({ value: s }));
};

window.filterUnplannedBySubtype = function () {
    let filterValues = [];
    if (PlanningState.tagifySubtypeFilter && PlanningState.tagifySubtypeFilter.value) {
        filterValues = PlanningState.tagifySubtypeFilter.value.map(tag => tag.value.toLowerCase());
    }

    if (filterValues.length === 0) {
        renderUnplannedProjects(window.rawUnplannedData);
        return;
    }

    const filtered = window.rawUnplannedData.filter(p => {
        const subtype = (p.activity_subtype || '').toLowerCase();
        const capability = (p.capability_name || '').toLowerCase();
        return filterValues.some(val => subtype.includes(val) || capability.includes(val));
    });

    renderUnplannedProjects(filtered);
}

function renderUnplannedProjects(projects) {
    const container = document.getElementById('unplannedProjectsContainer');
    if (!container) return;

    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-check2-circle display-4 d-block mb-2"></i>
                Няма предстоящи обекти без машина за планиране.
            </div>`;
        return;
    }

    // Grouping logic: group by request_id (Object)
    const grouped = {};
    projects.forEach(p => {
        const groupKey = `${p.client_id}-${p.request_id}`;
        if (!grouped[groupKey]) {
            grouped[groupKey] = {
                name: p.object_name,
                client: p.client_name,
                request_id: p.request_id,
                client_id: p.client_id,
                activities: []
            };
        }
        grouped[groupKey].activities.push(p);
    });

    let html = `
    <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
            <tbody>`;

    let groupId = 0;
    Object.keys(grouped).forEach(groupKey => {
        groupId++;
        const group = grouped[groupKey];
        const isExpanded = PlanningState.expandedUnplannedGroups.has(groupKey);
        const currentGroupId = 'unplan-group-' + groupId;

        // Group Header Row
        html += `
            <tr class="bg-light border-bottom" style="cursor: pointer;" onclick="toggleUnplannedGroup('${groupKey}', '${currentGroupId}')">
                <td colspan="6" class="py-2 px-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-chevron-down text-primary me-3 transition-all" id="icon-${currentGroupId}" style="display: inline-block; transition: transform 0.3s; ${isExpanded ? 'transform: rotate(-180deg);' : ''}"></i>
                            <div class="d-flex flex-column">
                                <span class="fw-bold text-primary-emphasis"><i class="bi bi-building me-2"></i>${escapeHtml(group.name)}</span>
                                <small class="text-muted"><i class="bi bi-person me-1"></i>${escapeHtml(group.client)}</small>
                            </div>
                            <span class="badge bg-secondary rounded-pill ms-3">${group.activities.length} дейности</span>
                        </div>
                    </div>
                </td>
            </tr>`;

        // Activity Rows
        group.activities.forEach(p => {
            // Use pre-formatted Vid from server (#24)
            let displayVid = p.display_vid || '-';

            let assignedMachinesHtml = '';
            if (p.assigned_machines) {
                assignedMachinesHtml = p.assigned_machines.split('||').map(m => {
                    const parts = m.split(':');
                    const id = parts[0];
                    const name = parts[1];
                    const startDate = parts[2] || '';
                    const isMobilized = (startDate && startDate !== '0000-00-00' && startDate !== '00.00.0000');
                    const iconClass = isMobilized ? 'bi-truck text-primary' : 'bi-calendar-event text-info';
                    const title = isMobilized ? 'Мобилизирана' : 'Прогнозирана / Присъединена';

                    return `<div title="${title}"><i class="bi ${iconClass} me-1"></i> ${escapeHtml(name.trim())}</div>`;
                }).join('');
            } else {
                assignedMachinesHtml = '<span class="text-muted small">Няма машина</span>';
            }

            let anyMobilized = false;
            if (p.assigned_machines) {
                anyMobilized = p.assigned_machines.split('||').some(m => {
                    const parts = m.split(':');
                    const startDate = parts[2] || '';
                    return (startDate && startDate !== '0000-00-00' && startDate !== '00.00.0000');
                });
            }

            const hasForecast = parseInt(p.forecast_count || 0) > 0;
            const forecastDisabled = (hasForecast || anyMobilized) ? 'disabled' : '';
            const mobilizationDisabled = anyMobilized ? 'disabled' : '';

            html += `
                <tr class="${currentGroupId} ${isExpanded ? '' : 'd-none'}" style="opacity: ${isExpanded ? '1' : '0'}; transition: opacity 0.2s;">
                    <td class="px-3" title="Машини" style="width: 250px;">
                        <div class="d-flex flex-column gap-1">
                            ${assignedMachinesHtml}
                        </div>
                    </td>
                    <td class="px-3" title="Дейность">
                        <div>${escapeHtml(p.activity_name)}</div>
                    </td>
                    <td class="px-3" title="Вид">
                        <div class="text-body-secondary font-medium">
                            ${escapeHtml(displayVid)}
                        </div>
                    </td>
                    <td class="px-3" title="Количество">
                        <div class="fw-bold">${p.total_quantity} ${escapeHtml(p.unit_of_measure)}</div>
                        ${p.dimension_info ? `<small class="text-muted">Р: ${p.dimension_info}</small>` : ''}
                    </td>
                    <td class="px-3" title="План / Дни">
                        <div><i class="bi bi-graph-up text-primary me-1"></i>${p.daily_productivity_plan}</div>
                        <small class="text-muted">${p.planned_days} дни</small>
                    </td>
                    <td class="px-3 text-center" title="Действие">
                        <div class="d-flex gap-2 justify-content-center">
                            <button class="btn btn-sm btn-forecast rounded-pill px-3" ${forecastDisabled} 
                                    title="${hasForecast ? 'Вече има добавена прогноза за тази дейност' : (anyMobilized ? 'Дейността е вече мобилизирана' : '')}"
                                    onclick="openForecastFromUnplanned(${p.schedule_id}, event)">
                                <i class="bi bi-calendar-plus"></i> Прогноза
                            </button>
                            <button class="btn btn-sm btn-primary rounded-pill px-3" ${mobilizationDisabled}
                                    title="${anyMobilized ? 'Дейността е вече мобилизирана' : ''}"
                                    onclick="openMovementFromUnplanned(${p.schedule_id}, event)">
                                <i class="bi bi-truck"></i> Мобилизация
                            </button>
                        </div>
                    </td>
                </tr>`;
        });
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

/**
 * Initializes Tagify for each machine assignment input in the unplanned list
 */
function initUnplannedRowTagifies() {
    const inputs = document.querySelectorAll('.unplanned-machine-tagify');
    inputs.forEach(input => {
        const activityId = input.getAttribute('data-activity-id');
        const capability = input.getAttribute('data-capability');
        const firstTag = capability ? capability.split(',')[0].trim().toLowerCase() : '';

        // Filter valid machines for this row
        const whitelist = PlanningState.allMachinesData.filter(m => {
            const isCapable = !activityId || (m.allowed_activities && m.allowed_activities.includes(parseInt(activityId)));
            let moreSpecificMatch = true;
            if (isCapable && firstTag && m.capabilities_map && m.capabilities_map[activityId]) {
                const machineCaps = m.capabilities_map[activityId].map(c => c.toLowerCase().trim());
                moreSpecificMatch = machineCaps.includes(firstTag);
            }
            return isCapable && moreSpecificMatch;
        }).map(m => ({ value: m.machine_name, id: m.id }));

        new Tagify(input, {
            whitelist: whitelist,
            enforceWhitelist: true,
            templates: {
                tag: function (tagData) {
                    return `
                        <tag title="${tagData.value}"
                             contenteditable='false'
                             spellcheck='false'
                             tabIndex="-1"
                             class="tagify__tag ${tagData.class ? tagData.class : ""}"
                             ${this.getAttributes(tagData)}>
                            <x title='' class='tagify__tag__removeBtn' role='button' aria-label='remove tag'></x>
                            <div>
                                <i class="bi bi-gear-fill me-1" style="font-size: 0.7rem;"></i>
                                <span class='tagify__tag__text'>${tagData.value}</span>
                            </div>
                        </tag>
                    `;
                }
            },
            dropdown: {
                enabled: 0,
                maxItems: 50,
                closeOnSelect: false,
                highlightFirst: true
            }
        });
    });
}

window.toggleUnplannedGroup = function (groupKey, currentGroupId) {
    const items = document.querySelectorAll('.' + currentGroupId);
    const icon = document.getElementById('icon-' + currentGroupId);

    if (items.length === 0) return;
    const isExpanding = items[0].classList.contains('d-none');

    if (isExpanding) {
        PlanningState.expandedUnplannedGroups.add(groupKey);
        icon.style.transform = 'rotate(-180deg)';
        items.forEach((item, index) => {
            item.classList.remove('d-none');
            setTimeout(() => { item.style.opacity = '1'; }, index * 20);
        });
    } else {
        PlanningState.expandedUnplannedGroups.delete(groupKey);
        icon.style.transform = 'rotate(0deg)';
        items.forEach(item => { item.style.opacity = '0'; });
        setTimeout(() => { items.forEach(item => { item.classList.add('d-none'); }); }, 200);
    }
}

window.saveUnplannedAssignment = function (scheduleId, event) {
    const machInput = document.getElementById(`assign_machine_${scheduleId}`);
    if (!machInput || !scheduleId) return;

    let machineIds = [];
    try {
        const val = machInput.value;
        if (val) {
            const parsed = JSON.parse(val);
            machineIds = parsed.map(p => p.id);
        }
    } catch (e) {
        console.error("Error parsing machines", e);
    }

    const formData = new FormData();
    formData.append('action', 'sync_machine_assignments');
    formData.append('schedule_id', scheduleId);
    // Add machine_ids as an array
    machineIds.forEach(id => formData.append('machine_ids[]', id));

    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btn.disabled = true;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php`, {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                showToast({ message: res.message, type: 'success' });

                // Refresh calendar if relevant
                const currentFilterMachine = document.getElementById('ganttMachinePicker') ? document.getElementById('ganttMachinePicker').value : null;
                if (!currentFilterMachine || machineIds.some(id => String(id) === String(currentFilterMachine))) {
                    if (typeof loadYearMatrix === 'function') loadYearMatrix();
                }
            } else {
                showToast({ message: res.message, type: 'danger' });
            }
        })
        .catch(err => {
            showToast({ message: 'Мрежова грешка при присъединяване.', type: 'danger' });
        })
        .finally(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });
}

window.openMovementFromUnplanned = function (scheduleId, event) {
    if (event) event.stopPropagation();

    const project = (window.rawUnplannedData || []).find(p => String(p.schedule_id) === String(scheduleId));
    if (!project) return;

    if (typeof resetMovementModal === 'function') resetMovementModal();

    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    const todayStr = `${dd}.${mm}.${yyyy}`;
    const arrivalInput = document.getElementById('arrival_date');
    const departureInput = document.getElementById('departure_date');
    if (arrivalInput) arrivalInput.value = todayStr;
    if (departureInput) departureInput.value = todayStr;

    const modalEl = document.getElementById('movementModal');
    if (modalEl) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    if (typeof loadMachineMovementsOptions === 'function') {
        loadMachineMovementsOptions().then(() => {
            PlanningState.autoFillingMovement = true;
            if (PlanningState.tagifyMovementObject && project.object_name) {
                PlanningState.tagifyMovementObject.removeAllTags();
                PlanningState.tagifyMovementObject.addTags([{ value: project.object_name, id: project.request_id }]);

                const filteredSchedules = (PlanningState.movementOptions.schedules || [])
                    .filter(s => String(s.request_id) === String(project.request_id))
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

                let matchedSchedule = filteredSchedules.find(s => String(s.id) === String(project.schedule_id));
                if (!matchedSchedule && project.schedule_id) {
                    let vid = project.capability_name || '';
                    if (project.activity_subtype) vid = (vid ? vid + ' — ' : '') + project.activity_subtype;
                    let display = (project.activity_name || 'Без дейност');
                    if (vid) display += ' (' + vid + ')';

                    const qtyStr = parseFloat(project.total_quantity || 0);
                    const dimStr = parseFloat(project.dimension_info || 0);
                    display += ' | ' + qtyStr;
                    if (dimStr > 0) display += ' / ' + dimStr;

                    matchedSchedule = {
                        value: display,
                        id: project.schedule_id,
                        request_id: project.request_id,
                        site_name: project.object_name,
                        activity_type_id: project.activity_type_id ? parseInt(project.activity_type_id) : null,
                        capability_name: project.capability_name
                    };
                    filteredSchedules.push(matchedSchedule);
                }

                if (PlanningState.tagifyMovementSchedule) {
                    setTimeout(() => {
                        PlanningState.tagifyMovementSchedule.settings.whitelist = filteredSchedules;
                        PlanningState.tagifyMovementSchedule.removeAllTags();

                        if (matchedSchedule) {
                            PlanningState.tagifyMovementSchedule.addTags([{ value: String(matchedSchedule.value), id: String(matchedSchedule.id) }]);
                            if (PlanningState.tagifyMovementSchedule.value.length === 0) {
                                PlanningState.tagifyMovementSchedule.addTags([String(matchedSchedule.value)]);
                            }

                            if (PlanningState.tagifyToSite) {
                                PlanningState.tagifyToSite.removeAllTags();
                                PlanningState.tagifyToSite.addTags([{ value: matchedSchedule.site_name, id: matchedSchedule.request_id }]);
                            }

                            // Second pass fallback just in case Tagify whitelist needed an extra tick
                            setTimeout(() => {
                                if (PlanningState.tagifyMovementSchedule.value.length === 0) {
                                    PlanningState.tagifyMovementSchedule.addTags([{ value: String(matchedSchedule.value), id: String(matchedSchedule.id) }]);
                                }
                            }, 50);
                        }
                        PlanningState.autoFillingMovement = false;
                    }, 150);
                } else {
                    PlanningState.autoFillingMovement = false;
                }
            } else {
                PlanningState.autoFillingMovement = false;
            }

            let selectedMachineId = "";
            if (project && project.assigned_machines) {
                const parts = project.assigned_machines.split('||');
                if (parts[0]) {
                    selectedMachineId = String(parts[0].split(':')[0]);
                }
            }

            if (selectedMachineId && PlanningState.tagifyMovementMachine) {
                const tag = PlanningState.tagifyMovementMachine.settings.whitelist.find(i => String(i.id) === selectedMachineId);
                PlanningState.tagifyMovementMachine.removeAllTags();
                if (tag) {
                    PlanningState.tagifyMovementMachine.addTags([tag]);
                } else {
                    const mData = (PlanningState.allMachinesData || []).find(m => String(m.id) === selectedMachineId);
                    if (mData) {
                        PlanningState.tagifyMovementMachine.addTags([{ value: mData.machine_name, id: mData.id }]);
                    }
                }
            }
        }).catch(err => {
            console.warn("Error auto-filling movement options:", err);
            PlanningState.autoFillingMovement = false;
        });
    }
};

window.openForecastFromUnplanned = function (scheduleId, event) {
    if (event) event.stopPropagation();

    const projects = window.rawUnplannedData || (window.PlanningState ? PlanningState.rawUnplannedData : []);
    const project = projects ? projects.find(p => String(p.schedule_id) === String(scheduleId)) : null;

    if (!project) {
        console.warn("Project not found", scheduleId);
        // Fallback: at least open the modal
        const modalEl = document.getElementById('estimateModal');
        if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
        return;
    }

    // Get currently selected machine
    let selectedMachineId = "";
    if (project && project.assigned_machines) {
        const parts = project.assigned_machines.split('||');
        if (parts[0]) {
            selectedMachineId = String(parts[0].split(':')[0]);
        }
    }

    // Fallback to backend machine_id
    if (!selectedMachineId && project.machine_id != "0" && project.machine_id != null) {
        selectedMachineId = String(project.machine_id);
    }

    // Reset and prepare the estimate modal
    if (typeof resetEstimateModal === 'function') resetEstimateModal();

    // Set desired pre-selection for the loader to pick up later
    let capName = (project.capability_name || '').trim();
    let subType = (project.activity_subtype || '').trim();

    // LEGACY FALLBACK: If activity_subtype is empty but capability has a pipe, split it
    if (!subType && capName.indexOf('|') !== -1) {
        const parts = capName.split('|');
        capName = parts[0].trim();
        subType = parts[1].trim();
    }

    PlanningState.desiredActivityId = project.activity_type_id || null;
    PlanningState.desiredCapabilityName = capName || null;
    PlanningState.desiredActivitySubtype = subType || null;

    const objInput = document.getElementById('object_name');
    if (objInput) objInput.value = project.object_name || "";

    const reqIdInput = document.getElementById('est_request_id');
    if (reqIdInput) reqIdInput.value = project.request_id || "0";
    const schedIdInput = document.getElementById('est_schedule_id');
    if (schedIdInput) schedIdInput.value = project.schedule_id || "0";

    // INSTANT GRAB: Force the subtype into the box immediately
    const subInputDirect = document.getElementById('est_activity_subtype');
    if (subInputDirect) subInputDirect.value = subType || "";

    // Helper to finalize and show modal
    const finalizeAndShow = () => {
        const machInput = document.getElementById('machine_id');
        if (machInput && PlanningState.tagifyEstimateMachine) {
            const tag = PlanningState.tagifyEstimateMachine.settings.whitelist.find(i => String(i.id) === String(selectedMachineId));
            if (tag) PlanningState.tagifyEstimateMachine.addTags([tag]);
        } else if (machInput && machInput.tagName === 'SELECT') {
            // Ensure the selected machine exists in the dropdown before selecting
            const exists = Array.from(machInput.options).some(opt => opt.value == selectedMachineId);
            if (exists) {
                machInput.value = selectedMachineId;
            }
        }

        if (typeof updateEstimateObjectAutocomplete === 'function') {
            updateEstimateObjectAutocomplete(selectedMachineId);
        }

        if (PlanningState.tagifyObjectName && typeof PlanningState.tagifyObjectName.removeAllTags === 'function') {
            PlanningState.tagifyObjectName.removeAllTags();
            if (project.object_name) {
                // Build the activity info part to match Movement modal style (#35)
                let vid = project.capability_name || '';
                if (project.activity_subtype) vid = (vid ? vid + ' — ' : '') + project.activity_subtype;
                let actDisplay = (project.activity_name || 'Без дейност');
                if (vid) actDisplay += ' (' + vid + ')';

                const qtyStr = parseFloat(project.total_quantity || 0);
                actDisplay += ' | ' + qtyStr;
                if (project.dimension_info && project.dimension_info !== '0') {
                    actDisplay += ' / ' + project.dimension_info;
                }

                PlanningState.tagifyObjectName.addTags([{
                    value: project.object_name + ' | ' + actDisplay,
                    request_id: project.request_id,
                    schedule_id: project.schedule_id,
                    original_name: project.object_name,
                    activity_subtype: project.activity_subtype
                }]);
            }
        }

        // Trigger capability loading sequence (this handles Act/Cap pre-selection inside planning_modals.js)
        if (selectedMachineId && typeof loadEstimateMachineCapabilities === 'function') {
            loadEstimateMachineCapabilities(selectedMachineId).then(() => {
                const modalEl = document.getElementById('estimateModal');
                if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
            }).catch(err => {
                console.warn("Failed to load capabilities", err);
                const modalEl = document.getElementById('estimateModal');
                if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
            });
        } else {
            const modalEl = document.getElementById('estimateModal');
            if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    };

    // Load filtered machines before opening the modal - Use only the first tag for filtering machines
    const firstTagForFilter = (capName || '').split(',')[0].trim();
    loadMachinesDropdown(project.activity_type_id || 0, firstTagForFilter, false).then(machinesArray => {
        if (Array.isArray(machinesArray)) {
            // FORCE SELECTED MACHINE INTO LIST: Ensure our selectedMachineId is in the list even if it was manually assigned 
            const machineExistsInList = machinesArray.some(m => String(m.id) === String(selectedMachineId));
            if (selectedMachineId && !machineExistsInList && typeof PlanningState !== 'undefined' && PlanningState.allMachinesData) {
                const machine = PlanningState.allMachinesData.find(m => String(m.id) === String(selectedMachineId));
                if (machine) {
                    machinesArray.push({ id: machine.id, machine_name: machine.machine_name });
                }
            }
            populateModalMachineSelect(machinesArray);
        }
        finalizeAndShow();
    }).catch(err => {
        console.warn("Machine filter failed", err);
        finalizeAndShow();
    });
}

window.initObjectNameTagify = function () {
    const input = document.getElementById('object_name');
    if (input && !PlanningState.tagifyObjectName) {
        if (typeof Tagify === 'undefined') {
            console.error('Tagify is not loaded');
        } else {
            PlanningState.tagifyObjectName = new Tagify(input, {
                mode: "select", whitelist: [], enforceWhitelist: false,
                dropdown: { enabled: 0, closeOnSelect: true, maxItems: 50 }
            });

            PlanningState.tagifyObjectName.on('add', function (e) {
                const data = e.detail.data;
                if (!data || !data.schedule_id) return;

                const project = window.rawUnplannedData.find(p => String(p.schedule_id) === String(data.schedule_id));
                if (project) {
                    const actSelect = document.getElementById('est_activity_type_id');
                    if (actSelect) {
                        actSelect.value = project.activity_type_id || '';
                        // Trigger dependency logic
                        populateEstCapabilityDropdown(actSelect.value);
                        const capSelect = document.getElementById('est_capability_name');
                        if (capSelect) capSelect.value = project.capability_name || '';
                    }
                }
            });
        }
    }
};

/**
 * Populates the datalist for "Обект за прогноза" with unique object names from unplanned projects (#22)
 */
window.updateEstimateObjectAutocomplete = function (machineId = null) {
    let filteredData = window.rawUnplannedData;

    if (machineId && typeof PlanningState !== 'undefined' && PlanningState.allMachinesData) {
        const machine = PlanningState.allMachinesData.find(m => String(m.id) === String(machineId));
        if (machine) {
            filteredData = window.rawUnplannedData.filter(p => {
                // If the row has an activity_type_id, check if the machine supports it
                const isCapable = !p.activity_type_id || (machine.allowed_activities && machine.allowed_activities.includes(parseInt(p.activity_type_id)));
                if (!isCapable) return false;

                // Additional filter: if there's a capability name, check if machine supports it
                if (p.capability_name && machine.capabilities_map && machine.capabilities_map[p.activity_type_id]) {
                    const firstTag = p.capability_name.split(',')[0].trim().toLowerCase();
                    const machineCaps = machine.capabilities_map[p.activity_type_id].map(c => c.toLowerCase().trim());
                    return machineCaps.includes(firstTag);
                }
                return true;
            });
        }
    }

    // DEDUPLICATION LOGIC: Group by object, activity, specification, and subtype
    const seen = new Set();
    const whitelist = [];

    filteredData.forEach(p => {
        // Build the activity info part to match Movement modal style (#35)
        let vid = p.capability_name || '';
        if (p.activity_subtype) vid = (vid ? vid + ' — ' : '') + p.activity_subtype;
        let actDisplay = (p.activity_name || 'Без дейност');
        if (vid) actDisplay += ' (' + vid + ')';

        const qtyStr = parseFloat(p.total_quantity || 0);
        actDisplay += ' | ' + qtyStr;
        if (p.dimension_info && p.dimension_info !== '0') {
            actDisplay += ' / ' + p.dimension_info;
        }

        const label = p.object_name + ' | ' + actDisplay;

        // UNIQUE KEY: object_id + activity_type_id + capability + subtype
        const uniqueKey = `${p.request_id}-${p.activity_type_id}-${p.capability_name || ''}-${p.activity_subtype || ''}`;

        if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            whitelist.push({
                value: label,
                request_id: p.request_id,
                schedule_id: p.schedule_id,
                original_name: p.object_name,
                activity_subtype: p.activity_subtype
            });
        }
    });

    if (PlanningState.tagifyObjectName) {
        PlanningState.tagifyObjectName.settings.whitelist = whitelist;
    }
};

window.initEstimateMachineTagify = function () {
    const input = document.getElementById('machine_id');
    if (input && !PlanningState.tagifyEstimateMachine) {
        if (typeof Tagify === 'undefined') {
            console.error('Tagify is not loaded');
        } else {
            PlanningState.tagifyEstimateMachine = new Tagify(input, {
                mode: "select",
                whitelist: (PlanningState.allMachinesData || []).map(m => ({ value: m.machine_name, id: m.id })),
                enforceWhitelist: true,
                dropdown: { enabled: 0, closeOnSelect: true, maxItems: 50 }
            });

            PlanningState.tagifyEstimateMachine.on('change', function (e) {
                const val = e.detail.value;
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        if (parsed && parsed[0]) {
                            if (typeof loadEstimateMachineCapabilities === 'function') {
                                loadEstimateMachineCapabilities(parsed[0].id);
                            }
                            if (typeof updateEstimateObjectAutocomplete === 'function') {
                                updateEstimateObjectAutocomplete(parsed[0].id);
                            }
                        }
                    } catch (err) { }
                }
            });
        }
    }
};
