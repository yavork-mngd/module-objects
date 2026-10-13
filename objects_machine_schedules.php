<?php
// /modules/objects/objects_machine_schedules.php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';

// Protect this page
if (!isLoggedIn()) {
    header('Location: ' . BASE_URL . 'login.php');
    exit();
}

if (!hasAnyRole(['objects_admin', 'objects_editor', 'objects_viewer'])) {
    showAccessDenied();
}

$page_title = 'График Механизация';

// Start HTML output
ob_start();
?>

<?php include PROJECT_ROOT . '/templates/header.php'; ?>

<style>
    /* Calendar Matrix Custom Styles - Gantt Modernization */
    :root {
        --gantt-cell-width: 52px;
        --gantt-cell-height: 48px;
        --gantt-btn-size: 40px;
        --gantt-today-bg: rgba(var(--bs-primary-rgb), 0.08);
        --gantt-today-border: var(--apple-accent-color);

        /* Status Color Palette - Unified with Planning */
        --status-active-border: #b8daff;
        --status-active-bg: rgba(184, 218, 255, 0.3);
        --status-active-color: #004085;

        --status-completed-border: #c3e6cb;
        --status-completed-bg: rgba(195, 230, 203, 0.3);
        --status-completed-color: #155724;

        --status-planned-border: #bee5eb;
        --status-planned-bg: rgba(190, 229, 235, 0.3);
        --status-planned-color: #0c5460;

        --status-problem-border: #f5c6cb;
        --status-problem-bg: rgba(245, 198, 203, 0.3);
        --status-problem-color: #721c24;

        --status-forecast-border: #6610f2;
        --status-forecast-bg: rgba(102, 16, 242, 0.15);
        --status-forecast-color: #510bc4;

        --status-problem-main: #dc3545;
        --overlap-border: #ffffff;
    }

    /* Conflict Indicator Bar (Ported from Planning) */
    .conflict-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 6px;
        z-index: 10;
        pointer-events: none;
        border-bottom-left-radius: 4px;
        border-bottom-right-radius: 4px;
    }

    .conflict-bar.conflict-overlap {
        background: #dc3545;
    }

    [data-bs-theme="dark"] :root {
        --status-active-border: #0d6efd;
        --status-active-bg: rgba(13, 110, 253, 0.25);
        --status-active-color: #9ec5fe;

        --status-completed-border: #198754;
        --status-completed-bg: rgba(25, 135, 84, 0.25);
        --status-completed-color: #a3cfbb;

        --status-planned-border: #0dcaf0;
        --status-planned-bg: rgba(13, 202, 240, 0.25);
        --status-planned-color: #6edff6;

        --status-problem-border: #dc3545;
        --status-problem-bg: rgba(220, 53, 69, 0.25);
        --status-problem-color: #f8d7da;

        --status-forecast-border: #6f42c1;
        --status-forecast-bg: rgba(111, 66, 193, 0.25);
        --status-forecast-color: #d1b9f9;

        --status-problem-main: #ff4d5e;
        --overlap-border: var(--bs-body-bg);
    }

    .matrix-container-wrapper {
        border: 1px solid var(--apple-card-border-light);
        border-radius: 1rem;
        overflow: auto;
        background: var(--apple-card-bg-light);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    }

    [data-bs-theme="dark"] .matrix-container-wrapper {
        border-color: var(--apple-card-border-dark);
        background: var(--apple-card-bg-dark);
    }

    .matrix-table {
        border-collapse: separate;
        border-spacing: 0;
        width: max-content;
        min-width: 100%;
    }

    /* Sticky Headers and Columns */
    .matrix-table thead th {
        background: var(--apple-card-bg-light) !important;
        border-bottom: 2px solid var(--apple-card-border-light);
        padding: 0.5rem;
        position: sticky;
        top: 0;
        z-index: 150;
    }

    /* First row (Months) */
    .matrix-table thead tr:nth-child(1) th {
        top: 0;
        height: 38px;
        z-index: 160;
    }

    /* Second row (Days) */
    .matrix-table thead tr:nth-child(2) th {
        top: 38px;
        z-index: 150;
    }

    [data-bs-theme="dark"] .matrix-table thead th {
        background: var(--apple-card-bg-dark) !important;
        border-bottom-color: var(--apple-card-border-dark);
    }

    .matrix-machine-name {
        position: sticky !important;
        left: 0 !important;
        z-index: 100 !important;
        background: rgba(var(--bs-body-bg-rgb), 0.98) !important;
        border-right: 2px solid var(--apple-card-border-light);
        min-width: 220px;
        max-width: 220px;
        text-align: left;
        padding: 0.75rem 1rem !important;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    [data-bs-theme="dark"] .matrix-machine-name {
        background: rgba(var(--bs-body-bg-rgb), 0.98) !important;
        border-right-color: var(--apple-card-border-dark);
        box-shadow: 2px 0 10px rgba(0, 0, 0, 0.4);
    }

    /* Header Machine Cell needs highest z-index (Intersection of Top and Left) */
    thead tr th.matrix-machine-name {
        z-index: 180 !important;
        top: 0;
        left: 0;
    }

    /* Second row machine cell offset */
    thead tr:nth-child(2) th.matrix-machine-name {
        top: 38px;
    }

    /* Cell styling */
    .matrix-table td {
        border-bottom: 1px solid var(--apple-card-border-light);
        border-right: 1px solid var(--apple-card-border-light);
        padding: 0;
        height: var(--gantt-cell-height);
        position: relative;
    }

    [data-bs-theme="dark"] .matrix-table td {
        border-color: var(--apple-card-border-dark);
    }

    .day-cell {
        width: var(--gantt-cell-width);
        min-width: var(--gantt-cell-width);
    }

    /* Weekend Styling */
    .weekend-col {
        background-color: rgba(var(--bs-secondary-rgb), 0.03);
    }

    /* Today Highlight (Background only) */
    .today-col {
        background-color: var(--gantt-today-bg) !important;
    }

    /* Record Button (Icon-based) */
    .record-btn {
        position: absolute;
        inset: 0;
        margin: auto;
        width: var(--gantt-btn-size);
        height: var(--gantt-btn-size);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid rgba(0, 0, 0, 0.1);
        font-size: 1.4rem;
    }

    .record-btn:hover {
        transform: scale(1.1);
        z-index: 15;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    /* Matrix Button (Legend-sync) */
    .matrix-btn {
        position: absolute;
        inset: 0;
        margin: auto;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .matrix-btn:hover {
        transform: scale(1.15);
        z-index: 15;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    }

    .matrix-btn i {
        font-size: 1.3rem;
    }

    /* Overlap Indicator Badge */
    .overlap-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
        color: white;
        border-radius: 10px;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.65rem;
        font-weight: 800;
        border: 2px solid var(--bs-body-bg);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        z-index: 6;
    }

    .overlap-badge.bg-danger {
        background: #ef4444 !important;
        box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
    }

    /* Status Varients - Isolated from global styles */
    .status-badge-completed {
        background-color: var(--status-completed-bg) !important;
        border: 1px solid var(--status-completed-border) !important;
        color: var(--status-completed-color) !important;
        animation: none !important;
    }

    .status-badge-active {
        background-color: var(--status-active-bg) !important;
        border: 1px solid var(--status-active-border) !important;
        color: var(--status-active-color) !important;
        animation: none !important;
    }

    .status-badge-upcoming {
        background-color: var(--status-planned-bg) !important;
        border: 1px solid var(--status-planned-border) !important;
        color: var(--status-planned-color) !important;
        animation: none !important;
    }

    .status-badge-problem {
        background-color: var(--status-problem-bg) !important;
        border: 1px solid var(--status-problem-border) !important;
        color: var(--status-problem-color) !important;
        animation: none !important;
    }

    .status-badge-paused {
        background: #e2e3e5 !important;
        color: #383d41 !important;
        border: 1px solid #d6d8db !important;
        animation: none !important;
    }

    .status-badge-forecast {
        background-color: var(--status-forecast-bg) !important;
        border: 1px dashed var(--status-forecast-border) !important;
        color: var(--status-forecast-color) !important;
        animation: none !important;
    }

    .status-badge-movement {
        background-color: #f1f3f5 !important;
        border: 1px solid #ced4da !important;
        color: #495057 !important;
        animation: none !important;
    }

    /* Popover/Tooltip Badge Colors (#18 Sync) */
    .pop-badge-active {
        background-color: var(--status-active-bg) !important;
        color: var(--status-active-color) !important;
        border: 1px solid var(--status-active-border) !important;
    }

    .pop-badge-completed {
        background-color: var(--status-completed-bg) !important;
        color: var(--status-completed-color) !important;
        border: 1px solid var(--status-completed-border) !important;
    }

    .pop-badge-planned {
        background-color: var(--status-planned-bg) !important;
        color: var(--status-planned-color) !important;
        border: 1px solid var(--status-planned-border) !important;
    }

    .pop-badge-problem {
        background-color: var(--status-problem-bg) !important;
        color: var(--status-problem-color) !important;
        border: 1px solid var(--status-problem-border) !important;
    }

    .pop-badge-forecast {
        background-color: var(--status-forecast-bg) !important;
        color: var(--status-forecast-color) !important;
        border: 1px solid var(--status-forecast-border) !important;
    }

    /* Row hover effect */
    .matrix-table tr:hover td {
        background-color: rgba(var(--bs-primary-rgb), 0.02);
    }

    /* Tooltip Customization */
    .gantt-tooltip {
        position: absolute;
        background: rgba(var(--bs-body-bg-rgb), 0.95);
        border: 1px solid var(--apple-card-border-light);
        border-radius: 12px;
        padding: 0;
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        width: auto;
        min-width: 280px;
        max-width: 600px;
        pointer-events: none;
        backdrop-filter: blur(20px) saturate(160%);
        overflow: hidden;
    }

    [data-bs-theme="dark"] .gantt-tooltip {
        background: rgba(var(--bs-body-bg-rgb), 0.9);
        border-color: var(--apple-card-border-dark);
    }

    .tooltip-header {
        padding: 10px 15px;
        background: rgba(var(--bs-primary-rgb), 0.1);
        border-bottom: 1px solid var(--apple-card-border-light);
        font-weight: 700;
        font-size: 0.85rem;
        color: var(--bs-primary);
    }

    [data-bs-theme="dark"] .tooltip-header {
        border-bottom-color: var(--apple-card-border-dark);
    }

    .tooltip-body {
        padding: 12px 15px;
        font-size: 0.8rem;
    }

    /* Standardized Pop-Row Layout (Sync with Planning) */
    .pop-row {
        display: flex;
        align-items: flex-start;
        margin-bottom: 4px;
        gap: 6px;
    }

    .pop-label {
        color: var(--bs-secondary-color);
        font-weight: 500;
        white-space: nowrap;
    }

    .pop-value {
        font-weight: 600;
        text-align: left;
        flex: 1;
        word-break: break-word;
    }

    text-align: center;
    background: var(--apple-accent-color);
    color: white;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.8rem;
    }

    /* Tagify specific adjustments */
    .matrix-month-container .tagify,
    .matrix-year-container .tagify {
        width: 100% !important;
    }

    /* Gantt Bar Styles */
    .gantt-bar-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }

    .gantt-bar {
        position: absolute;
        height: 32px;
        top: 8px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        font-size: 0.7rem;
        font-weight: 700;
        color: white;
        pointer-events: auto;
        cursor: pointer;
        transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        z-index: 10;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .gantt-bar:hover {
        transform: scale(1.02);
        z-index: 20;
        box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
        filter: brightness(1.1);
    }

    .gantt-bar-label {
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Gantt Status Colors (Premium Gradients) */
    .gantt-bar-active {
        background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
    }

    .gantt-bar-completed {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }

    .gantt-bar-planned {
        background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    }

    .gantt-bar-problem {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }

    .gantt-bar-forecast {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        border: 1px dashed rgba(255, 255, 255, 0.4);
    }

    .gantt-bar-movement {
        background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    }

    /* Glassmorphism & Scoreboard Styling (Sync with Planning) */
    .card-glass {
        background: rgba(var(--bs-body-bg-rgb), 0.8) !important;
        backdrop-filter: blur(15px) saturate(180%);
        -webkit-backdrop-filter: blur(15px) saturate(180%);
        border: 1px solid rgba(var(--bs-white-rgb), 0.1) !important;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1) !important;
    }

    [data-bs-theme="dark"] .card-glass {
        background: rgba(var(--bs-body-bg-rgb), 0.7) !important;
        border-color: rgba(255, 255, 255, 0.05) !important;
    }

    .glass-context-box {
        backdrop-filter: blur(5px);
        border: 1px solid rgba(var(--bs-primary-rgb), 0.1);
        transition: all 0.3s ease;
    }

    .glass-progress {
        height: 12px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 6px;
        overflow: hidden;
        position: relative;
    }

    .glass-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4f46e5 0%, #0ea5e9 100%);
        box-shadow: 0 0 15px rgba(14, 165, 233, 0.4);
        transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Animation for Refresh Button */
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(360deg);
        }
    }

    .bi-spin {
        animation: spin 1s linear infinite;
    }
