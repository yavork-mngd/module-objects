let tagifyInstance = { month: null, year: null, duration: null };
let currentView = 'gantt'; // 'matrix' or 'gantt'
let lastData = null;

/**
 * Minimalist Excavator SVG for "Active" status
 */
const EXCAVATOR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;"><path d="M3 15h18M5 15l1-6h6l1 6M13 9l6-4h2M13 9l-1 3M16 11l-2 4" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>`;

window.initMachineMatrix = function () {
    console.log('Initializing Machine Matrix with Tagify...');
    const monthInput = document.getElementById('matrixMonthPicker');
    const yearInput = document.getElementById('matrixYearPicker');
    const durationInput = document.getElementById('matrixDurationPicker');
    if (!monthInput || !yearInput || !durationInput) return;

    // Cleanup old instances if any
    Object.values(tagifyInstance).forEach(instance => {
        if (instance && typeof instance.destroy === 'function') instance.destroy();
    });

    const months = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];
    const monthWhitelist = months.map((m, i) => ({ value: m, id: i + 1 }));

    const currentYear = new Date().getFullYear();
    const yearWhitelist = [];
    for (let i = -1; i <= 2; i++) {
        yearWhitelist.push({ value: (currentYear + i).toString() });
    }

    const durationWhitelist = [
        { value: "1 месец", id: 1 },
        { value: "2 месеца", id: 2 },
        { value: "3 месеца", id: 3 },
        { value: "6 месеца", id: 6 },
        { value: "12 месеца", id: 12 }
    ];

    const tagifySettings = {
        mode: 'select',
        enforceWhitelist: true,
        dropdown: { enabled: 0, closeOnSelect: true }
    };

    tagifyInstance.month = new Tagify(monthInput, { ...tagifySettings, whitelist: monthWhitelist });
    tagifyInstance.year = new Tagify(yearInput, { ...tagifySettings, whitelist: yearWhitelist });
    tagifyInstance.duration = new Tagify(durationInput, { ...tagifySettings, whitelist: durationWhitelist });

    // Set default values
    const now = new Date();
    tagifyInstance.month.addTags([months[now.getMonth()]]);
    tagifyInstance.year.addTags([now.getFullYear().toString()]);
    tagifyInstance.duration.addTags(["2 месеца"]);

    // Event listeners
    tagifyInstance.month.on('change', updateMatrixFromTagify);
    tagifyInstance.year.on('change', updateMatrixFromTagify);
    tagifyInstance.duration.on('change', updateMatrixFromTagify);

    // View Toggle listeners
    document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentView = e.target.id === 'viewGantt' ? 'gantt' : 'matrix';
            if (lastData) {
                renderMachineMatrix(lastData);
            }
        });
    });

    // Refresh Button listener
    const refreshBtn = document.getElementById('refreshMatrix');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            updateMatrixFromTagify(true);
        });
    }
};

let lastLoadedRange = '';
function updateMatrixFromTagify(force = false) {
    if (!tagifyInstance.month || !tagifyInstance.year || !tagifyInstance.duration) return;

    const monthName = tagifyInstance.month.value[0]?.value || '';
    const yearStr = tagifyInstance.year.value[0]?.value || '';
    const duration = tagifyInstance.duration.value[0]?.id || 2;

    if (!monthName || !yearStr) return;

    const months = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];
    const monthIndex = months.indexOf(monthName) + 1;
    const mm = String(monthIndex).padStart(2, '0');

    const cacheKey = `${yearStr}-${mm}-${duration}`;
    if (cacheKey === lastLoadedRange && !force) return; // Prevent duplicate loads unless forced
    lastLoadedRange = cacheKey;

    // Add visual feedback to refresh button if it exists
    const refreshBtn = document.getElementById('refreshMatrix');
    if (refreshBtn) {
        const icon = refreshBtn.querySelector('i');
        if (icon) icon.classList.add('bi-spin');
    }

    loadMachineMatrix(`${yearStr}-${mm}`, duration);
}

