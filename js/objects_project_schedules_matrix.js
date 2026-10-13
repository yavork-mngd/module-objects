// /modules/objects/js/objects_project_schedules_matrix.js
// Refactored from objects_project_schedules.js

// ==========================================
// Object Matrix (Calendar) Logic
// ==========================================

var currentMatrixRequestId = null;

function openObjectMatrix(requestId, objectName) {
    currentMatrixRequestId = requestId;
    document.getElementById('matrixObjectName').textContent = objectName;

    // Default to current month if picker is empty
    const monthPicker = document.getElementById('matrixMonthPicker');
    if (!monthPicker.value) {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        monthPicker.value = `${now.getFullYear()}-${mm}`;
    }

    loadObjectMatrix(requestId, monthPicker.value);

    const matrixModal = new bootstrap.Modal(document.getElementById('objectMatrixModal'));
    matrixModal.show();
}

window.initProjectSchedulesMatrix = function () {
    const monthPicker = document.getElementById('matrixMonthPicker');
    if (monthPicker) {
        // Remove existing listener if any (though in AJAX load the element is new)
        const newMonthPicker = monthPicker.cloneNode(true);
        monthPicker.parentNode.replaceChild(newMonthPicker, monthPicker);

        newMonthPicker.addEventListener('change', function () {
            if (currentMatrixRequestId) {
                loadObjectMatrix(currentMatrixRequestId, this.value);
            }
        });
    }

    const quickLogForm = document.getElementById('quickLogForm');
    if (quickLogForm) {
        const newQuickLogForm = quickLogForm.cloneNode(true);
        quickLogForm.parentNode.replaceChild(newQuickLogForm, quickLogForm);

        newQuickLogForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const quantity = parseFloat(document.getElementById('quick_quantity').value || 0);
            const notes = document.getElementById('quick_notes').value.trim();

            if (quantity === 0 && !notes) {
                if (typeof showToast === 'function') {
                    showToast({ message: 'При количество 0 е задължително да въведете бележка.', type: 'error' });
                } else {
                    alert('При количество 0 е задължително да въведете бележка.');
                }
                return;
            }

            const formData = new FormData(this);
            formData.append('action', 'save_log');

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Запис...';
            submitBtn.disabled = true;

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

                        // Close quick log modal
                        const quickModalEl = document.getElementById('quickLogModal');
                        const quickModal = bootstrap.Modal.getInstance(quickModalEl);
                        if (quickModal) quickModal.hide();

                        // Reload matrix
                        const monthVal = document.getElementById('matrixMonthPicker').value;
                        loadObjectMatrix(currentMatrixRequestId, monthVal);

                        // Reload table below 
                        const searchTerm = document.getElementById('search_schedule').value;
                        loadSchedules(searchTerm || '');

                    } else {
                        alert(data.message || 'Възникна грешка при запазване.');
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert('Възникна грешка при връзката със сървъра.');
                })
                .finally(() => {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                });
        });
    }
};

function loadObjectMatrix(requestId, yearMonth) {
    const tableContainer = document.getElementById('matrixTable');
    tableContainer.innerHTML = '<tr><td class="text-center p-4">Зареждане...</td></tr>';

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php?action=get_object_matrix&request_id=${requestId}&month=${yearMonth}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderMatrixTable(data.days, data.schedules, data.logs);
            } else {
                tableContainer.innerHTML = `<tr><td class="text-danger text-center p-4">${data.message || 'Грешка при зареждане'}</td></tr>`;
            }
        })
        .catch(err => {
            console.error(err);
            tableContainer.innerHTML = '<tr><td class="text-danger text-center p-4">Възникна грешка при връзката със сървъра.</td></tr>';
        });
}

