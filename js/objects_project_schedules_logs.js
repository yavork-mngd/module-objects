// /modules/objects/js/objects_project_schedules_logs.js
// Refactored from objects_project_schedules.js

// --- LOGS FUNCTIONALITY ---

window.openLogsModal = function (scheduleId, contextText) {
    document.getElementById('log_schedule_id').value = scheduleId;
    document.getElementById('logContextAlert').innerText = `График: ${contextText} `;

    // Default to today
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const today = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];

    // Check if flatpickr is already initialized on work_date, if not initialize it
    let dateInput = document.getElementById('work_date');
    if (!dateInput._flatpickr) {
        flatpickr(dateInput, {
            dateFormat: "Y-m-d",         // Hidden format for database
            altInput: true,              // Creates a secondary visible input
            altFormat: "d.m.Y",          // Visible format to the user
            defaultDate: today,
            allowInput: true,
            locale: { firstDayOfWeek: 1 }
        });
    } else {
        dateInput._flatpickr.setDate(today);
    }

    document.getElementById('quantity_completed').value = '';
    document.getElementById('log_notes').value = '';

    loadLogs(scheduleId);

    const modalEl = document.getElementById('progressLogsModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
};

function loadLogs(scheduleId) {
    const tableBody = document.getElementById('logsTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Зареждане...</td></tr>`;

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php?action=get_logs&schedule_id=${scheduleId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderLogsTable(data.data);
            } else {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Възникна грешка при зареждане.</td></tr>`;
            }
        })
        .catch(error => {
            console.error('Error fetching logs:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Възникна грешка при зареждане.</td></tr>`;
        });
}

function renderLogsTable(logs) {
    const tableBody = document.getElementById('logsTableBody');
    tableBody.innerHTML = '';

    if (logs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Няма въведени отчети.</td></tr>`;
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
                    <td>${formatDateDisplay(log.work_date)}</td>
            <td class="fw-bold text-success">+${log.quantity_completed}</td>
            <td>${escapeHtml(log.notes)}</td>
            <td class="small text-muted">${escapeHtml(log.updated_by_name)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteLog(${log.log_id})" title="Изтрий отчет">
                    <i class="bi bi-x"></i>
                </button>
            </td>
                `;
        tableBody.appendChild(tr);
    });
}

window.saveLog = function () {
    const form = document.getElementById('logForm');

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const quantity = parseFloat(document.getElementById('quantity_completed').value || 0);
    const notes = document.getElementById('log_notes').value.trim();

    if (quantity === 0 && !notes) {
        if (typeof showToast === 'function') {
            showToast({ message: 'При количество 0 е задължително да въведете бележка.', type: 'error' });
        } else {
            alert('При количество 0 е задължително да въведете бележка.');
        }
        return;
    }

    const formData = new FormData(form);
    const scheduleId = document.getElementById('log_schedule_id').value;

    const btn = document.getElementById('saveLogBtn');
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    btn.disabled = true;

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

                // Refresh logs list inside modal
                loadLogs(scheduleId);

                // Reset inputs
                document.getElementById('quantity_completed').value = '';
                document.getElementById('log_notes').value = '';

                // Important: Also refresh the main schedules table to see the updated progress bar!
                const searchTerm = document.getElementById('search_schedule').value || '';
                loadSchedules(searchTerm);
            } else {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message || 'Грешка', type: 'error' });
                } else {
                    alert(data.message || 'Грешка');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
        })
        .finally(() => {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        });
}

window.deleteLog = function (logId) {
    const confirmModal = document.getElementById('confirmationModal');
    const confirmText = document.getElementById('confirmationModalBody');
    const confirmBtn = document.getElementById('btn-confirm-action');

    if (confirmModal && confirmText && confirmBtn) {
        confirmText.innerText = "Сигурни ли сте, че искате да изтриете този отчет?";

        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        const modalInstance = bootstrap.Modal.getInstance(confirmModal) || new bootstrap.Modal(confirmModal);

        newConfirmBtn.addEventListener('click', function () {
            modalInstance.hide();
            executeDeleteLog(logId);
        });
        modalInstance.show();
    } else {
        if (confirm("Сигурни ли сте, че искате да изтриете този отчет?")) {
            executeDeleteLog(logId);
        }
    }
}

function executeDeleteLog(logId) {
    const formData = new FormData();
    formData.append('action', 'delete_log');
    formData.append('log_id', logId);

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
                const scheduleId = document.getElementById('log_schedule_id').value;
                loadLogs(scheduleId);

                const searchTerm = document.getElementById('search_schedule').value || '';
                loadSchedules(searchTerm);
            } else {
                if (typeof showToast === 'function') {
                    showToast({ message: data.message || 'Грешка при изтриване', type: 'error' });
                } else {
                    alert(data.message || 'Грешка при изтриване');
                }
            }
        })
        .catch(error => console.error('Error:', error));
}
