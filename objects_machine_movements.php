<?php
// /modules/objects/objects_machine_movements.php

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

$page_title = 'Движение на механизация';

// Start HTML output
ob_start();
?>
<?php include PROJECT_ROOT . '/templates/header.php'; ?>


<div id="objects-machine-movements-container" class="py-4">

    <div class="d-flex align-items-center mb-4">
        <a href="<?php echo BASE_URL; ?>modules/objects/objects_machines.php"
            class="btn btn-outline-secondary rounded-circle shadow-sm me-3 d-flex align-items-center justify-content-center"
            style="width: 40px; height: 40px;" title="Назад към Машини" data-no-animation="true">
            <i class="bi bi-arrow-left"></i>
        </a>
        <h2 class="mb-0 fw-bold text-gradient"><i class="bi bi-truck me-2"></i>Движение на механизация</h2>
        <div class="ms-auto d-flex gap-2">
            <button type="button" class="btn btn-primary rounded-pill shadow-sm" data-bs-toggle="modal"
                data-bs-target="#movementModal" onclick="resetMovementModal()">
                <i class="bi bi-plus-circle me-1"></i> Ново Движение
            </button>
        </div>
    </div>

    <!-- Filter Section -->
    <div class="card card-glass mb-4 rounded-4">
        <div class="card-body p-4">
            <form id="movement-search-form" class="row g-3" onsubmit="return false;">
                <div class="col-md-12">
                    <label for="search_movement"
                        class="form-label text-muted small text-uppercase fw-semibold">Търсене</label>
                    <input type="text" id="search_movement" name="search_movement" class="form-control"
                        placeholder="Търсене по машина, обект, превозвач или дата (дд.мм.гггг)...">
                </div>
            </form>
        </div>
    </div>

    <!-- Movements Table Section -->
    <div class="card card-glass rounded-4">
        <div class="card-body px-0 py-3">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" id="movementsTable">
                    <thead class="table-glass">
                        <tr>
                            <th class="ps-4">Дата</th>
                            <th>Машина</th>
                            <th>Отбелязан от (Обект/База)</th>
                            <th>Преместен към (Обект/База)</th>
                            <th>Планиран период</th>
                            <th>Превозвач</th>
                            <th class="text-center" style="width: 120px;">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="movementsTableBody">
                        <!-- Populated via AJAX -->
                        <tr>
                            <td colspan="6" class="text-center p-5 text-muted">
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

<!-- Add/Edit Movement Modal -->
<div class="modal fade" id="movementModal" tabindex="-1" aria-labelledby="movementModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="movementModalLabel">Ново Движение</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="movementForm">
                    <input type="hidden" id="movement_id" name="movement_id" value="0">
                    <input type="hidden" name="action" value="save_movement">

                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <label for="client_select" class="form-label">Клиент <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input id="client_select" placeholder="Избери клиент...">
                            </div>
                        </div>
                        <div class="col-md-6">
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
                            <label for="machine_id" class="form-label">Машина <span class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input id="machine_id" name="machine_id" placeholder="Изберете машина..." required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label for="carrier" class="form-label">Превозвач <span class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" id="carrier" name="carrier" required>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <label for="arrival_date" class="form-label">Планирана начална дата</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" id="arrival_date" name="arrival_date" placeholder="дд.мм.гггг">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label for="departure_date" class="form-label">Планирана крайна дата</label>
                            <div class="tagify-styled-wrapper">
                                <input type="text" id="departure_date" name="departure_date" placeholder="дд.мм.гггг">
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
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="saveMovementBtn">Запази</button>
            </div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
require_once PROJECT_ROOT . '/templates/layout.php';
?>