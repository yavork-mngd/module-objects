<?php
// /modules/objects/objects_project_schedules.php

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

$page_title = 'График Обекти';

// Start HTML output
ob_start();

// Fetch site options for Tagify
$all_sites = [];
$db_conn = OpenCon();
$sites_res = $db_conn->query("SELECT request_id as id, обект_име as value FROM requests_main WHERE обект_име IS NOT NULL AND обект_име != '' ORDER BY обект_име");
if ($sites_res) {
    while ($row = $sites_res->fetch_assoc()) {
        $all_sites[] = $row;
    }
}
?>
<script>
    window.allSitesWhitelist = <?php echo json_encode($all_sites); ?>;
</script>
<?php include PROJECT_ROOT . '/templates/header.php'; ?>
<link rel="stylesheet" href="<?php echo BASE_URL; ?>modules/objects/css/objects.css">


<div id="objects-project-schedules-container" class="py-4" data-animation="fade-in-up" data-animation-delay="100">

    <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="mb-0 fw-bold text-gradient"><i class="bi bi-calendar-range me-2"></i>График Обекти</h2>
        <button type="button" class="btn btn-primary rounded-pill shadow-sm" data-bs-toggle="modal"
            data-bs-target="#newObjectModal" onclick="resetNewObjectModal()">
            <i class="bi bi-plus-circle me-1"></i> Нов Обект
        </button>
    </div>

    <!-- Filter Section -->
    <div class="card card-glass mb-4 rounded-4" data-animation="fade-in-up" data-animation-delay="200">
        <div class="card-body p-4">
            <form id="schedule-search-form" class="row g-3" onsubmit="return false;">
                <div class="col-md-12">
                    <label for="search_schedule"
                        class="form-label text-muted small text-uppercase fw-semibold">Търсене</label>
                    <div class="tagify-styled-wrapper">
                        <input type="text" id="search_schedule" name="search_schedule"
                            placeholder="Търсене по клиент, обект, машина или дейност и натиснете Enter...">
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- Table Section -->
    <div class="card card-glass rounded-4 shadow-sm"
        style="height: calc(100vh - 350px); display: flex; flex-direction: column;" data-animation="fade-in-up"
        data-animation-delay="300">
        <div class="card-body px-0 py-3 d-flex flex-column overflow-hidden">
            <div class="table-responsive flex-grow-1" style="overflow-y: auto; scrollbar-gutter: stable;">
                <table class="table table-hover align-middle mb-0" id="schedulesTable"
                    style="--bs-table-bg: transparent; --bs-table-color-type: inherit;">
                    <tbody id="schedulesTableBody">
                        <!-- Populated via AJAX -->
                        <tr>
                            <td colspan="12" class="text-center p-5 text-muted">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2 mb-0">Зареждане...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- Add/Edit Schedule Modal -->
