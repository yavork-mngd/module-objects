/**
 * planning_ui.js
 * Rendering and UI state management for the Machine Planning module.
 */

const EXCAVATOR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;"><path d="M3 15h18M5 15l1-6h6l1 6M13 9l6-4h2M13 9l-1 3M16 11l-2 4" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>`;

function renderMachineInfoCard(machineName, capabilities, currentLocation, unplannedQueue = [], machineId) {
    const card = document.getElementById('machineInfoCard');
    const locationEl = document.getElementById('machineInfoLocation');
    const nameEl = card ? card.querySelector('.text-gradient') : null;

    if (!card || !locationEl) return;

    if (nameEl) {
        let displayId = machineId ? ` (#${machineId})` : '';
        nameEl.innerHTML = `<i class="bi bi-truck me-2"></i>${escapeHtml(machineName)}${displayId}`;
    }

    locationEl.innerHTML = `<i class="bi bi-geo-alt me-1"></i>Текущо: <strong>${escapeHtml(currentLocation)}</strong>`;

    // Add Unplanned Queue (Waitlist) Section (#14)
    const queueWrapper = document.getElementById('machineInfoQueueWrapper');
    const queueEl = document.getElementById('machineInfoQueue');
    if (queueWrapper && queueEl) {
        if (unplannedQueue.length === 0) {
            queueWrapper.classList.add('d-none');
        } else {
            let qHtml = '';
            unplannedQueue.forEach(q => {
                qHtml += `
                    <div class="p-2 border rounded bg-body-tertiary shadow-sm" style="font-size: 0.82rem; border-left: 4px solid var(--bs-warning) !important;">
                        <div class="fw-bold">${escapeHtml(q.object_name)}</div>
                        <div class="d-flex justify-content-between text-muted mt-1" style="font-size: 0.75rem;">
                            <span><i class="bi bi-gear-wide-connected me-1"></i>${escapeHtml(q.activity_name)}</span>
                            <span>${escapeHtml(q.activity_subtype || '-')}</span>
                        </div>
                    </div>`;
            });
            queueEl.innerHTML = qHtml;
            queueWrapper.classList.remove('d-none');
        }
    }

    card.classList.remove('d-none');
}

function hideMachineInfoCard() {
    const card = document.getElementById('machineInfoCard');
    if (card) card.classList.add('d-none');
}



/**
 * Returns status-specific styling information
 * @param {object} item 
 */
function getStatusInfo(item) {
    const data = item.data || item;

    if (item.type === 'movement' || data.status === '__travel__') {
        return { class: 'status-badge-movement', icon: 'bi-truck', label: 'Мобилизация', popoverBadgeClass: 'bg-warning-subtle text-warning-emphasis' };
    }

    if (item.type === 'estimate') {
        return { class: 'status-forecast-bg', icon: 'bi-graph-up-arrow', label: 'Прогноза', popoverBadgeClass: 'pop-badge-forecast' };
    }

    let status = (data.status || '').toLowerCase().trim();
    if (!status) return { class: 'status-upcoming-bg', icon: 'bi-calendar-week', label: 'Мобилизация', popoverBadgeClass: 'pop-badge-planned' };

    // Standard Mapping with .includes for robustness
    if (status.includes('прик') || status.includes('завърш') || status.includes('completed'))
        return { class: 'status-completed-bg', icon: 'bi-check2-square', label: 'Приключен', popoverBadgeClass: 'pop-badge-completed' };

    if ((status.includes('актив') || status.includes('старт') || status.includes('започнал')) && !status.includes('не'))
        return { class: 'status-active-bg', svg: EXCAVATOR_SVG, label: 'Активен', popoverBadgeClass: 'pop-badge-active' };

    if (status.includes('пауза') || status.includes('пауз'))
        return { class: 'status-paused-bg', icon: 'bi-pause-fill', label: 'В пауза', popoverBadgeClass: 'bg-secondary-subtle text-secondary-emphasis' };

    if (status.includes('пробл') || status.includes('спрян'))
        return { class: 'status-problem-bg', icon: 'bi-exclamation-triangle-fill', label: 'Проблем', popoverBadgeClass: 'pop-badge-problem' };

    if (status.includes('прог') || status.includes('fore'))
        return { class: 'status-forecast-bg', icon: 'bi-graph-up-arrow', label: 'Прогноза', popoverBadgeClass: 'pop-badge-forecast' };

    if (status.includes('планиран') || status.includes('upcoming') || status.includes('не старт'))
        return { class: 'status-upcoming-bg', icon: 'bi-calendar2-week', label: 'Мобилизиран', popoverBadgeClass: 'pop-badge-planned' };

    return { class: 'status-upcoming-bg', icon: 'bi-calendar-week', label: 'Мобилизиран', popoverBadgeClass: 'pop-badge-planned' };
}