</style>

<div class="py-4">

    <div class="d-flex align-items-center mb-4">
        <a href="<?php echo BASE_URL; ?>modules/objects/objects_machines.php"
            class="btn btn-outline-secondary rounded-circle shadow-sm me-3 d-flex align-items-center justify-content-center"
            style="width: 40px; height: 40px;" title="Назад към Машини" data-no-animation="true">
            <i class="bi bi-arrow-left"></i>
        </a>
        <h2 class="mb-0 fw-bold text-gradient"><i class="bi bi-calendar3-range me-2"></i>График Механизация</h2>
    </div>

    <!-- Matrix Chart Container -->
    <div class="card card-glass rounded-4 mb-4">
        <div class="card-body p-4">
            <!-- Month Picker & Controls -->
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div class="d-flex align-items-center gap-4">
                    <div class="d-flex flex-column gap-1 matrix-month-container" style="width: 200px;">
                        <label for="matrixMonthPicker" class="form-label mb-0 fw-bold small opacity-75">Начален
                            месец</label>
                        <input id="matrixMonthPicker" placeholder="Изберете месец...">
                    </div>
                    <div class="d-flex flex-column gap-1 matrix-year-container" style="width: 140px;">
                        <label for="matrixYearPicker" class="form-label mb-0 fw-bold small opacity-75">Година</label>
                        <input id="matrixYearPicker" placeholder="Година...">
                    </div>
                    <div class="d-flex flex-column gap-1 matrix-duration-container" style="width: 180px;">
                        <label for="matrixDurationPicker" class="form-label mb-0 fw-bold small opacity-75">Период
                            (месеци)</label>
                        <input id="matrixDurationPicker" placeholder="Изберете период...">
                    </div>
                </div>

                <div class="d-flex align-items-center gap-2">
                    <div class="rounded-3 p-1">
                        <input type="radio" class="btn-check" name="viewMode" id="viewMatrix" autocomplete="off">
                        <label
                            class="btn btn-sm btn-outline-primary border-0 rounded-2 px-3 py-2 d-flex align-items-center"
                            for="viewMatrix">
                            <i class="bi bi-grid-3x3 me-2"></i>Матрица
                        </label>
                    </div>

                    <div class="rounded-3 p-1">
                        <input type="radio" class="btn-check" name="viewMode" id="viewGantt" autocomplete="off" checked>
                        <label
                            class="btn btn-sm btn-outline-primary border-0 rounded-2 px-3 py-2 d-flex align-items-center"
                            for="viewGantt">
                            <i class="bi bi-bar-chart-steps me-2"></i>Гант
                        </label>
                    </div>

                    <div class="rounded-3 p-1">
                        <button id="refreshMatrix"
                            class="btn btn-sm btn-outline-primary border-0 rounded-2 px-3 py-2 d-flex align-items-center"
                            title="Обнови">
                            <i class="bi bi-arrow-clockwise me-2"></i>Обнови
                        </button>
                    </div>
                </div>
            </div>

            <div class="matrix-container-wrapper" id="matrixContainer"
                style="overflow: auto; max-height: calc(100vh - 350px);">
                <table class="table matrix-table table-bordered table-sm align-middle text-center mb-0"
                    id="matrixTable">
                    <!-- Table will be injected here via JS -->
                </table>
            </div>

            <!-- Legend -->
            <div class="d-flex flex-wrap gap-4 mt-4 p-3 rounded-4 shadow-sm border align-items-center bg-light-subtle"
                style="border-color: var(--apple-card-border-light);">
                <div class="d-flex align-items-center">
                    <div class="status-badge-active rounded-3 me-2 d-flex align-items-center justify-content-center shadow-sm"
                        style="width: 24px; height: 24px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                            <path d="M3 15h18M5 15l1-6h6l1 6M13 9l6-4h2M13 9l-1 3M16 11l-2 4" />
                            <circle cx="6" cy="18" r="2" />
                            <circle cx="18" cy="18" r="2" />
                        </svg>
                    </div>
                    <small class="fw-bold opacity-75">Активен обект</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="status-badge-completed rounded-3 me-2 d-flex align-items-center justify-content-center shadow-sm"
                        style="width: 24px; height: 24px;">
                        <i class="bi bi-check2-square" style="font-size: 0.9rem;"></i>
                    </div>
                    <small class="fw-bold opacity-75">Приключен</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="status-badge-paused rounded-3 me-2 d-flex align-items-center justify-content-center shadow-sm"
                        style="width: 24px; height: 24px;">
                        <i class="bi bi-pause-fill" style="font-size: 0.9rem;"></i>
                    </div>
                    <small class="fw-bold opacity-75">В пауза</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="status-badge-upcoming rounded-3 me-2 d-flex align-items-center justify-content-center shadow-sm"
                        style="width: 24px; height: 24px;">
                        <i class="bi bi-calendar2-week" style="font-size: 0.9rem;"></i>
                    </div>
                    <small class="fw-bold opacity-75">Мобилизация</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="status-badge-problem rounded-3 me-2 d-flex align-items-center justify-content-center shadow-sm"
                        style="width: 24px; height: 24px;">
                        <i class="bi bi-exclamation-triangle-fill" style="font-size: 0.9rem;"></i>
                    </div>
                    <small class="fw-bold opacity-75">Проблем / Спрян</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="status-badge-forecast rounded-3 me-2 d-flex align-items-center justify-content-center shadow-sm"
                        style="width: 24px; height: 24px;">
                        <i class="bi bi-graph-up-arrow" style="font-size: 0.9rem;"></i>
                    </div>
                    <small class="fw-bold opacity-75">Прогноза</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="status-badge-movement rounded-3 me-2 d-flex align-items-center justify-content-center shadow-sm"
                        style="width: 24px; height: 24px;">
                        <i class="bi bi-truck" style="font-size: 0.9rem;"></i>
                    </div>
                    <small class="fw-bold opacity-75">Мобилизация</small>
                </div>
                <div class="d-flex align-items-center ms-auto">
                    <div class="rounded-pill bg-danger me-2"
                        style="width: 20px; height: 6px; box-shadow: 0 0 5px rgba(239, 68, 68, 0.4);"></div>
                    <small class="fw-bold opacity-75 text-muted">Застъпване на обекти</small>
                </div>
            </div>

            <style>
                [data-bs-theme="dark"] #matrixTable+.d-flex {
                    background: var(--apple-card-bg-dark) !important;
                    border-color: var(--apple-card-border-dark) !important;
                }
            </style>
        </div>
    </div>
