<?php
// /modules/objects/objects_manage_machines_api.php
require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';
require_once __DIR__ . '/../../sys/dbcon.php';

if (!isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

header('Content-Type: application/json; charset=utf-8');

$action = $_REQUEST['action'] ?? '';

$db_conn = OpenCon();

try {
    switch ($action) {
        case 'get_options':
            $machines = [];
            $res = $db_conn->query("SELECT id, machine_name FROM heavy_machines ORDER BY machine_name");
            if ($res) {
                while ($row = $res->fetch_assoc())
                    $machines[] = $row;
            }

            $activities = [];
            $res = $db_conn->query("SELECT id, activity_name, unit_of_measure FROM objects_activity_types ORDER BY activity_name");
            if ($res) {
                while ($row = $res->fetch_assoc())
                    $activities[] = $row;
            }

            ob_clean();
            echo json_encode([
                'success' => true,
                'machines' => $machines,
                'activities' => $activities
            ]);
            break;

        case 'get_mappings':
            $search = $_GET['search'] ?? '';
            $query = "SELECT ma.machine_id,
                             GROUP_CONCAT(DISTINCT a.id ORDER BY a.activity_name SEPARATOR ',') as activity_ids,
                             GROUP_CONCAT(ma.id ORDER BY a.activity_name, ma.capability_name SEPARATOR '|||') as ids,
                             GROUP_CONCAT(DISTINCT ma.capability_name ORDER BY ma.capability_name SEPARATOR '|||') as capability_names,
                             m.machine_name,
                             GROUP_CONCAT(DISTINCT a.activity_name ORDER BY a.activity_name SEPARATOR '|||') as activity_names
                      FROM objects_machine_activities ma
                      JOIN heavy_machines m ON ma.machine_id = m.id
                      JOIN objects_activity_types a ON ma.activity_type_id = a.id";

            $params = [];
            $types = "";

            if (!empty($search)) {
                $query .= " WHERE m.machine_name LIKE ? OR a.activity_name LIKE ? OR ma.capability_name LIKE ?";
                $searchTerm = "%" . $search . "%";
                $params = [$searchTerm, $searchTerm, $searchTerm];
                $types = "sss";
            }

            $query .= " GROUP BY ma.machine_id, m.machine_name";
            $query .= " ORDER BY m.machine_name";

            $stmt = $db_conn->prepare($query);
            if (!$stmt) {
                // Table might not exist yet -> return empty without crashing
                ob_clean();
                echo json_encode(['success' => true, 'data' => []]);
                exit;
            }

            if (!empty($params)) {
                $stmt->bind_param($types, ...$params);
            }

            $stmt->execute();
            $result = $stmt->get_result();

            $data = [];
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }

            ob_clean();
            echo json_encode(['success' => true, 'data' => $data]);
            break;

        case 'save_mapping':
            $machine_id = (int) ($_POST['machine_id'] ?? 0);
            $activity_type_id = (int) ($_POST['activity_type_id'] ?? 0);
            $capability_name = trim($_POST['capability_name'] ?? '');

            if (empty($machine_id) || empty($activity_type_id) || empty($capability_name)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Моля, попълнете всички задължителни полета.']);
                exit;
            }

            // Check for duplicates
            $stmt = $db_conn->prepare("SELECT id FROM objects_machine_activities WHERE machine_id = ? AND activity_type_id = ? AND capability_name = ?");
            $stmt->bind_param("iis", $machine_id, $activity_type_id, $capability_name);
            $stmt->execute();
            if ($stmt->get_result()->num_rows > 0) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Тази възможност вече съществува за тази машина.']);
                exit;
            }

            $sql = "INSERT INTO objects_machine_activities (machine_id, activity_type_id, capability_name) VALUES (?, ?, ?)";
            $stmt = $db_conn->prepare($sql);
            $stmt->bind_param("iis", $machine_id, $activity_type_id, $capability_name);

            if ($stmt->execute()) {
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Умението е добавено успешно.']);
            } else {
                throw new Exception("Error inserting mapping: " . $stmt->error);
            }
            break;

        case 'save_group_mapping':
            $machine_id = (int) ($_POST['machine_id'] ?? 0);
            $activities_json = $_POST['activity_type_id'] ?? ''; // From Tagify (Multiple)
            $capabilities_json = $_POST['capability_name'] ?? ''; // From Tagify (Multiple)

            if (empty($machine_id) || empty($activities_json) || empty($capabilities_json)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Моля, попълнете всички задължителни полета.']);
                exit;
            }

            // Parse activities
            $activities_arr = json_decode($activities_json, true);
            if (!is_array($activities_arr)) {
                $activities_arr = array_map('trim', explode(',', $activities_json));
            } else {
                $activities_arr = array_column($activities_arr, 'id');
            }
            $activities_arr = array_filter($activities_arr);

            // Parse capabilities
            $caps_arr = json_decode($capabilities_json, true);
            if (!is_array($caps_arr)) {
                $caps_arr = array_map('trim', explode(',', $capabilities_json));
            } else {
                $caps_arr = array_column($caps_arr, 'value');
            }
            $caps_arr = array_filter($caps_arr);

            if (empty($activities_arr) || empty($caps_arr)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Моля, изберете поне една дейност и една спецификация.']);
                exit;
            }

            // Begin transaction
            $db_conn->begin_transaction();

            try {
                foreach ($activities_arr as $activity_type_id) {
                    $activity_type_id = (int) $activity_type_id;
                    // Delete existing capabilities for this machine and specific activity
                    $stmt = $db_conn->prepare("DELETE FROM objects_machine_activities WHERE machine_id = ? AND activity_type_id = ?");
                    $stmt->bind_param("ii", $machine_id, $activity_type_id);
                    $stmt->execute();

                    // Insert new ones
                    $stmt = $db_conn->prepare("INSERT INTO objects_machine_activities (machine_id, activity_type_id, capability_name) VALUES (?, ?, ?)");
                    foreach ($caps_arr as $cap) {
                        $stmt->bind_param("iis", $machine_id, $activity_type_id, $cap);
                        $stmt->execute();
                    }
                }

                $db_conn->commit();
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Уменията са запазени успешно.']);
            } catch (Exception $e) {
                $db_conn->rollback();
                throw $e;
            }
            break;

        case 'delete_mapping':
            $id = (int) ($_POST['id'] ?? 0);
            $machine_id = (int) ($_POST['machine_id'] ?? 0);
            $activity_type_id = (int) ($_POST['activity_type_id'] ?? 0);

            if ($id > 0) {
                $stmt = $db_conn->prepare("DELETE FROM objects_machine_activities WHERE id = ?");
                $stmt->bind_param("i", $id);
            } elseif ($machine_id > 0 && $activity_type_id > 0) {
                // Delete specific activity for a machine
                $stmt = $db_conn->prepare("DELETE FROM objects_machine_activities WHERE machine_id = ? AND activity_type_id = ?");
                $stmt->bind_param("ii", $machine_id, $activity_type_id);
            } elseif ($machine_id > 0 && !empty($_POST['capability_name'])) {
                // Delete specific capability for a machine (all activities)
                $cap_name = trim($_POST['capability_name']);
                $stmt = $db_conn->prepare("DELETE FROM objects_machine_activities WHERE machine_id = ? AND capability_name = ?");
                $stmt->bind_param("is", $machine_id, $cap_name);
            } elseif ($machine_id > 0) {
                // Delete all for a machine
                $stmt = $db_conn->prepare("DELETE FROM objects_machine_activities WHERE machine_id = ?");
                $stmt->bind_param("i", $machine_id);
            } else {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Невалидно ID.']);
                exit;
            }

            if ($stmt->execute()) {
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Изтрито успешно.']);
            } else {
                throw new Exception("Error deleting mapping: " . $stmt->error);
            }
            break;

        default:
            ob_clean();
            echo json_encode(['success' => false, 'message' => 'Невалидно действие.']);
    }
} catch (Exception $e) {
    error_log("Error in objects_manage_machines_api.php: " . $e->getMessage());
    ob_clean();
    echo json_encode(['success' => false, 'message' => 'Системна грешка. Моля, опитайте по-късно.']);
} finally {
    if (isset($db_conn)) {
        CloseCon($db_conn);
    }
}
?>