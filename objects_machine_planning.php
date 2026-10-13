<?php
// /modules/objects/objects_machine_planning.php

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

$page_title = 'Планиране на механизация';

// Start HTML output
ob_start();
?>

<?php include PROJECT_ROOT . '/templates/header.php'; ?>

<!-- Tagify CSS -->
<link href="https://cdn.jsdelivr.net/npm/@yaireo/tagify/dist/tagify.css" rel="stylesheet" type="text/css" />

<style>
    :root {
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
    }

    [data-bs-theme="dark"] {
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
    }

    .popover {
        max-width: 500px !important;
        min-width: 300px !important;
    }

    .pop-value {
        word-break: break-word;
    }

    /* Status Badge Theming for Popover (#55) */
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

    .calendar-month {
        margin-bottom: 2rem;
        background: var(--bs-body-bg);
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--bs-border-color);
        overflow: hidden;
    }

    .calendar-month-header {
        background: var(--bs-tertiary-bg);
        padding: 10px;
        text-align: left;
        font-weight: bold;
        border-bottom: 1px solid var(--bs-border-color);
    }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        border-left: 1px solid var(--bs-border-color);
        border-top: 1px solid var(--bs-border-color);
    }

    .calendar-day-header {
        text-align: center;
        padding: 4px;
        background: var(--bs-tertiary-bg);
        font-weight: bold;
        font-size: 0.8rem;
        border-right: 1px solid var(--bs-border-color);
        border-bottom: 1px solid var(--bs-border-color);
        color: var(--bs-body-color);
    }

    .calendar-day {
        min-height: 75px;
        /* Increased to fit bigger icons */
        padding: 5px;
        border-right: 1px solid var(--bs-border-color);
        border-bottom: 1px solid var(--bs-border-color);
        position: relative;
        min-width: 0;
        background: transparent;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: center;
        gap: 4px;
        padding-top: 20px;
        /* Space for the absolute date num */
    }

    .calendar-day.weekend {
        background-color: rgba(var(--bs-tertiary-bg-rgb), 0.5);
    }

    .calendar-day.current-day {
        background-color: rgba(var(--bs-primary-rgb), 0.05);
    }

    .calendar-date-num {
        position: absolute;
        top: 4px;
        right: 6px;
        font-weight: 700;
        font-size: 0.75rem;
        color: var(--bs-secondary-color);
        z-index: 2;
        pointer-events: none;
        /* Allow clicks to pass through to the day */
    }

    /* Premium Popover Styling */
    .popover {
        border: none;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        max-width: 280px;
        backdrop-filter: blur(10px);
        background: rgba(var(--bs-body-bg-rgb), 0.95);
        border: 1px solid var(--bs-border-color);
    }

    .popover-header {
        background: transparent;
        border-bottom: 1px solid var(--bs-border-color);
        font-weight: bold;
        padding: 12px 15px;
        font-size: 0.9rem;
        color: var(--bs-primary);
    }

    .popover-body {
        padding: 12px 15px;
        font-size: 0.8rem;
        line-height: 1.4;
    }

    .pop-row {
        display: flex;
        align-items: flex-start;
        margin-bottom: 4px;
        gap: 6px;
    }

    .pop-label {
        color: var(--bs-secondary-color);
        font-weight: 500;
    }

    .pop-value {
        font-weight: 600;
        text-align: left;
        flex: 1;
    }

    /* Bootstrap-style Icon Badges - Bigger Version */
    .calendar-event {
        width: 40px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        /* Scaled rounding */
        cursor: pointer;
        position: relative;
        z-index: 3;
        font-size: 1.4rem;
        /* Bigger icon */
        border: 1px solid rgba(0, 0, 0, 0.1);
        transition: all 0.15s ease;
    }

    .calendar-event:hover {
        transform: scale(1.1);
        z-index: 10;
    }

    .calendar-event.status-completed-bg {
        background-color: var(--status-completed-bg) !important;
        color: var(--status-completed-color) !important;
        border-color: var(--status-completed-border) !important;
    }

    .calendar-event.status-active-bg,
    .status-active-bg {
        background-color: var(--status-active-bg) !important;
        color: var(--status-active-color) !important;
        border-color: var(--status-active-border) !important;
    }

    .calendar-event.status-upcoming-bg {
        background-color: var(--status-planned-bg) !important;
        color: var(--status-planned-color) !important;
        border-color: var(--status-planned-border) !important;
    }

    .calendar-event.status-paused-bg {
        background-color: #e2e3e5 !important;
        color: #383d41 !important;
        border-color: #d6d8db !important;
    }

    .calendar-event.status-problem-bg {
        background-color: var(--status-problem-bg) !important;
        color: var(--status-problem-color) !important;
        border-color: var(--status-problem-border) !important;
    }

    .calendar-event.status-forecast-bg {
        background-color: var(--status-forecast-bg) !important;
        border: 1px dashed var(--status-forecast-border) !important;
        color: var(--status-forecast-color) !important;
    }

    .calendar-event.movement {
        background-color: var(--bs-tertiary-bg);
        color: var(--bs-body-color);
        border-left: 1px solid var(--bs-border-color) !important;
    }

    /* Legend Styles */
    .legend-item {
        display: inline-flex;
        align-items: center;
        margin-right: 1rem;
        font-size: 0.85rem;
        color: var(--bs-body-color);
    }

    .legend-box {
        width: 16px;
        height: 16px;
        border-radius: 3px;
        margin-right: 5px;
        border: 1px solid var(--bs-border-color);
    }

    /* Machine Info Card */
    #machineInfoCard {
        transition: all 0.3s ease;
    }

    /* Machine Info Card */
    #machineInfoCard .card {
        background: linear-gradient(135deg, var(--bs-tertiary-bg) 0%, var(--bs-secondary-bg) 100%) !important;
        border: 1px solid var(--bs-border-color) !important;
    }

    [data-bs-theme="dark"] #machineInfoCard .card {
        background: linear-gradient(135deg, #2b3035 0%, #212529 100%) !important;
    }

    #machineInfoCard .capability-badge {
        font-size: 0.75rem;
        padding: 3px 8px;
    }

    #machineInfoCard .activity-group {
        margin-bottom: 0.5rem;
    }

    #machineInfoCard .activity-group:last-child {
        margin-bottom: 0;
    }

    /* Legend Styles */
    .legend-container {
        background: var(--bs-tertiary-bg) !important;
        border: 1px solid var(--bs-border-color) !important;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }

    /* Calendar Activity Indicator Badges */
    .calendar-activity-badge {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        font-size: 0.6rem;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        z-index: 1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    /* Find Machine Results */
    .find-machine-row {
        transition: background-color 0.15s ease;
    }

    .find-machine-row:hover {
        background-color: rgba(var(--bs-primary-rgb), 0.1);
    }

    .find-machine-row.is-busy {
        opacity: 0.55;
    }

    /* Estimate modal capability warning */
    #estimateCapWarning {
        transition: all 0.3s ease;
    }

    /* Unplanned Objects Section */
    .unplanned-project-row {
        transition: background-color 0.2s;
    }

    .unplanned-project-row:hover {
        background-color: rgba(var(--bs-primary-rgb), 0.1);
    }

    /* Tagify custom style for unplanned filter */
    .unplanned-tagify-filter {
        border-radius: 6px !important;
        padding: 0 10px;
        min-height: 38px;
        width: 800px !important;
        max-width: 100%;
        --tag-inset-shadow-size: 1.1em;
    }

    .tagify__tag {
        margin: 2px;
    }

    /* Collapse Chevron Rotation - adjusted for parent trigger */
    [data-bs-toggle="collapse"][aria-expanded="true"] .bi-chevron-down {
        transform: rotate(180deg);
    }

    .bi-chevron-down {
        transition: transform 0.3s ease;
        display: inline-block;
        color: var(--bs-body-color);
    }

    .collapse-btn,
    .collapse-btn:focus,
    .collapse-btn:active,
    .collapse-btn:hover {
        background: none !important;
        border: none !important;
        box-shadow: none !important;
        text-decoration: none !important;
        color: inherit !important;
    }

    /* Object Envelope Indicators - REMOVED */
    /* Seamless Machine Tagify for Unplanned Table */
    .unplanned-machine-tagify {
        --tag-bg: rgba(var(--bs-primary-rgb), 0.1);
        --tag-hover: rgba(var(--bs-primary-rgb), 0.2);
        --tag-text-color: var(--bs-primary-text-emphasis);
        --tag-remove-bg: rgba(var(--bs-danger-rgb), 0.1);
        --tag-remove-btn-color: var(--bs-danger);
        --tag-inset-shadow-size: 1.1em;

        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        min-height: auto !important;
        transition: all 0.2s ease;
    }

    [data-bs-theme="dark"] .unplanned-machine-tagify {
        --tag-bg: rgba(var(--bs-primary-rgb), 0.25);
        --tag-text-color: #9ec5fe;
    }

    .unplanned-machine-tagify .tagify__tag {
        margin: 2px;
        background: var(--tag-bg);
        border-radius: 6px;
        border: 1px solid rgba(var(--bs-primary-rgb), 0.2);
    }

    .unplanned-machine-tagify .tagify__tag>div {
        padding: 0.15rem 0.5rem;
        font-weight: 600;
        font-size: 0.8rem;
    }

    .unplanned-machine-tagify .tagify__tag:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .unplanned-machine-tagify.tagify--focus {
        background: rgba(var(--bs-primary-rgb), 0.03) !important;
        border-radius: 4px;
        box-shadow: inset 0 0 0 1px rgba(var(--bs-primary-rgb), 0.2);
    }

    /* Conflict Indicator Bar */
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

    .conflict-bar.conflict-duplicate {
        /* Dual mode: Half status color, half red (#Request 5) */
        background: linear-gradient(90deg, var(--indicator-color, #0dcaf0) 0%, var(--indicator-color, #0dcaf0) 50%, #dc3545 50%, #dc3545 100%);
    }

    .conflict-bar.conflict-overlap {
        /* Pure conflict: Solid red */
        background: #dc3545;
    }

    /* Mini Calendar for Forecast Info */
    .mini-calendar-container {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        text-align: center;
        background: rgba(var(--bs-primary-rgb), 0.03);
        padding: 15px;
        border-radius: 20px;
        border: 1px solid rgba(var(--bs-primary-rgb), 0.1);
        box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.02);
    }

    .mini-calendar-day {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        border-radius: 10px;
        color: #2c3e50;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid transparent;
    }

    .mini-calendar-day.weekend {
        color: #95a5a6;
        background: rgba(0, 0, 0, 0.04);
    }

    .mini-calendar-day.forecasted {
        background: #6366f1 !important;
        /* Indigo */
        color: white !important;
        font-weight: 800;
        box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
        transform: scale(1.1);
        z-index: 2;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .mini-calendar-day.forecasted-range {
        background: rgba(99, 102, 241, 0.15);
        color: #4338ca;
        font-weight: 700;
        border-radius: 4px;
        /* Less round for range to look like a bar */
    }

    .mini-calendar-header {
        grid-column: span 7;
        font-weight: 800;
        text-transform: uppercase;
        font-size: 0.75rem;
        color: #4338ca;
        letter-spacing: 1.5px;
        margin-bottom: 12px;
        padding-bottom: 6px;
        border-bottom: 2px solid rgba(99, 102, 241, 0.1);
    }

    .mini-calendar-weekday {
        font-size: 0.7rem;
        font-weight: 800;
        color: #64748b;
        margin-bottom: 6px;
    }

    [data-bs-theme="dark"] .mini-calendar-day {
        color: #e2e8f0;
    }

    [data-bs-theme="dark"] .mini-calendar-day.weekend {
        background: rgba(255, 255, 255, 0.05);
        color: #64748b;
    }

    [data-bs-theme="dark"] .mini-calendar-day.forecasted-range {
        background: rgba(99, 102, 241, 0.3);
        color: #c7d2fe;
    }

    [data-bs-theme="dark"] .mini-calendar-header {
        color: #818cf8;
        border-bottom-color: rgba(129, 140, 248, 0.2);
    }

    .calendar-event {
        position: relative;
        /* Ensure badge is positioned relative to icon */
    }

    .unplanned-machine-tagify .tagify__input::before {
        color: var(--bs-secondary-color);
        opacity: 0.5;
        font-size: 0.75rem;
        font-style: italic;
    }

    /* Calendar Row Toggles */
    .calendar-row-header {
        background: var(--bs-tertiary-bg);
        border: 1px solid var(--bs-border-color);
        padding: 12px 20px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        user-select: none;
        backdrop-filter: blur(10px);
    }

    .calendar-row-header:hover {
        background: var(--bs-secondary-bg);
        border-color: var(--bs-primary);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .calendar-row-header .row-title {
        font-weight: 700;
        font-size: 1rem;
        color: var(--bs-heading-color);
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .calendar-row-header .row-months {
        font-size: 0.85rem;
        color: var(--bs-secondary-color);
        font-weight: 500;
    }

    .calendar-row-header .bi-chevron-down {
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        color: var(--bs-primary);
    }

    .calendar-row-header[aria-expanded="true"] .bi-chevron-down {
        transform: rotate(180deg);
    }

    .calendar-row-header[aria-expanded="true"] {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        margin-bottom: 0;
        background: rgba(var(--bs-primary-rgb), 0.05);
    }

    .calendar-row-content {
        border: 1px solid var(--bs-border-color);
        border-top: none;
        padding: 20px;
        border-bottom-left-radius: 12px;
        border-bottom-right-radius: 12px;
        margin-bottom: 1.5rem;
        background: rgba(var(--bs-body-bg-rgb), 0.4);
    }

    /* Refresh Button Animation */
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(360deg);
        }
    }

    .btn-forecast {
        background-color: var(--status-forecast-bg) !important;
        border: 1px dashed var(--status-forecast-border) !important;
        color: var(--status-forecast-color) !important;
        transition: all 0.2s ease;
    }

    .btn-forecast:hover {
        background-color: var(--status-forecast-border) !important;
        color: white !important;
        border-style: solid !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .btn-planned {
        background-color: var(--status-planned-bg) !important;
        border: 1px solid var(--status-planned-border) !important;
        color: var(--status-planned-color) !important;
        transition: all 0.2s ease;
    }

    .btn-planned:hover {
        background-color: var(--status-planned-border) !important;
        color: var(--status-planned-color) !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .btn-mobilization {
        background-color: var(--bs-tertiary-bg) !important;
        border: 1px solid var(--bs-border-color) !important;
        border-left: 4px solid var(--bs-border-color) !important;
        color: var(--bs-body-color) !important;
        transition: all 0.2s ease;
    }

    .btn-mobilization:hover {
        background-color: var(--bs-secondary-bg) !important;
        border-color: var(--bs-primary) !important;
        border-left-color: var(--bs-primary) !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
</style>

<div class="py-4">

    <div class="d-flex align-items-center mb-4">
        <a href="<?php echo BASE_URL; ?>modules/objects/objects_machines.php"
            class="btn btn-outline-secondary rounded-circle shadow-sm me-3 d-flex align-items-center justify-content-center"
            style="width: 40px; height: 40px;" title="Назад към Машини">
            <i class="bi bi-arrow-left"></i>
        </a>
        <h2 class="mb-0 fw-bold text-gradient"><i class="bi bi-clipboard2-data me-2"></i>Планиране на механизация</h2>
        <div class="ms-auto d-flex gap-2">
            <button type="button" class="btn btn-info rounded-pill shadow-sm fw-bold text-white"
                onclick="openFindMachineModal()">
                <i class="bi bi-search me-1"></i> Намери свободна машина
            </button>
        </div>
    </div>


    <!-- Unplanned Objects Section (#7/9) -->
    <div class="card card-glass rounded-4 shadow-sm border-0 mb-4">
        <div
            class="card-header bg-transparent border-0 pt-4 px-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div class="d-flex align-items-center gap-2" style="cursor: pointer;" data-bs-toggle="collapse"
                data-bs-target="#unplannedCollapse" aria-expanded="false">
                <h5 class="mb-0 fw-bold"><i class="bi bi-list-task me-2"></i>Обекти без машина</h5>
                <i class="bi bi-chevron-down fs-5"></i>
            </div>
            <div class="d-flex gap-2 align-items-center flex-grow-1 justify-content-end">
                <input type="text" id="unplannedSubtypeFilter" class="form-control rounded"
                    placeholder="Филтър по Вид..." style="width: 800px;">
                <button class="btn btn-outline-primary rounded text-nowrap" onclick="loadUnplannedProjects()">
                    <i class="bi bi-arrow-clockwise me-1"></i> Опресни
                </button>
            </div>
        </div>
        <div class="collapse" id="unplannedCollapse">
            <div class="card-body p-4">
                <div id="unplannedProjectsContainer" style="max-height: 500px; overflow-y: auto;">
                    <div class="text-center py-4 text-muted">
                        <div class="spinner-border spinner-border-sm me-2"></div> Зареждане на обекти...
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Matrix Chart Container -->
    <div class="card card-glass rounded-4 mb-4">
        <div
            class="card-header bg-transparent border-0 pt-4 px-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div class="d-flex align-items-center gap-2" style="cursor: pointer;" data-bs-toggle="collapse"
                data-bs-target="#matrixCollapse" aria-expanded="true">
                <h5 class="mb-0 fw-bold"><i class="bi bi-calendar-event me-2"></i>График и Машини</h5>
                <i class="bi bi-chevron-down fs-5"></i>
            </div>

            <!-- Machine & Year Pickers -->
            <div class="d-flex align-items-center flex-grow-1 justify-content-end flex-wrap gap-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="d-flex align-items-center gap-2">
                        <label for="objectFilter" class="form-label mb-0 fw-bold">Обект:</label>
                        <select id="objectFilter" class="form-select form-select-sm w-auto">
                            <option value="0">Всички обекти</option>
                            <!-- Populated by JS -->
                        </select>
                    </div>

                    <div class="d-flex align-items-center gap-2">
                        <label for="activityFilter" class="form-label mb-0 fw-bold">Дейност:</label>
                        <select id="activityFilter" class="form-select form-select-sm w-auto">
                            <option value="0">Всички дейности</option>
                            <!-- Populated by JS -->
                        </select>
                    </div>

                    <div class="d-flex align-items-center gap-2">
                        <label for="ganttMachinePicker" class="form-label mb-0 fw-bold">Машина:</label>
                        <select id="ganttMachinePicker" class="form-select form-select-sm w-auto">
                            <option value="">Зареждане...</option> <!-- Populated by JS -->
                        </select>
                    </div>

                    <div class="d-flex align-items-center gap-2">
                        <label for="ganttYearPicker" class="form-label mb-0 fw-bold">Година:</label>
                        <select id="ganttYearPicker" class="form-select form-select-sm w-auto">
                            <?php
                            $currentYear = date('Y');
                            for ($y = $currentYear - 1; $y <= $currentYear + 2; $y++) {
                                $selected = ($y == $currentYear) ? 'selected' : '';
                                echo "<option value=\"$y\" $selected>$y</option>";
                            }
                            ?>
                        </select>
                        <button type="button" id="refreshMatrixBtn"
                            class="btn btn-outline-primary btn-sm rounded-pill ms-1" onclick="loadYearMatrix()"
                            title="Опресни графика">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="collapse show" id="matrixCollapse">
            <div class="card-body p-4">

                <!-- Machine Info Card (#1) -->
                <div id="machineInfoCard" class="d-none mb-4">
                    <div class="card border-0 shadow-sm rounded-3">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center gap-3">
                                <small class="text-muted" id="machineInfoLocation"></small>
                            </div>
                            <div id="machineInfoQueueWrapper" class="d-none">
                                <hr class="my-3 opacity-25">
                                <div class="d-flex align-items-center justify-content-between mb-2 collapse-btn collapsed"
                                    style="cursor: pointer;" data-bs-toggle="collapse"
                                    data-bs-target="#machineInfoQueueCollapse" aria-expanded="false">
                                    <h6 class="fw-bold mb-0 text-secondary" style="font-size: 0.85rem;">
                                        <i class="bi bi-hourglass-split me-1"></i>Обекти в изчакване (без дата)
                                    </h6>
                                    <i class="bi bi-chevron-down fs-7"></i>
                                </div>
                                <div class="collapse" id="machineInfoQueueCollapse">
                                    <div id="machineInfoQueue" class="d-flex flex-column gap-2">
                                        <!-- Populated by JS #14 -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Legend -->
                    <div class="d-flex flex-wrap bg-light-subtle p-3 rounded-3 shadow-sm border mt-3 gap-3">
                        <div class="d-flex align-items-center">
                            <div class="d-flex gap-1 me-2">
                                <div class="rounded d-flex align-items-center justify-content-center"
                                    style="width: 32px; height: 32px; background-color: var(--bs-tertiary-bg); border-left: 3px solid var(--bs-border-color); color: var(--bs-body-color); border-radius: 8px !important;">
                                    <i class="bi bi-truck" style="font-size: 1.1rem;"></i>
                                </div>
                                <div class="rounded d-flex align-items-center justify-content-center status-active-bg"
                                    style="width: 32px; height: 32px; background-color: var(--status-active-bg) !important; border: 1px solid var(--status-active-border); color: var(--status-active-color); border-radius: 8px !important;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                        stroke-linecap="round" stroke-linejoin="round"
                                        style="width: 20px; height: 20px;">
                                        <path d="M3 15h18M5 15l1-6h6l1 6M13 9l6-4h2M13 9l-1 3M16 11l-2 4" />
                                        <circle cx="6" cy="18" r="2" />
                                        <circle cx="18" cy="18" r="2" />
                                    </svg>
                                </div>
                            </div>
                            <small class="fw-bold">Активен обект</small>
                        </div>
                        <div class="d-flex align-items-center">
                            <div class="d-flex gap-1 me-2">
                                <div class="rounded d-flex align-items-center justify-content-center"
                                    style="width: 32px; height: 32px; background-color: var(--bs-tertiary-bg); border-left: 3px solid var(--bs-border-color); color: var(--bs-body-color); border-radius: 8px !important;">
                                    <i class="bi bi-truck" style="font-size: 1.1rem;"></i>
                                </div>
                                <div class="rounded d-flex align-items-center justify-content-center status-upcoming-bg"
                                    style="width: 32px; height: 32px; background-color: var(--status-planned-bg) !important; border: 1px solid var(--status-planned-border); color: var(--status-planned-color); border-radius: 8px !important;">
                                    <i class="bi bi-calendar2-week" style="font-size: 1.1rem;"></i>
                                </div>
                            </div>
                            <small class="fw-bold">Мобилизация</small>
                        </div>
                        <div class="d-flex align-items-center">
                            <div class="rounded me-2 d-flex align-items-center justify-content-center status-forecast-bg"
                                style="width: 32px; height: 32px; background-color: var(--status-forecast-bg) !important; border: 1px dashed var(--status-forecast-border); color: var(--status-forecast-color); border-radius: 8px !important;">
                                <i class="bi bi-graph-up" style="font-size: 1.1rem;"></i>
                            </div>
                            <small class="fw-bold">Прогноза</small>
                        </div>
                        <div class="d-flex align-items-center ms-lg-auto pt-2 pt-lg-0">
                            <div class="rounded-pill bg-danger me-2"
                                style="width: 20px; height: 6px; box-shadow: 0 0 5px rgba(239, 68, 68, 0.4);"></div>
                            <small class="fw-bold opacity-75 text-muted">Застъпване на обекти / Дублирани
                                събития</small>
                        </div>
                    </div>
                </div>

                <div class="row" id="ganttContainer">
                    <div class="col-12 text-center p-5 text-muted">
                        <i class="bi bi-arrow-left-circle display-4"></i>
                        <p class="mt-2 text-dark fs-5">Моля, изберете машина от филтъра горе.</p>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- Day Events Consolidated Modal -->
<div class="modal fade" id="dayEventsModal" tabindex="-1" aria-labelledby="dayEventsModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="dayEventsModalLabel">Графици и събития за деня</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4" id="dayEventsModalBody">
                <!-- Dynamically populated events list -->
            </div>
            <div class="modal-footer border-top-0 pt-0">
                <button type="button" class="btn btn-secondary rounded-pill px-4"
                    data-bs-dismiss="modal">Затвори</button>
            </div>
        </div>
    </div>
</div>

<!-- Add/Edit Estimate Modal (from Unplanned/Specific Object) -->
<div class="modal fade" id="estimateModal" tabindex="-1" aria-labelledby="estimateModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="estimateModalLabel">Прогнозен график за машина</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="estimateForm">
                    <input type="hidden" id="estimate_id" name="estimate_id" value="0">
                    <input type="hidden" id="est_request_id" name="request_id" value="0">
                    <input type="hidden" id="est_schedule_id" name="schedule_id" value="0">
                    <input type="hidden" name="action" value="save_estimate">

                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <label for="machine_id" class="form-label">Машина <span class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input id="machine_id" name="machine_id" placeholder="Изберете машина..." required>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <label for="est_activity_type_id" class="form-label">Дейност</label>
                            <div class="tagify-styled-wrapper">
                                <select class="form-select" id="est_activity_type_id" name="activity_type_id">
                                    <option value="">— Изберете —</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <label for="est_capability_name" class="form-label">Спецификация</label>
                            <div class="tagify-styled-wrapper">
                                <select class="form-select" id="est_capability_name" name="capability_name">
                                    <option value="">— Изберете —</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <label for="est_activity_subtype" class="form-label">Вид (под-дейност)</label>
                            <div class="tagify-styled-wrapper">
                                <input class="form-control" id="est_activity_subtype" name="activity_subtype"
                                    placeholder="напр. Набивни">
                            </div>
                        </div>
                        <div class="col-12 d-none" id="estimateCapWarning">
                            <div class="alert alert-warning mb-0 py-2 px-3 d-flex align-items-center gap-2">
                                <i class="bi bi-exclamation-triangle-fill"></i>
                                <small>Тази машина няма дефинирани дейности. Можете да ги настроите в "Управление на
                                    машини".</small>
                            </div>
                        </div>

                        <div class="col-md-12">
                            <label for="object_name" class="form-label">Обект за прогноза <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input class="form-control" id="object_name" name="object_name"
                                    placeholder="Въведете име на обекта..." required>
                            </div>
                        </div>

                        <div class="col-12"></div> <!-- Line break force -->

                        <div class="col-md-6">
                            <label for="start_date" class="form-label">От Дата <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="form-control planning-datepicker" id="start_date"
                                    name="start_date" required>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <label for="end_date" class="form-label">До Дата <span class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" class="form-control planning-datepicker" id="end_date"
                                    name="end_date" required>
                            </div>
                        </div>

                        <div class="col-md-12">
                            <label for="notes" class="form-label">Забележки</label>
                            <div class="tagify-styled-wrapper">
                                <textarea class="form-control" id="notes" name="notes" rows="3"
                                    placeholder="Допълнителна информация или причина за прогнозата..."></textarea>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-danger rounded-pill px-4 d-none"
                    id="deleteEstimateBtn">Изтрий</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="saveEstimateBtn">Запази
                    Прогноза</button>
            </div>
        </div>
    </div>
</div>

<!-- Action Selector Modal -->
<div class="modal fade" id="actionSelectorModal" tabindex="-1" aria-labelledby="actionSelectorModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="actionSelectorModalLabel">Избор на действие</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4 text-center">
                <div class="d-grid gap-3">
                    <button type="button" class="btn btn-warning rounded-pill py-2 shadow-sm fw-bold"
                        onclick="proceedToEstimate()">
                        <i class="bi bi-calendar-plus me-2"></i>Добави Прогноза
                    </button>
                    <button type="button" class="btn btn-primary rounded-pill py-2 shadow-sm fw-bold"
                        onclick="proceedToMovement()">
                        <i class="bi bi-truck me-2"></i>Добави Мобилизация
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Add/Edit Movement Modal (Copied from movements page) -->
<div class="modal fade" id="movementModal" tabindex="-1" aria-labelledby="movementModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="movementModalLabel">Мобилизация</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <div class="row g-4">
                    <!-- Left: Form -->
                    <div class="col-lg-8 border-end">
                        <form id="movementForm">
                            <input type="hidden" id="movement_id" name="movement_id" value="0">
                            <input type="hidden" name="action" value="save_movement">

                            <div class="row g-3 mb-4">
                                <div class="col-md-12">
                                    <label for="object_select" class="form-label">Обект <span
                                            class="text-danger">*</span></label>
                                    <div class="tagify-styled-wrapper">
                                        <input id="object_select" placeholder="Избери обект...">
                                    </div>
                                </div>
                            </div>
                            <div class="row g-3 mb-4">
                                <div class="col-md-12">
                                    <label for="schedule_id" class="form-label">Дейност <span
                                            class="text-danger">*</span></label>
                                    <div class="tagify-styled-wrapper">
                                        <input id="schedule_id" name="schedule_id" placeholder="Избери дейност...">
                                    </div>
                                </div>
                            </div>

                            <div class="row g-3 mb-4">
                                <div class="col-md-6">
                                    <label for="move_machine_id" class="form-label">Машина <span
                                            class="text-danger">*</span></label>
                                    <div class="tagify-styled-wrapper">
                                        <input id="move_machine_id" name="machine_id" placeholder="Изберете машина..."
                                            required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label for="carrier" class="form-label">Превозвач <span
                                            class="text-danger">*</span></label>
                                    <div class="tagify-styled-wrapper">
                                        <input type="text" id="carrier" name="carrier" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label for="arrival_date" class="form-label">Планирана начална дата</label>
                                    <div class="tagify-styled-wrapper">
                                        <input type="text" id="arrival_date" name="arrival_date"
                                            class="form-control planning-datepicker" placeholder="дд.мм.гггг">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label for="departure_date" class="form-label">Планирана крайна дата</label>
                                    <div class="tagify-styled-wrapper">
                                        <input type="text" id="departure_date" name="departure_date"
                                            class="form-control planning-datepicker" placeholder="дд.мм.гггг">
                                    </div>
                                </div>

                                <div class="col-md-6">
                                    <label for="from_site_id" class="form-label">От (Обект/База)</label>
                                    <div class="tagify-styled-wrapper">
                                        <input id="from_site_id" name="from_site_id" placeholder="Търси обект/база...">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label for="to_site_id" class="form-label">Към (Обект/База)</label>
                                    <div class="tagify-styled-wrapper">
                                        <input id="to_site_id" name="to_site_id" placeholder="Търси обект/база...">
                                    </div>
                                </div>

                                <div class="col-md-12">
                                    <label for="notes" class="form-label">Бележки</label>
                                    <div class="tagify-styled-wrapper">
                                        <textarea id="notes" name="notes" rows="3"></textarea>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    <!-- Right: Info / Calendar -->
                    <div class="col-lg-4">
                        <div class="h-100 d-flex flex-column">
                            <h6 class="fw-bold mb-3 text-info"><i class="bi bi-calendar3 me-2"></i>Данни от Прогноза
                            </h6>
                            <div id="forecastInfoContainer" class="flex-grow-1">
                                <div class="text-center py-5 text-muted">
                                    <i class="bi bi-info-circle display-4 d-block mb-2"></i>
                                    Изберете дейност и машина, за да видите прогнозираните дати.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="saveMovementBtn">Запази</button>
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
                                <span class="text-secondary fw-bold small text-uppercase">Изпълнение (Количество)</span>
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

<!-- Find Available Machine Modal (#6) -->
<div class="modal fade" id="findMachineModal" tabindex="-1" aria-labelledby="findMachineModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="findMachineModalLabel"><i class="bi bi-search me-2"></i>Намери
                    свободна машина</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <label for="find_start_date" class="form-label">От Дата <span
                                class="text-danger">*</span></label>
                        <input type="text" class="form-control planning-datepicker" id="find_start_date">
                    </div>
                    <div class="col-md-4">
                        <label for="find_end_date" class="form-label">До Дата <span class="text-danger">*</span></label>
                        <input type="text" class="form-control planning-datepicker" id="find_end_date">
                    </div>
                    <div class="col-md-3">
                        <label for="find_activity_type" class="form-label">Дейност</label>
                        <select class="form-select" id="find_activity_type">
                            <option value="0">Всички</option>
                        </select>
                    </div>
                    <div class="col-md-1 d-flex align-items-end">
                        <button type="button" class="btn btn-primary w-100" onclick="searchAvailableMachines()">
                            <i class="bi bi-search"></i>
                        </button>
                    </div>
                </div>

                <div id="findMachineResults">
                    <div class="text-center text-muted py-5">
                        <i class="bi bi-funnel display-4"></i>
                        <p class="mt-2">Изберете период и натиснете бутона за търсене.</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Затвори</button>
            </div>
        </div>
    </div>
</div>

<!-- Confirmation Modal -->
<div class="modal fade" id="confirmModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content card-glass border-0 shadow-lg">
            <div class="modal-body p-4 text-center">
                <div class="mb-3 text-warning">
                    <i class="bi bi-exclamation-triangle-fill display-4"></i>
                </div>
                <h5 class="fw-bold mb-2" id="confirmModalTitle">Потвърждение</h5>
                <p class="text-secondary mb-4" id="confirmModalMessage">Сигурни ли сте, че искате да
                    извършите това
                    действие?</p>
                <div class="d-flex gap-2 justify-content-center">
                    <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Отказ</button>
                    <button type="button" class="btn btn-danger rounded-pill px-4" id="confirmModalBtn">Изтрий</button>
                </div>
            </div>
        </div>
    </div>
</div>
</div>

<!-- Tagify JS loaded globally via import_js.php -->

<!-- Load Custom JS for Planning -->
<!-- Custom Planning Scripts (Modular refactoring #8) -->
<script
    src="<?php echo BASE_URL; ?>modules/objects/js/planning/planning_globals.js?v=<?= filemtime(__DIR__ . '/js/planning/planning_globals.js') ?>"></script>
<script
    src="<?php echo BASE_URL; ?>modules/objects/js/planning/planning_utils.js?v=<?= filemtime(__DIR__ . '/js/planning/planning_utils.js') ?>"></script>
<script
    src="<?php echo BASE_URL; ?>modules/objects/js/planning/planning_api.js?v=<?= filemtime(__DIR__ . '/js/planning/planning_api.js') ?>"></script>
<script
    src="<?php echo BASE_URL; ?>modules/objects/js/planning/planning_ui.js?v=<?= filemtime(__DIR__ . '/js/planning/planning_ui.js') ?>"></script>
<script
    src="<?php echo BASE_URL; ?>modules/objects/js/planning/planning_modals.js?v=<?= filemtime(__DIR__ . '/js/planning/planning_modals.js') ?>"></script>
<script
    src="<?php echo BASE_URL; ?>modules/objects/js/planning/planning_unplanned.js?v=<?= filemtime(__DIR__ . '/js/planning/planning_unplanned.js') ?>"></script>
<script
    src="<?php echo BASE_URL; ?>modules/objects/js/planning/planning_main.js?v=<?= filemtime(__DIR__ . '/js/planning/planning_main.js') ?>"></script>

<?php
$content = ob_get_clean();
require_once PROJECT_ROOT . '/templates/layout.php';
?>