function loadMachineMatrix(yearMonth, duration = 2) {
    const matrixTable = document.getElementById('matrixTable');
    if (!matrixTable) return;

    matrixTable.innerHTML = '<tr><td class="p-4 text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 mb-0">Зареждане...</p></td></tr>';

    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_schedules_api.php?action=get_machine_matrix&month=${yearMonth}&duration=${duration}`)
        .then(response => response.json())
        .then(data => {
            // Remove spin from refresh button
            const refreshBtn = document.getElementById('refreshMatrix');
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                if (icon) icon.classList.remove('bi-spin');
            }

            if (data.success) {
                renderMachineMatrix(data);
            } else {
                matrixTable.innerHTML = `<tr><td class="p-4 text-center text-danger">Грешка: ${data.message}</td></tr>`;
            }
        })
        .catch(error => {
            // Remove spin from refresh button
            const refreshBtn = document.getElementById('refreshMatrix');
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                if (icon) icon.classList.remove('bi-spin');
            }
            console.error('Error loading machine matrix:', error);
            matrixTable.innerHTML = '<tr><td class="p-4 text-center text-danger">Възникна мрежова грешка при зареждане.</td></tr>';
        });
}

function renderMachineMatrix(data) {
    lastData = data;
    const table = document.getElementById('matrixTable');
    const { days, machines, schedules, forecasts } = data;

    if (!machines || machines.length === 0) {
        table.innerHTML = '<tr><td class="p-4 text-center text-muted">Няма налични машини.</td></tr>';
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const monthsBG = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];

    // 1. Group days by month-year for the top header row
    const monthGroups = [];
    days.forEach(day => {
        const key = `${day.year}-${day.month}`;
        let group = monthGroups.find(g => g.key === key);
        if (!group) {
            group = {
                key,
                month: day.month,
                year: day.year,
                label: `${monthsBG[day.month - 1]} ${day.year}`,
                count: 0
            };
            monthGroups.push(group);
        }
        group.count++;
    });

    // --- Header ---
    let html = '<thead>';

    // Top Row: Month Names
    html += '<tr class="matrix-header-row">';
    html += '<th class="matrix-machine-name border-bottom-0" style="height: 38px;"></th>'; // Empty corner above machine names
    monthGroups.forEach(group => {
        html += `<th colspan="${group.count}" class="text-center py-2 border-start bg-primary bg-opacity-10">
                    <span class="text-primary fw-bold text-uppercase small" style="letter-spacing: 0.05rem;">${group.label}</span>
                 </th>`;
    });
    html += '</tr>';

    // Second Row: Days
    html += '<tr class="matrix-header-row">';
    html += '<th class="matrix-machine-name text-start px-3 pt-0" style="border-top: 0;">Машина</th>';

    days.forEach(day => {
        const isWeekend = day.weekend == 1;
        const isToday = day.fulldate === todayStr;
        const bgClass = isWeekend ? 'weekend-col' : '';
        const todayClass = isToday ? 'today-col' : '';
        const textClass = isWeekend ? 'text-danger' : '';

        // Added sticky top offset (38px is roughly the height of the month-name row)
        html += `<th class="text-center day-cell ${bgClass} ${todayClass} ${textClass}" data-date="${day.fulldate}" style="border-top: 0;">
                    <div class="fw-normal small opacity-75">${day.day_name}</div>
                    <div class="fw-bold">${day.day}</div>
                    ${isToday ? '<div class="today-marker"></div>' : ''}
                </th>`;
    });
    html += '</tr></thead>';

    // --- Body ---
    html += '<tbody>';
    machines.forEach(machine => {
        const mSchedules = schedules[machine.id] || [];
        const mForecasts = forecasts[machine.id] || [];

        html += `<tr>`;
        // Machine Name Sticky Column
        html += `<td class="matrix-machine-name fw-bold" data-machine-id="${machine.id}">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-gear-fill me-2 opacity-50"></i>
                        <span class="text-truncate">${escapeHtml(machine.machine_name)}</span>
                    </div>
                </td>`;

        days.forEach(day => {
            const isWeekend = day.weekend == 1;
            const isToday = day.fulldate === todayStr;
            const bgClass = isWeekend ? 'weekend-col' : '';
            const todayClass = isToday ? 'today-col' : '';

            let cellContent = '';
            if (isToday) {
                cellContent = '<div class="today-marker"></div>';
            }

            html += `<td class="day-cell ${bgClass} ${todayClass}" data-date="${day.fulldate}" data-machine-id="${machine.id}">${cellContent}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';

    table.innerHTML = html;

    // --- Render Items (Icons or Bars) ---
    if (currentView === 'gantt') {
        renderGanttBars(data);
    } else {
        renderMatrixIcons(data);
    }

    // --- Focus on Today ---
    // We use requestAnimationFrame to ensure the table is fully rendered before scrolling
    requestAnimationFrame(() => {
        scrollToToday();
    });
}

