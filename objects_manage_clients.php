<?php
// /modules/objects/objects_manage_clients.php

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

if (!hasAnyRole(['objects_admin', 'objects_editor'])) {
    showAccessDenied();
}

$page_title = 'Управление на Клиенти';

// Start HTML output
ob_start();
?>
<?php include PROJECT_ROOT . '/templates/header.php'; ?>

<style>
    /* Force opaque table header for better readability during scroll */
    #clientsTable thead.table-glass {
        background-color: #ffffff !important;
        opacity: 1 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        z-index: 11 !important;
        /* Ensure it stays above content */
    }

    #clientsTable thead.table-glass th {
        background-color: #ffffff !important;
        opacity: 1 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        color: #1c1c1e !important;
        border-bottom: 2px solid var(--apple-card-border-light) !important;
    }

    [data-bs-theme="dark"] #clientsTable thead.table-glass,
    [data-bs-theme="dark"] #clientsTable thead.table-glass th {
        background-color: #1c1c1e !important;
        color: #f2f2f7 !important;
        border-bottom: 2px solid var(--apple-card-border-dark) !important;
    }
</style>


<div id="objects-manage-clients-container" class="py-4">

    <div class="d-flex align-items-center mb-4">
        <a href="<?php echo BASE_URL; ?>modules/objects/objects_options.php?no_anim=1"
            class="btn btn-outline-secondary rounded-circle shadow-sm me-3 d-flex align-items-center justify-content-center"
            style="width: 40px; height: 40px;" title="Назад към Настройки">
            <i class="bi bi-arrow-left"></i>
        </a>
        <h2 class="mb-0 fw-bold"><i class="bi bi-people-fill me-2"></i>Управление на Клиенти</h2>
        <div class="ms-auto d-flex gap-2">
            <button type="button" class="btn btn-primary rounded-pill shadow-sm" data-bs-toggle="modal"
                data-bs-target="#clientModal" onclick="resetClientModal()">
                <i class="bi bi-person-plus-fill me-1"></i> Нов Клиент
            </button>
        </div>
    </div>

    <!-- Filter Section -->
    <div class="card card-glass mb-4 rounded-4">
        <div class="card-body p-4">
            <form id="client-search-form" class="row g-3" onsubmit="return false;">
                <div class="col-md-12">
                    <label for="search_client"
                        class="form-label text-muted small text-uppercase fw-semibold">Търсене</label>
                    <input type="text" id="search_client" name="search_client" class="form-control"
                        placeholder="Въведете име на клиент, контакт, email или телефон и натиснете Enter...">
                </div>
            </form>
        </div>
    </div>

    <!-- Clients Table Section -->
    <div class="card card-glass rounded-4">
        <div class="card-body p-3 border-0">
            <div class="table-responsive rounded-3" style="max-height: 60vh; overflow-y: auto;">
                <table class="table table-hover align-middle mb-0" id="clientsTable">
                    <thead class="table-glass shadow-sm" style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th class="ps-4">Клиент</th>
                            <th>Контакти</th>
                            <th>Адрес</th>
                            <th>Бележки</th>
                            <th class="text-center" style="width: 120px;">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="clientsTableBody">
                        <!-- Populated via AJAX -->
                        <tr>
                            <td colspan="5" class="text-center p-5 text-muted">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2 mb-0">Зареждане на клиенти...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- Add/Edit Client Modal -->
<div class="modal fade" id="clientModal" tabindex="-1" aria-labelledby="clientModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-glass">
            <div class="modal-header border-bottom-0 pb-0">
                <h5 class="modal-title fw-bold" id="clientModalLabel">Добави нов клиент</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="clientForm">
                    <input type="hidden" id="client_id" name="client_id" value="0">
                    <input type="hidden" name="action" value="save_client">

                    <h6 class="text-primary fw-bold mb-3">Основни Данни</h6>
                    <div class="row g-3 mb-4">
                        <div class="col-md-12">
                            <label for="client_name" class="form-label">Име на Клиент <span
                                    class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="client_name" name="client_name" required>
                        </div>
                        <div class="col-md-12">
                            <label for="client_address" class="form-label">Адрес</label>
                            <input type="text" class="form-control" id="client_address" name="client_address">
                        </div>
                    </div>

                    <h6 class="text-primary fw-bold mb-3">Главен Контакт</h6>
                    <div class="row g-3 mb-4">
                        <div class="col-md-12">
                            <label for="primary_contact_name" class="form-label">Име <span
                                    class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="primary_contact_name"
                                name="primary_contact_name" required>
                        </div>
                        <div class="col-md-6">
                            <label for="primary_contact_phone" class="form-label">Телефон <span
                                    class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="primary_contact_phone"
                                name="primary_contact_phone" required>
                        </div>
                        <div class="col-md-6">
                            <label for="primary_contact_email" class="form-label">Имейл <span
                                    class="text-danger">*</span></label>
                            <input type="email" class="form-control" id="primary_contact_email"
                                name="primary_contact_email" required>
                        </div>
                        <div class="col-md-12">
                            <label for="primary_contact_notes" class="form-label">Бележки</label>
                            <textarea class="form-control" id="primary_contact_notes" name="primary_contact_notes"
                                rows="2" placeholder="Бележки за главния контакт..."></textarea>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="text-primary fw-bold mb-0">Допълнителни Контакти</h6>
                        <button type="button" class="btn btn-sm btn-outline-primary shadow-sm rounded-pill"
                            onclick="addExtraContactRow()">
                            <i class="bi bi-plus-circle"></i> Добави контакт
                        </button>
                    </div>
                    <div id="extraContactsContainer" class="mb-4">
                        <!-- Dynamic contact rows will be injected here via JavaScript -->
                    </div>

                    <h6 class="text-primary fw-bold mb-3">Бележки</h6>
                    <div class="row g-3 mb-0">
                        <div class="col-md-6">
                            <label for="general_notes" class="form-label">Общи Бележки</label>
                            <textarea class="form-control" id="general_notes" name="general_notes" rows="3"></textarea>
                        </div>
                        <div class="col-md-6">
                            <label for="internal_notes" class="form-label">Вътрешни Бележки</label>
                            <textarea class="form-control" id="internal_notes" name="internal_notes"
                                rows="3"></textarea>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="saveClientBtn">Запази</button>
            </div>
        </div>
    </div>
</div>


<?php
$content = ob_get_clean();
require_once PROJECT_ROOT . '/templates/layout.php';
?>