<div class="modal fade" id="scheduleModal" tabindex="-1" aria-labelledby="scheduleModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="scheduleModalLabel">Редактирай График / Добави Дейност</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="scheduleForm">
                    <input type="hidden" id="schedule_id" name="schedule_id" value="0">
                    <input type="hidden" name="action" value="save_schedule">

                    <div class="row g-3">
                        <div class="d-none">
                            <label for="client_id" class="form-label">Клиент</label>
                            <input class="form-control" id="client_id" name="client_id" placeholder="Търси клиент...">
                        </div>

                        <!-- 1. Обект + записи от запитването -->
                        <div class="col-12">
                            <h6 class="text-muted fw-bold mb-3"><span class="badge bg-primary rounded-pill me-2">1</span>Обект</h6>
                        </div>

                        <div class="col-md-12">
                            <label for="request_id" class="form-label">Обект <span class="text-danger">*</span></label>
                            <div id="request_id_tagify_wrapper" class="tagify-styled-wrapper">
                                <input id="request_id" name="request_id" placeholder="Търси обект..." required>
                            </div>
                            <div id="request_id_locked_wrapper" class="tagify-styled-wrapper d-none">
                                <input id="request_id_locked_display" readonly disabled>
                            </div>
                        </div>


                        <div class="col-12 d-none" id="request_records_panel">
                            <label class="form-label d-flex justify-content-between align-items-center w-100">
                                <span>Записи от запитването <small class="text-muted">(изберете, за да попълните автоматично)</small></span>
                                <small class="text-secondary" style="cursor: pointer;" onclick="clearRequestRecordSelection()">изчисти</small>
                            </label>
                            <div id="request_records_list" class="list-group list-group-flush border rounded-3"
                                style="max-height: 220px; overflow-y: auto;"></div>
                        </div>

                        <div class="col-12 mt-4 pt-2 border-top">
                            <h6 class="text-muted fw-bold mb-3"><span class="badge bg-primary rounded-pill me-2">2</span>Дейност</h6>
                        </div>

                        <div class="col-md-6">
                            <label for="activity_type_id" class="form-label">Дейност <span
                                    class="text-danger">*</span></label>
                            <div id="activity_id_wrapper" class="tagify-styled-wrapper">
                                <input id="activity_tagify" placeholder="Изберете дейност...">
                                <!-- Native select kept as the data source/value holder; Tagify above is the visible control -->
                                <select class="d-none" id="activity_type_id" name="activity_type_id"
                                    onchange="if(typeof window.updateMachineOptions === 'function') window.updateMachineOptions();">
                                    <option value="" disabled selected>Изберете дейност...</option>
                                </select>
                            </div>
                            <div id="activity_locked_wrapper" class="tagify-styled-wrapper d-none">
                                <input id="activity_locked_display" readonly disabled>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label for="capability_name" class="form-label">Вид дейност</label>
                            <div id="capability_id_wrapper" class="tagify-styled-wrapper">
                                <input type="text" id="capability_name" name="capability_name"
                                    placeholder="Изберете за бързо въвеждане...">
                            </div>
                            <div id="capability_locked_wrapper" class="tagify-styled-wrapper d-none">
                                <input id="capability_locked_display" readonly disabled>
                            </div>
                        </div>
                        <div class="col-md-12">
                            <label for="activity_subtype" class="form-label">Допълнително описание</label>
                            <input type="text" class="form-control" id="activity_subtype" name="activity_subtype"
                                placeholder="Напр. Специфично описание на дейността...">
                        </div>
                        <div class="col-md-12">
                            <div id="machine-details-container" class="mt-3">
                                <!-- Dynamic machine assignment rows will appear here -->
                            </div>
                        </div>
                        <div class="col-md-12" style="display: none !important;">
                            <label for="machine_ids"
                                class="form-label d-flex justify-content-between align-items-center w-100">
                                <span>Машини</span>
                                <small class="text-secondary opacity-75"
                                    style="cursor: pointer; transition: opacity 0.2s;"
                                    onmouseover="this.classList.remove('opacity-75')"
                                    onmouseout="this.classList.add('opacity-75')"
                                    onclick="if(window.tagifyMachines) window.tagifyMachines.removeAllTags();"
                                    title="Изчисти избора">изчисти</small>
                            </label>
                            <div class="tagify-styled-wrapper">
                                <input id="machine_ids" name="machine_ids" placeholder="Изберете машини...">
                            </div>
                        </div>

                        <!-- 1. Количества и срокове (Moved to top) -->
                        <div class="col-12 mt-4 pt-2 border-top">
                            <h6 class="text-muted fw-bold mb-3"><span class="badge bg-primary rounded-pill me-2">3</span>Количества</h6>
                        </div>

                        <div class="col-md-3">
                            <label for="total_quantity"
                                class="form-label d-flex justify-content-between align-items-center w-100">
                                <span>Общо к-во <span class="text-danger">*</span></span>
                                <span class="note-toggle-icon ms-2" onclick="toggleNoteField('note_quantity_container')"
                                    title="Добави бележка">
                                    <i class="bi bi-chat-right-text-fill text-muted"></i>
                                </span>
                            </label>
                            <div class="tagify-styled-wrapper">
                                <input type="number" step="0.01" id="total_quantity" name="total_quantity" required>
                            </div>
                            <div id="note_quantity_container" class="mt-2 d-none">
                                <div class="tagify-styled-wrapper">
                                    <input type="text" id="note_quantity" name="note_quantity"
                                        placeholder="Причина за промяна...">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <label for="dimension_info" class="form-label">Доп. размер (м)</label>
                            <div class="tagify-styled-wrapper">
                                <input type="number" step="0.01" id="dimension_info" name="dimension_info">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <label for="daily_productivity_plan" class="form-label">Дневен план</label>
                            <div class="tagify-styled-wrapper">
                                <input type="number" step="0.01" id="daily_productivity_plan"
                                    name="daily_productivity_plan">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <label for="planned_days"
                                class="form-label d-flex justify-content-between align-items-center w-100">
                                <span>Дни общо</span>
                                <span class="note-toggle-icon ms-2" onclick="toggleNoteField('note_plan_container')"
                                    title="Добави бележка">
                                    <i class="bi bi-chat-right-text-fill text-muted"></i>
                                </span>
                            </label>
                            <div class="tagify-styled-wrapper">
                                <input type="number" step="0.01" id="planned_days" name="planned_days">
                            </div>
                            <div id="note_plan_container" class="mt-2 d-none">
                                <div class="tagify-styled-wrapper">
                                    <input type="text" id="note_plan" name="note_plan"
                                        placeholder="Причина за промяна...">
                                </div>
                            </div>
                        </div>

                        <!-- 2. Изпълнение (Moved to top) -->
                        <div class="col-12 d-none" id="extra_projects_wrapper">
                            <label class="form-label small text-muted mb-2">Допълнителни проекти от записа - всеки се запазва като отделен ред в графика</label>
                            <div id="extra_projects_container"></div>
                        </div>

                        <div class="col-12 mt-4 pt-2 border-top">
                            <h6 class="text-muted fw-bold mb-3"><span class="badge bg-primary rounded-pill me-2">4</span>Срокове и статус</h6>
                        </div>

                        <div class="col-md-4">
                            <label for="start_date"
                                class="form-label d-flex justify-content-between align-items-center w-100 mb-1">
                                <span>Начална дата</span>
                                <span class="note-toggle-icon ms-2" onclick="toggleNoteField('note_period_container')"
                                    title="Добави бележка">
                                    <i class="bi bi-chat-right-text-fill text-muted"></i>
                                </span>
                            </label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" id="start_date" name="start_date" placeholder="дд.мм.гггг"
                                    autocomplete="off">
                            </div>
                            <div id="note_period_container" class="mt-2 d-none">
                                <div class="tagify-styled-wrapper">
                                    <input type="text" id="note_period" name="note_period"
                                        placeholder="Причина за промяна...">
                                </div>
                            </div>
                        </div>

                        <div class="col-md-4">
                            <label for="end_date"
                                class="form-label d-flex justify-content-between align-items-center w-100 mb-1">
                                <span>Крайна дата</span>
                                <span class="note-toggle-icon ms-2" onclick="toggleNoteField('note_end_container')"
                                    title="Добави бележка">
                                    <i class="bi bi-chat-right-text-fill text-muted"></i>
                                </span>
                            </label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" id="end_date" name="end_date" placeholder="дд.мм.гггг"
                                    autocomplete="off">
                            </div>
                            <div id="note_end_container" class="mt-2 d-none">
                                <div class="tagify-styled-wrapper">
                                    <input type="text" id="note_end" name="note_end"
                                        placeholder="Причина за промяна...">
                                </div>
                            </div>
                        </div>

                        <div class="col-md-4">
                            <label for="status"
                                class="form-label d-flex justify-content-between align-items-center w-100">
                                <span>Статус</span>
                                <span class="note-toggle-icon ms-2" onclick="toggleNoteField('note_status_container')"
                                    title="Добави бележка">
                                    <i class="bi bi-chat-right-text-fill text-muted"></i>
                                </span>
                            </label>
                            <div class="tagify-styled-wrapper">
                                <select class="form-select" id="status" name="status">
                                    <option value="не стартирали" selected>Не стартирали</option>
                                    <option value="стартирали">Стартирали</option>
                                    <option value="в пауза">В пауза</option>
                                    <option value="приключен">Приключен</option>
                                    <option value="спрян">Спрян</option>
                                    <option value="проблем">Проблем</option>
                                </select>
                            </div>
                            <div id="note_status_container" class="mt-2 d-none">
                                <div class="tagify-styled-wrapper">
                                    <input type="text" id="note_status" name="note_status"
                                        placeholder="Причина за промяна...">
                                </div>
                            </div>
                        </div>

                    </div>
                </form>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="saveScheduleBtn">Запази</button>
            </div>
        </div>
    </div>
