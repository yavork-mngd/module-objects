<?php
// /modules/objects/objects_manage_machines.php
require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';

if (!isLoggedIn()) {
    header('Location: ' . BASE_URL . 'login.php');
    exit();
}

if (!hasAnyRole(['objects_admin', 'objects_editor'])) {
    showAccessDenied();
}

$page_title = 'Обекти - Управление на Машини';

ob_start();
?>
<?php include PROJECT_ROOT . '/templates/header.php'; ?>

<style>
    /* Manage machines - theme aware extras */
    .mm-muted {
        color: var(--apple-text-color);
        opacity: 0.65;
    }

    #mappingsTable,
    #mappingsTable > :not(caption) > * > * {
        background-color: transparent;
        color: var(--apple-text-color);
        border-color: rgba(128, 128, 128, 0.18);
    }

    #mappingsTable thead th {
        background-color: rgba(128, 128, 128, 0.08);
        color: var(--apple-text-color);
        opacity: 0.85;
    }

    .mm-badge-act {
        background-color: rgba(128, 128, 128, 0.22);
        color: var(--apple-text-color);
        border: 1px solid rgba(128, 128, 128, 0.3);
    }

    .mm-badge-act .btn-close {
        filter: none;
        opacity: 0.6;
    }

    [data-bs-theme="dark"] .mm-badge-act .btn-close {
        filter: invert(1) grayscale(100%) brightness(200%);
    }

    .mm-title-border {
        border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    }

    #machine_id option {
        color: #1c1c1e;
        background-color: #ffffff;
    }

    [data-bs-theme="dark"] #machine_id {
        color-scheme: dark;
    }

    [data-bs-theme="dark"] #machine_id option {
        color: #f2f2f7;
        background-color: #2c2c2e;
    }

    [data-bs-theme="dark"] #machine_id option:disabled {
        color: rgba(255, 255, 255, 0.45);
    }
</style>

<div id="objects-manage-machines-container" class="py-4">
    <div class="d-flex align-items-center mb-4 mm-title-border pb-3">
        <a href="<?php echo BASE_URL; ?>modules/objects/objects_options.php?no_anim=1"
            class="btn btn-outline-secondary rounded-circle shadow-sm me-3 d-flex align-items-center justify-content-center"
            style="width: 40px; height: 40px;" title="Назад към Настройки">
            <i class="bi bi-arrow-left"></i>
        </a>
        <div class="d-flex align-items-center">
            <h2 class="mb-0 fw-bold"><i class="bi bi-truck me-2"></i>Машини и Дейности</h2>
        </div>
        <div class="ms-auto d-flex gap-2">
            <button
                class="btn btn-primary d-flex align-items-center rounded-pill px-4 shadow-sm hover-elevate transition-all"
                onclick="openNewMappingModal()">
                <i class="bi bi-plus-circle me-2"></i> Ново умение на машина
            </button>
        </div>
    </div>

    <!-- Mappings Table Card -->
    <div class="card card-glass border-0 shadow-sm mb-4">
        <div
            class="card-header bg-transparent mm-title-border border-0 px-4 py-3 d-flex justify-content-between align-items-center">
            <h5 class="mb-0 fw-bold text-primary">Списък с възможности</h5>
            <div class="tagify-styled-wrapper" style="width: 320px; min-height: 44px;">
                <i class="bi bi-search text-primary ms-2"></i>
                <input type="text" id="search_mapping" placeholder="Търсене по машина или дейност...">
            </div>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" id="mappingsTable">
                    <thead>
                        <tr>
                            <th class="px-4 fw-semibold">Машина</th>
                            <th class="px-4 fw-semibold">Основна Дейност</th>
                            <th class="px-4 fw-semibold">Спецификация (Вид)</th>
                            <th class="px-4 text-center fw-semibold" style="white-space: nowrap;">
                                Действия</th>
                        </tr>
                    </thead>
                    <tbody id="mappingsTableBody">
                        <!-- Content loaded dynamically via JS -->
                        <tr>
                            <td colspan="4" class="text-center p-5 mm-muted">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Зареждане...</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- Add Modal -->
<div class="modal fade" id="addMappingModal" tabindex="-1" aria-labelledby="addMappingModalLabel" aria-hidden="true"
    data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold text-primary" id="addMappingModalLabel">
                    <i class="bi bi-link-45deg me-2"></i>Управление на умения
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="mappingForm">
                    <input type="hidden" name="action" id="form_action" value="save_group_mapping">
                    <div class="row g-3">
                        <div class="col-12">
                            <label for="machine_id" class="form-label">Машина <span class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <select class="form-select" id="machine_id" name="machine_id" required>
                                    <option value="" disabled selected>Изберете машина...</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-12">
                            <label for="activity_type_id" class="form-label">Дейност <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input id="activity_type_id" name="activity_type_id"
                                    placeholder="Изберете дейност...">
                            </div>
                        </div>
                        <div class="col-12">
                            <label for="capability_name" class="form-label">Спецификации (Видове дейности) <span
                                    class="text-danger">*</span></label>
                            <div class="tagify-styled-wrapper">
                                <input id="capability_name" name="capability_name"
                                    placeholder="Моля, въведете спецификации (Enter за нова)">
                            </div>
                            <small class="mm-muted mt-1 d-block">Можете да добавите множество спецификации за тази
                                комбинация.</small>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="saveMappingBtn"
                    onclick="saveMapping()">Запази</button>
            </div>
        </div>
    </div>
</div>

<!-- View rendered -->

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../../templates/layout.php';
?>