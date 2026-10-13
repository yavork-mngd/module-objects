// /modules/objects/js/objects_dashboard.js

let topObjectsChartInstance = null;
let machinesChartInstance = null;

function isDarkTheme() {
    return document.documentElement.getAttribute('data-bs-theme') === 'dark';
}

// Re-draw the charts when the user switches between light and dark theme
if (!window.objectsDashboardThemeObserver) {
    let lastTheme = document.documentElement.getAttribute('data-bs-theme');
    window.objectsDashboardThemeObserver = new MutationObserver(() => {
        const theme = document.documentElement.getAttribute('data-bs-theme');
        if (theme === lastTheme) return;
        lastTheme = theme;
        if (document.getElementById('topObjectsChart') || document.getElementById('machinesChart')) {
            loadDashboardCharts();
        }
    });
    window.objectsDashboardThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
}

// Use a more robust initialization pattern
window.initObjectsDashboard = function () {
    if (!document.getElementById('kpi-cards-container')) return;

    loadDashboardStats();
    loadDashboardCharts();
    loadDashboardTables();
    initSearch(); // Initialize the search functionality
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initObjectsDashboard);
} else {
    window.initObjectsDashboard();
}

// Generic Fetch function for API
async function fetchDashboardData(action, params = {}) {
    try {
        let url = `${APP_CONFIG.BASE_URL}modules/objects/objects_dashboard_api.php?action=${action}`;

        // Append extra params
        Object.keys(params).forEach(key => {
            url += `&${key}=${encodeURIComponent(params[key])}`;
        });

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();

        if (!result.success) throw new Error(result.message || "API Error");
        return result.data;
    } catch (error) {
        console.error(`Error loading ${action}:`, error);
        return { error: true, message: error.message };
    }
}

