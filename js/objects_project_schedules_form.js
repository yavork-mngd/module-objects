// /modules/objects/js/objects_project_schedules_form.js
// Refactored from objects_project_schedules.js

// Safe DOM helpers
const setSafeValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
        el.value = (val === null || val === undefined) ? '' : val;
        return true;
    }
    console.warn(`[SafeDOM] Element with ID "${id}" not found.`);
    return false;
};

const setSafeInnerText = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = val || '';
        return true;
    }
    console.warn(`[SafeDOM] Element with ID "${id}" not found.`);
    return false;
};

// Safe Notification helper
const safeAlert = (title, message, type = 'info') => {
    if (typeof Swal !== 'undefined') {
        Swal.fire(title, message, type);
    } else if (typeof showToast === 'function') {
        showToast({ message: `${title}: ${message}`, type: type === 'error' ? 'error' : 'success' });
    } else {
        alert(`${title}: ${message}`);
    }
};

// ---- Records (order lines) of the selected inquiry ----
window.requestRecords = [];

function parseRecordNumber(v) {
    if (v === null || v === undefined) return null;
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) || n <= 0 ? null : n;
}

window.loadRequestRecords = function (requestId) {
    const panel = document.getElementById('request_records_panel');
    const list = document.getElementById('request_records_list');
    if (!panel || !list) return;

    window.requestRecords = [];
    list.innerHTML = '';
    if (!requestId) {
        panel.classList.add('d-none');
        return;
    }

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php?action=get_request_records&request_id=${encodeURIComponent(requestId)}`)
        .then(r => r.json())
        .then(data => {
            const records = (data.success && data.records) || [];
            window.requestRecords = records;
            if (!records.length) {
                panel.classList.add('d-none');
                return;
            }
            const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            list.innerHTML = records.map(r => {
                const parts = [];
                if (r.project) parts.push(esc(r.project));
                if (r.qty) parts.push(`${esc(r.qty)} бр`);
                if (r.meters) parts.push(`${esc(r.meters)} м`);
                if (r.kg) parts.push(`${esc(r.kg)} кг`);
                return `<button type="button" class="list-group-item list-group-item-action py-2" data-record-id="${r.id}" onclick="selectRequestRecord(${r.id})">
                    <div class="fw-semibold">${esc(r.vid) || '—'}</div>
                    <small class="text-muted">${parts.join(' · ')}</small>
                </button>`;
            }).join('');
            panel.classList.remove('d-none');
        })
        .catch(err => {
            console.error('Error loading request records:', err);
            panel.classList.add('d-none');
        });
};

window.clearRequestRecordSelection = function () {
    document.querySelectorAll('#request_records_list .active').forEach(el => el.classList.remove('active'));
};

// Same rules as the "Нова заявка" draft modal in the requests module:
//  - "Проект" is split by "+" into projects, each "К x Размер" (quantity x dimension)
//  - "Вид" is matched against the capability names of the machine mapping; a match sets the activity + Вид дейност,
//    otherwise "Вид" is kept as a free-text description (activity_subtype)
const MANDATORY_CAPABILITY_ACTIVITIES = ['Анкери', 'Армопакети', 'Профили', 'Торкрет'];

function parseRecordProjects(proektStr) {
    const projects = [];
    (proektStr || '').split('+').forEach(pStr => {
        const p = pStr.trim();
        if (!p) return;
        const partsX = p.split(/[xхXХ]/);
        const quantity = parseFloat((partsX[0] || '').replace(/,/g, '.')) || 0;
        const dimension = partsX.length >= 2 ? (parseFloat(partsX[1].replace(/,/g, '.')) || '') : '';
        projects.push({ quantity, dimension });
    });
    if (!projects.length) projects.push({ quantity: '', dimension: '' });
    return projects;
}

window.renderExtraProjects = function (projects) {
    const wrapper = document.getElementById('extra_projects_wrapper');
    const container = document.getElementById('extra_projects_container');
    if (!wrapper || !container) return;
    container.innerHTML = '';
    if (!projects || !projects.length) {
        wrapper.classList.add('d-none');
        return;
    }
    projects.forEach(pd => {
        const row = document.createElement('div');
        row.className = 'row g-3 extra-project-row mb-2 align-items-end border rounded p-2';
        row.innerHTML = `
            <div class="col-md-3"><label class="form-label small mb-1">Общо к-во</label>
                <input type="number" step="0.01" class="form-control form-control-sm extra-qty" value="${pd.quantity || ''}"></div>
            <div class="col-md-3"><label class="form-label small mb-1">Доп. размер (м)</label>
                <input type="number" step="0.01" class="form-control form-control-sm extra-dim" value="${pd.dimension || ''}"></div>
            <div class="col-md-3"><label class="form-label small mb-1">Дневен план</label>
                <input type="number" step="0.01" class="form-control form-control-sm extra-plan"></div>
            <div class="col-md-3"><label class="form-label small mb-1">Дни общо</label>
                <input type="number" step="0.01" class="form-control form-control-sm extra-days" readonly></div>`;
        const qty = row.querySelector('.extra-qty'), plan = row.querySelector('.extra-plan'), days = row.querySelector('.extra-days');
        const calc = () => {
            const q = parseFloat(qty.value) || 0, d = parseFloat(plan.value) || 0;
            days.value = q > 0 && d > 0 ? Math.ceil(q / d) : '';
            window.updateEndDateFromDays();
        };
        qty.addEventListener('input', calc);
        plan.addEventListener('input', calc);
        container.appendChild(row);
    });
    wrapper.classList.remove('d-none');
};

// End date = start date + the longest project (in working days), only for new schedules
window.updateEndDateFromDays = function () {
    const idEl = document.getElementById('schedule_id');
    if (!idEl || idEl.value !== '0') return;
    const startDate = (document.getElementById('start_date') || {}).value;
    let maxDays = parseFloat((document.getElementById('planned_days') || {}).value) || 0;
    document.querySelectorAll('.extra-days').forEach(i => { maxDays = Math.max(maxDays, parseFloat(i.value) || 0); });
    if (!startDate || maxDays <= 0) return;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php?action=calculate_end_date&start_date=${encodeURIComponent(startDate)}&days=${encodeURIComponent(Math.ceil(maxDays))}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.end_date) {
                const endEl = document.getElementById('end_date');
                if (endEl && endEl._flatpickr) endEl._flatpickr.setDate(data.end_date, false, 'd.m.Y');
                else if (endEl) endEl.value = data.end_date;
            }
        })
        .catch(err => console.error('Error calculating end date:', err));
};

window.selectRequestRecord = function (recordId) {
    const rec = (window.requestRecords || []).find(r => String(r.id) === String(recordId));
    if (!rec) return;

    clearRequestRecordSelection();
    const btn = document.querySelector(`#request_records_list [data-record-id="${recordId}"]`);
    if (btn) btn.classList.add('active');

    const vidName = (rec.vid || '').trim();
    const activitySelect = document.getElementById('activity_type_id');

    // Reset what a previous record may have filled
    if (window.tagifyCapability) window.tagifyCapability.removeAllTags();
    if (activitySelect) activitySelect.value = '';
    if (typeof window.syncActivityTagify === 'function') window.syncActivityTagify();

    // Activity + Вид дейност from the machine mapping (capability name == Вид)
    let freeSubtype = '';
    const match = vidName
        ? (window.machineActivitiesMapping || []).find(m => String(m.capability_name).toLowerCase() === vidName.toLowerCase())
        : null;
    if (match && activitySelect) {
        activitySelect.value = match.activity_type_id;
        activitySelect.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof window.syncActivityTagify === 'function') window.syncActivityTagify();
        if (typeof window.updateSubtypeOptions === 'function') window.updateSubtypeOptions();
        if (window.tagifyCapability) window.tagifyCapability.addTags([match.capability_name]);
    } else {
        freeSubtype = vidName;
        if (activitySelect) activitySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const subtypeEl = document.getElementById('activity_subtype');
    if (subtypeEl) subtypeEl.value = freeSubtype;

    // Projects: the first one fills the main fields, the rest become extra rows (saved as separate schedules)
    const projects = parseRecordProjects(rec.project);
    const first = projects.shift();
    setSafeValue('total_quantity', first.quantity || '');
    setSafeValue('dimension_info', first.dimension || '');
    setSafeValue('daily_productivity_plan', '');
    setSafeValue('planned_days', '');
    window.renderExtraProjects(projects);
};