function renderMatrixIcons(data) {
    const { days, machines, schedules, forecasts } = data;
    const cellWidth = 52; // Matching --gantt-cell-width

    machines.forEach(machine => {
        const mSchedules = schedules[machine.id] || [];
        const mForecasts = forecasts[machine.id] || [];
        const allItems = [
            ...mSchedules.map(s => ({ ...s, type: 'schedule' })),
            ...mForecasts.map(f => ({ ...f, type: 'forecast' }))
        ];

        // Group items by day to detect overlaps
        const dayMap = {};
        days.forEach(day => dayMap[day.fulldate] = []);

        allItems.forEach(item => {
            const isForecast = item.type === 'forecast';
            let start, end;

            if (isForecast) {
                start = item.start_date;
                end = item.end_date || item.start_date;

                days.forEach(day => {
                    if (day.fulldate >= start && day.fulldate <= end) {
                        dayMap[day.fulldate].push({ type: 'forecast', data: { ...item, priority: 3 } });
                    }
                });
            } else {
                const sInfo = getStatusInfo(item);
                const isPlanned = sInfo.label === 'Мобилизация';

                // 1. Simple Work Window Fallbacks
                const wS = item.start_date || item.estimated_start_date;
                const wE = item.end_date || item.estimated_end_date;

                // 2. Assignment Window (Potential Travel Days)
                const aS = (item.assign_start && item.assign_start !== '0000-00-00') ? item.assign_start : null;
                const aE = (item.assign_end && item.assign_end !== '0000-00-00') ? item.assign_end : null;

                // Total range we care about
                const totalS = aS || wS;
                const totalE = aE || wE;

                if (!totalS) return; // Skip if no anchor

                days.forEach(day => {
                    const d = day.fulldate;
                    if (d >= totalS && d <= totalE) {
                        const realS = (item.start_date && item.start_date !== '0000-00-00') ? item.start_date : null;
                        const realE = (item.end_date && item.end_date !== '0000-00-00') ? item.end_date : null;
                        const planS = (item.estimated_start_date && item.estimated_start_date !== '0000-00-00') ? item.estimated_start_date : null;
                        const planE = (item.estimated_end_date && item.estimated_end_date !== '0000-00-00') ? item.estimated_end_date : null;

                        const isWorkDayActual = realS ? (realE ? (d >= realS && d <= realE) : (d === realS)) : false;
                        const isWorkDayPlanned = planS ? (planE ? (d >= planS && d <= planE) : (d === planS)) : false;

                        const isArrivalDay = (d === totalS);
                        const isDepartureDay = (totalE && d === totalE);

                        const statusStr = (item.status || '').toLowerCase();
                        const isSpecialStatus = statusStr.includes('пробл') || statusStr.includes('спрян') ||
                            statusStr.includes('пауз') || statusStr.includes('приключен') ||
                            statusStr.includes('завършен') || statusStr.includes('completed');

                        if (isWorkDayActual || isSpecialStatus) {
                            // Actual work or Special Status (Top Priorities)
                            let p = 1.5;
                            if (statusStr.includes('пробл') || statusStr.includes('спрян')) p = 0.01;
                            else if (statusStr.includes('пауз')) p = 0.02;
                            else if (statusStr.includes('старт') || statusStr.includes('active') || statusStr.includes('активен') || statusStr.includes('започнал')) p = 0.05;
                            else if (statusStr.includes('приключен') || statusStr.includes('завършен') || statusStr.includes('completed')) p = 0.06;
                            else if (isSpecialStatus) p = 0.07;
                            else p = 0.08;

                            dayMap[d].push({ type: 'location', data: { ...item, priority: p } });
                        }

                        if (isArrivalDay || isDepartureDay) {
                            // Arrival/Departure
                            dayMap[d].push({
                                type: 'location',
                                data: { ...item, status: '__travel__', _isArrival: isArrivalDay, _isDeparture: isDepartureDay, priority: 0.1 }
                            });
                        } else {
                            // Mobilization middle days - show the planned icon (calendar)
                            dayMap[d].push({ type: 'location', data: { ...item, status: 'планиран', priority: 1.5 } });
                        }
                    }
                });
            }
        });

        // Find the specific row for this machine to ensure targeting is contained
        const machineRow = document.querySelector(`#matrixTable tbody tr td[data-machine-id="${machine.id}"]`)?.parentElement;
        if (!machineRow) return;

        // Render icons for each day
        days.forEach(day => {
            const itemsOnDay = dayMap[day.fulldate];
            if (itemsOnDay.length > 0) {
                // Find cell within the machineRow context only
                const targetCell = machineRow.querySelector(`td[data-date="${day.fulldate}"]`);
                if (targetCell) {
                    // Sort items: Active > Travel > Planned > Forecast
                    itemsOnDay.sort((a, b) => (a.data.priority || 99) - (b.data.priority || 99));

                    const primaryEntry = itemsOnDay[0];
                    const primaryItem = primaryEntry.data;
                    let sInfo = getStatusInfo(primaryItem);

                    // User Request: Truck icon on first/last dates for Active status too
                    if (sInfo.class === 'status-badge-active') {
                        const isStart = primaryItem.start_date === day.fulldate;
                        const isEnd = primaryItem.end_date === day.fulldate;
                        if (isStart || isEnd) {
                            sInfo = { ...sInfo, svg: null, icon: 'bi-truck' };
                        }
                    }

                    const btn = document.createElement('div');
                    btn.className = `matrix-btn ${sInfo.class}`;
                    btn.setAttribute('data-bs-toggle', 'tooltip');
                    btn.setAttribute('data-bs-html', 'true');

                    if (sInfo.svg) {
                        btn.innerHTML = sInfo.svg;
                    } else if (sInfo.icon) {
                        btn.innerHTML = `<i class="bi ${sInfo.icon}"></i>`;
                    }

                    // Calculate Badge Count synced with Tooltip sections (#25)
                    const tooltipSections = [];
                    const seenInTooltip = new Set();
                    const mobilizedObjects = new Set();
                    const forecastObjects = new Set();
                    const dayStr = day.fulldate;

                    itemsOnDay.forEach(entry => {
                        const item = entry.data;
                        const isForecast = entry.type === 'forecast';
                        const status = (item.status || '').toLowerCase().trim();
                        const isPlanned = status.includes('планиран') || status.includes('не') || status.includes('upcoming');
                        const isTravel = status === '__travel__';

                        // Deduplication key for tooltip/badge
                        const objId = item.location_id || item.request_id || item.id;
                        const uniqueKey = `${objId}_${isForecast ? 'F' : 'S'}_${status}`;

                        if (!seenInTooltip.has(uniqueKey)) {
                            // Suppression logic: on middle days of a mobilization, we skip the redundant mobilization block
                            // if there is already another primary activity (Active/Special) for the same object.
                            const isArrival = itemsOnDay.some(e => e.data.status === '__travel__' && e.data._isArrival);
                            const isDeparture = itemsOnDay.some(e => e.data.status === '__travel__' && e.data._isDeparture);
                            const isMiddleDay = !isArrival && !isDeparture;

                            if (isMiddleDay && (isPlanned || isTravel)) {
                                const hasPrimaryActivity = itemsOnDay.some(e => {
                                    const s = (e.data.status || '').toLowerCase();
                                    return e.type === 'location' && e.data.status !== '__travel__' &&
                                        (s.includes('старт') || s.includes('актив') || s.includes('започ') ||
                                            s.includes('пробл') || s.includes('спрян') || s.includes('пауз') ||
                                            s.includes('прик') || s.includes('завърш') || s.includes('compl'));
                                });
                                if (hasPrimaryActivity) return; // Skip redundant mobilization block on middle days
                            }

                            seenInTooltip.add(uniqueKey);
                            tooltipSections.push(entry);

                            // Count unique objects for conflict detection (ignore transport for this)
                            const objName = item.обект_име || item.object_name;
                            if (objName && item.status !== '__travel__') {
                                if (isForecast) forecastObjects.add(objName);
                                else mobilizedObjects.add(objName);
                            }
                        }

                        // Also add synthesized planned status if we have active work but also a plan
                        const isCurrentlyPlanned = isPlanned || isTravel;
                        if (entry.type === 'location' && !isCurrentlyPlanned) {
                            const isPreStart = (item.start_date && item.start_date !== '0000-00-00' && dayStr < item.start_date);
                            if (!isPreStart) {
                                const planS = item.estimated_start_date;
                                const planE = item.estimated_end_date;
                                if (planS && planE && dayStr >= planS && dayStr <= planE) {
                                    const synthKey = `${objId}_S_планиран`;
                                    if (!seenInTooltip.has(synthKey)) {
                                        seenInTooltip.add(synthKey);
                                        tooltipSections.push({ type: 'location', data: { ...item, status: 'планиран', _isSynthesizedPlanned: true, priority: 1.5 } });
                                    }
                                }
                            }
                        }
                    });

                    // Overlap Indicator logic (Sync with Planning module)
                    const isConflict = (mobilizedObjects.size > 1) || (mobilizedObjects.size === 0 && forecastObjects.size > 1);

                    if (isConflict) {
                        const conflictBar = document.createElement('div');
                        conflictBar.className = 'conflict-bar conflict-overlap';
                        btn.appendChild(conflictBar);
                    }

                    // Tooltip logic
                    let tooltipContent = `<div class="tooltip-body">`;

                    if (isConflict) {
                        tooltipContent += `<div class="alert alert-danger p-2 mb-3 small d-flex align-items-center gap-2 border-0 shadow-sm">
                                            <i class="bi bi-exclamation-triangle-fill fs-5"></i>
                                            <span class="fw-bold">Застъпване на обекти!</span>
                                          </div>`;
                    }

                    // Merged Transport Logic (#Request 11.05)
                    let displaySections = [...tooltipSections];
                    const travelEntries = displaySections.filter(e => e.data.status === '__travel__');
                    if (travelEntries.length === 2) {
                        const depEntry = travelEntries.find(e => e.data._isDeparture);
                        const arrEntry = travelEntries.find(e => e.data._isArrival);
                        if (depEntry && arrEntry) {
                            const depItem = depEntry.data;
                            const arrItem = arrEntry.data;
                            const mergedEntry = {
                                type: 'location',
                                data: {
                                    status: '__travel__',
                                    _isMerged: true,
                                    dep_obj: depItem.обект_име || depItem.object_name,
                                    arr_obj: arrItem.обект_име || arrItem.object_name,
                                    carrier: depItem.carrier || arrItem.carrier || '-'
                                }
                            };
                            // Find the index of the first travel entry to preserve position
                            const firstTravelIdx = displaySections.findIndex(e => e.data.status === '__travel__');
                            // Remove both original travel entries
                            displaySections = displaySections.filter(e => e.data.status !== '__travel__');
                            // Insert merged entry at the original first index
                            displaySections.splice(firstTravelIdx, 0, mergedEntry);
                        }
                    }

                    displaySections.forEach((entry, index) => {
                        const item = entry.data;
                        const sInfo = getStatusInfo(item);
                        const isForecast = entry.type === 'forecast';
                        const isTravel = item.status === '__travel__';
                        const isSynthPlanned = item._isSynthesizedPlanned;
                        const isPlanned = isSynthPlanned || (sInfo.label === 'Мобилизация' || (item.status && item.status.includes('не')));

                        if (index > 0) {
                            tooltipContent += '<hr class="my-3 opacity-50">';
                        }

                        let labelText = isForecast ? 'Прогноза:' : 'Изпълнение:';
                        if (isTravel) labelText = 'Мобилизация:';
                        else if (isPlanned) labelText = 'График на обекта:';

                        const nameClass = isForecast ? 'text-info-emphasis' : 'text-primary-emphasis';
                        const badgeClass = isSynthPlanned ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' : (sInfo.popoverBadgeClass || 'bg-primary-subtle text-primary-emphasis border border-primary-subtle');

                        let effS, effE;
                        if (isForecast) {
                            effS = item.start_date;
                            effE = item.end_date || effS;
                        } else if (isSynthPlanned) {
                            effS = item.estimated_start_date;
                            effE = item.estimated_end_date;
                        } else {
                            effS = item.assign_start || (isPlanned ? (item.estimated_start_date || item.start_date) : (item.start_date || item.estimated_start_date));
                            effE = item.assign_end || (isPlanned ? (item.estimated_end_date || item.end_date) : (item.end_date || item.estimated_end_date));
                        }

                        const activityName = item.activity_name || item.est_activity_name || '-';
                        const capabilityName = (item.capability_name || '') + (item.activity_subtype ? ' — ' + item.activity_subtype : '') || '-';

                        if (isTravel) {
                            if (item._isMerged) {
                                tooltipContent += `
                                    <div>
                                        <div class="pop-row">
                                            <span class="pop-label text-warning-emphasis fw-bold"><i class="bi bi-truck me-2"></i>Мобилизация:</span> 
                                        </div>
                                        <div class="pop-row">
                                            <span class="pop-label">Заминава за:</span> 
                                            <span class="pop-value text-success-emphasis fw-bold">${escapeHtml(item.dep_obj)}</span>
                                        </div>
                                        <div class="pop-row">
                                            <span class="pop-label">Пристигнал от:</span> 
                                            <span class="pop-value text-success-emphasis fw-bold">${escapeHtml(item.arr_obj)}</span>
                                        </div>
                                        <div class="pop-row">
                                            <span class="pop-label">Период:</span> 
                                            <span class="pop-value">${formatRange(effS, effE || effS)}</span>
                                        </div>
                                        <div class="pop-row">
                                            <span class="pop-label">Превозвач:</span> 
                                            <span class="pop-value fw-bold">${escapeHtml(item.carrier)}</span>
                                        </div>
                                    </div>
                                `;
                            } else {
                                const origin = item.manual_from || item.from_site_name || 'База';
                                const destination = item.manual_to || item.to_site_name_obj || 'База';
                                const display_name = item.обект_име || item.object_name;

                                let labelFrom = 'От:';
                                let showDestination = true;

                                if (item._isArrival) {
                                    labelFrom = 'Пристигнал от:';
                                    showDestination = false;
                                } else if (item._isDeparture) {
                                    labelFrom = 'Заминава за:';
                                    showDestination = false;
                                }

                                tooltipContent += `
                                    <div>
                                        <div class="pop-row">
                                            <span class="pop-label text-warning-emphasis fw-bold"><i class="bi bi-truck me-2"></i>Мобилизация:</span> 
                                        </div>
                                        <div class="pop-row">
                                            <span class="pop-label">Обект:</span> 
                                            <span class="pop-value text-success-emphasis fw-bold">${escapeHtml(display_name)}</span>
                                        </div>
                                        <div class="pop-row">
                                            <span class="pop-label">${labelFrom}</span> 
                                            <span class="pop-value">${escapeHtml(origin)}</span>
                                        </div>
                                        ${showDestination ? `
                                        <div class="pop-row">
                                            <span class="pop-label">До:</span> 
                                            <span class="pop-value">${escapeHtml(destination)}</span>
                                        </div>` : ''}
                                        <div class="pop-row">
                                            <span class="pop-label">Период:</span> 
                                            <span class="pop-value">${formatRange(effS, effE || effS)}</span>
                                        </div>
                                        <div class="pop-row">
                                            <span class="pop-label">Превозвач:</span> 
                                            <span class="pop-value fw-bold">${escapeHtml(item.carrier || '-')}</span>
                                        </div>
                                    </div>
                                `;
                            }
                        } else {
                            tooltipContent += `
                                <div>
                                    <div class="pop-row">
                                        <span class="pop-label">${labelText}</span> 
                                        <span class="pop-value ${nameClass} fw-bold">${escapeHtml(item.обект_име || item.object_name)}</span>
                                    </div>
                                    <div class="pop-row">
                                        <span class="pop-label">Дейност:</span> 
                                        <span class="pop-value">${escapeHtml(activityName)}</span>
                                    </div>
                                    <div class="pop-row">
                                        <span class="pop-label">Вид:</span> 
                                        <span class="pop-value">${escapeHtml(capabilityName)}</span>
                                    </div>
                                    <div class="pop-row">
                                        <span class="pop-label">Период:</span> 
                                        <span class="pop-value">${formatRange(effS, effE || effS)}</span>
                                    </div>
                                    <div class="pop-row">
                                        <span class="pop-label">Статус:</span> 
                                        <span class="pop-value"><span class="badge ${badgeClass}">${escapeHtml(isSynthPlanned ? 'Мобилизация' : sInfo.label)}</span></span>
                                    </div>
                                </div>
                            `;
                        }
                    });

                    tooltipContent += `</div>`;

                    btn.addEventListener('mouseenter', (e) => showTooltip(e, tooltipContent));
                    btn.addEventListener('mouseleave', hideTooltip);

                    // Click to open Day Events Modal (Ported from Planning)
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Filter out duplicates for the modal too
                        const modalItems = [];
                        const seenModalItems = new Set();
                        itemsOnDay.forEach(entry => {
                            const item = entry.data;
                            const isForecast = entry.type === 'forecast';
                            const status = (item.status || '').toLowerCase().trim();
                            const objId = item.location_id || item.request_id || item.id;
                            const key = `${objId}_${isForecast ? 'F' : 'S'}_${status}`;
                            if (!seenModalItems.has(key)) {
                                seenModalItems.add(key);
                                modalItems.push(entry);
                            }
                        });

                        const b64 = btoa(encodeURIComponent(JSON.stringify(modalItems)));
                        openDayEventsModal(b64, dayStr);
                    });
                    btn.title = 'Кликнете за преглед на всички събития за деня';

                    targetCell.appendChild(btn);
                }
            }
        });
    });
}

