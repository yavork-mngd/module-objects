<?php
// /modules/objects/objects_backup_restore_api.php
ob_start(); // Buffer everything to prevent accidental output
require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';

// Catch fatal errors that normally bypass try/catch
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== NULL && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_CORE_ERROR || $error['type'] === E_COMPILE_ERROR)) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'PHP Fatal Error: ' . $error['message'] . ' in ' . $error['file'] . ' on line ' . $error['line']
        ]);
    }
});

if (!isLoggedIn() || !hasAnyRole(['objects_admin'])) {
    ob_clean();
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized access.']);
    exit();
}

// Increase limits for large datasets
set_time_limit(300);
ini_set('memory_limit', '512M');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$conn = OpenCon(); // Use native MySQLi connection

switch ($action) {
    case 'export':
        handleExport($conn);
        break;
    case 'import':
        handleImport($conn);
        break;
    case 'clear':
        handleClear($conn);
        break;
    default:
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

function handleClear($conn)
{
    $selectedModules = $_POST['modules'] ?? [];
    if (empty($selectedModules)) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Моля, изберете модули за изчистване.']);
        return;
    }

    try {
        $conn->query("SET FOREIGN_KEY_CHECKS = 0");

        if (in_array('personal', $selectedModules)) {
            $conn->query("TRUNCATE TABLE work_hours");
            $conn->query("TRUNCATE TABLE import_table");
        }

        if (in_array('requests', $selectedModules)) {
            // Clearing requests_main will cascade to orders and drafts in most setups, 
            // but we'll be explicit for safety.
            $conn->query("DELETE FROM requests_draft_visibility");
            $conn->query("DELETE FROM requests_drafts");
            $conn->query("DELETE FROM requests_orders");
            $conn->query("DELETE FROM requests_main");
            $conn->query("TRUNCATE TABLE requests_import_main");
            $conn->query("TRUNCATE TABLE requests_import_orders");
        }

        if (in_array('objects', $selectedModules)) {
            $conn->query("DELETE FROM objects_daily_progress_logs");
            $conn->query("DELETE FROM objects_schedule_notes");
            $conn->query("DELETE FROM objects_project_schedules");
            $conn->query("DELETE FROM objects_machine_assignments");
            $conn->query("DELETE FROM objects_machine_movements");
            $conn->query("DELETE FROM objects_machine_schedules");
        }

        $conn->query("SET FOREIGN_KEY_CHECKS = 1");

        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => 'Избраните данни бяха изчистени успешно.']);
    } catch (Throwable $e) {
        $conn->query("SET FOREIGN_KEY_CHECKS = 1");
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Грешка при изчистване: ' . $e->getMessage()]);
    }
}

