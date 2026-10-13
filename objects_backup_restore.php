<?php
// /modules/objects/objects_backup_restore.php
require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';

if (!isLoggedIn()) {
    header('Location: ' . BASE_URL . 'login.php');
    exit();
}

// Only admins can handle backup/restore
if (!hasAnyRole(['objects_admin'])) {
    showAccessDenied();
}

$page_title = 'Обекти - Резервно копие';

ob_start();
?>
<?php include PROJECT_ROOT . '/templates/header.php'; ?>

<div id="objects-backup-restore-container" class="py-4">
    <div class="d-flex align-items-center mb-4">
        <a href="<?php echo BASE_URL; ?>modules/objects/objects_options.php?no_anim=1"
            class="btn btn-outline-secondary rounded-circle shadow-sm me-3 d-flex align-items-center justify-content-center"
            style="width: 40px; height: 40px;" title="Назад към Настройки">
            <i class="bi bi-arrow-left"></i>
        </a>
        <h2 class="mb-0 fw-bold"><i class="bi bi-cloud-arrow-up-fill me-2"></i>Резервно копие и
            Възстановяване</h2>
    </div>

    <div class="row g-4">
        <!-- Export Card -->
        <div class="col-lg-4">
            <div class="card card-glass h-100 shadow-sm border-0">
                <div class="card-header bg-transparent border-bottom-0 pt-4 px-4">
                    <h5 class="card-title fw-bold mb-0 text-primary">
                        <i class="bi bi-download me-2"></i>Експортиране на данни (Backup)
                    </h5>
                </div>
                <div class="card-body p-4">
                    <p class="text-muted small mb-4">Изберете модулите и данните, които искате да включите в резервното
                        копие.</p>

                    <form id="exportForm">
                        <div class="mb-4">
                            <label class="form-label text-secondary fw-semibold small text-uppercase">Модули</label>

                            <div class="form-check form-switch mb-3 p-3 selection-card hover-elevate transition-all">
                                <div class="d-flex align-items-center">
                                    <div class="ms-0">
                                        <input class="form-check-input ms-0 me-3" type="checkbox" id="mod_personal"
                                            name="modules[]" value="personal" checked>
                                        <label class="form-check-label fw-bold" for="mod_personal">Модул
                                            Персонал</label>
                                        <div class="small text-muted">Служители и отработени часове</div>
                                    </div>
                                    <i class="bi bi-person-badge ms-auto fs-4 text-primary opacity-50"></i>
                                </div>
                            </div>

                            <div class="form-check form-switch mb-3 p-3 selection-card hover-elevate transition-all">
                                <div class="d-flex align-items-center">
                                    <div class="ms-0">
                                        <input class="form-check-input ms-0 me-3" type="checkbox" id="mod_requests"
                                            name="modules[]" value="requests" checked>
                                        <label class="form-check-label fw-bold" for="mod_requests">Модул Заявки</label>
                                        <div class="small text-muted">Основни заявки и поръчки (Records)</div>
                                    </div>
                                    <i class="bi bi-clipboard-check ms-auto fs-4 text-primary opacity-50"></i>
                                </div>
                            </div>

                            <div class="form-check form-switch mb-3 p-3 selection-card hover-elevate transition-all">
                                <div class="d-flex align-items-center">
                                    <div class="ms-0">
                                        <input class="form-check-input ms-0 me-3" type="checkbox" id="mod_objects"
                                            name="modules[]" value="objects" checked>
                                        <label class="form-check-label fw-bold" for="mod_objects">Модул Обекти</label>
                                        <div class="small text-muted">Клиенти, Машини, Графици и Прогрес</div>
                                    </div>
                                    <i class="bi bi-building ms-auto fs-4 text-primary opacity-50"></i>
                                </div>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="form-label text-secondary fw-semibold small text-uppercase">Опции</label>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="include_archived"
                                    name="include_archived" checked>
                                <label class="form-check-label" for="include_archived">
                                    Включи архивирани записи
                                </label>
                            </div>
                        </div>

                        <button type="button"
                            class="btn btn-primary w-100 rounded-pill py-3 shadow-sm hover-elevate transition-all fw-bold mt-2"
                            onclick="startExport()">
                            <i class="bi bi-file-earmark-arrow-down me-2"></i>Генерирай Резервно Копие (JSON)
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Import Card -->
        <div class="col-lg-4">
            <div class="card card-glass h-100 shadow-sm border-0">
                <div class="card-header bg-transparent border-bottom-0 pt-4 px-4">
                    <h5 class="card-title fw-bold mb-0 text-success">
                        <i class="bi bi-upload me-2"></i>Възстановяване на данни (Restore)
                    </h5>
                </div>
                <div class="card-body p-4">
                    <p class="text-muted small mb-4">Качете JSON файл, генериран от системата, за да възстановите
                        данните.</p>

                    <form id="importForm" enctype="multipart/form-data">
                        <div class="mb-4">
                            <label for="import_file"
                                class="form-label text-secondary fw-semibold small text-uppercase">Избор на файл</label>
                            <div class="drop-zone p-5 border border-2 border-dashed rounded-3 text-center transition-all"
                                id="dropZone">
                                <i class="bi bi-file-earmark-code display-4 opacity-50 mb-3 d-block"></i>
                                <div class="fw-bold mb-1">Провлачете файла тук</div>
                                <div class="small text-muted mb-3">или кликнете за избор от компютъра</div>
                                <input type="file" id="import_file" name="import_file" accept=".json" class="d-none">
                                <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                    onclick="document.getElementById('import_file').click()">Избери файл</button>
                                <div id="selected_filename" class="mt-3 fw-bold text-success d-none"></div>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="form-label text-secondary fw-semibold small text-uppercase">Настройки при
                                импорт</label>
                            <div class="selection-card border-warning p-3 mb-3">
                                <div class="form-check form-switch mb-0">
                                    <input class="form-check-input" type="checkbox" id="update_existing"
                                        name="update_existing">
                                    <label class="form-check-label fw-bold" for="update_existing">Режим на
                                        актуализация (Update)</label>
                                    <div class="small text-muted mt-1">Ако е включено, съществуващите записи ще бъдат
                                        актуализирани. Ако е изключено, те ще бъдат прескочени.</div>
                                </div>
                            </div>
                        </div>

                        <button type="button"
                            class="btn btn-success w-100 rounded-pill py-3 shadow-sm hover-elevate transition-all fw-bold mt-2"
                            onclick="startImport()">
                            <i class="bi bi-cloud-arrow-up-fill me-2"></i>Започни Възстановяване
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Clear Card -->
        <div class="col-lg-4">
            <div class="card card-glass h-100 shadow-sm border-0">
                <div class="card-header bg-transparent border-bottom-0 pt-4 px-4">
                    <h5 class="card-title fw-bold mb-0 text-danger">
                        <i class="bi bi-trash3-fill me-2"></i>Изчистване на данни (Cleanup)
                    </h5>
                </div>
                <div class="card-body p-4">
                    <p class="text-muted small mb-4">Бързо изчистване на тестови данни. Основните настройки (Клиенти,
                        Машини) ще бъдат запазени.</p>

                    <form id="clearForm">
                        <div class="mb-4">
                            <label class="form-label text-secondary fw-semibold small text-uppercase">Изберете за
                                изчистване</label>

                            <div
                                class="form-check mb-3 p-3 selection-card selection-card-danger hover-elevate transition-all">
                                <div class="d-flex align-items-center">
                                    <div class="ms-0">
                                        <input class="form-check-input ms-0 me-3" type="checkbox" id="clear_personal"
                                            name="modules[]" value="personal">
                                        <label class="form-check-label fw-bold" for="clear_personal">Данни
                                            Персонал</label>
                                        <div class="small text-muted">Изчиства само отработените часове.</div>
                                    </div>
                                    <i class="bi bi-clock-history ms-auto fs-4 text-danger opacity-50"></i>
                                </div>
                            </div>

                            <div
                                class="form-check mb-3 p-3 selection-card selection-card-danger hover-elevate transition-all">
                                <div class="d-flex align-items-center">
                                    <div class="ms-0">
                                        <input class="form-check-input ms-0 me-3" type="checkbox" id="clear_requests"
                                            name="modules[]" value="requests">
                                        <label class="form-check-label fw-bold" for="clear_requests">Данни
                                            Заявки</label>
                                        <div class="small text-muted">Изчиства всички Заявки и Поръчки.</div>
                                    </div>
                                    <i class="bi bi-file-earmark-x ms-auto fs-4 text-danger opacity-50"></i>
                                </div>
                            </div>

                            <div
                                class="form-check mb-3 p-3 selection-card selection-card-danger hover-elevate transition-all">
                                <div class="d-flex align-items-center">
                                    <div class="ms-0">
                                        <input class="form-check-input ms-0 me-3" type="checkbox" id="clear_objects"
                                            name="modules[]" value="objects">
                                        <label class="form-check-label fw-bold" for="clear_objects">Данни
                                            Обекти</label>
                                        <div class="small text-muted">Изчиства Графици, Протоколи и Движение.</div>
                                    </div>
                                    <i class="bi bi-building-dash ms-auto fs-4 text-danger opacity-50"></i>
                                </div>
                            </div>
                        </div>

                        <div class="alert alert-warning small border-0 py-2 d-flex align-items-center">
                            <i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                            Тази операция е необратима!
                        </div>

                        <button type="button"
                            class="btn btn-outline-danger w-100 rounded-pill py-3 shadow-sm hover-elevate transition-all fw-bold mt-2"
                            onclick="startClear()">
                            <i class="bi bi-shield-lock-fill me-2"></i>Изчисти Избраните Данни
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .drop-zone {
        cursor: pointer;
        background: var(--apple-hover-bg);
        border: 2px dashed var(--apple-card-border) !important;
    }

    .drop-zone.active {
        background-color: var(--button-glow) !important;
        border-color: var(--apple-accent-color) !important;
    }

    .hover-elevate:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1) !important;
    }

    [data-bs-theme="dark"] .hover-elevate:hover {
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3) !important;
    }

    .text-gradient {
        background: linear-gradient(45deg, var(--apple-accent-color), #0dcaf0);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .transition-all {
        transition: all 0.3s ease;
    }

    .selection-card {
        background: var(--apple-hover-bg);
        border: 1px solid var(--apple-card-border);
        border-radius: 0.8rem;
    }

    .selection-card-danger {
        background: rgba(var(--bs-danger-rgb), 0.05);
        border-color: rgba(var(--bs-danger-rgb), 0.1);
    }

    .selection-card-danger .form-check-label {
        color: var(--bs-danger) !important;
    }

    .border-dashed {
        border-style: dashed !important;
    }
</style>

<script src="<?php echo BASE_URL; ?>modules/objects/js/objects_backup_restore.js"></script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../../templates/layout.php';
?>