/**
 * Day Events Modal Logic (Ported from Planning)
 */
window.openDayEventsModal = function (encodedItems, dateStr) {
    const items = JSON.parse(decodeURIComponent(atob(encodedItems)));
    const modalEl = document.getElementById('dayEventsModal');
    const modalTitle = document.getElementById('dayEventsDate');
    const listContainer = document.getElementById('dayEventsList');

    if (!modalEl || !listContainer) return;

    modalTitle.innerText = formatDateBG(dateStr);
    listContainer.innerHTML = '';

    items.forEach(entry => {
        const item = entry.data;
        const sInfo = getStatusInfo(item);
        const isForecast = entry.type === 'forecast';
        const status = (item.status || '').toLowerCase().trim();
        const isPlanned = status.includes('планиран') || status.includes('не') || status.includes('upcoming') || (item.status === '__travel__');

        const objName = item.обект_име || item.object_name || 'Мобилизация';
        const activityName = item.activity_name || item.est_activity_name || '-';
        const b64 = btoa(encodeURIComponent(JSON.stringify(item)));

        const itemHtml = `
            <div class="list-group-item bg-transparent px-0 py-3 border-secondary-subtle">
                <div class="d-flex w-100 justify-content-between align-items-center flex-wrap">
                    <div>
                        <h6 class="mb-1 fw-bold ${isForecast ? 'text-info-emphasis' : 'text-primary-emphasis'}">
                            <i class="bi ${isForecast ? 'bi-graph-up-arrow' : 'bi-geo-alt-fill'} me-1"></i>${escapeHtml(objName)}
                        </h6>
                        <p class="mb-1 small"><strong>Дейност:</strong> ${escapeHtml(activityName)}</p>
                        <p class="mb-0 small">
                            <strong>Статус:</strong> 
                            <span class="badge ${sInfo.popoverBadgeClass}">${escapeHtml(sInfo.label)}</span>
                        </p>
                    </div>
                    <div class="mt-2 mt-md-0 d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="openAndHideModal('location', '${b64}', event)">
                            <i class="bi ${isPlanned ? 'bi-pencil-square' : 'bi-info-circle'} me-1"></i>${isPlanned ? 'Редактирай' : 'Информация'}
                        </button>
                        ${item.request_id ? `
                        <a href="${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules.php?request_id=${item.request_id}" target="_blank" class="btn btn-sm btn-outline-secondary rounded-pill px-3">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Обект
                        </a>
                        ` : ''}
                    </div>
                </div>
            </div>`;
        listContainer.insertAdjacentHTML('beforeend', itemHtml);
    });

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

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
    setVal('loc_object_name', locData.location_name || locData.object_name || locData.обект_име);
    setVal('loc_start_date', formatDateBG(locData.start_date));
    setVal('loc_end_date', formatDateBG(locData.end_date));
    setVal('loc_activity_name', locData.activity_name || locData.est_activity_name);
    setVal('loc_activity_subtype', locData.activity_subtype || locData.capability_name);
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

    const modalEl = document.getElementById('locationModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
};

window.openAndHideModal = function (type, data, event) {
    if (event) event.stopPropagation();
    const dayEventsModalEl = document.getElementById('dayEventsModal');
    if (dayEventsModalEl) {
        const dayEventsModal = bootstrap.Modal.getInstance(dayEventsModalEl);
        if (dayEventsModal) dayEventsModal.hide();
    }

    if (type === 'location') {
        openLocationModal(data);
    }
};

/**
 * Renders the new Microsoft Project-style Gantt bars
 */
function renderGanttBars(data) {
    const { days, machines, schedules, forecasts } = data;
    const cellWidth = 52; // --gantt-cell-width
    const dayMap = {};
    days.forEach((day, idx) => dayMap[day.fulldate] = idx);

    machines.forEach(machine => {
        const mSchedules = schedules[machine.id] || [];
        const mForecasts = forecasts[machine.id] || [];

        // Find machine row
        const machineRow = document.querySelector(`#matrixTable tbody tr td[data-machine-id="${machine.id}"]`)?.parentElement;
        if (!machineRow) return;

        // Group items that represent the same activity but are split in the data
        const allItems = [
            ...mSchedules.map(s => ({ ...s, type: 'schedule' })),
            ...mForecasts.map(f => ({ ...f, type: 'forecast' }))
        ];

        const lanes = []; // Track end index of bars in each lane to find gaps

        allItems.forEach(item => {
            const isForecast = item.type === 'forecast';
            let start, end;

            if (isForecast) {
                start = item.start_date;
                end = item.end_date || item.start_date;
            } else {
                const sInfo = getStatusInfo(item);
                // For actual work, we use the assignment window or the work window
                start = item.assign_start || item.start_date || item.estimated_start_date;
                end = item.assign_end || item.end_date || item.estimated_end_date;

                if ((item.status || '').toLowerCase().includes('актив') && (!end || end === '0000-00-00')) {
                    end = days[days.length - 1].fulldate;
                }
            }

            if (!start || start === '0000-00-00') return;

            const rangeStart = days[0].fulldate;
            const rangeEnd = days[days.length - 1].fulldate;
            if (start > rangeEnd || (end && end < rangeStart)) return;

            const visibleStart = start < rangeStart ? rangeStart : start;
            const visibleEnd = (end && end > rangeEnd) ? rangeEnd : (end || visibleStart);

            const startIdx = dayMap[visibleStart];
            const endIdx = dayMap[visibleEnd];
            if (startIdx === undefined || endIdx === undefined) return;

            // Lane assignment for overlaps
            let laneIdx = lanes.findIndex(laneEndIdx => startIdx > laneEndIdx);
            if (laneIdx === -1) {
                laneIdx = lanes.length;
                lanes.push(endIdx);
            } else {
                lanes[laneIdx] = endIdx;
            }

            // Create a Gantt Bar
            const sInfo = getStatusInfo(item);
            let barClass = 'gantt-bar-planned';
            if (item.status === '__travel__') barClass = 'gantt-bar-movement';
            else if (item.type === 'forecast') barClass = 'gantt-bar-forecast';
            else {
                const status = (item.status || '').toLowerCase();
                if (status.includes('прик') || status.includes('compl')) barClass = 'gantt-bar-completed';
                else if (status.includes('актив') || (status.includes('старт') && !status.includes('не'))) barClass = 'gantt-bar-active';
                else if (status.includes('пробл') || status.includes('спрян')) barClass = 'gantt-bar-problem';
            }

            const bar = document.createElement('div');
            bar.className = `gantt-bar ${barClass}`;

            const left = 2; // Relative to startCell
            const width = ((endIdx - startIdx + 1) * cellWidth) - 4;

            bar.style.left = `${left}px`;
            bar.style.width = `${width}px`;
            bar.style.top = `${8 + (laneIdx * 38)}px`; // Stack bars vertically

            const name = item.обект_име || item.object_name || 'Мобилизация';
            bar.innerHTML = `<span class="gantt-bar-label">${escapeHtml(name)}</span>`;

            // Tooltip logic
            const tooltipContent = `<div class="tooltip-body">${generateItemTooltipHtml(item)}</div>`;
            bar.addEventListener('mouseenter', (e) => showTooltip(e, tooltipContent));
            bar.addEventListener('mouseleave', hideTooltip);

            // Click to navigate
            const requestId = item.request_id;
            if (requestId && (item.schedule_id || item.id)) {
                bar.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.open(`${APP_CONFIG.BASE_URL}modules/objects/objects_project_schedules.php?request_id=${requestId}`, '_blank');
                });
            }

            // Append bar to the machine row's start day cell
            const startCell = machineRow.querySelector(`td[data-date="${visibleStart}"]`);
            if (startCell) {
                let container = startCell.querySelector('.gantt-bar-container');
                if (!container) {
                    container = document.createElement('div');
                    container.className = 'gantt-bar-container';
                    startCell.appendChild(container);
                }
                container.appendChild(bar);
            }
        });

        // Adjust row height if multiple lanes are used
        if (lanes.length > 1) {
            machineRow.style.height = `${8 + (lanes.length * 38) + 8}px`;
        }
    });
}

