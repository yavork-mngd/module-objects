<?php
// /modules/objects/objects_dashboard.php
require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';

// --- Authorization ---
if (!isLoggedIn()) {
    header('Location: ' . BASE_URL . 'login.php');
    exit();
}

if (!hasAnyRole(['objects_admin', 'objects_editor', 'objects_viewer'])) {
    showAccessDenied();
}

$page_title = 'Обекти - Табло';

ob_start();
?>
<?php include PROJECT_ROOT . '/templates/header.php'; ?>

<style>
    /* Objects dashboard - extras on top of the shared glass / stat-card styles */
    .dashboard-kpi-card {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .stat-icon-wrapper.bg-soft-purple {
        background: rgba(111, 66, 193, 0.12);
        color: #6f42c1;
    }

    [data-bs-theme="dark"] .stat-icon-wrapper.bg-soft-purple {
        background: rgba(168, 139, 224, 0.2);
        color: #b79cf0;
    }

    /* Muted text that stays readable in both themes */
    .od-muted {
        color: var(--apple-text-color);
        opacity: 0.65;
    }

    .od-divider {
        border-bottom: 1px solid var(--apple-card-border-light, rgba(0, 0, 0, 0.08)) !important;
    }

    [data-bs-theme="dark"] .od-divider {
        border-bottom-color: rgba(255, 255, 255, 0.1) !important;
    }

    .od-title-badge {
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 12px;
        font-size: 1.15rem;
        color: var(--apple-accent-color);
        background: rgba(var(--bs-primary-rgb), 0.12);
        border: 1px solid rgba(var(--bs-primary-rgb), 0.25);
    }

    #status_filter option {
        color: #1c1c1e;
        background-color: #fff;
    }

    [data-bs-theme="dark"] #status_filter option {
        color: #f2f2f7;
        background-color: #2c2c2e;
    }

    .od-section-title {
        color: var(--apple-text-color);
    }

    .chart-container {
        position: relative;
        height: 300px;
        width: 100%;
    }

    .mini-table-container {
        max-height: 350px;
        overflow-y: auto;
    }

    .mini-table-container thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        background-color: var(--apple-card-bg-light, #fff);
        backdrop-filter: blur(20px);
    }

    [data-bs-theme="dark"] .mini-table-container thead th {
        background-color: #2c2c2e;
    }

    .table-glass,
    .table-glass > :not(caption) > * > * {
        background-color: transparent;
        color: var(--apple-text-color);
        border-color: rgba(128, 128, 128, 0.18);
    }

    .progress {
        background-color: rgba(128, 128, 128, 0.2);
    }
</style>