</div>


<!-- Day Events Modal -->
<div class="modal fade" id="dayEventsModal" tabindex="-1" aria-labelledby="dayEventsModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="dayEventsModalLabel">Графици и събития за деня</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4 pt-2">
                <div id="dayEventsDate" class="text-secondary small mb-3"></div>
                <div id="dayEventsList" class="list-group list-group-flush">
                    <!-- List of events will be injected here via JS -->
                </div>
            </div>
            <div class="modal-footer border-top-0 pt-0">
                <button type="button" class="btn btn-secondary rounded-pill px-4"
                    data-bs-dismiss="modal">Затвори</button>
            </div>
        </div>
    </div>
</div>

<!-- Location Activity Modal -->
<div class="modal fade" id="locationModal" tabindex="-1" aria-labelledby="locationModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="locationModalLabel">Данни за реална позиция</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="locationForm">
                    <div class="row g-3">
                        <div class="col-md-12">
                            <label for="loc_object_name" class="form-label">Обект</label>
                            <div class="tagify-styled-wrapper">
                                <input class="form-control" id="loc_object_name" name="loc_object_name" readonly>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label for="loc_start_date" class="form-label">От Дата</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="form-control" id="loc_start_date" name="loc_start_date"
                                    readonly>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label for="loc_end_date" class="form-label">До Дата</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="form-control" id="loc_end_date" name="loc_end_date" readonly>
                            </div>
                        </div>

                        <div class="col-12 mt-3 pt-3 border-top">
                            <h6 class="fw-bold mb-3 text-secondary">Данни за дейността</h6>
                        </div>

                        <div class="col-md-6">
                            <label for="loc_activity_name" class="form-label">Дейност</label>
                            <div class="tagify-styled-wrapper">
                                <input class="form-control" id="loc_activity_name" name="loc_activity_name" readonly>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label for="loc_status" class="form-label">Статус</label>
                            <div class="tagify-styled-wrapper">
                                <input class="form-control" id="loc_status" name="loc_status" readonly>
                            </div>
                        </div>
                        <div class="col-md-12">
                            <label for="loc_activity_subtype" class="form-label">Вид (под дейност)</label>
                            <div class="tagify-styled-wrapper">
                                <input class="form-control" id="loc_activity_subtype" name="loc_activity_subtype"
                                    readonly>
                            </div>
                        </div>
                        <div class="col-md-12">
                            <label class="form-label d-flex justify-content-between align-items-center">
                                <span class="text-secondary fw-bold small text-uppercase">Изпълнение
                                    (Количество)</span>
                                <span class="badge bg-primary rounded-pill px-3" id="loc_percent_badge">0%</span>
                            </label>
                            <div class="glass-context-box border-0 shadow-none p-3"
                                style="background: rgba(var(--bs-primary-rgb), 0.05); border-radius: 16px;">
                                <div class="d-flex justify-content-between align-items-end mb-2">
                                    <div class="d-flex flex-column">
                                        <span class="text-muted small">Изработено</span>
                                        <span class="fs-3 fw-bold text-primary" id="loc_completed_display">0.00</span>
                                    </div>
                                    <div class="text-center px-3">
                                        <span class="text-muted fs-4">/</span>
                                    </div>
                                    <div class="d-flex flex-column align-items-end">
                                        <span class="text-muted small">Общо количество</span>
                                        <span class="fs-4 fw-bold text-secondary" id="loc_total_display">0.00</span>
                                    </div>
                                </div>

                                <div class="glass-progress mt-2"
                                    style="height: 12px; background: rgba(0,0,0,0.05); border-radius: 6px; overflow: hidden;">
                                    <div class="glass-progress-bar" id="loc_progress_bar"
                                        style="width: 0%; border-radius: 6px;"></div>
                                </div>

                                <div class="d-flex justify-content-between mt-2">
                                    <span class="text-muted x-small">Прогрес на дейността</span>
                                    <span class="fw-bold text-secondary small" id="loc_unit_display">бр.</span>
                                </div>
                            </div>

                            <!-- Hidden inputs for data storage -->
                            <input type="hidden" id="loc_total_completed" name="loc_total_completed">
                            <input type="hidden" id="loc_total_quantity" name="loc_total_quantity">
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Затвори</button>
            </div>
        </div>
    </div>
</div>

<!-- Load Custom JS for Schedules -->
<script src="<?php echo BASE_URL; ?>modules/objects/js/objects_machine_schedules.js?v=<?php echo time(); ?>"></script>

<script>
    document.addEventListener('DOMContentLoaded', function () {
        if (typeof window.initMachineMatrix === 'function') {
            window.initMachineMatrix();
        }
    });
</script>

<?php
$content = ob_get_clean();
require_once PROJECT_ROOT . '/templates/layout.php';
?>