/**
 * Helper to generate tooltip HTML for a single item
 */
function generateItemTooltipHtml(item) {
    const isTravel = item.status === '__travel__';
    const isForecast = item.type === 'forecast';
    const sInfo = getStatusInfo(item);
    const isPlanned = (sInfo.label === 'Мобилизация' || (item.status && item.status.includes('не')));

    let labelText = isForecast ? 'Прогноза:' : 'Изпълнение:';
    if (isTravel) labelText = 'Мобилизация:';
    else if (isPlanned) labelText = 'График на обекта:';

    const nameClass = isForecast ? 'text-info-emphasis' : 'text-primary-emphasis';
    const badgeClass = sInfo.popoverBadgeClass || 'bg-primary-subtle text-primary-emphasis border border-primary-subtle';

    let effS = item.assign_start || (isPlanned ? (item.estimated_start_date || item.start_date) : (item.start_date || item.estimated_start_date));
    let effE = item.assign_end || (isPlanned ? (item.estimated_end_date || item.end_date) : (item.end_date || item.estimated_end_date));

    if (isTravel) {
        const origin = item.manual_from || item.from_site_name || 'База';
        const destination = item.manual_to || item.to_site_name_obj || 'База';
        const display_name = item.обект_име || item.object_name;

        return `
            <div class="mt-2">
                <div class="pop-row">
                    <span class="pop-label text-warning-emphasis fw-bold"><i class="bi bi-truck me-2"></i>Мобилизация:</span> 
                </div>
                <div class="pop-row">
                    <span class="pop-label">Обект:</span> 
                    <span class="pop-value text-success-emphasis fw-bold">${escapeHtml(display_name)}</span>
                </div>
                <div class="pop-row">
                    <span class="pop-label">От:</span> 
                    <span class="pop-value">${escapeHtml(origin)}</span>
                </div>
                <div class="pop-row">
                    <span class="pop-label">До:</span> 
                    <span class="pop-value">${escapeHtml(destination)}</span>
                </div>
                <div class="pop-row">
                    <span class="pop-label">Период:</span> 
                    <span class="pop-value">${formatRange(effS, effE || effS)}</span>
                </div>
                <div class="pop-row">
                    <span class="pop-label">Превозвач:</span> 
                    <span class="pop-value fw-bold">${escapeHtml(item.carrier || '-')}</span>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="mt-2">
                <div class="pop-row">
                    <span class="pop-label">${labelText}</span> 
                    <span class="pop-value ${nameClass} fw-bold">${escapeHtml(item.обект_име || item.object_name)}</span>
                </div>
                <div class="pop-row">
                    <span class="pop-label">Дейност:</span> 
                    <span class="pop-value">${escapeHtml(item.activity_name || item.est_activity_name || '-')}</span>
                </div>
                <div class="pop-row">
                    <span class="pop-label">Вид:</span> 
                    <span class="pop-value">${escapeHtml((item.capability_name || '') + (item.activity_subtype ? ' — ' + item.activity_subtype : '') || '-')}</span>
                </div>
                <div class="pop-row">
                    <span class="pop-label">Период:</span> 
                    <span class="pop-value">${formatRange(effS, effE || effS)}</span>
                </div>
                <div class="pop-row">
                    <span class="pop-label">Статус:</span> 
                    <span class="pop-value"><span class="badge ${badgeClass}">${escapeHtml(sInfo.label)}</span></span>
                </div>
            </div>
        `;
    }
}