</div>

<!-- Start New Object Modal -->
<div class="modal fade" id="newObjectModal" tabindex="-1" aria-labelledby="newObjectModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="newObjectModalLabel">Добави нов обект към графика</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="newObjectForm">
                    <input type="hidden" name="action" value="save_new_object">
                    <div class="row g-3">
                        <div class="col-12">
                            <label for="new_request_id" class="form-label">Обект <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input id="new_request_id" name="request_id" placeholder="Търси обект..." required>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="saveNewObjectBtn">Запази</button>
            </div>
        </div>
    </div>
</div>

<!-- Progress Logs Modal -->
<div class="modal fade" id="progressLogsModal" tabindex="-1" aria-labelledby="progressLogsModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="progressLogsModalLabel">Отчети за изпълнение</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">

                <!-- Display context info about the schedule -->
                <div class="glass-context-box mb-4" id="logContextAlert">
                    <!-- JS populated context info -->
                </div>

                <!-- Add new log form -->
                <form id="logForm" class="mb-4 rounded-3 p-3 border-0">
                    <input type="hidden" id="log_schedule_id" name="schedule_id" value="">
                    <input type="hidden" name="action" value="save_log">

                    <h6 class="mb-3 fw-bold text-primary"><i class="bi bi-plus-circle me-2"></i>Добави отчет</h6>
                    <div class="row g-3">
                        <div class="col-md-3">
                            <label for="work_date" class="form-label">Дата <span class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input type="date" id="work_date" name="work_date" required>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <label for="quantity_completed" class="form-label">Количество <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input type="number" step="0.01" id="quantity_completed" name="quantity_completed"
                                    required>
                            </div>
                        </div>
                        <div class="col-md-5">
                            <label for="log_notes" class="form-label">Бележки / Проблеми</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" id="log_notes" name="notes" placeholder="Опционално обяснение...">
                            </div>
                        </div>
                        <div class="col-md-1 d-flex align-items-end">
                            <button type="button" class="btn btn-primary w-100" id="saveLogBtn" title="Запази отчет">
                                <i class="bi bi-check-lg"></i>
                            </button>
                        </div>
                    </div>
                </form>

                <!-- History Table -->
                <h6 class="fw-bold mb-3"><i class="bi bi-clock-history me-2"></i>История на отчетите</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle border mb-0" id="logsTable">
                        <thead class="table-glass">
                            <tr>
                                <th>Дата</th>
                                <th>Изработено</th>
                                <th>Бележки</th>
                                <th>Въведено от</th>
                                <th class="text-center" style="width: 80px;">Изтрий</th>
                            </tr>
                        </thead>
                        <tbody id="logsTableBody">
                            <!-- Populated via AJAX -->
                        </tbody>
                    </table>
                </div>

            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Затвори</button>
            </div>
        </div>
    </div>