// Function to reset the modal form
window.resetScheduleModal = function () {
    const form = document.getElementById('scheduleForm');
    if (!form) return;
    form.reset();

    // Reset Tagify values
    if (tagifyRequest) {
        tagifyRequest.setReadonly(false);
        tagifyRequest.removeAllTags();
    }

    // Reset visibility of locked fields
    const requestTagifyWrapper = document.getElementById('request_id_tagify_wrapper');
    const requestLockedWrapper = document.getElementById('request_id_locked_wrapper');
    if (requestTagifyWrapper) requestTagifyWrapper.classList.remove('d-none');
    if (requestLockedWrapper) requestLockedWrapper.classList.add('d-none');

    const activityWrapper = document.getElementById('activity_id_wrapper');
    const activityLockedWrapper = document.getElementById('activity_locked_wrapper');
    if (activityWrapper) activityWrapper.classList.remove('d-none');
    if (activityLockedWrapper) activityLockedWrapper.classList.add('d-none');

    const capabilityWrapper = document.getElementById('capability_id_wrapper');
    const capabilityLockedWrapper = document.getElementById('capability_locked_wrapper');
    if (capabilityWrapper) capabilityWrapper.classList.remove('d-none');
    if (capabilityLockedWrapper) capabilityLockedWrapper.classList.add('d-none');

    // Reset client Tagify
    if (tagifyClient) {
        tagifyClient.setReadonly(false);
        tagifyClient.removeAllTags();
    }

    // Reset capability Tagify
    if (window.tagifyCapability) {
        window.tagifyCapability.removeAllTags();
    }

    setSafeValue('schedule_id', '0');
    setSafeInnerText('scheduleModalLabel', 'Нов График');
    window.renderExtraProjects([]);
    const recPanel = document.getElementById('request_records_panel');
    if (recPanel) recPanel.classList.add('d-none');

    ['start_date', 'estimated_start_date', 'estimated_end_date', 'end_date'].forEach(id => {
        const fp = document.getElementById(id)?._flatpickr;
        if (fp) fp.clear();
    });

    // Hide and clear note fields
    ['note_quantity', 'note_plan', 'note_period', 'note_estimated_start', 'note_estimated_end', 'note_end', 'note_status'].forEach(id => {
        const el = document.getElementById(id);
        const container = document.getElementById(id + '_container');
        if (el) el.value = '';
        if (container) container.classList.add('d-none');
    });

    // Reset original values for note monitoring
    ['total_quantity', 'planned_days', 'start_date', 'estimated_start_date', 'estimated_end_date', 'end_date', 'status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('data-original-value', '');
    });

    if (typeof window.updateMachineOptions === 'function') window.updateMachineOptions();
    if (typeof window.updateActivityOptions === 'function') window.updateActivityOptions();
    if (typeof window.updateSubtypeOptions === 'function') window.updateSubtypeOptions();

    if (window.tagifyMachines) {
        window.tagifyMachines.removeAllTags();
    }

    const detailsContainer = document.getElementById('machine-details-container');
    if (detailsContainer) detailsContainer.innerHTML = '';
    window.currentMachineAssignments = [];
};

