<?php
// /modules/objects/objects_machine_movements_api.php

ini_set('display_errors', 0);
error_reporting(E_ALL);

ob_start();

require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';
require_once __DIR__ . '/../../sys/dbcon.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Access Denied.']);
    exit();
}

$action = $_REQUEST['action'] ?? null;
$db_conn = OpenCon();

try {
    switch ($action) {

        case 'get_options':
            $sql = "SELECT m.id, m.machine_name, ma.activity_type_id, ma.capability_name 
                    FROM heavy_machines m 
                    LEFT JOIN objects_machine_activities ma ON m.id = ma.machine_id 
                    ORDER BY m.machine_name ASC";
            $res = $db_conn->query($sql);
            $machines_raw = [];
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $mid = $row['id'];
                    $m_name = trim($row['machine_name']);
                    if (!empty($m_name) && $m_name[0] === '[') {
                        $decoded = json_decode($m_name, true);
                        if (is_array($decoded) && isset($decoded[0]['value'])) {
                            $m_name = trim($decoded[0]['value']);
                        }
                    }
                    if (!isset($machines_raw[$mid])) {
                        $machines_raw[$mid] = [
                            'id' => (string) $mid,
                            'machine_name' => $m_name,
                            'allowed_activities' => [],
                            'capabilities_map' => []
                        ];
                    }
                    if ($row['activity_type_id']) {
                        $aid = (int) $row['activity_type_id'];
                        if (!in_array($aid, $machines_raw[$mid]['allowed_activities'])) {
                            $machines_raw[$mid]['allowed_activities'][] = $aid;
                        }
                        if ($row['capability_name']) {
                            if (!isset($machines_raw[$mid]['capabilities_map'][$aid])) {
                                $machines_raw[$mid]['capabilities_map'][$aid] = [];
                            }
                            $machines_raw[$mid]['capabilities_map'][$aid][] = $row['capability_name'];
                        }
                    }
                }
            }
            $machines = array_values($machines_raw);

            $clients = [];
            $res = $db_conn->query("SELECT client_id, client_name FROM clients_main ORDER BY client_name");
            if ($res) {
                while ($row = $res->fetch_assoc())
                    $clients[] = $row;
            }

            $sites = [];
            $res = $db_conn->query("SELECT request_id, обект_име FROM requests_main WHERE обект_име IS NOT NULL AND обект_име != '' ORDER BY обект_име");
            if ($res) {
                while ($row = $res->fetch_assoc())
                    $sites[] = $row;
            }

            $schedules = [];
            $res = $db_conn->query("SELECT s.schedule_id, r.обект_име, s.start_date, s.end_date, s.request_id,
                                           s.activity_type_id, at.activity_name, s.capability_name, s.activity_subtype,
                                           s.client_id, c.client_name, s.total_quantity, s.dimension_info
                                    FROM objects_project_schedules s
                                    LEFT JOIN requests_main r ON s.request_id = r.request_id
                                    LEFT JOIN objects_activity_types at ON s.activity_type_id = at.id
                                    LEFT JOIN clients_main c ON s.client_id = c.client_id
                                    WHERE (s.start_date IS NULL OR s.start_date = '0000-00-00')
                                      AND (s.end_date IS NULL OR s.end_date = '0000-00-00')
                                    ORDER BY s.schedule_id DESC");
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $vid = $row['capability_name'] ?: '';
                    if (!empty($row['activity_subtype'])) {
                        $vid = ($vid ? $vid . ' — ' : '') . $row['activity_subtype'];
                    }

                    $display = ($row['обект_име'] ?: 'Без име');
                    $display .= ' | ' . ($row['activity_name'] ?: 'Без дейност');
                    if ($vid)
                        $display .= ' (' . $vid . ')';

                    // Show quantity and dimension instead of dates
                    $qtyStr = (float) ($row['total_quantity'] ?? 0);
                    $dimStr = (float) ($row['dimension_info'] ?? 0);
                    $display .= ' | ' . $qtyStr;
                    if ($dimStr > 0)
                        $display .= ' / ' . $dimStr;

                    $row['display_name'] = $display;
                    $schedules[] = $row;
                }
            }

            ob_clean();
            echo json_encode(['success' => true, 'machines' => $machines, 'sites' => $sites, 'schedules' => $schedules, 'clients' => $clients]);
            break;

        case 'get_movements':
            $search = trim($_GET['search'] ?? '');

            $sql = "SELECT m.*, hm.machine_name, r1.обект_име as from_site_name, r2.обект_име as to_site_name, r3.обект_име as schedule_site_name 
                    FROM objects_machine_movements m 
                    LEFT JOIN heavy_machines hm ON m.machine_id = hm.id 
                    LEFT JOIN requests_main r1 ON m.from_site_id = r1.request_id 
                    LEFT JOIN requests_main r2 ON m.to_site_id = r2.request_id 
                    LEFT JOIN objects_project_schedules s ON m.schedule_id = s.schedule_id
                    LEFT JOIN requests_main r3 ON s.request_id = r3.request_id
                    WHERE 1=1";

            $params = [];
            $types = "";

            if (!empty($search)) {
                $sql .= " AND (hm.machine_name LIKE ? OR m.carrier LIKE ? OR COALESCE(r1.обект_име, 'База') LIKE ? OR COALESCE(r2.обект_име, 'База') LIKE ? OR m.departure_from LIKE ? OR m.arrive_to LIKE ? OR DATE_FORMAT(m.movement_date, '%d.%m.%Y') LIKE ?)";
                $searchTerm = '%' . $search . '%';
                $params[] = $searchTerm;
                $params[] = $searchTerm;
                $params[] = $searchTerm;
                $params[] = $searchTerm;
                $params[] = $searchTerm;
                $params[] = $searchTerm;
                $params[] = $searchTerm;
                $types .= "sssssss";
            }

            $sql .= " ORDER BY m.movement_date DESC, m.id DESC";

            $stmt = $db_conn->prepare($sql);
            if (!empty($params)) {
                $stmt->bind_param($types, ...$params);
            }
            $stmt->execute();
            $result = $stmt->get_result();

            $movements = [];
            while ($row = $result->fetch_assoc()) {
                // Clean machine_name if it contains Tagify JSON
                $m_name = trim($row['machine_name'] ?? '');
                if (!empty($m_name) && $m_name[0] === '[') {
                    $decoded = json_decode($m_name, true);
                    if (is_array($decoded) && isset($decoded[0]['value'])) {
                        $m_name = trim($decoded[0]['value']);
                    }
                }
                $row['machine_name'] = $m_name;
                $row['id'] = (string) ($row['id'] ?? '');
                $row['machine_id'] = (string) ($row['machine_id'] ?? '');
                $movements[] = $row;
            }

            ob_clean();
            echo json_encode(['success' => true, 'data' => $movements]);
            break;

        case 'save_movement':
            $movement_id = (int) ($_POST['movement_id'] ?? 0);

            $arrival_date_raw = $_POST['arrival_date'] ?? '';
            $arrival_date = null;
            if (!empty($arrival_date_raw)) {
                $dateObject = DateTime::createFromFormat('d.m.Y', $arrival_date_raw);
                if ($dateObject) {
                    $arrival_date = $dateObject->format('Y-m-d');
                } else {
                    $arrival_date = $arrival_date_raw;
                }
            }

            $departure_date_raw = $_POST['departure_date'] ?? '';
            $departure_date = null;
            if (!empty($departure_date_raw)) {
                $dateObject = DateTime::createFromFormat('d.m.Y', $departure_date_raw);
                if ($dateObject) {
                    $departure_date = $dateObject->format('Y-m-d');
                } else {
                    $departure_date = $departure_date_raw;
                }
            }

            // Automatically set movement_date to arrival_date (or departure_date if arrival is empty)
            $movement_date = !empty($arrival_date) ? $arrival_date : (!empty($departure_date) ? $departure_date : date('Y-m-d'));

            $machine_id = 0;
            if (!empty($_POST['machine_id'])) {
                $parsed = json_decode($_POST['machine_id'], true);
                if (is_array($parsed) && isset($parsed[0]['id'])) {
                    $machine_id = (int) $parsed[0]['id'];
                }
            }
            $carrier = $_POST['carrier'] ?? '';
            $notes = $_POST['notes'] ?? '';

            $from_site_id = null;
            $departure_from = 'База'; // Default
            if (!empty($_POST['from_site_id'])) {
                $parsed = json_decode($_POST['from_site_id'], true);
                if (is_array($parsed) && isset($parsed[0]['id']) && $parsed[0]['id'] !== '') {
                    $from_site_id = (int) $parsed[0]['id'];
                    $departure_from = $parsed[0]['value'] ?? '';
                } else if (is_array($parsed) && isset($parsed[0]['value'])) {
                    $departure_from = $parsed[0]['value'];
                }
            }
            $to_site_id = null;
            $arrive_to = 'База'; // Default
            if (!empty($_POST['to_site_id'])) {
                $parsed = json_decode($_POST['to_site_id'], true);
                if (is_array($parsed) && isset($parsed[0]['id']) && $parsed[0]['id'] !== '') {
                    $to_site_id = (int) $parsed[0]['id'];
                    $arrive_to = $parsed[0]['value'] ?? '';
                } else if (is_array($parsed) && isset($parsed[0]['value'])) {
                    $arrive_to = $parsed[0]['value'];
                }
            }

            $schedule_id = null;
            if (!empty($_POST['schedule_id'])) {
                $parsed = json_decode($_POST['schedule_id'], true);
                if (is_array($parsed) && isset($parsed[0]['id']) && $parsed[0]['id'] !== '') {
                    $schedule_id = (int) $parsed[0]['id'];
                }
            }

            if (empty($machine_id)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Моля изберете машина.']);
                exit;
            }

            if (empty($schedule_id)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Моля изберете проект / обект.']);
                exit;
            }

            if ($movement_id > 0) {
                // Update
                $sql = "UPDATE objects_machine_movements SET movement_date=?, arrival_date=?, departure_date=?, machine_id=?, from_site_id=?, to_site_id=?, carrier=?, departure_from=?, arrive_to=?, notes=?, schedule_id=? WHERE id=?";
                $stmt = $db_conn->prepare($sql);
                if (!$stmt)
                    throw new Exception("Prepare Error: " . $db_conn->error);
                $stmt->bind_param("sssiiissssii", $movement_date, $arrival_date, $departure_date, $machine_id, $from_site_id, $to_site_id, $carrier, $departure_from, $arrive_to, $notes, $schedule_id, $movement_id);

                if ($stmt->execute()) {
                    // Sync to assignments
                    $stmt_sync = $db_conn->prepare("UPDATE objects_machine_assignments SET start_date=?, end_date=? WHERE movement_id=?");
                    $stmt_sync->bind_param("ssi", $arrival_date, $departure_date, $movement_id);
                    $stmt_sync->execute();
                    $stmt_sync->close();

                    // If linked to a schedule, ensure assignment exists and is linked
                    if ($schedule_id > 0) {
                        $check_assign = $db_conn->prepare("SELECT id FROM objects_machine_assignments WHERE schedule_id=? AND machine_id=?");
                        $check_assign->bind_param("ii", $schedule_id, $machine_id);
                        $check_assign->execute();
                        $res_assign = $check_assign->get_result();

                        if ($row_assign = $res_assign->fetch_assoc()) {
                            $a_id = $row_assign['id'];
                            $upd_assign = $db_conn->prepare("UPDATE objects_machine_assignments SET movement_id=?, start_date=?, end_date=? WHERE id=?");
                            $upd_assign->bind_param("issi", $movement_id, $arrival_date, $departure_date, $a_id);
                            $upd_assign->execute();
                        } else {
                            $ins_assign = $db_conn->prepare("INSERT INTO objects_machine_assignments (schedule_id, machine_id, movement_id, start_date, end_date) VALUES (?, ?, ?, ?, ?)");
                            $ins_assign->bind_param("iiiss", $schedule_id, $machine_id, $movement_id, $arrival_date, $departure_date);
                            $ins_assign->execute();
                        }
                    }

                    ob_clean();
                    echo json_encode(['success' => true, 'message' => 'Успешно обновено движение.']);
                } else {
                    throw new Exception("Грешка при обновяване: " . $stmt->error);
                }
            } else {
                // Insert
                $sql = "INSERT INTO objects_machine_movements (movement_date, arrival_date, departure_date, machine_id, from_site_id, to_site_id, carrier, departure_from, arrive_to, notes, schedule_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $db_conn->prepare($sql);
                if (!$stmt)
                    throw new Exception("Prepare Error: " . $db_conn->error);
                $stmt->bind_param("sssiiissssi", $movement_date, $arrival_date, $departure_date, $machine_id, $from_site_id, $to_site_id, $carrier, $departure_from, $arrive_to, $notes, $schedule_id);
                if ($stmt->execute()) {
                    $new_movement_id = $db_conn->insert_id;

                    if ($schedule_id > 0) {
                        $check_assign = $db_conn->prepare("SELECT id FROM objects_machine_assignments WHERE schedule_id=? AND machine_id=?");
                        $check_assign->bind_param("ii", $schedule_id, $machine_id);
                        $check_assign->execute();
                        $res_assign = $check_assign->get_result();

                        if ($row_assign = $res_assign->fetch_assoc()) {
                            $a_id = $row_assign['id'];
                            $upd_assign = $db_conn->prepare("UPDATE objects_machine_assignments SET movement_id=?, start_date=?, end_date=? WHERE id=?");
                            $upd_assign->bind_param("issi", $new_movement_id, $arrival_date, $departure_date, $a_id);
                            $upd_assign->execute();
                        } else {
                            $ins_assign = $db_conn->prepare("INSERT INTO objects_machine_assignments (schedule_id, machine_id, movement_id, start_date, end_date) VALUES (?, ?, ?, ?, ?)");
                            $ins_assign->bind_param("iiiss", $schedule_id, $machine_id, $new_movement_id, $arrival_date, $departure_date);
                            $ins_assign->execute();
                        }
                    }

                    ob_clean();
                    echo json_encode(['success' => true, 'message' => 'Успешно добавено движение.']);
                } else {
                    throw new Exception("Грешка при запис: " . $stmt->error);
                }
            }
            break;

        case 'get_movement':
            $movement_id = (int) ($_GET['movement_id'] ?? 0);
            $sql = "SELECT m.*, hm.machine_name, r1.обект_име as from_site_name, r2.обект_име as to_site_name, 
                           r3.обект_име as schedule_site_name, s.start_date as s_start, s.end_date as s_end,
                           at.activity_name as s_activity, s.capability_name as s_cap, s.activity_subtype as s_sub,
                           s.client_id, c.client_name, s.request_id, s.total_quantity, s.dimension_info
                    FROM objects_machine_movements m
                    LEFT JOIN heavy_machines hm ON m.machine_id = hm.id
                    LEFT JOIN requests_main r1 ON m.from_site_id = r1.request_id
                    LEFT JOIN requests_main r2 ON m.to_site_id = r2.request_id
                    LEFT JOIN objects_project_schedules s ON m.schedule_id = s.schedule_id
                    LEFT JOIN requests_main r3 ON s.request_id = r3.request_id
                    LEFT JOIN objects_activity_types at ON s.activity_type_id = at.id
                    LEFT JOIN clients_main c ON s.client_id = c.client_id
                    WHERE m.id = ?";
            $stmt = $db_conn->prepare($sql);
            $stmt->bind_param("i", $movement_id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                // Clean machine_name if it contains Tagify JSON
                $m_name = trim($row['machine_name'] ?? '');
                if (!empty($m_name) && $m_name[0] === '[') {
                    $decoded = json_decode($m_name, true);
                    if (is_array($decoded) && isset($decoded[0]['value'])) {
                        $m_name = trim($decoded[0]['value']);
                    }
                }
                $row['machine_name'] = $m_name;
                $row['id'] = (string) ($row['id'] ?? '');
                $row['machine_id'] = (string) ($row['machine_id'] ?? '');

                ob_clean();
                echo json_encode(['success' => true, 'data' => $row]);
            } else {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Записът не е намерен.']);
            }
            break;

        case 'delete_movement':
            $movement_id = (int) ($_POST['movement_id'] ?? 0);

            // Delete matching machine assignments
            $stmt_del_ass = $db_conn->prepare("DELETE FROM objects_machine_assignments WHERE movement_id = ?");
            $stmt_del_ass->bind_param("i", $movement_id);
            $stmt_del_ass->execute();
            $stmt_del_ass->close();

            $stmt = $db_conn->prepare("DELETE FROM objects_machine_movements WHERE id = ?");
            $stmt->bind_param("i", $movement_id);
            if ($stmt->execute()) {
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Успешно изтрито движение.']);
            } else {
                throw new Exception("Грешка при изтриване: " . $stmt->error);
            }
            break;

        default:
            ob_clean();
            echo json_encode(['success' => false, 'message' => 'Invalid action.']);
            break;
    }
} catch (Exception $e) {
    ob_clean();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
