<?php
// /modules/objects/objects_project_schedules_api.php

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
            // Fetch associated options for dropdowns
            $clients = [];
            $res = $db_conn->query("SELECT client_id, client_name FROM clients_main ORDER BY client_name");
            if ($res) {
                while ($row = $res->fetch_assoc())
                    $clients[] = $row;
            }

            $requests = [];
            $res = $db_conn->query("SELECT request_id, обект_име FROM requests_main WHERE обект_име IS NOT NULL AND обект_име != '' ORDER BY обект_име");
            if ($res) {
                while ($row = $res->fetch_assoc())
                    $requests[] = $row;
            }

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

            // Fetch machine-activity mappings safely
            $machine_activities = [];
            $table_check = $db_conn->query("SHOW TABLES LIKE 'objects_machine_activities'");
            if ($table_check && $table_check->num_rows > 0) {
                $res = $db_conn->query("SELECT machine_id, activity_type_id, capability_name FROM objects_machine_activities");
                if ($res) {
                    while ($row = $res->fetch_assoc()) {
                        $machine_activities[] = $row;
                    }
                }
            }

            ob_clean();
            echo json_encode([
                'success' => true,
                'clients' => $clients,
                'requests' => $requests,
                'machines' => $machines,
                'activities' => $activities,
                'machine_activities' => $machine_activities
            ]);
            break;

        case 'get_request_records':
            // Records (order lines) of an inquiry from the requests module
            $req_id = (int) ($_GET['request_id'] ?? 0);
            $records = [];
            if ($req_id > 0) {
                $stmt = $db_conn->prepare("SELECT id, `Вид` AS vid, `Проект` AS project, `Бр` AS qty, `М` AS meters, `Кг` AS kg, `Статус` AS status
                                           FROM requests_orders WHERE request_id = ? ORDER BY id");
                $stmt->bind_param("i", $req_id);
                $stmt->execute();
                $res = $stmt->get_result();
                while ($row = $res->fetch_assoc())
                    $records[] = $row;
                $stmt->close();
            }
            ob_clean();
            echo json_encode(['success' => true, 'records' => $records]);
            break;

        case 'calculate_end_date':
            $start_date = $_GET['start_date'] ?? '';
            $days = (int) ($_GET['days'] ?? 0);

            if (empty($start_date) || $days <= 0) {
                echo json_encode(['success' => false, 'message' => 'Невалидна дата или дни.']);
                break;
            }

            // Convert DD.MM.YYYY to YYYY-MM-DD
            $date_obj = DateTime::createFromFormat('d.m.Y', $start_date);
            if (!$date_obj) {
                echo json_encode(['success' => false, 'message' => 'Невалиден формат на датата.']);
                break;
            }
            $start_ymd = $date_obj->format('Y-m-d');

            // Find the nth working day from the start date (inclusive of start date if it's a working day)
            // weekend=0 means working day. We select $days amount of working days starting from $start_ymd.
            $sql = "SELECT fulldate FROM calendar 
                    WHERE fulldate >= ? AND weekend = 0 
                    ORDER BY fulldate ASC 
                    LIMIT ?";
            $stmt = $db_conn->prepare($sql);
            $stmt->bind_param("si", $start_ymd, $days);
            $stmt->execute();
            $res = $stmt->get_result();

            $end_date_ymd = $start_ymd;
            $count = 0;
            while ($row = $res->fetch_assoc()) {
                $end_date_ymd = $row['fulldate'];
                $count++;
            }

            if ($count > 0) {
                $end_obj = new DateTime($end_date_ymd);
                echo json_encode(['success' => true, 'end_date' => $end_obj->format('d.m.Y')]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Не може да бъде изчислена крайна дата.']);
            }
            break;

        case 'get_schedules':
            $search = trim($_GET['search'] ?? '');

            $sql = "SELECT s.*, 
                           c.client_name, 
                           r.обект_име, 
                           a.activity_name, a.unit_of_measure,
                           COALESCE((SELECT SUM(quantity_completed) FROM objects_daily_progress_logs WHERE schedule_id = s.schedule_id), 0) as total_completed,
                           (SELECT GROUP_CONCAT(hm.machine_name SEPARATOR ', ')
                            FROM objects_machine_assignments oma
                            JOIN heavy_machines hm ON oma.machine_id = hm.id
                            WHERE oma.schedule_id = s.schedule_id AND (oma.end_date IS NULL OR oma.end_date = '0000-00-00' OR oma.end_date >= CURDATE())) as machine_name,
                           (SELECT GROUP_CONCAT(CONCAT(hm.id, ':', hm.machine_name) SEPARATOR '||')
                            FROM objects_machine_assignments oma
                            JOIN heavy_machines hm ON oma.machine_id = hm.id
                            WHERE oma.schedule_id = s.schedule_id AND (oma.end_date IS NULL OR oma.end_date = '0000-00-00' OR oma.end_date >= CURDATE())) as assigned_machines
                    FROM objects_project_schedules s
                    LEFT JOIN clients_main c ON s.client_id = c.client_id
                    LEFT JOIN requests_main r ON s.request_id = r.request_id
                    LEFT JOIN objects_activity_types a ON s.activity_type_id = a.id";

            $params = [];
            $types = "";

            if (!empty($search)) {
                $sql .= " WHERE c.client_name LIKE ? OR r.обект_име LIKE ? OR a.activity_name LIKE ? OR s.activity_subtype LIKE ? OR s.status LIKE ? OR s.schedule_id IN (
                            SELECT schedule_id FROM objects_machine_assignments oma 
                            JOIN heavy_machines hm ON oma.machine_id = hm.id 
                            WHERE hm.machine_name LIKE ?
                        )";
                $searchTerm = '%' . $search . '%';
                $params = [$searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm];
                $types = "ssssss";
            }

            $sql .= " ORDER BY s.schedule_id ASC";

            $stmt = $db_conn->prepare($sql);
            if (!$stmt) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'SQL Error: ' . $db_conn->error]);
                exit;
            }

            if (!empty($params)) {
                $stmt->bind_param($types, ...$params);
            }
            $stmt->execute();
            $result = $stmt->get_result();

            $schedules = [];
            while ($row = $result->fetch_assoc()) {
                $schedules[] = $row;
            }

            ob_clean();
            echo json_encode(['success' => true, 'data' => $schedules]);
            break;

        case 'save_schedule':
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);

            // Handle relational fields from select or tagify
            // If clients was sent as Tagify JSON string
            $client_id = (int) ($_POST['client_id'] ?? 0);
            if (!empty($_POST['client_id']) && !is_numeric($_POST['client_id'])) {
                $parsed = json_decode($_POST['client_id'], true);
                if (is_array($parsed) && isset($parsed[0]['id'])) {
                    $client_id = (int) $parsed[0]['id'];
                }
            }

            // If requests_main was sent as Tagify JSON string
            $request_id = (int) ($_POST['request_id'] ?? 0);
            if (!empty($_POST['request_id']) && !is_numeric($_POST['request_id'])) {
                $parsed = json_decode($_POST['request_id'], true);
                if (is_array($parsed) && isset($parsed[0]['id'])) {
                    $request_id = (int) $parsed[0]['id'];
                }
            }

            // --- Handle Machine Assignments (Detailed) ---
            $assignments_raw = $_POST['machine_assignments'] ?? '[]';
            $machine_assignments = [];
            if (!empty($assignments_raw)) {
                $machine_assignments = json_decode($assignments_raw, true);
                if (!is_array($machine_assignments))
                    $machine_assignments = [];
            }

            $activity_type_id = (int) ($_POST['activity_type_id'] ?? 0);

            $capability_name = $_POST['capability_name'] ?? null;
            if (!empty($capability_name) && strpos($capability_name, '[') === 0 && strpos($capability_name, ']') === (strlen($capability_name) - 1)) {
                $parsed = json_decode($capability_name, true);
                if (is_array($parsed) && isset($parsed[0]['value'])) {
                    $capability_name = $parsed[0]['value'];
                }
            }
            $activity_subtype = $_POST['activity_subtype'] ?? '';

            $total_quantity = (float) ($_POST['total_quantity'] ?? 0);
            $dimension_info = !empty($_POST['dimension_info']) ? (float) $_POST['dimension_info'] : null;
            $daily_productivity_plan = (float) ($_POST['daily_productivity_plan'] ?? 0);
            $planned_days = (float) ($_POST['planned_days'] ?? 0);
            $status = trim($_POST['status'] ?? 'не стартирали');

            $start_date_raw = $_POST['start_date'] ?? '';
            $start_date = null;
            if (!empty($start_date_raw)) {
                $parsed = DateTime::createFromFormat('d.m.Y', $start_date_raw);
                if ($parsed) {
                    $start_date = $parsed->format('Y-m-d');
                } else {
                    $start_date = $start_date_raw; // fallback
                }
            }

            $estimated_start_date = null; // Moved to movements
            $estimated_end_date = null;   // Moved to movements

            $end_date_raw = $_POST['end_date'] ?? '';
            $end_date = null;
            if (!empty($end_date_raw)) {
                $parsed = DateTime::createFromFormat('d.m.Y', $end_date_raw);
                if ($parsed) {
                    $end_date = $parsed->format('Y-m-d');
                } else {
                    $end_date = $end_date_raw; // fallback
                }
            }

            if (empty($request_id) || empty($activity_type_id) || empty($total_quantity)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Моля попълнете всички задължителни полета: Обект, Дейност и Общо к-во.']);
                exit;
            }

            $old_data = null;
            if ($schedule_id > 0) {
                $stmt_old = $db_conn->prepare("SELECT * FROM objects_project_schedules WHERE schedule_id = ?");
                $stmt_old->bind_param("i", $schedule_id);
                $stmt_old->execute();
                $res_old = $stmt_old->get_result();
                $old_data = $res_old->fetch_assoc();
                $stmt_old->close();

                if ($old_data) {
                    $missing_notes_labels = [];
                    $missing_fields = [];

                    $is_date_changed = function ($new, $old) {
                        $n = empty($new) ? null : $new;
                        $o = empty($old) ? null : $old;
                        return $n !== $o;
                    };

                    if ((float) $total_quantity !== (float) $old_data['total_quantity'] && empty(trim($_POST['note_quantity'] ?? ''))) {
                        $missing_notes_labels[] = 'Общо к-во';
                        $missing_fields[] = 'note_quantity';
                    }
                    if ($is_date_changed($start_date, $old_data['start_date']) && empty(trim($_POST['note_period'] ?? ''))) {
                        $missing_notes_labels[] = 'Начална дата';
                        $missing_fields[] = 'note_period';
                    }
                    if ($is_date_changed($end_date, $old_data['end_date']) && empty(trim($_POST['note_end'] ?? ''))) {
                        $missing_notes_labels[] = 'Крайна дата';
                        $missing_fields[] = 'note_end';
                    }

                    if (!empty($missing_fields)) {
                        ob_clean();
                        echo json_encode([
                            'success' => false,
                            'message' => 'Моля, добавете бележка за следната промяна: ' . implode(', ', $missing_notes_labels),
                            'missing_fields' => $missing_fields
                        ]);
                        exit;
                    }
                }
            }

            if ($schedule_id > 0) {
                // Update
                $sql = "UPDATE objects_project_schedules 
                        SET client_id=NULLIF(?, 0), request_id=?, activity_type_id=?, capability_name=?, activity_subtype=?, 
                            total_quantity=?, dimension_info=?, daily_productivity_plan=?, 
                            planned_days=?, start_date=?, end_date=?, status=? 
                        WHERE schedule_id=?";
                $stmt = $db_conn->prepare($sql);
                $stmt->bind_param(
                    "iiissddddsssi",
                    $client_id,
                    $request_id,
                    $activity_type_id,
                    $capability_name,
                    $activity_subtype,
                    $total_quantity,
                    $dimension_info,
                    $daily_productivity_plan,
                    $planned_days,
                    $start_date,
                    $end_date,
                    $status,
                    $schedule_id
                );

                if ($stmt->execute()) {
                    // --- Sync Machine Assignments (Granular) ---
                    $processed_assignment_ids = [];

                    // Closure for movement synchronization
                    $sync_movement = function ($assign, $a_id, $m_id, $a_end) use ($db_conn, $request_id) {
                        $to_site_id = !empty($assign['to_site_id']) ? (int) $assign['to_site_id'] : null;
                        $carrier = !empty($assign['carrier']) ? trim($assign['carrier']) : '';
                        $notes = !empty($assign['notes']) ? trim($assign['notes']) : '';
                        $departure_from = !empty($assign['departure_from']) ? trim($assign['departure_from']) : '';
                        $arrive_to = !empty($assign['to_site_name']) ? trim($assign['to_site_name']) : '';
                        $arrival_dt = !empty($assign['start_date']) ? DateTime::createFromFormat('d.m.Y', $assign['start_date']) : null;
                        $arr_ymd = ($arrival_dt instanceof DateTime) ? $arrival_dt->format('Y-m-d') : null;

                        $mov_id = !empty($assign['movement_id']) ? (int) $assign['movement_id'] : null;

                        // If no movement_id provided but we have an assignment ID, check the DB to prevent duplicates
                        if (!$mov_id && $a_id > 0) {
                            $check_db = $db_conn->query("SELECT movement_id FROM objects_machine_assignments WHERE id = $a_id");
                            if ($check_db && $row_db = $check_db->fetch_assoc()) {
                                $mov_id = (int) $row_db['movement_id'] ?: null;
                            }
                        }

                        // Only sync if we have a departure date
                        if ($a_end && $a_end !== '0000-00-00') {
                            if ($mov_id) {
                                // Update existing movement
                                $stmt_mov = $db_conn->prepare("UPDATE objects_machine_movements SET movement_date=?, arrival_date=?, departure_date=?, machine_id=?, from_site_id=?, to_site_id=?, departure_from=?, arrive_to=?, carrier=?, notes=? WHERE id=?");
                                $stmt_mov->bind_param("sssiisssssi", $a_end, $arr_ymd, $a_end, $m_id, $request_id, $to_site_id, $departure_from, $arrive_to, $carrier, $notes, $mov_id);
                                $stmt_mov->execute();
                                return $mov_id;
                            } else if (!empty($carrier) || $to_site_id || !empty($departure_from) || !empty($notes)) {
                                // Create new movement (only if we have some info)
                                $stmt_mov = $db_conn->prepare("INSERT INTO objects_machine_movements (movement_date, arrival_date, departure_date, machine_id, from_site_id, to_site_id, departure_from, arrive_to, carrier, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                                $stmt_mov->bind_param("sssiisssss", $a_end, $arr_ymd, $a_end, $m_id, $request_id, $to_site_id, $departure_from, $arrive_to, $carrier, $notes);
                                if ($stmt_mov->execute()) {
                                    return $db_conn->insert_id;
                                }
                            }
                        }
                        return $mov_id;
                    };

                    foreach ($machine_assignments as $assign) {
                        $m_id = (int) ($assign['machine_id'] ?? 0);
                        if ($m_id <= 0)
                            continue;

                        $a_id = (int) ($assign['id'] ?? 0);
                        $to_site_id = !empty($assign['to_site_id']) ? (int) $assign['to_site_id'] : null;
                        $carrier = !empty($assign['carrier']) ? trim($assign['carrier']) : null;

                        // Safer date conversion & Smart Sync
                        $dt_start = !empty($assign['start_date']) ? DateTime::createFromFormat('d.m.Y', $assign['start_date']) : null;
                        $a_start_input = ($dt_start instanceof DateTime && $dt_start->format('d.m.Y') === $assign['start_date']) ? $dt_start->format('Y-m-d') : null;

                        $dt_end = !empty($assign['end_date']) ? DateTime::createFromFormat('d.m.Y', $assign['end_date']) : null;
                        $a_end_input = ($dt_end instanceof DateTime && $dt_end->format('d.m.Y') === $assign['end_date']) ? $dt_end->format('Y-m-d') : null;

                        $a_start = $a_start_input;
                        $a_end = $a_end_input;

                        // Sync movement
                        $mov_id = $sync_movement($assign, $a_id, $m_id, $a_end);

                        if ($a_id > 0) {
                            // Update existing
                            $stmt_upd = $db_conn->prepare("UPDATE objects_machine_assignments SET machine_id = ?, start_date = ?, end_date = ?, movement_id = ? WHERE id = ? AND schedule_id = ?");
                            $stmt_upd->bind_param("isssii", $m_id, $a_start, $a_end, $mov_id, $a_id, $schedule_id);
                            if (!$stmt_upd->execute()) {
                                throw new Exception("Грешка при обновяване на машина: " . $stmt_upd->error);
                            }
                            $processed_assignment_ids[] = $a_id;
                        } else {
                            // Insert new
                            $stmt_ins = $db_conn->prepare("INSERT INTO objects_machine_assignments (schedule_id, machine_id, start_date, end_date, movement_id) VALUES (?, ?, ?, ?, ?)");
                            $stmt_ins->bind_param("iissi", $schedule_id, $m_id, $a_start, $a_end, $mov_id);
                            if (!$stmt_ins->execute()) {
                                throw new Exception("Грешка при присъединяване на машина: " . $stmt_ins->error);
                            }
                            $processed_assignment_ids[] = $stmt_ins->insert_id;
                        }

                        // --- Smart Sync for Forecasts (Graph Icons) ---
                        // If there are forecast records explicitly tied to this project and machine,
                        // and they were using the old dates, slide them to the new dates.
                        if ($old_proj_start || $old_proj_est_start) {
                            $target_old_start = $old_proj_start ?: $old_proj_est_start;
                            $target_new_start = $start_date ?: $estimated_start_date;
                            $target_new_end = $end_date ?: $estimated_end_date;

                            if ($target_new_start && $target_new_start !== $target_old_start) {
                                $stmt_sync_f = $db_conn->prepare("UPDATE objects_machine_schedules SET start_date = ?, end_date = ? WHERE request_id = ? AND machine_id = ? AND start_date = ?");
                                if ($stmt_sync_f) {
                                    $stmt_sync_f->bind_param("ssiis", $target_new_start, $target_new_end, $request_id, $m_id, $target_old_start);
                                    $stmt_sync_f->execute();
                                    $stmt_sync_f->close();
                                }
                            }
                        }
                    }

                    // Handle Removals: If an assignment was in DB but not in our processed list
                    $placeholders = empty($processed_assignment_ids) ? "0" : implode(',', $processed_assignment_ids);
                    // If assignment hasn't started yet (start_date is NULL/empty), we can just DELETE it when unsetting it
                    $db_conn->query("DELETE FROM objects_machine_assignments WHERE schedule_id = $schedule_id AND id NOT IN ($placeholders) AND (start_date IS NULL OR start_date = '0000-00-00')");
                    // For started assignments, we perform a soft-delete by setting end_date to yesterday so it disappears from "Current" views immediately
                    $db_conn->query("UPDATE objects_machine_assignments SET end_date = IFNULL(end_date, DATE_SUB(CURDATE(), INTERVAL 1 DAY)) WHERE schedule_id = $schedule_id AND id NOT IN ($placeholders)");

                    // --- Handle Notes ---
                    $user_id = $_SESSION['user_id'] ?? null;
                    $save_note = function ($cat, $text, $new_val, $old_val) use ($db_conn, $schedule_id, $user_id) {
                        $text = trim($text);

                        $changed = false;
                        if (in_array($cat, ['quantity', 'plan'])) {
                            $changed = ((float) $new_val !== (float) $old_val);
                        } else {
                            $n = empty($new_val) ? null : $new_val;
                            $o = empty($old_val) ? null : $old_val;
                            $changed = ($n !== $o);
                        }

                        if (!empty($text) || $changed) {
                            $new_val_str = trim((string) $new_val);
                            $old_val_str = $old_val !== null ? trim((string) $old_val) : '';
                            $full_text = "VAL::" . $new_val_str . "::OLD::" . $old_val_str . "::VAL" . $text;
                            $stmt_note = $db_conn->prepare("INSERT INTO objects_schedule_notes (schedule_id, category, note_text, created_by) VALUES (?, ?, ?, ?)");
                            if ($stmt_note) {
                                $stmt_note->bind_param("issi", $schedule_id, $cat, $full_text, $user_id);
                                $stmt_note->execute();
                                $stmt_note->close();
                            }
                        }
                    };
                    $save_note('quantity', $_POST['note_quantity'] ?? '', $total_quantity, $old_data['total_quantity'] ?? '');
                    $save_note('plan', $_POST['note_plan'] ?? '', $planned_days, $old_data['planned_days'] ?? '');
                    $save_note('period', $_POST['note_period'] ?? '', $start_date, $old_data['start_date'] ?? '');
                    $save_note('end', $_POST['note_end'] ?? '', $end_date, $old_data['end_date'] ?? '');
                    $save_note('status', $_POST['note_status'] ?? '', $status, $old_data['status'] ?? '');

                    ob_clean();
                    echo json_encode(['success' => true, 'message' => 'Успешно обновен график.']);
                } else {
                    throw new Exception("Грешка при обновяване: " . $stmt->error);
                }
            } else {
                // Insert
                $sql = "INSERT INTO objects_project_schedules 
                        (client_id, request_id, activity_type_id, capability_name, activity_subtype, total_quantity, dimension_info, daily_productivity_plan, planned_days, start_date, end_date, status) 
                        VALUES (NULLIF(?, 0), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $db_conn->prepare($sql);
                $stmt->bind_param(
                    "iiissddddsss",
                    $client_id,
                    $request_id,
                    $activity_type_id,
                    $capability_name,
                    $activity_subtype,
                    $total_quantity,
                    $dimension_info,
                    $daily_productivity_plan,
                    $planned_days,
                    $start_date,
                    $end_date,
                    $status
                );

                if ($stmt->execute()) {
                    $new_schedule_id = $stmt->insert_id;

                    // --- Handle Machine Assignments ---
                    foreach ($machine_assignments as $assign) {
                        $m_id = (int) ($assign['machine_id'] ?? 0);
                        if ($m_id <= 0)
                            continue;

                        $to_site_id = !empty($assign['to_site_id']) ? (int) $assign['to_site_id'] : null;
                        $carrier = !empty($assign['carrier']) ? trim($assign['carrier']) : null;

                        // Safer date conversion - strictly manual
                        $dt_start = !empty($assign['start_date']) ? DateTime::createFromFormat('d.m.Y', $assign['start_date']) : null;
                        $a_start = ($dt_start instanceof DateTime && $dt_start->format('d.m.Y') === $assign['start_date']) ? $dt_start->format('Y-m-d') : null;

                        $dt_end = !empty($assign['end_date']) ? DateTime::createFromFormat('d.m.Y', $assign['end_date']) : null;
                        $a_end = ($dt_end instanceof DateTime && $dt_end->format('d.m.Y') === $assign['end_date']) ? $dt_end->format('Y-m-d') : null;

                        $mov_id = null;
                        if ($a_end && $a_end !== '0000-00-00' && (!empty($carrier) || $to_site_id || !empty($assign['departure_from']) || !empty($assign['notes']))) {
                            $notes = !empty($assign['notes']) ? trim($assign['notes']) : '';
                            $departure_from = !empty($assign['departure_from']) ? trim($assign['departure_from']) : '';
                            $arrive_to = !empty($assign['to_site_name']) ? trim($assign['to_site_name']) : '';

                            $arrival_dt = !empty($assign['start_date']) ? DateTime::createFromFormat('d.m.Y', $assign['start_date']) : null;
                            $arr_ymd = ($arrival_dt instanceof DateTime) ? $arrival_dt->format('Y-m-d') : null;

                            $stmt_mov = $db_conn->prepare("INSERT INTO objects_machine_movements (movement_date, arrival_date, departure_date, machine_id, from_site_id, to_site_id, departure_from, arrive_to, carrier, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                            $stmt_mov->bind_param("sssiisssss", $a_end, $arr_ymd, $a_end, $m_id, $request_id, $to_site_id, $departure_from, $arrive_to, $carrier, $notes);
                            if ($stmt_mov->execute()) {
                                $mov_id = $db_conn->insert_id;
                            }
                        }

                        $stmt_add = $db_conn->prepare("INSERT INTO objects_machine_assignments (schedule_id, machine_id, start_date, end_date, movement_id) VALUES (?, ?, ?, ?, ?)");
                        $stmt_add->bind_param("iissi", $new_schedule_id, $m_id, $a_start, $a_end, $mov_id);
                        if (!$stmt_add->execute()) {
                            throw new Exception("Грешка при присъединяване на машина: " . $stmt_add->error);
                        }
                    }

                    // --- Handle Notes ---
                    $user_id = $_SESSION['user_id'] ?? null;
                    $save_note = function ($cat, $text, $val) use ($db_conn, $new_schedule_id, $user_id) {
                        $text = trim($text);
                        if (!empty($text)) {
                            $val = trim($val);
                            $full_text = "VAL::" . $val . "::OLD::::VAL" . $text;
                            $stmt_note = $db_conn->prepare("INSERT INTO objects_schedule_notes (schedule_id, category, note_text, created_by) VALUES (?, ?, ?, ?)");
                            if ($stmt_note) {
                                $stmt_note->bind_param("issi", $new_schedule_id, $cat, $full_text, $user_id);
                                $stmt_note->execute();
                                $stmt_note->close();
                            }
                        }
                    };
                    $save_note('quantity', $_POST['note_quantity'] ?? '', $total_quantity);
                    $save_note('plan', $_POST['note_plan'] ?? '', $planned_days);
                    $save_note('period', $_POST['note_period'] ?? '', $start_date);
                    $save_note('end', $_POST['note_end'] ?? '', $end_date);
                    $save_note('status', $_POST['note_status'] ?? '', $status);

                    ob_clean();
                    echo json_encode(['success' => true, 'message' => 'Успешно добавен график.']);
                } else {
                    throw new Exception("Грешка при запис: " . $stmt->error);
                }
            }
            break;

        case 'save_new_object':
            // Handle request_id (Tagify)
            $request_id = (int) ($_POST['request_id'] ?? 0);
            if (!empty($_POST['request_id']) && !is_numeric($_POST['request_id'])) {
                $parsed = json_decode($_POST['request_id'], true);
                if (is_array($parsed) && isset($parsed[0]['id'])) {
                    $request_id = (int) $parsed[0]['id'];
                }
            }

            if (empty($request_id)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Моля изберете обект.']);
                exit;
            }

            $sql = "INSERT INTO objects_project_schedules 
                    (request_id, status, total_quantity, daily_productivity_plan, planned_days, start_date) 
                    VALUES (?, 'не стартирали', 0, 0, 0, CURDATE())";
            $stmt = $db_conn->prepare($sql);
            $stmt->bind_param("i", $request_id);

            if ($stmt->execute()) {
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Успешно добавен обект.']);
            } else {
                throw new Exception("Грешка при запис: " . $stmt->error);
            }
            break;

        case 'change_object_client':
            $request_id = (int) ($_POST['request_id'] ?? 0);
            $client_id = (int) ($_POST['change_client_id'] ?? 0);
            if (!empty($_POST['change_client_id']) && !is_numeric($_POST['change_client_id'])) {
                $parsed = json_decode($_POST['change_client_id'], true);
                if (is_array($parsed) && isset($parsed[0]['id'])) {
                    $client_id = (int) $parsed[0]['id'];
                }
            }

            if (empty($request_id) || empty($client_id)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Невалиден обект или клиент.']);
                exit;
            }

            $sql = "UPDATE objects_project_schedules SET client_id = ? WHERE request_id = ?";
            $stmt = $db_conn->prepare($sql);
            $stmt->bind_param("ii", $client_id, $request_id);

            if ($stmt->execute()) {
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Успешно променен клиент на обекта.']);
            } else {
                throw new Exception("Грешка при обновяване: " . $stmt->error);
            }
            break;

        case 'get_schedule':
            $schedule_id = (int) ($_GET['schedule_id'] ?? 0);
            try {
                $sql = "SELECT s.*, r.обект_име, c.client_name,
                               (SELECT GROUP_CONCAT(CONCAT(oma.id, ':', hm.id, ':', hm.machine_name, ':', IFNULL(oma.start_date, ''), ':', IFNULL(oma.end_date, ''), ':', IFNULL(mm.to_site_id, ''), ':', IFNULL(r2.обект_име, 'База'), ':', IFNULL(mm.carrier, ''), ':', IFNULL(oma.movement_id, ''), ':', IFNULL(mm.departure_from, ''), ':', IFNULL(mm.notes, '')) SEPARATOR '||')
                                FROM objects_machine_assignments oma
                                JOIN heavy_machines hm ON oma.machine_id = hm.id
                                LEFT JOIN objects_machine_movements mm ON oma.movement_id = mm.id
                                LEFT JOIN requests_main r2 ON mm.to_site_id = r2.request_id
                                WHERE oma.schedule_id = s.schedule_id) as assigned_machines
                        FROM objects_project_schedules s 
                        LEFT JOIN requests_main r ON s.request_id = r.request_id 
                        LEFT JOIN clients_main c ON s.client_id = c.client_id
                        WHERE s.schedule_id = ?";
                $stmt = $db_conn->prepare($sql);
                if (!$stmt)
                    die(json_encode(['success' => false, 'message' => 'SQL Prepare Error: ' . $db_conn->error]));
                $stmt->bind_param("i", $schedule_id);
                if (!$stmt->execute())
                    die(json_encode(['success' => false, 'message' => 'SQL Execute Error: ' . $stmt->error]));
                $result = $stmt->get_result();
                $row = $result->fetch_assoc();
                if (!$row)
                    die(json_encode(['success' => false, 'message' => 'Row not found for ID: ' . $schedule_id]));
                $json = json_encode(['success' => true, 'data' => $row], JSON_UNESCAPED_UNICODE);
                if ($json === false)
                    die(json_encode(['success' => false, 'message' => 'JSON Encode Error: ' . json_last_error_msg()]));
                ob_clean();
                die($json);
            } catch (Throwable $e) {
                die(json_encode(['success' => false, 'message' => 'Server Throwable: ' . $e->getMessage()]));
            }

        case 'sync_machine_assignments':
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);
            $machine_ids = $_POST['machine_ids'] ?? [];

            if (!$schedule_id) {
                echo json_encode(['success' => false, 'message' => 'Невалидно ID на график.']);
                exit;
            }

            // Sync logic
            $current_assignments = [];
            $res = $db_conn->query("SELECT machine_id FROM objects_machine_assignments WHERE schedule_id = $schedule_id AND (end_date IS NULL OR end_date = '0000-00-00')");
            while ($row = $res->fetch_assoc()) {
                $current_assignments[] = (int) $row['machine_id'];
            }

            $new_machine_ids = array_map('intval', $machine_ids);
            $to_add = array_diff($new_machine_ids, $current_assignments);
            $to_remove = array_diff($current_assignments, $new_machine_ids);

            foreach ($to_add as $mid) {
                if ($mid > 0) {
                    $stmt_add = $db_conn->prepare("INSERT INTO objects_machine_assignments (schedule_id, machine_id, start_date) VALUES (?, ?, NULL)");
                    $stmt_add->bind_param("ii", $schedule_id, $mid);
                    $stmt_add->execute();
                    $stmt_add->close();
                }
            }

            foreach ($to_remove as $mid) {
                $stmt_rem = $db_conn->prepare("DELETE FROM objects_machine_assignments WHERE schedule_id = ? AND machine_id = ? AND (end_date IS NULL OR end_date = '0000-00-00')");
                $stmt_rem->bind_param("ii", $schedule_id, $mid);
                $stmt_rem->execute();
                $stmt_rem->close();
            }

            echo json_encode(['success' => true, 'message' => 'Машините са обновени успешно.']);
            break;

        case 'delete_schedule':
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);

            // Allow deleting both real schedules and placeholders
            $stmt = $db_conn->prepare("DELETE FROM objects_project_schedules WHERE schedule_id = ?");
            $stmt->bind_param("i", $schedule_id);
            if ($stmt->execute()) {
                // Also clean up notes and logs attached to this schedule just in case
                $db_conn->query("DELETE FROM objects_schedule_notes WHERE schedule_id = $schedule_id");
                $db_conn->query("DELETE FROM objects_daily_progress_logs WHERE schedule_id = $schedule_id");

                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Успешно изтрито.']);
            } else {
                throw new Exception("Грешка при изтриване: " . $stmt->error);
            }
            break;

        case 'get_logs':
            $schedule_id = (int) ($_GET['schedule_id'] ?? 0);

            $sql = "SELECT l.*, u.full_name as updated_by_name 
                    FROM objects_daily_progress_logs l
                    LEFT JOIN users u ON l.updated_by = u.id
                    WHERE l.schedule_id = ?
                    ORDER BY l.work_date DESC, l.log_id DESC";

            $stmt = $db_conn->prepare($sql);
            $stmt->bind_param("i", $schedule_id);
            $stmt->execute();
            $result = $stmt->get_result();

            $logs = [];
            while ($row = $result->fetch_assoc()) {
                $logs[] = $row;
            }

            ob_clean();
            echo json_encode(['success' => true, 'data' => $logs]);
            break;

        case 'save_log':
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);
            $work_date = $_POST['work_date'] ?? '';
            $quantity_completed = (float) ($_POST['quantity_completed'] ?? 0);
            $notes = trim($_POST['notes'] ?? '');

            $user_id = $_SESSION['user_id'] ?? null;

            if ($quantity_completed < 0) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Количеството не може да бъде отрицателно число.']);
                exit;
            }

            if ($quantity_completed === 0.0 && empty($notes)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'При количество 0 е задължително да въведете бележка.']);
                exit;
            }

            if (empty($schedule_id) || empty($work_date)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Моля попълнете всички задължителни полета коректно.']);
                exit;
            }

            $stmt = $db_conn->prepare("INSERT INTO objects_daily_progress_logs (schedule_id, work_date, quantity_completed, notes, updated_by) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("isdsi", $schedule_id, $work_date, $quantity_completed, $notes, $user_id);

            if ($stmt->execute()) {
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Отчетът е добавен успешно.']);
            } else {
                throw new Exception("Грешка при запис: " . $stmt->error);
            }
            break;

        case 'delete_log':
            $log_id = (int) ($_POST['log_id'] ?? 0);
            $stmt = $db_conn->prepare("DELETE FROM objects_daily_progress_logs WHERE log_id = ?");
            $stmt->bind_param("i", $log_id);

            if ($stmt->execute()) {
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Успешно изтрит отчет.']);
            } else {
                throw new Exception("Грешка при изтриване: " . $stmt->error);
            }
            break;

        case 'get_schedule_timeline':
            $schedule_id = (int) ($_GET['schedule_id'] ?? 0);

            $timeline = [];

            // 1. Fetch from objects_schedule_notes
            $sql_notes = "SELECT n.note_id as id, n.category, n.note_text as content, n.created_at as timestamp, u.full_name as user_name
                          FROM objects_schedule_notes n
                          LEFT JOIN users u ON n.created_by = u.id
                          WHERE n.schedule_id = ?";
            $stmt_notes = $db_conn->prepare($sql_notes);
            $stmt_notes->bind_param("i", $schedule_id);
            $stmt_notes->execute();
            $res_notes = $stmt_notes->get_result();
            while ($row = $res_notes->fetch_assoc()) {
                $timeline[] = $row;
            }
            $stmt_notes->close();

            // 2. Fetch from objects_daily_progress_logs
            $sql_logs = "SELECT p.log_id as id, 'progress' as category, 
                                CONCAT('Изпълнено: +', p.quantity_completed, IF(p.notes != '', CONCAT(' - ', p.notes), '')) as content, 
                                p.work_date as ts_date, p.created_at, u.full_name as user_name
                         FROM objects_daily_progress_logs p
                         LEFT JOIN users u ON p.updated_by = u.id
                         WHERE p.schedule_id = ?";
            $stmt_logs = $db_conn->prepare($sql_logs);
            $stmt_logs->bind_param("i", $schedule_id);
            $stmt_logs->execute();
            $res_logs = $stmt_logs->get_result();
            while ($row = $res_logs->fetch_assoc()) {
                // If the log doesn't have an exact created_at time (depending on db schema), 
                // we fall back to work_date + 12:00:00 for sorting purposes.
                $timestamp = !empty($row['created_at']) ? $row['created_at'] : $row['ts_date'] . ' 12:00:00';

                $timeline[] = [
                    'id' => $row['id'],
                    'category' => $row['category'],
                    'content' => $row['content'],
                    'timestamp' => $timestamp,
                    'user_name' => $row['user_name']
                ];
            }
            $stmt_logs->close();

            // Sort merged array by timestamp ascending (or descending, timeline is usually descending)
            usort($timeline, function ($a, $b) {
                return strtotime($b['timestamp']) - strtotime($a['timestamp']); // Newest first
            });

            ob_clean();
            echo json_encode(['success' => true, 'data' => $timeline]);
            break;

        case 'get_object_matrix':
            $request_id = (int) ($_GET['request_id'] ?? 0);
            $year_month = $_GET['month'] ?? date('Y-m'); // Expected format 'YYYY-MM'

            if (!$request_id) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Невалиден обект.']);
                exit;
            }

            list($year, $month) = explode('-', $year_month);
            $year = (int) $year;
            $month = (int) $month;

            // 1. Get Calendar days for the specified month
            // 1. Get Calendar days for the specified month from the DB to include holidays
            $days = [];
            $bg_days = [
                'Monday' => 'По',
                'Tuesday' => 'Вт',
                'Wednesday' => 'Ср',
                'Thursday' => 'Че',
                'Friday' => 'Пе',
                'Saturday' => 'Съ',
                'Sunday' => 'Не'
            ];

            $cal_sql = "SELECT fulldate, day, day_name, weekend FROM calendar WHERE year = ? AND month = ? ORDER BY day ASC";
            $cal_stmt = $db_conn->prepare($cal_sql);
            $cal_stmt->bind_param("ii", $year, $month);
            $cal_stmt->execute();
            $cal_res = $cal_stmt->get_result();

            while ($row = $cal_res->fetch_assoc()) {
                $days[] = [
                    'day' => (int) $row['day'],
                    'fulldate' => $row['fulldate'],
                    'weekend' => (int) $row['weekend'],
                    'day_name' => $bg_days[$row['day_name']] ?? $row['day_name']
                ];
            }
            $cal_stmt->close();

            // 2. Get active Schedules for this request_id
            $sched_sql = "SELECT s.schedule_id, a.activity_name, s.activity_subtype, a.unit_of_measure, s.total_quantity, s.dimension_info,
                                 (SELECT GROUP_CONCAT(hm.machine_name SEPARATOR ', ')
                                  FROM objects_machine_assignments oma
                                  JOIN heavy_machines hm ON oma.machine_id = hm.id
                                  WHERE oma.schedule_id = s.schedule_id AND (oma.end_date IS NULL OR oma.end_date = '0000-00-00')) as machine_name,
                                 s.start_date, s.end_date, s.status, s.daily_productivity_plan,
                                 (SELECT SUM(quantity_completed) FROM objects_daily_progress_logs WHERE schedule_id = s.schedule_id) as total_completed
                          FROM objects_project_schedules s
                          LEFT JOIN objects_activity_types a ON s.activity_type_id = a.id
                          WHERE s.request_id = ? AND s.activity_type_id IS NOT NULL
                          ORDER BY s.schedule_id ASC";
            $stmt_sched = $db_conn->prepare($sched_sql);
            $stmt_sched->bind_param("i", $request_id);
            $stmt_sched->execute();
            $sched_res = $stmt_sched->get_result();
            $schedules = [];
            while ($row = $sched_res->fetch_assoc()) {
                $schedules[] = $row;
            }
            $stmt_sched->close();

            // 3. Get Logs map grouped by schedule_id and then by work_date
            $logs_by_sched_date = [];
            $schedule_ids = array_column($schedules, 'schedule_id');

            if (!empty($schedule_ids)) {
                $placeholders = implode(',', array_fill(0, count($schedule_ids), '?'));
                $log_sql = "SELECT log_id, schedule_id, work_date, quantity_completed, notes, u.full_name as user_name
                            FROM objects_daily_progress_logs l
                            LEFT JOIN users u ON l.updated_by = u.id
                            WHERE schedule_id IN ($placeholders) 
                            AND YEAR(work_date) = ? AND MONTH(work_date) = ?";
                $stmt_log = $db_conn->prepare($log_sql);

                $types = str_repeat('i', count($schedule_ids)) . 'ii';
                $params = $schedule_ids;
                $params[] = $year;
                $params[] = $month;
                $stmt_log->bind_param($types, ...$params);
                $stmt_log->execute();
                $log_res = $stmt_log->get_result();

                while ($row = $log_res->fetch_assoc()) {
                    $s_id = $row['schedule_id'];
                    $date = $row['work_date'];

                    if (!isset($logs_by_sched_date[$s_id])) {
                        $logs_by_sched_date[$s_id] = [];
                    }
                    if (!isset($logs_by_sched_date[$s_id][$date])) {
                        $logs_by_sched_date[$s_id][$date] = [
                            'quantity' => 0,
                            'notes' => []
                        ];
                    }

                    $logs_by_sched_date[$s_id][$date]['quantity'] += (float) $row['quantity_completed'];
                    if (!empty($row['notes'])) {
                        $logs_by_sched_date[$s_id][$date]['notes'][] = [
                            'text' => $row['notes'],
                            'user' => $row['user_name'] ?? 'Неизвестен'
                        ];
                    }
                }
                $stmt_log->close();
            }

            // Return aggregated payload
            ob_clean();
            echo json_encode([
                'success' => true,
                'days' => $days,
                'schedules' => $schedules,
                'logs' => $logs_by_sched_date
            ]);
            break;

        default:
            ob_clean();
            echo json_encode(['success' => false, 'message' => 'Invalid action.']);
            break;
    }
} catch (Throwable $e) {
    ob_clean();
    echo json_encode(['success' => false, 'message' => 'Възникна сървърна грешка: ' . $e->getMessage()]);
}