/**
 * Returns status-specific styling information
 * @param {object} item 
 */
function getStatusInfo(item) {
    if (item.status === '__travel__') {
        return { class: 'status-badge-movement', icon: 'bi-truck', label: 'Мобилизация', popoverBadgeClass: 'bg-secondary-subtle text-secondary-emphasis border' };
    }

    if (item.type === 'forecast') {
        return { class: 'status-badge-forecast', icon: 'bi-graph-up-arrow', label: 'Прогноза', popoverBadgeClass: 'pop-badge-forecast' };
    }

    let status = (item.status || '').toLowerCase().trim();

    // Default fallback if status is fully missing
    if (!status) return { class: 'status-badge-upcoming', icon: 'bi-calendar2-week', label: 'Планиран', popoverBadgeClass: 'pop-badge-planned' };

    // Standard Mapping
    if (status.includes('приключен') || status.includes('completed') || status.includes('завършен'))
        return { class: 'status-badge-completed', icon: 'bi-check2-square', label: 'Приключен', popoverBadgeClass: 'pop-badge-completed' };

    if (status.includes('старт') || status.includes('active') || status.includes('активен') || status.includes('започнал'))
        return { class: 'status-badge-active', svg: EXCAVATOR_SVG, label: 'Активен', popoverBadgeClass: 'pop-badge-active' };

    if (status.includes('пауз'))
        return { class: 'status-badge-paused', icon: 'bi-pause-fill', label: 'В пауза', popoverBadgeClass: 'bg-secondary-subtle text-secondary-emphasis' };

    if (status.includes('пробл') || status.includes('спрян'))
        return { class: 'status-badge-problem', icon: 'bi-exclamation-triangle-fill', label: 'Проблем', popoverBadgeClass: 'pop-badge-problem' };

    if (status.includes('планиран') || status.includes('upcoming') || status.includes('не старт'))
        return { class: 'status-badge-upcoming', icon: 'bi-calendar2-week', label: 'Мобилизация', popoverBadgeClass: 'pop-badge-planned' };

    if (status === 'прогноза' || status === 'forecast')
        return { class: 'status-badge-forecast', icon: 'bi-graph-up-arrow', label: 'Прогноза', popoverBadgeClass: 'pop-badge-forecast' };

    // Inclusive fallbacks
    if (status.includes('прик')) return { class: 'status-badge-completed', icon: 'bi-check2-square', label: 'Приключен', popoverBadgeClass: 'pop-badge-completed' };
    if (status.includes('актив') || (status.includes('старт') && !status.includes('не'))) return { class: 'status-badge-active', svg: EXCAVATOR_SVG, label: 'Активен', popoverBadgeClass: 'pop-badge-active' };
    if (status.includes('пауза')) return { class: 'status-badge-paused', icon: 'bi-pause-fill', label: 'В пауза', popoverBadgeClass: 'bg-secondary-subtle text-secondary-emphasis' };
    if (status.includes('пробл') || status.includes('спрян')) return { class: 'status-badge-problem', icon: 'bi-exclamation-triangle-fill', label: 'Проблем', popoverBadgeClass: 'pop-badge-problem' };
    if (status.includes('прог')) return { class: 'status-badge-forecast', icon: 'bi-graph-up-arrow', label: 'Прогноза', popoverBadgeClass: 'pop-badge-forecast' };

    return { class: 'status-badge-upcoming', icon: 'bi-calendar2-week', label: 'Планиран', popoverBadgeClass: 'pop-badge-planned' };
}