window.resetNewObjectModal = function () {
    const form = document.getElementById('newObjectForm');
    if (form) form.reset();

    if (tagifyNewRequest) {
        tagifyNewRequest.removeAllTags();
    }
};

window.openNewScheduleForObject = function (clientId, clientName, requestId, requestName) {
    resetScheduleModal();

    if (tagifyClient) {
        tagifyClient.addTags([{ value: clientName, id: clientId }]);
        tagifyClient.setReadonly(true);
    }

    if (tagifyRequest) {
        tagifyRequest.removeAllTags();
        tagifyRequest.addTags([{ value: requestName, id: requestId }]);
        tagifyRequest.setReadonly(true);

        // Hide tagify UI and show plain display
        const requestTagifyWrapper = document.getElementById('request_id_tagify_wrapper');
        const requestLockedWrapper = document.getElementById('request_id_locked_wrapper');
        const requestLockedDisplay = document.getElementById('request_id_locked_display');

        if (requestTagifyWrapper) requestTagifyWrapper.classList.add('d-none');
        if (requestLockedWrapper) requestLockedWrapper.classList.remove('d-none');
        if (requestLockedDisplay) requestLockedDisplay.value = requestName;
    }

    const modalEl = document.getElementById('scheduleModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
};

window.saveNewObject = function () {
    const form = document.getElementById('newObjectForm');
    if (!form) return;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const saveBtn = document.getElementById('saveNewObjectBtn');
    const originalBtnText = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Запазване...';
        saveBtn.disabled = true;
    }

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php`, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message, type: 'success' });
                }

                const modalEl = document.getElementById('newObjectModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    modal.hide();
                }

                const searchTerm = document.getElementById('search_schedule').value;
                loadSchedules(searchTerm);
            } else {
                safeAlert('Грешка', data.message || 'Възникна грешка.', 'error');
            }
        })
        .catch(error => {
            console.error('Error saving new object:', error);
            safeAlert('Грешка', 'Възникна мрежова грешка.', 'error');
        })
        .finally(() => {
            if (saveBtn) {
                saveBtn.innerHTML = originalBtnText;
                saveBtn.disabled = false;
            }
        });
};

// Function to render granular machine assignment rows
window.renderMachineAssignments = function () {
    const container = document.getElementById('machine-details-container');
    if (!container) return;

    container.innerHTML = '';
    const assignments = window.currentMachineAssignments || [];

    if (assignments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 bg-light-subtle rounded-3 border border-dashed">
                <i class="bi bi-info-circle text-muted d-block mb-2 fs-4"></i>
                <p class="text-muted small mb-0">Към тази дейност няма присъединени машини.</p>
            </div>
        `;
        return;
    }

    assignments.forEach((assign, index) => {
        const card = document.createElement('div');
        card.className = 'machine-assignment-card p-3 mb-3 border rounded-3 shadow-sm';
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-center">
                    <div class="machine-icon-circle me-3 bg-primary text-white d-flex align-items-center justify-content-center" style="width: 38px; height: 38px; border-radius: 10px;">
                        <i class="bi bi-truck fs-5"></i>
                    </div>
                    <div>
                        <h6 class="mb-0 fw-bold">${assign.machine_name}</h6>
                        <small class="text-muted x-small">${assign.id > 0 ? '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Активна</span>' : '<span class="text-warning"><i class="bi bi-clock-history me-1"></i>Прогнозна</span>'}</small>
                    </div>
                </div>
            </div>
            <div class="row g-3">
                <!-- From / Arrival Column -->
                <div class="col-md-4">
                    <div class="field-group-box h-100">
                        <small class="text-muted text-uppercase fw-bold x-small d-block mb-2 text-primary">Мобилизация</small>
                        <div class="mb-3">
                            <label class="form-label x-small mb-1 text-muted">Дата Пристигане</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="machine-start-date" 
                                    data-index="${index}" value="${assign.start_date || ''}" placeholder="дд.мм.гггг">
                            </div>
                        </div>
                        <div>
                            <label class="form-label x-small mb-1 text-muted">От (Обект/База)</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="machine-departure-from" 
                                    data-index="${index}" value="${assign.departure_from || ''}" placeholder="Текст или име">
                            </div>
                        </div>
                    </div>
                </div>
                <!-- To / Departure Column -->
                <div class="col-md-4">
                    <div class="field-group-box h-100">
                        <small class="text-muted text-uppercase fw-bold x-small d-block mb-2 text-success">Демобилизация</small>
                        <div class="mb-3">
                            <label class="form-label x-small mb-1 text-muted">Дата Заминаване</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="machine-end-date" 
                                    data-index="${index}" value="${assign.end_date || ''}" placeholder="дд.мм.гггг">
                            </div>
                        </div>
                        <div>
                            <label class="form-label x-small mb-1 text-muted">Към (Обект/База)</label>
                            <div class="tagify-styled-wrapper">
                                <input class="machine-to-site" 
                                    data-index="${index}" placeholder="Търси...">
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Logistics Column -->
                <div class="col-md-4">
                    <div class="field-group-box h-100">
                        <small class="text-muted text-uppercase fw-bold x-small d-block mb-2 text-info">Логистика и Бележки</small>
                        <div class="mb-3">
                            <label class="form-label x-small mb-1 text-muted">Превозвач</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="machine-carrier" 
                                    data-index="${index}" value="${assign.carrier || ''}" placeholder="Име">
                            </div>
                        </div>
                        <div>
                            <label class="form-label x-small mb-1 text-muted">Бележка</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="machine-notes" 
                                    data-index="${index}" value="${assign.notes || ''}" placeholder="Детайли...">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);

        // Init flatpickr (disabled/readonly as per request)
        flatpickr(card.querySelector('.machine-start-date'), {
            dateFormat: "d.m.Y",
            allowInput: false,
            clickOpens: false,
            locale: { firstDayOfWeek: 1 }
        });
        flatpickr(card.querySelector('.machine-end-date'), {
            dateFormat: "d.m.Y",
            allowInput: false,
            clickOpens: false,
            locale: { firstDayOfWeek: 1 }
        });

        // Add visual cues for disabled fields
        card.querySelectorAll('.machine-start-date, .machine-end-date, .machine-departure-from, .machine-carrier, .machine-notes').forEach(el => {
            el.readOnly = true;
            el.disabled = true;
            el.style.backgroundColor = 'var(--bs-secondary-bg)';
            el.style.cursor = 'not-allowed';
            const wrapper = el.closest('.tagify-styled-wrapper');
            if (wrapper) wrapper.style.opacity = '0.7';
        });


        // Listeners for text fields
        const depInput = card.querySelector('.machine-departure-from');
        if (depInput) {
            depInput.addEventListener('input', (e) => {
                window.currentMachineAssignments[index].departure_from = e.target.value;
            });
        }
        const carrInput = card.querySelector('.machine-carrier');
        if (carrInput) {
            carrInput.addEventListener('input', (e) => {
                window.currentMachineAssignments[index].carrier = e.target.value;
            });
        }
        const notesInput = card.querySelector('.machine-notes');
        if (notesInput) {
            notesInput.addEventListener('input', (e) => {
                window.currentMachineAssignments[index].notes = e.target.value;
            });
        }

        // Init Tagify for "To Site"
        const toSiteInput = card.querySelector('.machine-to-site');
        const tagify = new Tagify(toSiteInput, {
            mode: "select",
            whitelist: window.allSitesWhitelist || [],
            enforceWhitelist: true,
            dropdown: { enabled: 0, closeOnSelect: true }
        });

        // Set initial value if exists
        if (assign.to_site_id || assign.to_site_name) {
            tagify.addTags([{
                id: assign.to_site_id ? assign.to_site_id : "",
                value: assign.to_site_name ? assign.to_site_name : "База"
            }]);
        }

        tagify.setReadonly(true);
        const toSiteWrapper = toSiteInput.closest('.tagify-styled-wrapper');
        if (toSiteWrapper) toSiteWrapper.style.opacity = '0.7';

        tagify.on('change', (e) => {
            const val = e.detail.value;
            if (val) {
                const parsed = JSON.parse(val);
                if (parsed.length > 0) {
                    window.currentMachineAssignments[index].to_site_id = parsed[0].id;
                    window.currentMachineAssignments[index].to_site_name = parsed[0].value;
                }
            } else {
                window.currentMachineAssignments[index].to_site_id = null;
                window.currentMachineAssignments[index].to_site_name = null;
            }
        });
    });
};

