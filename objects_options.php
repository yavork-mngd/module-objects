<?php
// /modules/objects/objects_options.php
require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';

// --- Authorization ---
if (!isLoggedIn()) {
    header('Location: ' . BASE_URL . 'login.php');
    exit();
}

if (!hasAnyRole(['objects_admin', 'objects_editor'])) {
    showAccessDenied();
}

$page_title = 'Обекти - Настройки';

ob_start();
?>
<?php include PROJECT_ROOT . '/templates/header.php'; ?>

<div id="objects-options-container" class="py-4">
    <div class="d-flex align-items-center mb-4" <?php echo isset($_GET['no_anim']) ? '' : 'data-animation="fade-in-down" data-animation-delay="100"'; ?>>
        <h2 class="mb-0 fw-bold"><i class="bi bi-gear-fill me-2"></i>Настройки на Обекти</h2>
    </div>

    <div class="row g-4" <?php echo isset($_GET['no_anim']) ? '' : 'data-animation="fade-in-up" data-animation-delay="200"'; ?>>
        <!-- New Page Card Link -->
        <div class="col-md-4 col-sm-6">
            <a href="<?php echo BASE_URL; ?>modules/objects/objects_manage_clients.php" class="text-decoration-none">
                <div class="card card-glass h-100 hover-elevate transition-all">
                    <div class="card-body text-center p-5">
                        <div class="display-4 text-primary mb-3">
                            <i class="bi bi-people-fill"></i>
                        </div>
                        <h5 class="card-title fw-bold text-body">Управление на Клиенти</h5>
                        <p class="card-text text-muted small mt-2">Добавяне, редакция и изтриване на клиенти в
                            системата.
                        </p>
                    </div>
                </div>
            </a>
        </div>

        <!-- Machine Management Card -->
        <div class="col-md-4 col-sm-6">
            <a href="<?php echo BASE_URL; ?>modules/objects/objects_manage_machines.php" class="text-decoration-none">
                <div class="card card-glass h-100 hover-elevate transition-all">
                    <div class="card-body text-center p-5">
                        <div class="display-4 text-primary mb-3">
                            <i class="bi bi-truck"></i>
                        </div>
                        <h5 class="card-title fw-bold text-body">Управление на Машини</h5>
                        <p class="card-text text-muted small mt-2">Настройване на дейностите и възможностите на
                            свързаните машини.
                        </p>
                    </div>
                </div>
            </a>
        </div>

        <!-- Backup & Restore Card -->
        <div class="col-md-4 col-sm-12">
            <a href="<?php echo BASE_URL; ?>modules/objects/objects_backup_restore.php" class="text-decoration-none">
                <div class="card card-glass h-100 hover-elevate transition-all border-dashed">
                    <div class="card-body text-center p-5">
                        <div class="display-4 text-primary mb-3">
                            <i class="bi bi-cloud-arrow-up-fill"></i>
                        </div>
                        <h5 class="card-title fw-bold text-body">Резервно копие</h5>
                        <p class="card-text text-muted small mb-0">Експорт и импорт на данни за модули Обекти, Заявки и
                            Персонал.
                        </p>
                    </div>
                </div>
            </a>
        </div>


    </div>
</div>

<style>
    .hover-elevate:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1) !important;
    }

    .transition-all {
        transition: all 0.3s ease;
    }
</style>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../../templates/layout.php';
?>