// Tooltip Helpers
let tooltipEl = null;

function showTooltip(e, content) {
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'gantt-tooltip';
        document.body.appendChild(tooltipEl);
    }
    tooltipEl.innerHTML = content;
    tooltipEl.style.display = 'block';
    tooltipEl.style.visibility = 'hidden';

    const rect = e.target.getBoundingClientRect();
    const tooltipHeight = tooltipEl.offsetHeight;
    const tooltipWidth = tooltipEl.offsetWidth;

    // Vertical Position (Prefer top, fallback to bottom)
    let top = rect.top + window.scrollY - tooltipHeight - 10;
    if (rect.top < tooltipHeight + 20) {
        top = rect.bottom + window.scrollY + 10;
    }

    // Horizontal Position (Center with boundary checks)
    let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
    }

    tooltipEl.style.top = top + 'px';
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.visibility = 'visible';
}

function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
}

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

function formatDateBG(dateStr) {
    if (!dateStr || dateStr === '0000-00-00') return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatRange(start, end) {
    if (!start && !end) return '-';
    return `${formatDateBG(start)} - ${formatDateBG(end)}`;
}

/**
 * Centering the current date in the matrix/gantt view
 */
function scrollToToday() {
    const todayStr = new Date().toISOString().split('T')[0];
    const wrapper = document.getElementById('matrixContainer');
    if (!wrapper) return;

    // Find the header cell for today
    const todayCell = wrapper.querySelector(`.matrix-table th[data-date="${todayStr}"]`);
    if (!todayCell) {
        console.log('Today is not in the visible range.');
        return;
    }

    // Calculate the position to center the cell
    const cellOffset = todayCell.offsetLeft;
    const cellWidth = todayCell.offsetWidth;
    const wrapperWidth = wrapper.offsetWidth;

    // The machine name column is 200px and sticky. 
    // offsetLeft usually includes the width of preceding cells in the row.
    const scrollPos = cellOffset - (wrapperWidth / 2) + (cellWidth / 2);

    // Smooth scroll to the position
    wrapper.scrollTo({
        left: scrollPos,
        behavior: 'smooth'
    });

    // Handle Header Stickiness on Page Scroll
    window.addEventListener('scroll', () => {
        const table = document.getElementById('matrixTable');
        if (!table) return;
        const thead = table.querySelector('thead');
        if (!thead) return;

        const rect = table.getBoundingClientRect();
        const headerHeight = thead.offsetHeight;

        // Stick the header if the table top has passed the viewport top
        // but stop sticking if we've reached the bottom of the table
        if (rect.top < 0) {
            const maxTranslate = rect.height - headerHeight - 50;
            const translate = Math.min(Math.abs(rect.top), maxTranslate);
            thead.style.transform = `translateY(${translate}px)`;
            thead.style.zIndex = "160"; // Above everything
        } else {
            thead.style.transform = 'none';
        }
    });
}