window.removeMachineAssignment = function (index) {
    const assign = window.currentMachineAssignments[index];
    if (window.tagifyMachines) {
        // This will trigger the 'remove' event in Tagify, which we'll handle in core.js
        window.tagifyMachines.removeTags(assign.machine_name);
    } else {
        window.currentMachineAssignments.splice(index, 1);
        window.renderMachineAssignments();
    }
};


window.saveSchedule = function () {
    console.log('[Objects] saveSchedule triggered');
    const form = document.getElementById('scheduleForm');
    if (!form) {
        console.error('[Objects] scheduleForm not found!');
        return;
    }

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // The native activity select is hidden (Tagify is the visible control), so validate it manually
    const activityCheck = document.getElementById('activity_type_id');
    if (activityCheck && !activityCheck.value) {
        safeAlert('Внимание', 'Моля изберете дейност.', 'warning');
        return;
    }

    const clientSelect = document.getElementById('client_id');
    const wasClientDisabled = clientSelect ? clientSelect.disabled : false;
    if (wasClientDisabled && clientSelect) clientSelect.disabled = false;

    const formData = new FormData(form);

    // Collect granular machine assignments
    const assignments = window.currentMachineAssignments || [];
    formData.append('machine_assignments', JSON.stringify(assignments));

    let combinedVal = formData.get('capability_name') || '';
    if (typeof combinedVal === 'string' && combinedVal.startsWith('[') && combinedVal.endsWith(']')) {
        try {
            const parsed = JSON.parse(combinedVal);
            if (Array.isArray(parsed) && parsed.length > 0) {
                combinedVal = parsed[0].value;
            }
        } catch (e) {
            console.error("Error parsing capability_name tagify value", e);
        }
    }

    let capabilityPart = '';
    let subtypePart = '';
    if (typeof combinedVal === 'string' && combinedVal.includes(' — ')) {
        const parts = combinedVal.split(' — ');
        capabilityPart = parts[0].trim();
        subtypePart = parts[1].trim();
    } else if (typeof combinedVal === 'string') {
        capabilityPart = combinedVal.trim();
    }

    const isNewSchedule = String(formData.get('schedule_id')) === '0';
    if (isNewSchedule) {
        // Same rules as the requests module: only a capability from the machine mapping is saved as "Вид дейност",
        // anything else typed by hand is saved as a description (activity_subtype).
        const activityId = formData.get('activity_type_id');
        const activitySelect = document.getElementById('activity_type_id');
        const activityText = activitySelect && activitySelect.selectedIndex >= 0 ? activitySelect.options[activitySelect.selectedIndex].text : '';
        const known = new Set(window.getActivityMappingRows(activityId).map(m => m.capability_name));

        const capIsKnown = capabilityPart && known.has(capabilityPart);
        const mandatory = MANDATORY_CAPABILITY_ACTIVITIES.some(a => activityText.includes(a));
        if (mandatory && !capIsKnown) {
            safeAlert('Липсва Вид дейност', 'За избраната дейност е задължително да изберете стойност от падащото меню (бързи опции).', 'warning');
            if (wasClientDisabled && clientSelect) clientSelect.disabled = true;
            return;
        }
        if (capabilityPart && !capIsKnown) {
            subtypePart = [capabilityPart, subtypePart].filter(Boolean).join(', ');
            capabilityPart = '';
        }
    }
    // Free-text description typed (or filled from the inquiry record) in its own field
    const subtypeText = (formData.get('activity_subtype') || '').toString().trim();
    if (subtypeText && subtypeText !== subtypePart) {
        subtypePart = [subtypePart, subtypeText].filter(Boolean).join(', ');
    }
    formData.set('capability_name', capabilityPart);
    formData.set('activity_subtype', subtypePart);

    // Extra projects (new schedules only): each one is saved as its own schedule with the same shared data
    const extraProjects = isNewSchedule
        ? Array.from(document.querySelectorAll('.extra-project-row')).map(row => ({
            total_quantity: row.querySelector('.extra-qty').value,
            dimension_info: row.querySelector('.extra-dim').value,
            daily_productivity_plan: row.querySelector('.extra-plan').value,
            planned_days: row.querySelector('.extra-days').value
        })).filter(p => parseFloat(p.total_quantity) > 0)
        : [];

    if (wasClientDisabled && clientSelect) clientSelect.disabled = true;

    console.log('[Objects] saveSchedule triggered', {
        scheduleId: formData.get('schedule_id'),
        assignments: assignments
    });

    const saveBtn = document.getElementById('saveScheduleBtn');
    const originalBtnText = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Запазване...';
        saveBtn.disabled = true;
    }

    const postSchedule = (fd) => fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php`, {
        method: 'POST',
        body: fd
    }).then(response => response.json());

    const saveAll = async () => {
        const result = await postSchedule(formData);
        if (!result.success) return result;
        for (const proj of extraProjects) {
            const fd = new FormData();
            for (const [k, v] of formData.entries()) fd.append(k, v);
            Object.keys(proj).forEach(k => fd.set(k, proj[k]));
            const r = await postSchedule(fd);
            if (!r.success) return r;
        }
        if (extraProjects.length) result.message = `Добавени са ${extraProjects.length + 1} реда в графика.`;
        return result;
    };

    saveAll()
        .then(data => {
            if (data.success) {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message, type: 'success' });
                }

                const modalEl = document.getElementById('scheduleModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    modal.hide();
                }

                const searchTerm = document.getElementById('search_schedule').value;
                loadSchedules(searchTerm);
            } else {
                if (data.missing_fields && data.missing_fields.length > 0) {
                    data.missing_fields.forEach(field => {
                        const container = document.getElementById(field + '_container');
                        if (container) {
                            container.classList.remove('d-none');
                            const input = container.querySelector('input');
                            if (input) input.classList.add('is-invalid');
                        }
                    });
                }
                safeAlert('Грешка', data.message || 'Възникна грешка при запазване.', 'error');
            }
        })
        .catch(error => {
            console.error('Error saving schedule:', error);
            safeAlert('Грешка', 'Възникна мрежова грешка при запазване.', 'error');
        })
        .finally(() => {
            if (saveBtn) {
                saveBtn.innerHTML = originalBtnText;
                saveBtn.disabled = false;
            }
        });
}

// Function to fetch and open the modal for editing
window.editSchedule = function (scheduleId) {
    const btn = document.querySelector(`button[onclick = "editSchedule(${scheduleId})"]`);
    const originalIcon = btn ? btn.innerHTML : '<i class="bi bi-pencil"></i>';
    if (btn) {
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        btn.disabled = true;
    }

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php?action=get_schedule&schedule_id=${scheduleId}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success) {
                resetScheduleModal();
                const schedule = data.data;

                try {
                    setSafeValue('schedule_id', schedule.schedule_id);

                    const formatDateDisplay = (dateStr) => {
                        if (!dateStr || dateStr === '0000-00-00') return '';
                        const parts = dateStr.split('-');
                        if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
                        return dateStr;
                    };

                    const fpMap = {
                        'start_date': schedule.start_date,
                        'end_date': schedule.end_date
                    };

                    Object.keys(fpMap).forEach(id => {
                        const el = document.getElementById(id);
                        const fp = el ? el._flatpickr : null;
                        if (fp && fpMap[id]) fp.setDate(formatDateDisplay(fpMap[id]));
                    });

                    if (tagifyClient && schedule.client_id && schedule.client_name) {
                        tagifyClient.addTags([{ value: schedule.client_name, id: schedule.client_id }]);
                    }

                    setSafeValue('activity_type_id', schedule.activity_type_id);
                    if (typeof window.syncActivityTagify === 'function') window.syncActivityTagify();

                    // Populate Granular Machine Assignments
                    window.currentMachineAssignments = [];
                    if (schedule.assigned_machines) {
                        const lines = schedule.assigned_machines.split('||');
                        lines.forEach(line => {
                            const [id, m_id, name, start, end, to_site_id, to_site_name, carrier, movement_id, departure_from, notes] = line.split(':');

                            const formatInputDate = (d) => {
                                if (!d || d === '0000-00-00') return '';
                                const p = d.split('-');
                                return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
                            };

                            window.currentMachineAssignments.push({
                                id: id,
                                machine_id: m_id,
                                machine_name: name,
                                start_date: formatInputDate(start),
                                end_date: formatInputDate(end),
                                to_site_id: to_site_id || null,
                                to_site_name: to_site_name || null,
                                carrier: carrier || '',
                                movement_id: movement_id || null,
                                departure_from: departure_from || '',
                                notes: notes || ''
                            });
                        });
                    }

                    // Sync Tagify tags
                    if (window.tagifyMachines) {
                        window.tagifyMachines.removeAllTags();
                        const tags = window.currentMachineAssignments.map(a => ({ id: a.machine_id, value: a.machine_name }));
                        window.tagifyMachines.addTags(tags);
                    }

                    window.renderMachineAssignments();

                    if (typeof window.updateActivityOptions === 'function') window.updateActivityOptions();

                    let combinedText = schedule.capability_name || '';
                    if (schedule.activity_subtype) {
                        combinedText += (combinedText ? ' — ' : '') + schedule.activity_subtype;
                    }

                    if (window.tagifyCapability) {
                        window.tagifyCapability.removeAllTags();
                        if (combinedText) window.tagifyCapability.addTags([combinedText]);
                    } else {
                        setSafeValue('capability_name', combinedText);
                    }

                    setSafeValue('activity_subtype', schedule.activity_subtype);

                    if (typeof window.updateSubtypeOptions === 'function') window.updateSubtypeOptions();

                    setSafeValue('total_quantity', schedule.total_quantity);
                    setSafeValue('dimension_info', schedule.dimension_info);
                    setSafeValue('daily_productivity_plan', schedule.daily_productivity_plan);
                    setSafeValue('planned_days', schedule.planned_days);
                    setSafeValue('status', schedule.status);

                    // Set original values for note monitoring
                    ['total_quantity', 'planned_days', 'status'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.setAttribute('data-original-value', el.value);
                    });
                    ['start_date', 'estimated_start_date', 'estimated_end_date', 'end_date'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            const val = fpMap[id] ? formatDateDisplay(fpMap[id]) : '';
                            el.setAttribute('data-original-value', val);
                        }
                    });

                    if (tagifyRequest && schedule.request_id) {
                        tagifyRequest.removeAllTags();
                        tagifyRequest.addTags([{ value: schedule.обект_име, id: schedule.request_id }]);
                        tagifyRequest.setReadonly(true);

                        // Hide tagify UI and show plain display
                        const requestTagifyWrapper = document.getElementById('request_id_tagify_wrapper');
                        const requestLockedWrapper = document.getElementById('request_id_locked_wrapper');
                        const requestLockedDisplay = document.getElementById('request_id_locked_display');

                        if (requestTagifyWrapper) requestTagifyWrapper.classList.add('d-none');
                        if (requestLockedWrapper) requestLockedWrapper.classList.remove('d-none');
                        if (requestLockedDisplay) requestLockedDisplay.value = schedule.обект_име;
                    }

                    // Lock Activity and Capability
                    const activityWrapper = document.getElementById('activity_id_wrapper');
                    const activityLockedWrapper = document.getElementById('activity_locked_wrapper');
                    const activityLockedDisplay = document.getElementById('activity_locked_display');
                    if (activityWrapper && activityLockedWrapper && activityLockedDisplay) {
                        activityWrapper.classList.add('d-none');
                        activityLockedWrapper.classList.remove('d-none');
                        // Find the activity name from the select options (or data)
                        const activitySelect = document.getElementById('activity_type_id');
                        activityLockedDisplay.value = activitySelect.options[activitySelect.selectedIndex]?.text || schedule.activity_name || '';
                    }

                    const capabilityWrapper = document.getElementById('capability_id_wrapper');
                    const capabilityLockedWrapper = document.getElementById('capability_locked_wrapper');
                    const capabilityLockedDisplay = document.getElementById('capability_locked_display');
                    if (capabilityWrapper && capabilityLockedWrapper && capabilityLockedDisplay) {
                        capabilityWrapper.classList.add('d-none');
                        capabilityLockedWrapper.classList.remove('d-none');
                        capabilityLockedDisplay.value = combinedText || '';
                    }

                    setSafeInnerText('scheduleModalLabel', 'Редактирай График');

                    const modalEl = document.getElementById('scheduleModal');
                    if (modalEl) {
                        const modal = new bootstrap.Modal(modalEl);
                        modal.show();
                    }
                } catch (elementError) {
                    console.error('Error during modal population:', elementError);
                    safeAlert('Грешка', `Възникна грешка при зареждане на данните в полетата: ${elementError.message}`, 'error');
                }
            } else {
                safeAlert('Грешка', data.message || 'Не беше намерено.', 'error');
            }
        })
        .catch(error => {
            console.error('Error fetching details:', error);
            safeAlert('Грешка', `Възникна мрежова грешка при зареждане детайлите.\nГрешка: ${error.message}`, 'error');
        })
        .finally(() => {
            if (btn) {
                btn.innerHTML = originalIcon;
                btn.disabled = false;
            }
        });
};

// Function to delete
window.deleteSchedule = function (scheduleId) {
    const confirmModal = document.getElementById('confirmationModal');
    const confirmText = document.getElementById('confirmationModalBody');
    const confirmBtn = document.getElementById('btn-confirm-action');

    if (confirmModal && confirmText && confirmBtn) {
        confirmText.innerText = "Сигурни ли сте? Тази операция е необратима. Записът ще бъде изтрит!";

        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        const modalInstance = new bootstrap.Modal(confirmModal);

        newConfirmBtn.addEventListener('click', function () {
            modalInstance.hide();

            const formData = new FormData();
            formData.append('action', 'delete_schedule');
            formData.append('schedule_id', scheduleId);

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php`, {
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
                        const searchTerm = document.getElementById('search_schedule').value;
                        loadSchedules(searchTerm);
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
            formData.append('action', 'delete_schedule');
            formData.append('schedule_id', scheduleId);

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php`, {
                method: 'POST',
                body: formData
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const searchTerm = document.getElementById('search_schedule').value;
                        loadSchedules(searchTerm);
                    }
                });
        }
    }
};

// Function to open Change Client Modal
window.openChangeClientModal = function (clientId, clientName, requestId, objectName) {
    const form = document.getElementById('changeClientForm');
    if (form) form.reset();

    const requestInput = document.getElementById('change_client_request_id');
    if (requestInput) {
        requestInput.value = requestId;
    }

    const objectNameSpan = document.getElementById('changeClientObjectName');
    if (objectNameSpan) {
        objectNameSpan.innerText = objectName;
    }

    if (tagifyChangeClient) {
        tagifyChangeClient.removeAllTags();
        if (clientId && clientName) {
            tagifyChangeClient.addTags([{ value: clientName, id: clientId }]);
        }
    }

    const modalEl = document.getElementById('changeClientModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

// Function to save Object Client change
window.saveChangeClient = function () {
    const form = document.getElementById('changeClientForm');

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);

    const saveBtn = document.getElementById('saveChangeClientBtn');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Запазване...';
    saveBtn.disabled = true;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php`, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message, type: 'success' });
                }

                const modalEl = document.getElementById('changeClientModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();

                const searchTerm = document.getElementById('search_schedule').value;
                loadSchedules(searchTerm);
            } else {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message || 'Възникна грешка.', type: 'error' });
                } else {
                    alert(data.message || 'Възникна грешка.');
                }
            }
        })
        .catch(error => {
            console.error('Error saving change client:', error);
            if (typeof showToast === 'function') {
                showToast({ message: 'Възникна мрежова грешка.', type: 'error' });
            }
        })
        .finally(() => {
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
        });
};