</div>

<!-- Timeline & Notes Modal -->
<div class="modal fade" id="timelineModal" tabindex="-1" aria-labelledby="timelineModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="timelineModalLabel">Хронология на графика</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <div class="glass-context-box mb-4" id="timelineContextAlert">
                    <!-- Dynamic context -->
                </div>

                <div class="timeline-container px-2" id="timelineContainer">
                    <!-- Timeline items injected here via JS -->
                    <div class="text-center text-muted py-4">Зареждане...</div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Object Matrix Modal -->
<div class="modal fade" id="objectMatrixModal" tabindex="-1" aria-labelledby="objectMatrixModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable" style="max-width: 95vw;">
        <div class="modal-content border-0 shadow-lg card-glass" style="max-height: 90vh;">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold text-primary" id="objectMatrixModalLabel">
                    <i class="bi bi-calendar-range me-2"></i>Календарен изглед - <span id="matrixObjectName"></span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4" style="overflow-y: auto; overflow-x: hidden;">
                <!-- Month Picker & Controls -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div class="d-flex align-items-center gap-2">
                        <label for="matrixMonthPicker" class="form-label mb-0 fw-bold">Избери месец:</label>
                        <div class="tagify-styled-wrapper">
                            <input type="month" id="matrixMonthPicker" style="width: 160px;">
                        </div>
                    </div>
                </div>

                <div class="rounded shadow-sm border card-glass w-100" id="matrixContainer" style="overflow-x: auto;">
                    <table class="table table-bordered table-sm align-middle text-center mb-0" id="matrixTable">
                        <!-- Populated via JS -->
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Change Client Modal -->
<div class="modal fade" id="changeClientModal" tabindex="-1" aria-labelledby="changeClientModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold text-primary" id="changeClientModalLabel">
                    <i class="bi bi-person-lines-fill me-2"></i>Смени клиент
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <div class="alert alert-secondary border border-secondary-subtle rounded-3 mb-4 text-center">
                    <span class="fw-bold fs-5 text-primary" id="changeClientObjectName">Обект</span>
                </div>
                <form id="changeClientForm">
                    <input type="hidden" name="action" value="change_object_client">
                    <input type="hidden" id="change_client_request_id" name="request_id" value="">

                    <div class="row g-3">
                        <div class="col-12">
                            <label for="change_client_id" class="form-label">Нов Клиент <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input id="change_client_id" name="change_client_id" placeholder="Търси клиент..."
                                    required>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="saveChangeClientBtn"
                    onclick="saveChangeClient()">Запази</button>
            </div>
        </div>
    </div>