/**
 * Generate rich HTML content for the day's popover card
 */
function generatePopoverHtml(activeLocs, activeEsts, dayMovements, currentDayStr) {
    const popoverItems = [];
    const objectsSeen = new Set();
    const normalize = (val) => (val || '').toString().toLowerCase().replace(/[^a-z0-9а-яё]/gi, '').trim();

    const trackObject = (item) => {
        let name = normalize(item.object_name || item.location_name || item.to_site_name || item.from_site_name || item.site_name);
        if (name && name !== 'база') objectsSeen.add(name);
    };

    // 1. Movements Section
    if (dayMovements.length > 0) {
        const seenMovements = new Set();
        let displayMovements = [...dayMovements];

        // Transition Day Prioritization: If a day is both an arrival and departure for a machine,
        // we prioritize showing the mobilization for the new assignment (arrival).
        const arrivals = dayMovements.filter(m => m.arrival_date === currentDayStr || m.is_arrival);

        displayMovements.forEach((m) => {
            trackObject(m);
            const fromLoc = m.manual_departure_from || (m.from_site_name && m.from_site_name !== 'База' ? m.from_site_name : 'База');
            const toLoc = m.manual_arrive_to || (m.to_site_name && m.to_site_name !== 'База' ? m.to_site_name : 'База');
            const actObj = m.object_name || (toLoc !== 'База' ? toLoc : fromLoc);
            const uId = m.assignment_id || m.schedule_id || '';
            const uniqueKey = m.id ? `mov_real_${m.id}` : `mov_v_${fromLoc}_${toLoc}_${uId}_${m.activity_name || ''}`;

            if (seenMovements.has(uniqueKey)) return;
            seenMovements.add(uniqueKey);

            const isArrivalDay = (m.arrival_date === currentDayStr || m.is_arrival);
            const isDepartureDay = (m.departure_date === currentDayStr || m.movement_date === currentDayStr || m.is_departure);

            // Suppression logic: on transition days (end of one assignment, start of another), 
            // we prioritize the arrival and skip the departure-only mobilization block.
            if (isDepartureDay && !isArrivalDay && arrivals.length > 0) return;

            const isRedundant = activeLocs.some(loc =>
                (loc.schedule_id && (loc.schedule_id === m.schedule_id || loc.schedule_id === m.assignment_id)) ||
                (loc.assignment_id && (loc.assignment_id === m.assignment_id || loc.assignment_id === m.schedule_id)) ||
                (loc.location_name && actObj && loc.location_name.toLowerCase().trim() === actObj.toLowerCase().trim())
            );

            const hasDates = (m.arrival_date && m.arrival_date !== '0000-00-00') && (m.departure_date && m.departure_date !== '0000-00-00');
            const isMiddleDay = hasDates && !isArrivalDay && !isDepartureDay;

            // Completely skip redundant or virtual movements on middle days
            if (isMiddleDay && (isRedundant || m.is_virtual)) return;

            let logisticsHtml = '';
            if (isArrivalDay) {
                logisticsHtml = `
                    <div class="pop-row">
                        <span class="pop-label">Пристигнал от:</span> 
                        <span class="pop-value fw-bold text-success">${escapeHtml(fromLoc)}</span>
                    </div>`;
            } else if (isDepartureDay) {
                logisticsHtml = `
                    <div class="pop-row">
                        <span class="pop-label">Заминава за:</span> 
                        <span class="pop-value fw-bold text-success">${escapeHtml(toLoc)}</span>
                    </div>`;
            } else {
                logisticsHtml = `
                    <div class="pop-row"><span class="pop-label">Обект:</span> <span class="pop-value fw-bold text-warning-emphasis">${escapeHtml(toLoc)}</span></div>
                `;
            }

            let vid = m.capability_name || '';
            if (m.activity_subtype) {
                vid = (vid ? vid + ' — ' : '') + m.activity_subtype;
            }

            const datesRow = hasDates ? `<div class="pop-row"><span class="pop-label">Период:</span> <span class="pop-value">${formatRange(m.arrival_date, m.departure_date)}</span></div>` : '';
            const carrierHtml = m.carrier ? `<div class="pop-row"><span class="pop-label">Превозвач:</span> <span class="pop-value fw-bold">${escapeHtml(m.carrier)}</span></div>` : '';
            const notesHtml = m.notes ? `<div class="mt-1 small text-muted font-italic bg-light p-1 rounded border-start border-warning" style="font-size: 0.72rem;"><i class="bi bi-sticky me-1"></i>${escapeHtml(m.notes)}</div>` : '';

            let mobilizationHtml = `
                <div>
                    <div class="pop-row text-warning-emphasis fw-bold mb-1">
                        <i class="bi bi-truck me-2"></i>
                        Мобилизация: <span>${escapeHtml(actObj)}</span>
                    </div>
                    ${logisticsHtml}
                    ${datesRow}
                    ${carrierHtml}
                    ${notesHtml}
                </div>`;

            if (m.activity_name && (!isRedundant && !m.is_virtual)) {
                const sInfo = getStatusInfo(m);
                let plannedHtml = `
                    <div>
                        <div class="pop-row text-primary-emphasis fw-bold mb-1">
                            <i class="bi bi-calendar2-week me-2"></i>Обект: <span class="text-primary">${escapeHtml(actObj)}</span>
                        </div>
                        <div class="pop-row"><span class="pop-label">Дейност:</span> <span class="pop-value">${escapeHtml(m.activity_name)}</span></div>
                        <div class="pop-row"><span class="pop-label">Вид:</span> <span class="pop-value">${escapeHtml(vid || '-')}</span></div>
                        <div class="pop-row"><span class="pop-label">Период:</span> <span class="pop-value">${formatRange(m.arrival_date, m.departure_date)}</span></div>
                        <div class="pop-row"><span class="pop-label">Статус:</span> <span class="pop-value"><span class="badge rounded-pill ${sInfo.popoverBadgeClass} small py-1 px-2">${escapeHtml(sInfo.label)}</span></span></div>
                    </div>`;

                popoverItems.push({
                    html: plannedHtml,
                    priority: 20
                });
            }

            if (!isMiddleDay) {
                popoverItems.push({
                    html: mobilizationHtml,
                    priority: 30
                });
            } else if (!m.activity_name && (!isRedundant && !m.is_virtual)) {
                let synthPlannedHtml = `
                    <div>
                        <div class="pop-row text-primary-emphasis fw-bold mb-1">
                            <i class="bi bi-calendar2-week me-2"></i>Обект: <span class="text-primary">${escapeHtml(actObj)}</span>
                        </div>
                    </div>`;
                popoverItems.push({
                    html: synthPlannedHtml,
                    priority: 20
                });
            }
        });
    }

    // 2. Actual Locations Section
    activeLocs.forEach((loc) => {
        trackObject(loc);
        let dbLocName = (loc.location_name && loc.location_name.length > 0) ? loc.location_name : 'База';
        let status = (loc.status || '').toLowerCase().trim();
        let isPlanned = status.includes('планиран') || status.includes('не') || status.includes('upcoming');
        let label = 'Изпълнение:';
        if (isPlanned || (loc.start_date && loc.start_date !== '0000-00-00' && currentDayStr < loc.start_date)) {
            label = 'График на обекта:';
        }

        let displayVid = loc.display_vid || '-';

        const isPreStart = (loc.start_date && loc.start_date !== '0000-00-00' && currentDayStr < loc.start_date);
        const sInfo = getStatusInfo({ status: isPreStart ? (loc.status || 'планиран') : loc.status, type: 'location' });

        const statusStr = (loc.status || '').toLowerCase();
        const isSpecialStatus = statusStr.includes('пробл') || statusStr.includes('спрян') || statusStr.includes('пауз') || statusStr.includes('прик');
        const displayLabel = (isPreStart && !isSpecialStatus) ? 'Мобилизиран' : sInfo.label;

        let locHtml = `
            <div>
                <div class="pop-row"><span class="pop-label">${label}</span> <span class="pop-value text-primary-emphasis fw-bold">${escapeHtml(dbLocName)}</span></div>
                <div class="pop-row"><span class="pop-label">Дейност:</span> <span class="pop-value">${escapeHtml(loc.activity_name || '-')}</span></div>
                <div class="pop-row"><span class="pop-label">Вид:</span> <span class="pop-value">${escapeHtml(displayVid)}</span></div>
                <div class="pop-row"><span class="pop-label">Период:</span> <span class="pop-value">${formatRange(loc.start_date, loc.end_date)}</span></div>
                <div class="pop-row"><span class="pop-label">Статус:</span> <span class="pop-value"><span class="badge ${sInfo.popoverBadgeClass}">${escapeHtml(displayLabel)}</span></span></div>
            </div>`;

        if (loc.is_open_ended) {
            locHtml += `<div class="mt-1 text-danger fw-bold small"><i class="bi bi-exclamation-octagon-fill me-1"></i>НИКАКВА КРАЙНА ДАТА!</div>`;
        }

        popoverItems.push({
            html: locHtml,
            priority: (isPreStart || isPlanned) ? 20 : 10
        });

        const planS = loc.estimated_start_date;
        const planE = loc.estimated_end_date;
        const isCurrentlyPlanned = isPreStart || isPlanned;
        if (!isCurrentlyPlanned && planS && planE && currentDayStr >= planS && currentDayStr <= planE) {
            const pInfo = getStatusInfo({ status: loc.status || 'планиран', type: 'location' });
            let synthHtml = `
                <div>
                    <div class="pop-row"><span class="pop-label">График на обекта:</span> <span class="pop-value text-primary-emphasis fw-bold">${escapeHtml(dbLocName)}</span></div>
                    <div class="pop-row"><span class="pop-label">Дейност:</span> <span class="pop-value">${escapeHtml(loc.activity_name || '-')}</span></div>
                    <div class="pop-row"><span class="pop-label">Вид:</span> <span class="pop-value">${escapeHtml(displayVid)}</span></div>
                    <div class="pop-row"><span class="pop-label">Период:</span> <span class="pop-value">${formatDateBG(planS)} - ${formatDateBG(planE)}</span></div>
                    <div class="pop-row"><span class="pop-label">Статус:</span> <span class="pop-value"><span class="badge ${pInfo.popoverBadgeClass}">${escapeHtml(pInfo.label)}</span></span></div>
                </div>`;

            popoverItems.push({
                html: synthHtml,
                priority: 20
            });
        }
    });

    // 3. Forecast Section
    activeEsts.forEach((est) => {
        trackObject(est);
        let displayVid = est.display_vid || '-';
        const sInfo = getStatusInfo({ status: est.status, type: 'estimate' });

        let estHtml = `
            <div>
                <div class="pop-row"><span class="pop-label">Прогноза:</span> <span class="pop-value text-info-emphasis fw-bold">${escapeHtml(est.object_name)}</span></div>
                <div class="pop-row"><span class="pop-label">Дейност:</span> <span class="pop-value">${escapeHtml(est.est_activity_name || '-')}</span></div>
                <div class="pop-row"><span class="pop-label">Вид:</span> <span class="pop-value">${escapeHtml(displayVid)}</span></div>
                <div class="pop-row"><span class="pop-label">Период:</span> <span class="pop-value">${formatDateBG(est.start_date)} - ${formatDateBG(est.end_date)}</span></div>
                <div class="pop-row"><span class="pop-label">Статус:</span> <span class="pop-value"><span class="badge ${sInfo.popoverBadgeClass}">${escapeHtml(sInfo.label)}</span></span></div>
            </div>`;

        popoverItems.push({
            html: estHtml,
            priority: 40
        });
    });

    popoverItems.sort((a, b) => a.priority - b.priority);

    let html = '';

    // User Request 07.05: Synchronize popover conflict banner with calendar icon logic
    const mobilizedObjSeen = new Set();
    const forecastObjSeen = new Set();

    activeLocs.forEach(l => { let n = normalize(l.location_name || l.object_name); if (n && n !== 'база') mobilizedObjSeen.add(n); });
    dayMovements.forEach(m => { let n = normalize(m.object_name || m.to_site_name || m.from_site_name); if (n && n !== 'база') mobilizedObjSeen.add(n); });
    activeEsts.forEach(e => { let n = normalize(e.object_name); if (n && n !== 'база') forecastObjSeen.add(n); });

    const uMob = mobilizedObjSeen.size;
    const uEst = forecastObjSeen.size;
    const isConflict = (uMob > 1) || (uMob === 0 && uEst > 1);

    if (isConflict) {
        html += `<div class="alert alert-danger p-2 mb-3 small d-flex align-items-center gap-2 border-0 shadow-sm">
                    <i class="bi bi-exclamation-triangle-fill fs-5"></i>
                    <span class="fw-bold">Застъпване на обекти!</span>
                 </div>`;
    }

    popoverItems.forEach((item, index) => {
        if (index > 0) {
            const prevItem = popoverItems[index - 1];
            if (prevItem.priority !== item.priority) {
                html += '<hr class="my-3 opacity-50">';
            } else {
                html += '<div class="mt-3 pt-2 border-top border-secondary-subtle border-dashed"></div>';
            }
        }
        html += item.html;
    });

    return html;
}