function handleExport($conn)
{
    $selectedModules = $_POST['modules'] ?? [];
    $includeArchived = isset($_POST['include_archived']) && $_POST['include_archived'] === 'on';

    $data = [
        'metadata' => [
            'version' => '1.2',
            'timestamp' => date('Y-m-d H:i:s'),
            'modules' => $selectedModules,
            'include_archived' => $includeArchived
        ],
        'modules' => []
    ];

    // Helper to safely fetch data from a table using mysqli
    $safeFetch = function ($sql, $params = [], $types = "") use ($conn) {
        try {
            if (empty($params)) {
                $result = $conn->query($sql);
                if (!$result)
                    return [];
                return $result->fetch_all(MYSQLI_ASSOC);
            } else {
                $stmt = $conn->prepare($sql);
                if (!$stmt)
                    return [];
                $stmt->bind_param($types, ...$params);
                $stmt->execute();
                $result = $stmt->get_result();
                return $result->fetch_all(MYSQLI_ASSOC);
            }
        } catch (Throwable $e) {
            return [];
        }
    };

    try {
        // Module: Personal
        if (in_array('personal', $selectedModules)) {
            $data['modules']['personal'] = [
                'workers' => $safeFetch("SELECT * FROM workers"),
                'work_hours' => $safeFetch("SELECT * FROM work_hours"),
            ];
        }

        // Module: Requests
        if (in_array('requests', $selectedModules)) {
            $reqQuery = "SELECT * FROM requests_main";
            if (!$includeArchived) {
                $reqQuery .= " WHERE archived_at IS NULL";
            }
            $requests = $safeFetch($reqQuery);
            $requestIds = array_column($requests, 'request_id');

            $orders = [];
            $drafts = [];
            $visibility = [];

            if (!empty($requestIds)) {
                $placeholders = implode(',', array_fill(0, count($requestIds), '?'));
                $types = str_repeat('i', count($requestIds));

                // MySqli doesn't support 'IN (?)' as easily as PDO with arrays, 
                // so we build the SQL manually safely since $requestIds are integers
                $ids_string = implode(',', array_map('intval', $requestIds));

                $orders = $safeFetch("SELECT * FROM requests_orders WHERE request_id IN ($ids_string)");

                $orderIds = array_column($orders, 'id');
                if (!empty($orderIds)) {
                    $order_ids_string = implode(',', array_map('intval', $orderIds));
                    $drafts = $safeFetch("SELECT * FROM requests_drafts WHERE row_id IN ($order_ids_string)");

                    $draftIds = array_column($drafts, 'id');
                    if (!empty($draftIds)) {
                        $draft_ids_string = implode(',', array_map('intval', $draftIds));
                        $visibility = $safeFetch("SELECT * FROM requests_draft_visibility WHERE draft_id IN ($draft_ids_string)");
                    }
                }
            }

            $data['modules']['requests'] = [
                'requests_main' => $requests,
                'requests_orders' => $orders,
                'requests_drafts' => $drafts,
                'requests_draft_visibility' => $visibility
            ];
        }

        // Module: Objects
        if (in_array('objects', $selectedModules)) {
            $data['modules']['objects'] = [
                'clients_main' => $safeFetch("SELECT * FROM clients_main"),
                'heavy_machines' => $safeFetch("SELECT * FROM heavy_machines"),
                'objects_activity_types' => $safeFetch("SELECT * FROM objects_activity_types"),
                'objects_machine_movements' => $safeFetch("SELECT * FROM objects_machine_movements"),
                'objects_project_schedules' => $safeFetch("SELECT * FROM objects_project_schedules"),
                'objects_machine_assignments' => $safeFetch("SELECT * FROM objects_machine_assignments"),
                'objects_daily_progress_logs' => $safeFetch("SELECT * FROM objects_daily_progress_logs"),
                'objects_schedule_notes' => $safeFetch("SELECT * FROM objects_schedule_notes"),
                'objects_machine_schedules' => $safeFetch("SELECT * FROM objects_machine_schedules"),
                'objects_machine_activities' => $safeFetch("SELECT * FROM objects_machine_activities"),
            ];
        }

        // Clear any previous output buffers and send JSON
        while (ob_get_level())
            ob_end_clean();
        header('Content-Type: application/json');

        $json = json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            echo json_encode(['success' => false, 'message' => 'JSON Encoding Error: ' . json_last_error_msg()]);
        } else {
            echo $json;
        }
    } catch (Throwable $e) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function handleImport($conn)
{
    if (!isset($_FILES['import_file']) || $_FILES['import_file']['error'] !== UPLOAD_ERR_OK) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'No file uploaded or upload error.']);
        return;
    }

    $updateExisting = isset($_POST['update_existing']) && $_POST['update_existing'] === 'on';
    $jsonContent = file_get_contents($_FILES['import_file']['tmp_name']);
    $data = json_decode($jsonContent, true);

    if (!$data || !isset($data['modules'])) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Invalid backup file format.']);
        return;
    }

    try {
        $conn->begin_transaction();
        $conn->query("SET FOREIGN_KEY_CHECKS = 0");

        $stats = ['updated' => 0, 'inserted' => 0, 'skipped' => 0];

        foreach ($data['modules'] as $moduleName => $tables) {
            foreach ($tables as $tableName => $rows) {
                if (empty($rows))
                    continue;

                // Determine primary key
                $pk = '';
                if (isset($rows[0]['id']))
                    $pk = 'id';
                elseif (isset($rows[0]['request_id']))
                    $pk = 'request_id';
                elseif (isset($rows[0]['client_id']))
                    $pk = 'client_id';
                elseif (isset($rows[0]['schedule_id']))
                    $pk = 'schedule_id';
                elseif (isset($rows[0]['log_id']))
                    $pk = 'log_id';
                elseif (isset($rows[0]['note_id']))
                    $pk = 'note_id';

                foreach ($rows as $row) {
                    $exists = false;
                    if ($pk && isset($row[$pk])) {
                        $stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM `$tableName` WHERE `$pk` = ?");
                        $stmt->bind_param("s", $row[$pk]);
                        $stmt->execute();
                        $res = $stmt->get_result()->fetch_assoc();
                        $exists = ($res['cnt'] > 0);
                        $stmt->close();
                    }

                    if ($exists) {
                        if ($updateExisting) {
                            $sets = [];
                            $params = [];
                            $types = "";
                            foreach ($row as $col => $val) {
                                if ($col === $pk)
                                    continue;
                                $sets[] = "`$col` = ?";
                                $params[] = $val;
                                $types .= "s";
                            }
                            $params[] = $row[$pk];
                            $types .= "s";

                            $sql = "UPDATE `$tableName` SET " . implode(', ', $sets) . " WHERE `$pk` = ?";
                            $stmt = $conn->prepare($sql);
                            $stmt->bind_param($types, ...$params);
                            $stmt->execute();
                            $stmt->close();
                            $stats['updated']++;
                        } else {
                            $stats['skipped']++;
                        }
                    } else {
                        $cols = array_keys($row);
                        $placeholders = implode(',', array_fill(0, count($cols), '?'));
                        $types = str_repeat('s', count($cols));

                        $sql = "INSERT INTO `$tableName` (`" . implode('`, `', $cols) . "`) VALUES ($placeholders)";
                        $stmt = $conn->prepare($sql);
                        $stmt->bind_param($types, ...array_values($row));
                        $stmt->execute();
                        $stmt->close();
                        $stats['inserted']++;
                    }
                }
            }
        }

        $conn->query("SET FOREIGN_KEY_CHECKS = 1");
        $conn->commit();

        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'message' => "Възстановяването приключи успешно.",
            'stats' => $stats
        ]);
    } catch (Throwable $e) {
        $conn->rollback();
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => "Internal Error: " . $e->getMessage()]);
    }
}