</div>

<!-- Quick Log Modal -->
<div class="modal fade" id="quickLogModal" tabindex="-1" aria-labelledby="quickLogModalLabel" aria-hidden="true"
    style="z-index: 1060;">
    <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="quickLogModalLabel">
                    <i class="bi bi-plus-circle me-2"></i>Добави отчет
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">

                <div class="glass-context-box mb-4 text-center">
                    <span class="fw-bold text-primary" id="quickActivityName">Дейност</span><br>
                    <small class="text-muted" id="quickDateDisplay">Ден: --</small>
                </div>

                <form id="quickLogForm" class="rounded-3">
                    <input type="hidden" id="quick_schedule_id" name="schedule_id">
                    <input type="hidden" id="quick_work_date" name="work_date">

                    <div class="row g-3">
                        <div class="col-md-4">
                            <label for="quick_quantity" class="form-label">Количество <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input type="number" step="0.01" id="quick_quantity" name="quantity_completed" required>
                            </div>
                        </div>
                        <div class="col-md-8">
                            <label for="quick_notes" class="form-label">Бележки / Проблеми</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" id="quick_notes" name="notes" placeholder="Опционално обяснение...">
                            </div>
                        </div>
                        <div class="col-md-12 d-flex justify-content-end mt-4">
                            <button type="submit" class="btn btn-primary px-4 rounded-pill" id="quickSaveLogBtn">
                                Запиши
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<style>
    /* Custom mini-timeline styles */
    .timeline-container {
        position: relative;
        border-left: 2px solid var(--bs-primary-border-subtle, #dee2e6);
        margin-left: 15px;
        padding-left: 20px;
    }

    .timeline-item {
        position: relative;
        margin-bottom: 1.5rem;
    }

    .timeline-item::before {
        content: '';
        position: absolute;
        left: -26px;
        /* 20px padding + half of marker width */
        top: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: var(--bs-primary);
        border: 2px solid #fff;
        z-index: 1;
    }

    .timeline-item.category-quantity::before {
        background-color: var(--bs-success);
    }

    .timeline-item.category-plan::before {
        background-color: var(--bs-warning);
    }

    .timeline-item.category-status::before {
        background-color: var(--bs-danger);
    }

    .timeline-item.category-period::before {
        background-color: var(--bs-info);
    }

    .timeline-item.category-progress::before {
        background-color: var(--bs-primary);
        border-radius: 2px;
    }

    /* Progress logs slightly different shape */

    .timeline-date {
        font-size: 0.75rem;
        color: var(--bs-gray-600);
        margin-bottom: 2px;
    }

    .timeline-content {
        background: var(--bs-secondary-bg-subtle);
        padding: 10px;
        border-radius: 8px;
        font-size: 0.9rem;
    }

    .timeline-user {
        font-size: 0.7rem;
        color: var(--bs-gray-500);
        text-align: right;
        margin-top: 5px;
    }

    /* Note toggle icon styles */
    .note-toggle-icon {
        cursor: pointer;
        opacity: 0.5;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 5px;
        border-radius: 4px;
    }

    .note-toggle-icon:hover {
        opacity: 1;
        background-color: var(--bs-secondary-bg-subtle);
        transform: scale(1.1);
    }
</style>

<script>
    function triggerProjectSchedulesInit() {
        if (typeof window.initProjectSchedules === 'function') {
            window.initProjectSchedules();
        } else {
            // Try again in 50ms if the external script hasn't loaded yet
            setTimeout(triggerProjectSchedulesInit, 50);
        }
    }

    // Try immediately (works for AJAX/HTMX parsing if external scripts are cached)
    triggerProjectSchedulesInit();

    // Fallback for hard refreshes
    document.addEventListener('DOMContentLoaded', triggerProjectSchedulesInit);
</script>

<?php
$content = ob_get_clean();
require_once PROJECT_ROOT . '/templates/layout.php';
?>