/**
 * Deterministic color generator based on project ID
 */
function getObjectColor(id) {
    if (!id) return '#6c757d';
    const colors = [
        '#0d6efd', '#198754', '#0dcaf0', '#fd7e14', '#6610f2',
        '#d63384', '#20c997', '#ffc107', '#007bff', '#28a745'
    ];
    // Simple cycle through a professional palette, or use HSL for more variety
    const index = parseInt(id) % colors.length;
    return colors[index];
}

function renderYearMatrix(matrix, estimates, locations, movements, year, machineId, objectEnvelopes = {}) {
    const container = document.getElementById('ganttContainer');
    if (!container) return;

    let html = '';
    const dayNames = ['Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб', 'Нед'];

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const isCurrentYear = parseInt(year) === currentYear;

    // Group months into rows of 3
    for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
        const rowMonths = matrix.slice(rowIndex * 3, (rowIndex * 3) + 3);
        const rowId = `calendar_row_${rowIndex}`;
        const isRowActive = isCurrentYear && rowMonths.some(m => m.month_num === currentMonth);
        const defaultExpanded = isRowActive || (!isCurrentYear && rowIndex === 0);

        const startMonthName = rowMonths[0].month_name;
        const endMonthName = rowMonths[rowMonths.length - 1].month_name;

        html += `
            <div class="calendar-row-group">
                <div class="calendar-row-header ${defaultExpanded ? '' : 'collapsed'}" 
                     data-bs-toggle="collapse" 
                     data-bs-target="#${rowId}" 
                     aria-expanded="${defaultExpanded ? 'true' : 'false'}">
                    <div class="row-title">
                        <i class="bi bi-calendar-range"></i>
                        <span>${startMonthName} - ${endMonthName}</span>
                    </div>
                    <i class="bi bi-chevron-down"></i>
                </div>
                <div class="collapse ${defaultExpanded ? 'show' : ''}" id="${rowId}">
                    <div class="calendar-row-content">
                        <div class="row">
        `;

        rowMonths.forEach(row => {
            let monthHtml = `
                <div class="col-12 col-lg-6 col-xxl-4 mb-4">
                    <div class="calendar-month h-100 mb-0">
                        <div class="calendar-month-header fs-6">
                            <i class="bi bi-calendar3 text-muted me-2"></i>${escapeHtml(row.month_name)} ${year}
                        </div>
                        <div class="calendar-grid">
            `;

            dayNames.forEach(dayName => {
                monthHtml += `<div class="calendar-day-header">${dayName}</div>`;
            });

            let firstDayStr = row.days[0].date;
            let firstDayDate = new Date(firstDayStr);
            let firstDayOfWeek = firstDayDate.getDay();
            let emptyDaysCount = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
            for (let i = 0; i < emptyDaysCount; i++) {
                monthHtml += `<div class="calendar-day empty"></div>`;
            }

            row.days.forEach(d => {
                if (!d.valid) return;

                const currentDayStr = d.date;
                const isWeekend = d.is_weekend ? 'weekend' : '';
                const isToday = (currentDayStr === now.toISOString().split('T')[0]) ? 'current-day' : '';
                let eventsHtml = '';
                // Collect all items for the current day to detect overlaps (#10, #19)
                const dayItems = [];
                const rawMovements = movements ? movements.filter(m => {
                    const aD = (m.arrival_date && m.arrival_date !== '0000-00-00') ? m.arrival_date : null;
                    const dD = (m.departure_date && m.departure_date !== '0000-00-00') ? m.departure_date : null;
                    if (!aD && !dD) return false;

                    // Case 1: Only arrival exists
                    if (aD && !dD) return currentDayStr === aD;
                    // Case 2: Only departure exists
                    if (!aD && dD) return currentDayStr === dD;
                    // Case 3: Both exist - cover the entire range
                    return currentDayStr >= aD && currentDayStr <= dD;
                }) : [];
                // Deduplicate movements by ID to avoid multiple entries if they match multiple date fields
                const dayMovements = [];
                const movSeen = new Set();
                rawMovements.forEach(m => {
                    if (!movSeen.has(m.id)) {
                        movSeen.add(m.id);
                        dayMovements.push(m);
                    }
                });

                // 1. Collect Actual Locations
                locations.forEach(loc => {
                    const s = (loc.status || '').toLowerCase().trim();
                    const isActuallyActive = (s.includes('старт') || s.includes('active') || s.includes('активен') || s.includes('започнал')) && !s.includes('не');
                    const isPlanned = s.includes('планиран') || s.includes('не') || s.includes('upcoming');

                    // A. Work Window (Activity Dates)
                    const realS = (loc.start_date && loc.start_date !== '0000-00-00') ? loc.start_date : null;
                    const realE = (loc.end_date && loc.end_date !== '0000-00-00') ? loc.end_date : null;
                    const planS = (loc.estimated_start_date && loc.estimated_start_date !== '0000-00-00') ? loc.estimated_start_date : null;
                    const planE = (loc.estimated_end_date && loc.estimated_end_date !== '0000-00-00') ? loc.estimated_end_date : null;

                    // B. Simple Work Window Fallbacks
                    const wS = realS || planS;
                    const wE = realE || planE;

                    // B. Assignment Window (Potential Travel Days)
                    const aS = (loc.assign_start && loc.assign_start !== '0000-00-00') ? loc.assign_start : null;
                    const aE = (loc.assign_end && loc.assign_end !== '0000-00-00') ? loc.assign_end : null;

                    // Total range we care about
                    let totalS = loc.display_start;
                    if (!totalS) {
                        if (aS && wS) {
                            totalS = (aS < wS) ? aS : wS;
                        } else {
                            totalS = aS || wS;
                        }
                    }

                    let totalE = loc.display_end;
                    if (!totalE) {
                        if (aE && wE) {
                            totalE = (aE > wE) ? aE : wE;
                        } else {
                            totalE = aE || wE;
                        }
                    }

                    if (!totalS) return;

                    const isMatch = (loc.is_open_ended)
                        ? (currentDayStr >= totalS)
                        : (totalE && totalE !== '0000-00-00')
                            ? (currentDayStr >= totalS && currentDayStr <= totalE)
                            : (currentDayStr === totalS);

                    if (isMatch) {
                        // Precise Work Logic: Actual vs Planned
                        const isWorkDayActual = realS ? (realE ? (currentDayStr >= realS && currentDayStr <= realE) : (currentDayStr === realS)) : false;
                        const isWorkDayPlanned = planS ? (planE ? (currentDayStr >= planS && currentDayStr <= planE) : (currentDayStr === planS)) : false;

                        const isSpecialStatus = s.includes('пробл') || s.includes('спрян') || s.includes('пауз') || s.includes('прик') || s.includes('завърш') || s.includes('completed');

                        // User Request: Support special statuses in the planning matrix
                        if ((isWorkDayActual || isWorkDayPlanned || isSpecialStatus)) {
                            if (isActuallyActive || isSpecialStatus) {
                                let priority = 0.05; // Active default
                                if (s.includes('пробл') || s.includes('спрян')) priority = 0.01;
                                else if (s.includes('пауз')) priority = 0.02;
                                else if (s.includes('прик') || s.includes('завърш') || s.includes('completed')) priority = 0.06;

                                dayItems.push({ type: 'location', isActualLayer: true, data: { ...loc }, priority: priority });
                            } else if (isWorkDayPlanned) {
                                // Default planned window
                                dayItems.push({ type: 'location', isActualLayer: false, data: { ...loc, status: 'планиран' }, priority: 2 });
                            }
                        }

                        // Virtual Movement Injection for Overlap Visibility (#55)
                        // We inject these for any assignment start/end day to ensure the Truck icon appears.
                        // We skip this if the assignment is already Active (which now also uses the Truck icon)
                        if (wS && currentDayStr === totalS && dayMovements.length === 0 && !isActuallyActive) {
                            dayItems.push({
                                type: 'movement', data: {
                                    from_site_name: loc.from_site_name || 'База',
                                    to_site_name: loc.location_name,
                                    carrier: loc.carrier,
                                    is_virtual: true,
                                    is_arrival: true,
                                    machine_id: machineId,
                                    assignment_id: loc.assignment_id,
                                    schedule_id: loc.schedule_id,
                                    activity_name: loc.activity_name,
                                    activity_subtype: loc.activity_subtype,
                                    capability_name: loc.capability_name,
                                    arrival_date: wS,
                                    departure_date: wE,
                                    notes: loc.notes
                                }, priority: 0.1
                            });
                        }
                        if (wE && totalE && currentDayStr === totalE && dayMovements.length === 0 && !isActuallyActive) {
                            dayItems.push({
                                type: 'movement', data: {
                                    from_site_name: loc.location_name,
                                    to_site_name: loc.to_site_name || 'База',
                                    carrier: loc.carrier,
                                    is_virtual: true,
                                    is_departure: true,
                                    machine_id: machineId,
                                    assignment_id: loc.assignment_id,
                                    schedule_id: loc.schedule_id,
                                    activity_name: loc.activity_name,
                                    activity_subtype: loc.activity_subtype,
                                    capability_name: loc.capability_name,
                                    arrival_date: wS,
                                    departure_date: wE,
                                    notes: loc.notes
                                }, priority: 0.1
                            });
                        }
                    }
                });

                // 2. Collect Estimates (Forecasts)
                estimates.forEach(est => {
                    if (currentDayStr >= est.start_date && currentDayStr <= est.end_date) {
                        dayItems.push({ type: 'estimate', data: est, priority: 3 });
                    }
                });

                // 3. Collect Movements - Highest priority for transport days
                dayMovements.forEach(m => {
                    const isArrival = m.arrival_date === currentDayStr;
                    const isDeparture = (m.departure_date === currentDayStr || m.movement_date === currentDayStr);
                    const hasDates = (m.arrival_date && m.arrival_date !== '0000-00-00') || (m.departure_date && m.departure_date !== '0000-00-00');
                    const isMiddle = hasDates && !isArrival && !isDeparture;

                    // Trucks (Arrival/Departure) are Grey, Middle days are Cyan (#Request 4)
                    const priority = (isArrival || isDeparture) ? 0.1 : 1.5;
                    dayItems.push({ type: 'movement', data: m, priority: priority });
                });

                // Sort items: Active Locations > Planned Locations > Estimates > Movements
                dayItems.sort((a, b) => a.priority - b.priority);

                // Deduplicate: If we have a specific Movement record, suppress the generic virtual 'Travel' item
                const hasSpecificMovement = dayItems.some(i => i.type === 'movement');
                const initialItems = hasSpecificMovement
                    ? dayItems.filter(i => !(i.type === 'location' && i.data.status === '__travel__'))
                    : dayItems;

                // Strict Deduplication (#55): Remove only exact redundant virtual items, but KEEP history layers (Forecast/Plan/Actual)
                // Group items by type/name to detect real overlaps
                const finalItems = [];
                const seenItems = new Set();

                initialItems.forEach(item => {
                    let key = '';
                    if (item.type === 'location') {
                        const isTravel = item.data.status === '__travel__';
                        const uId = item.data.assignment_id || item.data.schedule_id;
                        const layerType = item.isActualLayer ? 'actual' : 'planned';
                        key = `loc_${item.data.schedule_id}_${uId}_${isTravel ? 'travel' : layerType}`;
                    } else if (item.type === 'estimate') {
                        key = `est_${item.data.estimate_id}`;
                    } else if (item.type === 'movement') {
                        // Use ID for real movements to allow multiple events per day; fallback to unique identifiers for virtual ones
                        const m = item.data;
                        if (m.id) {
                            key = `mov_real_${m.id}`;
                        } else {
                            const fromL = m.manual_departure_from || (m.from_site_name && m.from_site_name !== 'База' ? m.from_site_name : 'База');
                            const toL = m.manual_arrive_to || (m.to_site_name && m.to_site_name !== 'База' ? m.to_site_name : 'База');
                            const uId = m.assignment_id || m.schedule_id || '';
                            key = `mov_v_${fromL}_${toL}_${uId}_${m.activity_name || ''}`;
                        }
                    }

                    if (!seenItems.has(key)) {
                        seenItems.add(key);
                        finalItems.push(item);
                    } else if (item.type === 'movement' && !item.data.is_virtual) {
                        // If we see a REAL movement but already have a key (likely from virtual), prioritize real
                        const idx = finalItems.findIndex(i => i.type === 'movement' && i.data.is_virtual);
                        if (idx !== -1) finalItems[idx] = item;
                    }
                });

                // Second pass for badge count: Only count unique status groups (#10)
                const badgeItems = [];
                const badgeSeen = new Set();
                finalItems.forEach(item => {
                    let bKey = '';
                    const normalize = (val) => (val || '').toString().toLowerCase().replace(/[^a-z0-9а-яё]/gi, '').trim();

                    let objName = '';
                    if (item.type === 'movement') {
                        const isDeparture = (item.data.departure_date === currentDayStr || item.data.movement_date === currentDayStr);
                        if (isDeparture) {
                            objName = normalize(item.data.from_site_name || item.data.object_name || item.data.location_name || item.data.to_site_name || item.data.site_name);
                        } else {
                            objName = normalize(item.data.object_name || item.data.location_name || item.data.to_site_name || item.data.from_site_name || item.data.site_name);
                        }
                    } else {
                        objName = normalize(item.data.object_name || item.data.location_name || item.data.to_site_name || item.data.from_site_name || item.data.site_name);
                    }

                    const requestId = item.data.request_id;

                    if (requestId && requestId > 0) {
                        bKey = `obj_id_${requestId}`;
                    } else if (objName) {
                        bKey = `obj_name_${objName}`;
                    } else {
                        bKey = `obj_raw_${item.type}_${item.data.id || Math.random()}`;
                    }

                    if (!badgeSeen.has(bKey)) {
                        badgeSeen.add(bKey);
                        badgeItems.push(item);
                    }
                });

                if (finalItems.length > 0) {
                    // Determine if we should show the primary icon
                    // (Already handled by sorting, we take finalItems[0])
                    const primary = finalItems[0];
                    let sInfo, iconHtml, cardBody, clickHandler;

                    // Build consolidated popover content (#19)
                    const activeLocs = finalItems.filter(i => i.type === 'location').map(i => i.data);
                    const activeEsts = finalItems.filter(i => i.type === 'estimate').map(i => i.data);
                    const movementsToday = finalItems.filter(i => i.type === 'movement').map(i => i.data);
                    cardBody = generatePopoverHtml(activeLocs, activeEsts, movementsToday, currentDayStr);

                    // Prepare primary icon rendering
                    if (primary.type === 'location') {
                        sInfo = getStatusInfo(primary);

                        // User Request: Truck icon on first/last dates for Active status too
                        if (sInfo.class === 'status-active-bg') {
                            const isStart = primary.data.start_date === currentDayStr;
                            const isEnd = primary.data.end_date === currentDayStr;
                            if (isStart || isEnd) {
                                sInfo.svg = null;
                                sInfo.icon = 'bi-truck';
                            }
                        }

                        iconHtml = sInfo.svg ? sInfo.svg : `<i class="bi ${sInfo.icon}"></i>`;
                    } else if (primary.type === 'estimate') {
                        sInfo = getStatusInfo(primary);
                        iconHtml = sInfo.svg ? sInfo.svg : `<i class="bi ${sInfo.icon}"></i>`;
                    } else {
                        const m = primary.data;
                        const isArrival = m.arrival_date === currentDayStr;
                        const isDeparture = (m.departure_date === currentDayStr || m.movement_date === currentDayStr);
                        const hasDates = (m.arrival_date && m.arrival_date !== '0000-00-00') || (m.departure_date && m.departure_date !== '0000-00-00');
                        const isMiddle = hasDates && !isArrival && !isDeparture;

                        // Trucks (Arrival/Departure) are Grey, Middle days are Cyan (#Request 4)
                        sInfo = {
                            class: isMiddle ? 'status-upcoming-bg' : 'movement',
                            icon: isMiddle ? 'bi-calendar2-week' : 'bi-truck'
                        };
                        iconHtml = `<i class="bi ${sInfo.icon}"></i>`;
                    }
                    clickHandler = `onclick="openDayEventsModal('${btoa(encodeURIComponent(JSON.stringify(finalItems)))}', '${currentDayStr}', event)"`;

                    // Extraction helper for object identity
                    const getObjectKey = (item) => {
                        const norm = (val) => (val || '').toString().toLowerCase().replace(/[^a-z0-9а-яё]/gi, '').trim();
                        let names = [
                            norm(item.data.object_name),
                            norm(item.data.location_name),
                            norm(item.data.site_name)
                        ];
                        if (item.type === 'movement') {
                            names.push(norm(item.data.to_site_name));
                            names.push(norm(item.data.from_site_name));
                        }
                        let validName = '';
                        for (let n of names) {
                            if (n && n !== 'база') {
                                validName = n;
                                break;
                            }
                        }
                        return validName ? `name_${validName}` : (item.data.request_id ? `id_${item.data.request_id}` : '');
                    };

                    const mobilizedItems = finalItems.filter(item => item.type !== 'estimate');
                    const mobilizedObjects = mobilizedItems.map(getObjectKey).filter(val => val !== '');
                    const uniqueMobilizedCount = new Set(mobilizedObjects).size;

                    const forecastItems = finalItems.filter(item => item.type === 'estimate');
                    const forecastObjects = forecastItems.map(getObjectKey).filter(val => val !== '');
                    const uniqueForecastCount = new Set(forecastObjects).size;

                    // User Request 07.05:
                    // 1. 2+ Mobilizations for different objects -> Red line (Conflict)
                    // 2. 0 Mobilizations + 2+ Forecasts for different objects -> Red line (Conflict)
                    // 3. 1 Mobilization + any Forecasts -> NO Red line (Mobilization takes over)
                    const isConflict = (uniqueMobilizedCount > 1) || (uniqueMobilizedCount === 0 && uniqueForecastCount > 1);

                    let conflictHtml = '';
                    if (isConflict) {
                        // All multi-object conflicts now show solid red bar (#Request 07.05)
                        conflictHtml = `<div class="conflict-bar conflict-overlap"></div>`;
                    }

                    eventsHtml += `<div class="calendar-event ${sInfo.class}" 
                                        ${clickHandler}
                                        data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="auto" 
                                        title="" data-bs-content="${escapeHtml(cardBody)}">
                                        ${iconHtml}
                                        ${conflictHtml}
                                   </div>`;
                }

                monthHtml += `<div class="calendar-day ${isWeekend} ${isToday}">`;
                monthHtml += `<div class="calendar-date-num" onclick="openNewEstimate('${currentDayStr}', ${machineId}, event)" style="cursor: crosshair;">${d.day}</div>`;
                monthHtml += eventsHtml;
                monthHtml += `</div>`;
            });

            let allGridItemsCount = emptyDaysCount + row.days.filter(d => d.valid).length;
            let trailingDaysCount = allGridItemsCount % 7 === 0 ? 0 : 7 - (allGridItemsCount % 7);
            for (let i = 0; i < trailingDaysCount; i++) {
                monthHtml += `<div class="calendar-day empty"></div>`;
            }

            monthHtml += `</div></div></div>`;
            html += monthHtml;
        });

        html += `
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(container.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(t => new bootstrap.Tooltip(t));

        const popoverTriggerList = [].slice.call(container.querySelectorAll('[data-bs-toggle="popover"]'));
        popoverTriggerList.map(p => new bootstrap.Popover(p));
    }
}