<div id="objects-dashboard-container" class="py-4">
    <!-- Header Section -->
    <div class="d-flex justify-content-between align-items-center mb-4 mt-2" data-animation="fade-in-down"
        data-animation-delay="100">
        <h2 class="mb-0 fw-bold text-gradient"><i class="bi bi-speedometer2 me-2"></i>Табло Обекти</h2>
    </div>

    <!-- KPI Cards Row -->
    <div class="row g-4 mb-4" id="kpi-cards-container">
        <!-- Cards will be populated by JS -->
        <div class="col-md-3 col-sm-6 text-center py-4" data-animation="fade-in-up" data-animation-delay="150">
            <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
        </div>
    </div>

    <!-- Charts Row -->
    <div class="row g-4 mb-4" data-animation="fade-in-up" data-animation-delay="200">
        <!-- Top Objects Progress Chart -->
        <div class="col-lg-8">
            <div class="card card-glass h-100">
                <div class="card-header bg-transparent border-0 pt-4 pb-0">
                    <h5 class="fw-bold mb-0 od-section-title"><i class="bi bi-bar-chart-steps me-2"></i>Топ 5 Активни
                        Обекта</h5>
                </div>
                <div class="card-body">
                    <div class="chart-container">
                        <canvas id="topObjectsChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- Machine Deployment Chart -->
        <div class="col-lg-4">
            <div class="card card-glass h-100">
                <div class="card-header bg-transparent border-0 pt-4 pb-0">
                    <h5 class="fw-bold mb-0 od-section-title"><i class="bi bi-pie-chart me-2"></i>Машини (Разпределение)
                    </h5>
                </div>
                <div class="card-body d-flex flex-column align-items-center justify-content-center">
                    <div class="chart-container" style="height: 250px;">
                        <canvas id="machinesChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Actionable Tables Row -->
    <div class="row g-4 mb-4" data-animation="fade-in-up" data-animation-delay="250">

        <!-- Urgent Warnings & Delays -->
        <div class="col-lg-6">
            <div class="card card-glass h-100">
                <div
                    class="card-header bg-transparent border-0 pt-4 pb-0 d-flex justify-content-between align-items-center">
                    <h5 class="fw-bold mb-0 text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Изоставащи
                        Дейности</h5>
                </div>
                <div class="card-body p-0">
                    <div class="mini-table-container custom-scrollbar px-4 pb-4 mt-3" id="warnings-container">
                        <div class="text-center py-4 od-muted small">
                            <div class="spinner-border spinner-border-sm od-muted me-2"></div>Зареждане...
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Upcoming Movements -->
        <div class="col-lg-6">
            <div class="card card-glass h-100">
                <div
                    class="card-header bg-transparent border-0 pt-4 pb-0 d-flex justify-content-between align-items-center">
                    <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-truck me-2"></i>Премествания (График -14/+30
                        дни)</h5>
                </div>
                <div class="card-body p-0">
                    <div class="mini-table-container custom-scrollbar px-4 pb-4 mt-3">
                        <table class="table table-hover table-glass m-0 align-middle">
                            <thead class="text-uppercase od-muted small">
                                <tr>
                                    <th>Дата</th>
                                    <th>Машина</th>
                                    <th>От</th>
                                    <th>До</th>
                                </tr>
                            </thead>
                            <tbody id="movements-tbody">
                                <tr>
                                    <td colspan="4" class="text-center py-4 od-muted small">
                                        <div class="spinner-border spinner-border-sm od-muted me-2"></div>
                                        Зареждане...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- All Objects Search / Table (Kept from original request) -->
    <div class="card card-glass mb-4" data-animation="fade-in-up" data-animation-delay="300">
        <div class="card-header bg-transparent border-0 pt-4 pb-0 d-flex align-items-center">
            <span class="od-title-badge me-3"><i class="bi bi-search"></i></span>
            <div>
                <h5 class="fw-bold mb-0 od-section-title">Търсене на обекти</h5>
                <small class="od-muted">Намерете обект по име и статус</small>
            </div>
        </div>
        <div class="card-body">
            <form id="objects-filter-form" class="row g-3 align-items-end mb-4">
                <div class="col-md-9">
                    <div class="tagify-styled-wrapper">
                        <i class="bi bi-search text-primary ms-2"></i>
                        <input type="text" id="search_object" name="search_object"
                            placeholder="Търсене по име на обект...">
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="tagify-styled-wrapper">
                        <select id="status_filter" name="status_filter" class="form-select">
                            <option value="active" selected>Активни</option>
                            <option value="archived">Архивирани</option>
                            <option value="all">Всички</option>
                        </select>
                    </div>
                </div>
            </form>

            <div id="objects-table-container" class="text-center py-4 glass-context-box">
                <i class="bi bi-inbox od-muted" style="font-size: 2rem;"></i>
                <p class="mt-2 od-muted mb-0 small">Използвайте формата за търсене.</p>
            </div>
        </div>
    </div>
</div>

<?php
// Temporary hack: Since we don't have objects_project_schedules_form.js included natively on this page, and the button calls "#newObjectModal", we either need to include the modal HTML or keep it simple.
// I assume `header.php` or `layout.php` or a dedicated modal include has this modal. If not, the button just wont open anything yet.
?>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../../templates/layout.php';
?>