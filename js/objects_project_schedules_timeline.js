// /modules/objects/js/objects_project_schedules_timeline.js
// Refactored from objects_project_schedules.js

// --- NOTES & TIMELINE FUNCTIONALITY ---

window.toggleNoteField = function (containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.classList.toggle('d-none');
        if (!container.classList.contains('d-none')) {
            container.querySelector('input').focus();
        } else {
            container.querySelector('input').value = '';
        }
    }
}

window.openTimelineModal = function (scheduleId, contextText) {
    document.getElementById('timelineContextAlert').innerText = `График: ${contextText} `;

    const container = document.getElementById('timelineContainer');
    container.innerHTML = `<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>Зареждане...</div>`;

    const modalEl = document.getElementById('timelineModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules_api.php?action=get_schedule_timeline&schedule_id=${scheduleId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderTimeline(data.data);
            } else {
                container.innerHTML = `<div class="text-center text-danger py-4">Възникна грешка при зареждане.</div>`;
            }
        })
        .catch(error => {
            console.error('Error fetching timeline:', error);
            container.innerHTML = `<div class="text-center text-danger py-4">Възникна грешка при зареждане.</div>`;
        });
}

function renderTimeline(timelineItems) {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';

    if (!timelineItems || timelineItems.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-4">Няма въведени бележки или отчети.</div>`;
        return;
    }

    timelineItems.forEach(item => {
        const div = document.createElement('div');
        div.className = `timeline-item category-${item.category}`;

        let formattedDate = '-';
        if (item.timestamp) {
            const dateStr = item.timestamp.replace(' ', 'T');
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj)) {
                if (item.timestamp.endsWith('12:00:00') && item.category === 'progress') {
                    formattedDate = dateObj.toLocaleDateString('bg-BG');
                } else {
                    formattedDate = dateObj.toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                }
            } else {
                formattedDate = formatDateDisplay(item.timestamp);
            }
        }

        let categoryLabel = '';
        switch (item.category) {
            case 'quantity': categoryLabel = 'Общо к-во'; break;
            case 'plan': categoryLabel = 'Дни общо'; break;
            case 'period': categoryLabel = 'Начална дата'; break;
            case 'estimated_start': categoryLabel = 'Прогнозна начална'; break;
            case 'estimated_end': categoryLabel = 'Прогнозна крайна'; break;
            case 'end': categoryLabel = 'Крайна дата'; break;
            case 'status': categoryLabel = 'Статус'; break;
            case 'progress': categoryLabel = 'Ежедневен отчет'; break;
            default: categoryLabel = item.category;
        }

        let content = item.content || '';
        let valueAdded = '';

        if (item.category !== 'progress') {
            const matchOldNew = content.match(/^VAL::(.*)::OLD::(.*)::VAL(.*)$/s);
            if (matchOldNew) {
                let newVal = matchOldNew[1].trim();
                let oldVal = matchOldNew[2].trim();

                if (['period', 'estimated_start', 'estimated_end', 'end'].includes(item.category)) {
                    if (newVal) newVal = formatDateDisplay(newVal);
                    if (oldVal) oldVal = formatDateDisplay(oldVal);
                }

                newVal = escapeHtml(newVal);
                oldVal = escapeHtml(oldVal);

                if (oldVal && oldVal !== newVal && oldVal !== '-') {
                    valueAdded = ` - <span class="text-muted text-decoration-line-through">${oldVal}</span> <i class="bi bi-arrow-right text-muted mx-1"></i> <span class="text-primary">${newVal}</span>`;
                } else if (newVal && newVal !== '-') {
                    valueAdded = ` - <span class="text-primary">${newVal}</span>`;
                }

                content = matchOldNew[3].trim();
            } else {
                // Backward compatibility for old notes
                const matchOld = content.match(/^VAL::(.*)::VAL(.*)$/s);
                if (matchOld) {
                    let val = matchOld[1].trim();
                    if (['period', 'estimated_start', 'estimated_end', 'end'].includes(item.category)) {
                        val = formatDateDisplay(val);
                    }
                    valueAdded = ` - <span class="text-primary">${escapeHtml(val)}</span>`;
                    content = matchOld[2].trim();
                }
            }
        }

        div.innerHTML = `
            <div class="mb-1" style="font-size: 0.95rem; color: var(--bs-gray-700);">${formattedDate} • <strong>${categoryLabel}</strong>${valueAdded}</div>
            <div class="timeline-content text-break mt-1">
                ${escapeHtml(content)}

                <div class="timeline-user">- ${escapeHtml(item.user_name || 'Система')}</div>
            </div>
        `;
        container.appendChild(div);
    });
}