// 1. Load KPI Stats
async function loadDashboardStats() {
    const container = document.getElementById('kpi-cards-container');
    const data = await fetchDashboardData('get_dashboard_stats');

    if (!data || data.error) {
        if (container) {
            container.innerHTML = `<div class="col-12 text-center py-4 text-danger small"><i class="bi bi-exclamation-circle me-2"></i>Грешка при зареждане на показатели: ${data?.message || 'Unknown error'}</div>`;
        }
        return;
    }

    const cardsHtml = `
        <div class="col-md-3 col-sm-6" data-animation="fade-in-up" data-animation-delay="100">
            <div class="card card-glass stat-card-glass dashboard-kpi-card h-100 border-0">
                <div class="card-body p-4 d-flex align-items-center">
                    <div class="stat-icon-wrapper bg-soft-primary me-3">
                        <i class="bi bi-play-circle-fill"></i>
                    </div>
                    <div>
                        <div class="stat-label text-uppercase fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Активни Дейности</div>
                        <div class="stat-value">${data.active_activities}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-3 col-sm-6" data-animation="fade-in-up" data-animation-delay="150">
            <div class="card card-glass stat-card-glass dashboard-kpi-card h-100 border-0">
                <div class="card-body p-4 d-flex align-items-center">
                    <div class="stat-icon-wrapper bg-soft-warning me-3">
                        <i class="bi bi-truck-flatbed"></i>
                    </div>
                    <div>
                        <div class="stat-label text-uppercase fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Машини в Работа</div>
                        <div class="stat-value">${data.machine_utilization_ratio}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-3 col-sm-6" data-animation="fade-in-up" data-animation-delay="200">
            <div class="card card-glass stat-card-glass dashboard-kpi-card h-100 border-0">
                <div class="card-body p-4 d-flex align-items-center">
                    <div class="stat-icon-wrapper bg-soft-success me-3">
                        <i class="bi bi-journal-check"></i>
                    </div>
                    <div>
                        <div class="stat-label text-uppercase fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Отчети (Днес)</div>
                        <div class="stat-value">${data.today_reports}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-3 col-sm-6" data-animation="fade-in-up" data-animation-delay="250">
            <div class="card card-glass stat-card-glass dashboard-kpi-card h-100 border-0">
                <div class="card-body p-4 d-flex align-items-center">
                    <div class="stat-icon-wrapper bg-soft-purple me-3">
                        <i class="bi bi-person-hearts"></i>
                    </div>
                    <div>
                        <div class="stat-label text-uppercase fw-semibold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Активни Клиенти</div>
                        <div class="stat-value">${data.active_clients}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (container) container.innerHTML = cardsHtml;

    // Trigger animations if present
    if (typeof AppAnimations !== 'undefined' && typeof AppAnimations.init === 'function') {
        AppAnimations.init(container);
    } else if (typeof anime !== 'undefined') {
        anime({
            targets: '.dashboard-kpi-card',
            translateY: [20, 0],
            opacity: [0, 1],
            delay: anime.stagger(50),
            easing: 'easeOutQuart',
            duration: 800
        });
    }
}

// 2. Load Charts
async function loadDashboardCharts() {
    const data = await fetchDashboardData('get_dashboard_charts');
    const topCanvas = document.getElementById('topObjectsChart');
    const machinesCanvas = document.getElementById('machinesChart');

    if (!data || data.error) {
        const errorMsg = data?.message || 'Unknown error';
        if (topCanvas) topCanvas.parentElement.innerHTML = `<div class="text-center py-4 text-danger small"><i class="bi bi-exclamation-circle me-2"></i>Грешка: ${errorMsg}</div>`;
        if (machinesCanvas) machinesCanvas.parentElement.innerHTML = `<div class="text-center py-4 text-danger small"><i class="bi bi-exclamation-circle me-2"></i>Грешка: ${errorMsg}</div>`;
        return;
    }

    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded.');
        return;
    }

    // A. Top Objects Progress Chart
    if (topCanvas) {
        const labels = data.top_objects.map(obj => obj.request_name.length > 25 ? obj.request_name.substring(0, 25) + "..." : obj.request_name);
        const totals = data.top_objects.map(obj => parseFloat(obj.total_quantity));
        const completed = data.top_objects.map(obj => parseFloat(obj.completed_quantity));

        const textColor = isDarkTheme() ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)';
        const gridColor = isDarkTheme() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

        if (topObjectsChartInstance) topObjectsChartInstance.destroy();
        topObjectsChartInstance = new Chart(topCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Изпълнено',
                        data: completed,
                        backgroundColor: 'rgba(13, 110, 253, 0.8)',
                        borderRadius: 4,
                    },
                    {
                        label: 'Общо Планирано',
                        data: totals,
                        backgroundColor: isDarkTheme() ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.12)',
                        borderRadius: 4,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: textColor, font: { family: 'Inter, sans-serif' } }, grid: { display: false } },
                    y: { ticks: { color: textColor, font: { family: 'Inter, sans-serif' } }, grid: { color: gridColor } }
                },
                plugins: {
                    legend: { labels: { color: textColor, font: { family: 'Inter, sans-serif' } } },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: isDarkTheme() ? 'rgba(33, 37, 41, 0.95)' : 'rgba(0,0,0,0.8)',
                        borderColor: isDarkTheme() ? 'rgba(255,255,255,0.15)' : 'transparent',
                        borderWidth: 1,
                        titleFont: { family: 'Inter, sans-serif' },
                        bodyFont: { family: 'Inter, sans-serif' },
                        callbacks: {
                            label: function (context) {
                                const unit = data.top_objects[context.dataIndex].unit_of_measure;
                                return context.dataset.label + ': ' + context.parsed.y + ' ' + (unit || '');
                            }
                        }
                    }
                }
            }
        });
    }

    // B. Machines Chart
    if (machinesCanvas) {
        const md = data.machine_deployment;
        const mLabels = ['Работещи', 'На Обект (Бездействие)', 'В Транзит', 'На База'];
        const mData = [md.working, md.idle_on_site, md.in_transit, md.at_base];
        const mColors = [
            'rgba(25, 135, 84, 0.8)', // Green
            'rgba(255, 193, 7, 0.8)', // Yellow 
            'rgba(13, 110, 253, 0.8)', // Blue
            isDarkTheme() ? 'rgba(173, 181, 189, 0.5)' : 'rgba(108, 117, 125, 0.5)' // Gray
        ];

        const textColor = isDarkTheme() ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)';

        if (machinesChartInstance) machinesChartInstance.destroy();
        machinesChartInstance = new Chart(machinesCanvas, {
            type: 'doughnut',
            data: {
                labels: mLabels,
                datasets: [{
                    data: mData,
                    backgroundColor: mColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, padding: 15, font: { family: 'Inter, sans-serif', size: 11 } }
                    }
                }
            }
        });
    }
}

// 3. Load Mini Tables
async function loadDashboardTables() {
    const tbodyMovements = document.getElementById('movements-tbody');
    const warningsContainer = document.getElementById('warnings-container');

    const data = await fetchDashboardData('get_dashboard_tables');

    if (!data) {
        if (tbodyMovements) {
            tbodyMovements.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger small"><i class="bi bi-exclamation-circle me-2"></i>Грешка при зареждане.</td></tr>`;
        }
        if (warningsContainer) {
            warningsContainer.innerHTML = `<div class="text-center py-4 text-danger small"><i class="bi bi-exclamation-circle me-2"></i>Грешка при зареждане на предупреждения.</div>`;
        }
        return;
    }

    // A. Upcoming Movements
    if (tbodyMovements) {
        if (typeof data.upcoming_movements === 'string') {
            tbodyMovements.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger small"><i class="bi bi-exclamation-circle me-2"></i>${data.upcoming_movements}</td></tr>`;
        } else if (!data.upcoming_movements || data.upcoming_movements.length === 0) {
            tbodyMovements.innerHTML = `<tr><td colspan="4" class="text-center py-4 od-muted small"><i class="bi bi-inbox me-2"></i>Няма предстоящи премествания.</td></tr>`;
        } else {
            let html = '';
            data.upcoming_movements.forEach(m => {
                let displayDate = 'N/A';
                if (m.movement_date) {
                    const dateParts = m.movement_date.split('-');
                    if (dateParts.length === 3) {
                        displayDate = `${dateParts[2]}.${dateParts[1]}`;
                    } else {
                        displayDate = m.movement_date;
                    }
                }
                html += `
                    <tr>
                        <td class="fw-semibold text-primary" style="white-space: nowrap;"><i class="bi bi-calendar-event me-1"></i>${displayDate}</td>
                        <td class="od-muted">${m.machine_name}</td>
                        <td class="small od-muted">${m.from_site || 'База'}</td>
                        <td class="small od-muted">${m.to_site || 'База'}</td>
                    </tr>
                `;
            });
            tbodyMovements.innerHTML = html;
        }
    }

    // B. Delayed Warnings
    if (warningsContainer) {
        if (typeof data.warnings === 'string') {
            warningsContainer.innerHTML = `<div class="text-center py-4 text-danger small"><i class="bi bi-exclamation-circle me-2"></i>${data.warnings}</div>`;
        } else if (!data.warnings || data.warnings.length === 0) {
            warningsContainer.innerHTML = `<div class="text-center py-4 text-success small"><i class="bi bi-check-circle me-2" style="font-size:1.5rem;"></i><br>Всичко е по график!</div>`;
        } else {
            let html = `<ul class="list-group list-group-flush bg-transparent">`;
            data.warnings.forEach(w => {
                const badgeColor = w.severity === 'danger' ? 'bg-danger' : 'bg-warning text-dark';
                html += `
                    <li class="list-group-item bg-transparent d-flex justify-content-between align-items-start px-0 py-3 border-bottom od-divider">
                        <div class="ms-2 me-auto">
                            <div class="fw-bold text-body small">${w.request_name} <span class="badge ${badgeColor} ms-1 smaller">${w.status}</span></div>
                            <div class="od-muted smaller mt-1">Дейност: ${w.activity_name}</div>
                            <div class="od-muted smaller fst-italic mt-1"><i class="bi bi-info-circle me-1"></i>${w.reason}</div>
                        </div>
                        <a href="objects_project_schedules.php?request_id=${w.request_id}" target="_blank" 
                           class="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center" 
                           style="width: 32px; height: 32px; padding: 0;" 
                           title="Виж графика"><i class="bi bi-arrow-right"></i></a>
                    </li>
                 `;
            });
            html += `</ul>`;
            warningsContainer.innerHTML = html;
        }
    }
}


