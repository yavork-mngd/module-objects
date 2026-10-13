<?php
// /modules/objects/objects_machines.php

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

$page_title = 'Управление на Механизация';

// Start HTML output
ob_start();

?>
<?php include PROJECT_ROOT . '/templates/header.php'; ?>

<div id="objects-machines-hub-container" class="py-4" data-animation="fade-in-up" data-animation-delay="100">

    <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="mb-0 fw-bold text-gradient"><i class="bi bi-truck me-2"></i>Управление на Механизация</h2>
    </div>

    <!-- Hub Cards -->
    <div class="row g-4" data-animation="fade-in-up" data-animation-delay="200">

        <!-- Machine Planning Card -->
        <div class="col-md-4">
            <a href="<?php echo BASE_URL; ?>modules/objects/objects_machine_planning.php" class="text-decoration-none">
                <div class="card card-glass rounded-4 h-100 p-4 dashboard-card hover-lift">
                    <div class="card-body text-center d-flex flex-column justify-content-center align-items-center">
                        <i class="bi bi-clipboard2-data text-warning display-1 mb-3"></i>
                        <h3 class="fw-bold">Планиране</h3>
                        <p class="text-muted mb-0">Управление на бъдещи графици и прогнозиране на заетостта.</p>
                    </div>
                </div>
            </a>
        </div>

        <!-- Machine Schedules Card -->
        <div class="col-md-4">
            <a href="<?php echo BASE_URL; ?>modules/objects/objects_machine_schedules.php" class="text-decoration-none">
                <div class="card card-glass rounded-4 h-100 p-4 dashboard-card hover-lift">
                    <div class="card-body text-center d-flex flex-column justify-content-center align-items-center">
                        <i class="bi bi-calendar3-range text-success display-1 mb-3"></i>
                        <h3 class="fw-bold">График механизация</h3>
                        <p class="text-muted mb-0">Разпределение и планиране на машините по обекти и времеви рамки
                            (Gantt график).</p>
                    </div>
                </div>
            </a>
        </div>

        <!-- Machine Movements Card -->
        <div class="col-md-4">
            <a href="<?php echo BASE_URL; ?>modules/objects/objects_machine_movements.php" class="text-decoration-none">
                <div class="card card-glass rounded-4 h-100 p-4 dashboard-card hover-lift">
                    <div class="card-body text-center d-flex flex-column justify-content-center align-items-center">
                        <i class="bi bi-truck text-primary display-1 mb-3"></i>
                        <h3 class="fw-bold">Движение на механизация</h3>
                        <p class="text-muted mb-0">Преглед и регистриране на физическото преместване на машините между
                            обекти и бази.</p>
                    </div>
                </div>
            </a>
        </div>



    </div>
</div>

<style>
    /* Hub Cards Specific Styles */
    .hover-lift {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .hover-lift:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1) !important;
    }

    .dashboard-card {
        min-height: 250px;
    }
</style>

<?php
$content = ob_get_clean();
require_once PROJECT_ROOT . '/templates/layout.php';
?>