function renderMatrixTable(days, schedules, logsMap) {
    const table = document.getElementById('matrixTable');
    if (schedules.length === 0) {
        table.innerHTML = '<tr><td class="text-center p-4 text-muted">Няма активни графици за този обект.</td></tr>';
        return;
    }

    // Header
    let thead = `<thead class="table-glass sticky-top" style="z-index: 10;"> <tr>`;
    thead += `<th style="min-width: 150px; max-width: 200px;" class="text-start position-sticky start-0 bg-white shadow-sm" style="z-index: 11;">Дейност</th>`;
    thead += `<th style="min-width: 60px;" class="text-center align-middle bg-light">Мярка</th>`;
    thead += `<th style="min-width: 70px;" class="text-center align-middle bg-light">Общо</th>`;

    days.forEach(d => {
        const isWeekend = d.weekend == 1;
        const bgClass = isWeekend ? 'bg-secondary-subtle text-danger' : '';
        thead += `<th class="text-center ${bgClass} px-0 border-start" style="min-width: 38px; font-size: 0.75rem;" title="${d.fulldate}">
                    <div class="fw-normal mb-1 small">${d.day_name.substring(0, 2)}</div>
                    <div class="fw-bold">${d.day}</div>
                </th>`;
    });
    thead += `</tr></thead>`;

    // Body
    let tbody = `<tbody>`;
    schedules.forEach(sched => {
        let tr = `<tr class="hover-elevate-sm">`;

        // Activity Name (Sticky)
        tr += `<td class="text-start position-sticky start-0 bg-white shadow-sm pe-2" style="z-index: 5;">
            <div class="fw-bold text-dark text-truncate" title="${escapeHtml(sched.activity_name)}">${escapeHtml(sched.activity_name)}</div>
            <div class="text-body small text-truncate">
                ${sched.capability_name ? escapeHtml(sched.capability_name) : ''}
                ${sched.activity_subtype ? (sched.capability_name ? ' — ' : '') + `<span class="text-muted">${escapeHtml(sched.activity_subtype)}</span>` : (sched.capability_name ? '' : '-')}
            </div>
            <div class="badge bg-primary mt-1" title="Дневен План: ${sched.daily_productivity_plan}"><i class="bi bi-graph-up me-1"></i>${sched.daily_productivity_plan} / ден</div>
        </td>`;

        // Unit
        tr += `<td class="text-center align-middle bg-white border-end">
            <span class="fw-semibold">${escapeHtml(sched.unit_of_measure)}</span>
        </td>`;

        // Total
        let totalCompleted = parseFloat(sched.total_completed) || 0;
        let totalQty = parseFloat(sched.total_quantity) || 0;
        let progressColor = totalCompleted >= totalQty ? 'text-success' : 'text-primary';
        tr += `<td class="text-center align-middle shadow-sm bg-white border-end">
            <div class="fw-bold ${progressColor}">${totalCompleted}</div>
            <div class="small text-muted border-top pt-1 mt-1">
                от ${totalQty}
                ${sched.dimension_info ? `<div class="mt-1 pb-1" style="font-size: 0.7rem; color: var(--bs-gray-600); line-height: 1;">Размер: ${sched.dimension_info}</div>` : ''}
            </div>
        </td>`;

        // Days Matcher
        days.forEach(d => {
            const isWeekend = d.weekend == 1;
            const bgClass = isWeekend ? 'bg-light' : '';
            const scheduleLogs = logsMap[sched.schedule_id] || {};
            const dayLog = scheduleLogs[d.fulldate];

            if (dayLog) {
                // Has logs
                let tooltipContent = '';
                if (dayLog.notes && dayLog.notes.length > 0) {
                    tooltipContent = dayLog.notes.map(n => `<b>${escapeHtml(n.user)}:</b> ${escapeHtml(n.text)}`).join('<br>');
                } else {
                    tooltipContent = 'Няма бележки';
                }

                // Color logic
                let plan = parseFloat(sched.daily_productivity_plan) || 0;
                let badgeClass = 'bg-success';
                if (plan > 0 && dayLog.quantity < plan) {
                    badgeClass = 'bg-danger';
                }

                tr += `<td class="text-center align-middle border-start border-end ${bgClass} position-relative"
        onclick="openQuickLogModal(${sched.schedule_id}, '${d.fulldate}', '${escapeHtml(sched.activity_name)}')"
        style="cursor: pointer;" onmouseover="this.style.backgroundColor='#e9ecef'" onmouseout="this.style.backgroundColor=''">
            <div class="badge ${badgeClass} w-100 py-1 shadow-sm" style="cursor: pointer; font-size: 0.8rem;"
                data-bs-toggle="tooltip" data-bs-html="true" data-bs-placement="top" title="${tooltipContent}">
                ${dayLog.quantity}
            </div>
                    </td>`;
            } else {
                // Empty cell
                tr += `<td class="text-center align-middle border-start border-end ${bgClass} position-relative text-black-50"
        onclick="openQuickLogModal(${sched.schedule_id}, '${d.fulldate}', '${escapeHtml(sched.activity_name)}')"
        style="cursor: pointer;" onmouseover="this.querySelector('i').style.opacity='1'; this.style.backgroundColor='#e9ecef'" onmouseout="this.querySelector('i').style.opacity='0'; this.style.backgroundColor=''">
            <i class="bi bi-plus text-primary fs-5" style="opacity: 0; transition: 0.2s;"></i>
                    </td>`;
            }
        });

        tr += `</tr > `;
        tbody += tr;
    });
    tbody += `</tbody>`;

    table.innerHTML = thead + tbody;

    // Initialize tooltips
    const popoverTriggerList = [].slice.call(table.querySelectorAll('[data-bs-toggle="tooltip"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Tooltip(popoverTriggerEl);
    });
}

function openQuickLogModal(scheduleId, fullDate, activityName) {
    document.getElementById('quick_schedule_id').value = scheduleId;
    document.getElementById('quick_work_date').value = fullDate;
    document.getElementById('quickActivityName').textContent = activityName;

    // Format date specifically like DD.MM.YYYY
    const parts = fullDate.split('-');
    const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    document.getElementById('quickDateDisplay').textContent = `Ден: ${formattedDate}`;

    document.getElementById('quick_quantity').value = '';
    document.getElementById('quick_notes').value = '';

    const quickModal = new bootstrap.Modal(document.getElementById('quickLogModal'));
    quickModal.show();
}

// Logic moved to window.initProjectSchedulesMatrix

// Auto-init if on the correct page (for hard refreshes)
if (document.getElementById('schedule-search-form')) {
    window.initProjectSchedulesMatrix();
}