// 4. Object Search & Filters
function initSearch() {
    const searchInput = document.getElementById('search_object');
    const statusFilter = document.getElementById('status_filter');
    const tableContainer = document.getElementById('objects-table-container');

    if (!searchInput || !statusFilter || !tableContainer) return;

    let debounceTimer;

    const performSearch = async () => {
        const query = searchInput.value;
        const status = statusFilter.value;

        tableContainer.innerHTML = `<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;

        const data = await fetchDashboardData('search_objects', { search: query, status: status });

        if (!data || data.length === 0) {
            tableContainer.innerHTML = `
                <div class="text-center py-4 glass-context-box">
                    <i class="bi bi-inbox od-muted" style="font-size: 2rem;"></i>
                    <p class="mt-2 od-muted mb-0 small">${data === null ? 'Грешка при търсене.' : 'Няма намерени обекти.'}</p>
                </div>`;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover table-glass align-middle m-0">
                    <thead class="text-uppercase od-muted small">
                        <tr>
                            <th>Обект</th>
                            <th>Дейности</th>
                            <th>Статус</th>
                            <th>Прогрес</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>`;

        data.forEach(obj => {
            const progress = obj.total_qty > 0 ? Math.round((obj.completed_qty / obj.total_qty) * 100) : 0;
            const statusBadge = obj.latest_status === 'приключили' ? 'bg-success' : 'bg-primary';

            html += `
                <tr>
                    <td>
                        <div class="fw-bold">${obj.request_name}</div>
                    </td>
                    <td class="small od-muted">${obj.activities}</td>
                    <td><span class="badge ${statusBadge}">${obj.latest_status}</span></td>
                    <td style="width: 200px;">
                        <div class="d-flex align-items-center">
                            <div class="progress flex-grow-1" style="height: 6px;">
                                <div class="progress-bar" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="ms-2 small fw-bold">${progress}%</span>
                        </div>
                        <div class="od-muted" style="font-size: 10px;">${obj.completed_qty} / ${obj.total_qty} ${obj.unit || ''}</div>
                    </td>
                    <td class="text-end">
                        <a href="objects_project_schedules.php?request_id=${obj.request_id}" target="_blank"
                           class="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center"
                           style="width: 32px; height: 32px; padding: 0;"
                           title="Виж обекта">
                            <i class="bi bi-chevron-right"></i>
                        </a>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        tableContainer.innerHTML = html;
        tableContainer.classList.remove('text-center', 'glass-context-box');
    };

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(performSearch, 400);
    });

    statusFilter.addEventListener('change', performSearch);

    // Initial search on load to populate the table
    performSearch();
}
