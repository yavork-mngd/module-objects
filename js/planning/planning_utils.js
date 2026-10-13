/**
 * planning_utils.js
 * Utility functions for the Machine Planning module.
 */

function escapeHtml(text) {
    if (!text) return "";
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function (m) { return map[m]; });
}

function formatDateBG(dateStr) {
    if (!dateStr || dateStr === '0000-00-00' || dateStr === '00.00.0000') return '-';
    // If already in DD.MM.YYYY
    if (dateStr.includes('.')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatRange(start, end) {
    if (!start && !end) return '-';
    return `${formatDateBG(start)} - ${formatDateBG(end)}`;
}

function renderProgressBar(completed, total) {
    const c = parseFloat(completed) || 0;
    const t = parseFloat(total) || 1;
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

function getActivityColor(activityName) {
    if (!activityName) return '#6c757d';
    if (!activityColorMap[activityName]) {
        activityColorMap[activityName] = BADGE_COLORS[colorIndex % BADGE_COLORS.length];
        colorIndex++;
    }
    return activityColorMap[activityName];
}

/**
 * Safely sets the date on an input, handling flatpickr instances if they exist.
 */
function setSafeDate(id, dateStr) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el._flatpickr) {
        el._flatpickr.setDate(dateStr || "", true); // second param triggers 'onChange' if needed
    } else {
        el.value = dateStr || "";
    }
}
