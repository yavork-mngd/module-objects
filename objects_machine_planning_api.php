<?php
// /modules/objects/objects_machine_planning_api.php

ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
    exit();
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$db_conn = OpenCon();

try {
    switch ($action) {

        case 'get_machines':
            $res = $db_conn->query("SELECT id, machine_name FROM heavy_machines ORDER BY machine_name ASC");
            $machines = [];
            while ($row = $res->fetch_assoc()) {
                $m_name = trim($row['machine_name']);
                if (!empty($m_name) && $m_name[0] === '[') {
                    $decoded = json_decode($m_name, true);
                    if (is_array($decoded) && isset($decoded[0]['value'])) {
                        $m_name = trim($decoded[0]['value']);
                    }
                }
                $row['machine_name'] = $m_name;
                $machines[] = $row;
            }
            echo json_encode(['success' => true, 'data' => $machines]);
            break;

        case 'save_estimate':
            $estimate_id = (int) ($_POST['estimate_id'] ?? 0);
            $machine_id = (int) ($_POST['machine_id'] ?? 0);
            $request_id = (int) ($_POST['request_id'] ?? 0);
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);
            $object_name = $_POST['object_name'] ?? '';
            $start_date = $_POST['start_date'] ?? null;
            $end_date = $_POST['end_date'] ?? null;
            $notes = $_POST['notes'] ?? '';
            $est_activity_type_id = !empty($_POST['activity_type_id']) ? (int) $_POST['activity_type_id'] : null;
            $est_capability_name = !empty($_POST['capability_name']) ? trim($_POST['capability_name']) : null;

            if (!$machine_id || empty(trim($object_name)) || !$start_date || !$end_date) {
                echo json_encode(['success' => false, 'message' => 'Липсват задължителни полета.']);
                exit;
            }

            if ($estimate_id > 0) {
                // Update
                $stmt = $db_conn->prepare("UPDATE objects_machine_schedules SET machine_id=?, object_name=?, start_date=?, end_date=?, notes=?, activity_type_id=?, capability_name=?, activity_subtype=?, request_id=? WHERE id=?");
                $req_id_val = $request_id > 0 ? $request_id : null;
                $stmt->bind_param("issssisii", $machine_id, $object_name, $start_date, $end_date, $notes, $est_activity_type_id, $est_capability_name, $_POST['activity_subtype'], $req_id_val, $estimate_id);
                $stmt->execute();
            } else {
                // Insert
                $stmt = $db_conn->prepare("INSERT INTO objects_machine_schedules (machine_id, object_name, start_date, end_date, notes, activity_type_id, capability_name, activity_subtype, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $req_id_val = $request_id > 0 ? $request_id : null;
                $stmt->bind_param("issssisss", $machine_id, $object_name, $start_date, $end_date, $notes, $est_activity_type_id, $est_capability_name, $_POST['activity_subtype'], $req_id_val);
                $stmt->execute();
            }

            // AUTO-ASSIGN MACHINE TO UNPLANNED PROJECTS (Bulk support #22)
            if ($schedule_id > 0 && $machine_id > 0) {
                // Fetch details of the original schedule_id to find matching ones
                $stmt_fetch = $db_conn->prepare("SELECT request_id, activity_type_id, activity_subtype, capability_name FROM objects_project_schedules WHERE schedule_id = ?");
                $stmt_fetch->bind_param("i", $schedule_id);
                $stmt_fetch->execute();
                $orig = $stmt_fetch->get_result()->fetch_assoc();

                if ($orig) {
                    $req_id = $orig['request_id'];
                    $act_id = $orig['activity_type_id'];
                    $sub_type = $orig['activity_subtype'];
                    $orig_cap = $orig['capability_name'];
                    // Use new capability if provided, else keep original
                    $cap_name = !empty($est_capability_name) ? $est_capability_name : $orig['capability_name'];

                    // 1. Update capability name on all matching unplanned activities for this object
                    // We use COALESCE/IFNULL to treat NULL and empty string as equivalent for matching purposes
                    $sql_update = "UPDATE objects_project_schedules 
                                SET capability_name = ? 
                                WHERE request_id = ? AND activity_type_id = ? 
                                AND IFNULL(activity_subtype, '') = IFNULL(?, '')
                                AND IFNULL(capability_name, '') = IFNULL(?, '')
                                AND (start_date IS NULL OR start_date = '0000-00-00' OR start_date = '00.00.0000')";

                    $stmt_update = $db_conn->prepare($sql_update);
                    $stmt_update->bind_param("siiss", $cap_name, $req_id, $act_id, $sub_type, $orig_cap);
                    $stmt_update->execute();

                    // 2. Assign machine to all matching unplanned activities via bridge table
                    $sql_find = "SELECT schedule_id FROM objects_project_schedules 
                                WHERE request_id = ? AND activity_type_id = ? 
                                AND IFNULL(activity_subtype, '') = IFNULL(?, '')
                                AND IFNULL(capability_name, '') = IFNULL(?, '')
                                AND (start_date IS NULL OR start_date = '0000-00-00' OR start_date = '00.00.0000')";

                    // Always include the current schedule_id in the processing list
                    $target_ids = [$schedule_id];

                    $stmt_find = $db_conn->prepare($sql_find);
                    $stmt_find->bind_param("iiss", $req_id, $act_id, $sub_type, $cap_name);
                    $stmt_find->execute();
                    $res_find = $stmt_find->get_result();

                    while ($row = $res_find->fetch_assoc()) {
                        $target_ids[] = (int) $row['schedule_id'];
                    }

                    $unique_targets = array_unique($target_ids);
                    foreach ($unique_targets as $target_sched_id) {
                        // Check if already assigned
                        $check = $db_conn->query("SELECT id FROM objects_machine_assignments WHERE schedule_id = $target_sched_id AND machine_id = $machine_id AND (end_date IS NULL OR end_date = '0000-00-00')");
                        if ($check && $check->num_rows == 0) {
                            $stmt_assign = $db_conn->prepare("INSERT INTO objects_machine_assignments (schedule_id, machine_id, start_date) VALUES (?, ?, NULL)");
                            $stmt_assign->bind_param("ii", $target_sched_id, $machine_id);
                            $stmt_assign->execute();
                            $stmt_assign->close();
                        }
                    }
                }
            }

            echo json_encode(['success' => true, 'message' => 'Успешно запазено.']);
            break;

        case 'delete_estimate':
            $estimate_id = (int) ($_POST['estimate_id'] ?? 0);
            if ($estimate_id > 0) {
                // Fetch details before delete to clean up orphaned assignments (#Request 5.05)
                $stmt_fetch = $db_conn->prepare("SELECT machine_id, request_id, activity_type_id, capability_name, activity_subtype FROM objects_machine_schedules WHERE id = ?");
                $stmt_fetch->bind_param("i", $estimate_id);
                $stmt_fetch->execute();
                $est = $stmt_fetch->get_result()->fetch_assoc();

                if ($est) {
                    $m_id = (int) $est['machine_id'];
                    $r_id = (int) $est['request_id'];
                    $a_id = (int) $est['activity_type_id'];
                    $cap = $est['capability_name'];
                    $sub = $est['activity_subtype'];

                    // Find matching schedule_ids in project schedules to clean up assignments
                    $sql_find = "SELECT schedule_id FROM objects_project_schedules 
                                WHERE request_id = ? AND activity_type_id = ? 
                                AND IFNULL(capability_name, '') = IFNULL(?, '') 
                                AND IFNULL(activity_subtype, '') = IFNULL(?, '')";
                    $stmt_sched = $db_conn->prepare($sql_find);
                    $stmt_sched->bind_param("iiss", $r_id, $a_id, $cap, $sub);
                    $stmt_sched->execute();
                    $res_sched = $stmt_sched->get_result();

                    while ($row_s = $res_sched->fetch_assoc()) {
                        $s_id = (int) $row_s['schedule_id'];
                        // Delete assignments that have NO start date (meaning they were just planned/forecasted)
                        $db_conn->query("DELETE FROM objects_machine_assignments WHERE schedule_id = $s_id AND machine_id = $m_id AND (start_date IS NULL OR start_date = '0000-00-00')");
                    }
                }

                $stmt = $db_conn->prepare("DELETE FROM objects_machine_schedules WHERE id=?");
                $stmt->bind_param("i", $estimate_id);
                $stmt->execute();
                echo json_encode(['success' => true, 'message' => 'Успешно изтрито.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Невалидно ID за изтриване.']);
            }
            break;

        case 'delete_assignment':
            $assignment_id = (int) ($_POST['assignment_id'] ?? 0);
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);
            $machine_id = (int) ($_POST['machine_id'] ?? 0);

            if ($assignment_id > 0) {
                $stmt = $db_conn->prepare("DELETE FROM objects_machine_assignments WHERE id = ?");
                $stmt->bind_param("i", $assignment_id);
                if ($stmt->execute()) {
                    echo json_encode(['success' => true, 'message' => 'Успешно изтрито.']);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Грешка при изтриване.']);
                }
            } else if ($schedule_id > 0 && $machine_id > 0) {
                $stmt = $db_conn->prepare("DELETE FROM objects_machine_assignments WHERE schedule_id = ? AND machine_id = ?");
                $stmt->bind_param("ii", $schedule_id, $machine_id);
                if ($stmt->execute()) {
                    echo json_encode(['success' => true, 'message' => 'Успешно изтрито.']);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Грешка при изтриване.']);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'Невалидни ID за изтриване.']);
            }
            break;

        case 'get_machine_year_matrix':
            $machine_id = (int) ($_GET['machine_id'] ?? 0);
            $year = (int) ($_GET['year'] ?? date('Y'));

            if ($machine_id <= 0) {
                echo json_encode(['success' => false, 'message' => 'Невалидна машина.']);
                exit;
            }

            // 1. Generate Months and Days (12 x 31)
            $matrix = [];
            $bg_months = [
                1 => 'Януари',
                2 => 'Февруари',
                3 => 'Март',
                4 => 'Април',
                5 => 'Май',
                6 => 'Юни',
                7 => 'Юли',
                8 => 'Август',
                9 => 'Септември',
                10 => 'Октомври',
                11 => 'Ноември',
                12 => 'Декември'
            ];

            for ($m = 1; $m <= 12; $m++) {
                $days_in_month = cal_days_in_month(CAL_GREGORIAN, $m, $year);
                $month_days = [];
                for ($d = 1; $d <= 31; $d++) {
                    if ($d <= $days_in_month) {
                        $date_str = sprintf('%04d-%02d-%02d', $year, $m, $d);
                        $timestamp = strtotime($date_str);
                        $day_of_week = date('N', $timestamp);
                        $is_weekend = ($day_of_week >= 6);

                        $month_days[] = [
                            'day' => $d,
                            'date' => $date_str,
                            'is_weekend' => $is_weekend,
                            'valid' => true
                        ];
                    } else {
                        $month_days[] = [
                            'day' => $d,
                            'date' => '',
                            'is_weekend' => false,
                            'valid' => false
                        ];
                    }
                }
                $matrix[] = [
                    'month_num' => $m,
                    'month_name' => $bg_months[$m],
                    'days' => $month_days
                ];
            }

            $start_of_year = sprintf('%04d-01-01', $year);
            $end_of_year = sprintf('%04d-12-31', $year);

            // 2. Get Estimates
            $sql_est = "SELECT s.id as estimate_id, s.machine_id, 
                        NULLIF(s.start_date, '0000-00-00') as start_date, 
                        NULLIF(s.end_date, '0000-00-00') as end_date, 
                        s.notes, s.status, 
                        s.capability_name, s.activity_subtype,
                        at_est.activity_name as est_activity_name,
                        COALESCE(s.object_name, r.обект_име) as object_name 
                    FROM objects_machine_schedules s
                    LEFT JOIN requests_main r ON s.request_id = r.request_id
                    LEFT JOIN objects_activity_types at_est ON s.activity_type_id = at_est.id
                    WHERE s.machine_id = ? AND s.start_date <= ? AND s.end_date >= ?
                    ORDER BY s.start_date ASC";

            $stmt_est = $db_conn->prepare($sql_est);
            $stmt_est->bind_param("iss", $machine_id, $end_of_year, $start_of_year);
            $stmt_est->execute();
            $res_est = $stmt_est->get_result();

            $estimates = [];
            while ($row = $res_est->fetch_assoc()) {
                $vid = $row['capability_name'] ?: '';
                if (!empty($row['activity_subtype'])) {
                    $vid = ($vid ? $vid . ' — ' : '') . $row['activity_subtype'];
                }
                $row['display_vid'] = $vid ?: '-';
                $estimates[] = $row;
            }

            // 3. Get Project Schedules (Corrected with machine_movements JOIN)
            $locations = [];
            $sql_proj = "SELECT oma.id as assignment_id, ps.schedule_id, ps.request_id, ps.activity_type_id, ps.capability_name, ps.activity_subtype, ps.status,
                                NULLIF(ps.start_date, '0000-00-00') as start_date, 
                                NULLIF(ps.end_date, '0000-00-00') as end_date, 
                                NULLIF(ps.estimated_start_date, '0000-00-00') as estimated_start_date, 
                                NULLIF(ps.estimated_end_date, '0000-00-00') as estimated_end_date, 
                                ps.total_quantity,
                                NULLIF(oma.start_date, '0000-00-00') as assign_start, 
                                NULLIF(oma.end_date, '0000-00-00') as assign_end, 
                                (SELECT обект_име FROM requests_main WHERE request_id = m.to_site_id) as to_site_name_obj,
                                m.departure_from as manual_from,
                                m.arrive_to as manual_to,
                                m.carrier, m.notes,
                                (SELECT r_prev.обект_име 
                                 FROM objects_machine_assignments oma_prev
                                 JOIN objects_project_schedules ps_prev ON oma_prev.schedule_id = ps_prev.schedule_id
                                 JOIN requests_main r_prev ON ps_prev.request_id = r_prev.request_id
                                 WHERE oma_prev.machine_id = oma.machine_id 
                                   AND oma_prev.end_date < oma.start_date
                                 ORDER BY oma_prev.end_date DESC LIMIT 1) as from_site_name,
                                r.обект_име as location_name,
                                a.activity_name,
                                a.unit_of_measure,
                                (SELECT SUM(quantity_completed) FROM objects_daily_progress_logs WHERE schedule_id = ps.schedule_id) as total_completed
                         FROM objects_machine_assignments oma
                         JOIN objects_project_schedules ps ON oma.schedule_id = ps.schedule_id
                         LEFT JOIN requests_main r ON ps.request_id = r.request_id
                         LEFT JOIN objects_activity_types a ON ps.activity_type_id = a.id
                         LEFT JOIN objects_machine_movements m ON oma.movement_id = m.id
                         WHERE oma.machine_id = ?";

            $stmt_proj = $db_conn->prepare($sql_proj);
            $stmt_proj->bind_param("i", $machine_id);
            $stmt_proj->execute();
            $res_proj = $stmt_proj->get_result();

            while ($row = $res_proj->fetch_assoc()) {
                $status = strtolower($row['status'] ?: 'планиран');
                $isActuallyStarted = ($status !== 'планиран' && $status !== 'не стартирали' && $status !== 'upcoming');

                $hasProjDates = (!empty($row['start_date']) && $row['start_date'] != '0000-00-00') ||
                    (!empty($row['estimated_start_date']) && $row['estimated_start_date'] != '0000-00-00');

                // Refined Ghost filter: Only skip if NOT started, NO project dates, and machine is assigned without an end date AND NO linked object (#33)
                if (!$isActuallyStarted && !$hasProjDates && !empty($row['assign_start']) && empty($row['assign_end']) && empty($row['request_id'])) {
                    continue;
                }

                $base_loc = $row;
                $base_loc['location_name'] = $row['location_name'] ?: 'Неизвестен обект';
                $base_loc['total_completed'] = (float) $row['total_completed'];
                $base_loc['total_quantity'] = (float) $row['total_quantity'];

                $vid = $row['capability_name'] ?: '';
                if (!empty($row['activity_subtype'])) {
                    $vid = ($vid ? $vid . ' — ' : '') . $row['activity_subtype'];
                }
                $base_loc['display_vid'] = $vid ?: '-';

                // 1. ACTUAL RANGE
                $act_start = (!empty($row['assign_start']) && $row['assign_start'] != '0000-00-00') ? $row['assign_start'] : $row['start_date'];
                $act_end = (!empty($row['assign_end']) && $row['assign_end'] != '0000-00-00') ? $row['assign_end'] : $row['end_date'];

                if (!empty($act_start) && $act_start != '0000-00-00') {
                    if ($act_start <= $end_of_year && ($act_end == '2099-12-31' || ($act_end >= $start_of_year || empty($act_end) || $act_end == '0000-00-00'))) {
                        $displayStatus = $status;
                        $isProblem = (strpos($status, 'проблем') !== false || strpos($status, 'спрян') !== false);
                        if (!$isActuallyStarted && !$isProblem && $status !== 'completed' && $status !== 'приключен' && $status !== 'не стартирали' && $status !== 'планиран') {
                            $displayStatus = 'active';
                        }

                        $locations[] = array_merge($base_loc, [
                            'display_start' => $act_start,
                            'display_end' => $act_end,
                            'status' => $displayStatus,
                            'is_open_ended' => ($act_end == '2099-12-31'),
                            'to_site_name' => ($row['to_site_name_obj'] ?? '') ?: ($row['manual_to'] ?? ''),
                            'from_site_name' => ($row['from_site_name'] ?? '') ?: ($row['manual_from'] ?? 'База'),
                            'carrier' => $row['carrier']
                        ]);
                    }
                }

                // 2. ESTIMATED RANGE
                $est_start = (!empty($row['estimated_start_date']) && $row['estimated_start_date'] != '0000-00-00') ? $row['estimated_start_date'] : null;
                $est_end = (!empty($row['estimated_end_date']) && $row['estimated_end_date'] != '0000-00-00') ? $row['estimated_end_date'] : null;

                if (!empty($est_start)) {
                    if (empty($est_end))
                        $est_end = $est_start;

                    // Removed $alreadyCovered suppression to allow full visibility of overlaps
                    if ($est_start <= $end_of_year && $est_end >= $start_of_year) {
                        $locations[] = array_merge($base_loc, [
                            'start_date' => $est_start,
                            'end_date' => $est_end,
                            'status' => 'планиран',
                            'is_open_ended' => false,
                            'to_site_name' => ($row['to_site_name_obj'] ?? '') ?: ($row['manual_to'] ?? ''),
                            'from_site_name' => ($row['from_site_name'] ?? '') ?: ($row['manual_from'] ?? 'База'),
                            'carrier' => $row['carrier']
                        ]);
                    }
                }
            }

            // 4. Get Machine Movements
            $movements = [];
            $sql_mov = "SELECT m.id, m.movement_date, m.arrival_date, m.departure_date, m.carrier, m.notes,
                               m.departure_from as manual_departure_from,
                               m.arrive_to as manual_arrive_to,
                               COALESCE(rf.обект_име, 'База') as from_site_name,
                               COALESCE(rt.обект_име, 'База') as to_site_name,
                               COALESCE(r_obj.обект_име, NULLIF(rt.обект_име, 'База'), NULLIF(rf.обект_име, 'База'), NULLIF(m.arrive_to, 'База'), NULLIF(m.departure_from, 'База'), 'База') as object_name,
                               at.activity_name, ps.capability_name, ps.activity_subtype,
                               COALESCE(ps.request_id, m.to_site_id, m.from_site_id) as request_id, m.schedule_id
                        FROM objects_machine_movements m
                        LEFT JOIN requests_main rf ON m.from_site_id = rf.request_id
                        LEFT JOIN requests_main rt ON m.to_site_id = rt.request_id
                        LEFT JOIN objects_project_schedules ps ON m.schedule_id = ps.schedule_id
                        LEFT JOIN requests_main r_obj ON ps.request_id = r_obj.request_id
                        LEFT JOIN objects_activity_types at ON ps.activity_type_id = at.id
                        WHERE m.machine_id = ? 
                          AND (
                            (m.movement_date >= ? AND m.movement_date <= ?) OR 
                            (m.arrival_date >= ? AND m.arrival_date <= ?) OR 
                            (m.departure_date >= ? AND m.departure_date <= ?)
                          )
                        ORDER BY m.movement_date ASC";

            $stmt_mov = $db_conn->prepare($sql_mov);
            $stmt_mov->bind_param("issssss", $machine_id, $start_of_year, $end_of_year, $start_of_year, $end_of_year, $start_of_year, $end_of_year);
            $stmt_mov->execute();
            $res_mov = $stmt_mov->get_result();
            while ($row = $res_mov->fetch_assoc()) {
                $movements[] = $row;
            }

            // 5. Get Capabilities
            $sql_cap = "SELECT ma.activity_type_id, a.activity_name, ma.capability_name
                        FROM objects_machine_activities ma
                        JOIN objects_activity_types a ON ma.activity_type_id = a.id
                        WHERE ma.machine_id = ?
                        ORDER BY a.activity_name, ma.capability_name";
            $stmt_cap = $db_conn->prepare($sql_cap);
            $stmt_cap->bind_param("i", $machine_id);
            $stmt_cap->execute();
            $res_cap = $stmt_cap->get_result();
            $cap_grouped = [];
            while ($row = $res_cap->fetch_assoc()) {
                $act_id = $row['activity_type_id'];
                if (!isset($cap_grouped[$act_id])) {
                    $cap_grouped[$act_id] = [
                        'activity_type_id' => (int) $act_id,
                        'activity_name' => $row['activity_name'],
                        'capabilities' => []
                    ];
                }
                $cap_grouped[$act_id]['capabilities'][] = $row['capability_name'];
            }
            $capabilities = array_values($cap_grouped);

            // 7. Unplanned Queue
            $unplanned_queue = [];
            $sql_unp = "SELECT s.*, r.обект_име as object_name, c.client_name, a.activity_name, a.unit_of_measure
                        FROM objects_machine_assignments oma
                        JOIN objects_project_schedules s ON oma.schedule_id = s.schedule_id
                        LEFT JOIN requests_main r ON s.request_id = r.request_id
                        LEFT JOIN clients_main c ON s.client_id = c.client_id
                        LEFT JOIN objects_activity_types a ON s.activity_type_id = a.id
                        WHERE oma.machine_id = ?
                          AND (s.start_date IS NULL OR s.start_date = '0000-00-00')
                          AND (s.estimated_start_date IS NULL OR s.estimated_start_date = '0000-00-00')
                          AND (oma.end_date IS NULL OR oma.end_date = '0000-00-00')
                        ORDER BY r.обект_име ASC";
            $stmt_unp = $db_conn->prepare($sql_unp);
            $stmt_unp->bind_param("i", $machine_id);
            $stmt_unp->execute();
            $res_unp = $stmt_unp->get_result();
            while ($row = $res_unp->fetch_assoc()) {
                $vid = $row['capability_name'] ?: '';
                if (!empty($row['activity_subtype'])) {
                    $vid = ($vid ? $vid . ' — ' : '') . $row['activity_subtype'];
                }
                $row['display_vid'] = $vid ?: '-';
                $unplanned_queue[] = $row;
            }

            // 8. Global Object Envelopes
            $object_envelopes = [];
            $sql_env = "SELECT ps.request_id, r.обект_име,
                               MIN(NULLIF(ps.estimated_start_date, '0000-00-00')) as min_est_start, 
                               MAX(NULLIF(ps.estimated_end_date, '0000-00-00')) as max_est_end, 
                               MIN(NULLIF(ps.start_date, '0000-00-00')) as min_actual_start, 
                               MAX(NULLIF(ps.end_date, '0000-00-00')) as max_actual_end
                        FROM objects_project_schedules ps
                        LEFT JOIN requests_main r ON ps.request_id = r.request_id
                        WHERE (ps.estimated_start_date <= ? AND ps.estimated_end_date >= ?)
                           OR (ps.start_date <= ? AND (ps.end_date >= ? OR ps.end_date = '0000-00-00' OR ps.end_date IS NULL))
                        GROUP BY ps.request_id, r.обект_име";
            $stmt_env = $db_conn->prepare($sql_env);
            $stmt_env->bind_param("ssss", $end_of_year, $start_of_year, $end_of_year, $start_of_year);
            $stmt_env->execute();
            $res_env = $stmt_env->get_result();
            while ($row = $res_env->fetch_assoc()) {
                $object_envelopes[$row['request_id']] = $row;
            }

            echo json_encode([
                'success' => true,
                'matrix' => $matrix,
                'estimates' => $estimates,
                'locations' => $locations,
                'movements' => $movements,
                'capabilities' => $capabilities,
                'unplanned_queue' => $unplanned_queue,
                'object_envelopes' => $object_envelopes
            ]);
            break;

        case 'get_gantt_data':
            $year_month = $_GET['month'] ?? date('Y-m');
            list($year, $month) = explode('-', $year_month);
            $year = (int) $year;
            $month = (int) $month;
            $days = [];
            $num_days = cal_days_in_month(CAL_GREGORIAN, $month, $year);
            $bg_days = ['Monday' => 'По', 'Tuesday' => 'Вт', 'Wednesday' => 'Ср', 'Thursday' => 'Че', 'Friday' => 'Пе', 'Saturday' => 'Съ', 'Sunday' => 'Не'];

            for ($d = 1; $d <= $num_days; $d++) {
                $date_str = sprintf('%04d-%02d-%02d', $year, $month, $d);
                $timestamp = strtotime($date_str);
                $day_name = date('l', $timestamp);
                $days[] = [
                    'day' => $d,
                    'fulldate' => $date_str,
                    'weekend' => (date('N', $timestamp) >= 6 ? 1 : 0),
                    'day_name' => $bg_days[$day_name] ?? $day_name
                ];
            }

            $start_of_month = sprintf('%04d-%02d-01', $year, $month);
            $end_of_month = sprintf('%04d-%02d-%02d', $year, $month, $num_days);

            $res_machines = $db_conn->query("SELECT id, machine_name FROM heavy_machines ORDER BY machine_name ASC");
            $machines = [];
            while ($row = $res_machines->fetch_assoc()) {
                $machines[] = $row;
            }

            $sql_est = "SELECT s.id as estimate_id, s.machine_id, s.start_date, s.end_date, s.status, s.capability_name, at.activity_name as est_activity_name, COALESCE(s.object_name, r.обект_име) as object_name 
                        FROM objects_machine_schedules s
                        LEFT JOIN requests_main r ON s.request_id = r.request_id
                        LEFT JOIN objects_activity_types at ON s.activity_type_id = at.id
                        WHERE s.start_date <= ? AND s.end_date >= ?
                        ORDER BY s.start_date ASC";
            $stmt_est = $db_conn->prepare($sql_est);
            $stmt_est->bind_param("ss", $end_of_month, $start_of_month);
            $stmt_est->execute();
            $res_est = $stmt_est->get_result();
            $estimates_by_machine = [];
            while ($row = $res_est->fetch_assoc()) {
                $m_id = $row['machine_id'];
                if (!isset($estimates_by_machine[$m_id]))
                    $estimates_by_machine[$m_id] = [];
                $estimates_by_machine[$m_id][] = $row;
            }

            $sql_proj_all = "SELECT ps.*, oma.machine_id, oma.start_date as assign_start, oma.end_date as assign_end, at.activity_name, r.обект_име as location_name 
                             FROM objects_machine_assignments oma
                             JOIN objects_project_schedules ps ON oma.schedule_id = ps.schedule_id
                             LEFT JOIN requests_main r ON ps.request_id = r.request_id
                             LEFT JOIN objects_activity_types at ON ps.activity_type_id = at.id";
            $res_proj_all = $db_conn->query($sql_proj_all);
            $locations_by_machine = [];
            while ($row = $res_proj_all->fetch_assoc()) {
                $m_id = $row['machine_id'];
                $eff_start = $row['assign_start'] ?: ($row['start_date'] ?: $row['estimated_start_date']);
                $eff_end = $row['assign_end'] ?: ($row['end_date'] ?: $row['estimated_end_date']);
                if ($eff_start && $eff_end && $eff_start <= $end_of_month && $eff_end >= $start_of_month) {
                    if (!isset($locations_by_machine[$m_id]))
                        $locations_by_machine[$m_id] = [];
                    $locations_by_machine[$m_id][] = array_merge($row, ['start_date' => $eff_start, 'end_date' => $eff_end, 'location_name' => $row['location_name'] ?: 'Неизвестен обект']);
                }
            }

            echo json_encode(['success' => true, 'days' => $days, 'machines' => $machines, 'estimates' => $estimates_by_machine, 'locations' => $locations_by_machine]);
            break;

        case 'get_estimate':
            $estimate_id = (int) ($_GET['estimate_id'] ?? $_GET['id'] ?? 0);
            $stmt = $db_conn->prepare("SELECT s.*, COALESCE(s.object_name, r.обект_име) as object_name FROM objects_machine_schedules s LEFT JOIN requests_main r ON s.request_id = r.request_id WHERE s.id = ?");
            $stmt->bind_param("i", $estimate_id);
            $stmt->execute();
            $res = $stmt->get_result();
            echo json_encode(['success' => true, 'data' => $res->fetch_assoc()]);
            break;

        case 'get_all_activities':
            $request_id = (int) ($_GET['request_id'] ?? 0);
            $sql = "SELECT DISTINCT a.id, a.activity_name, a.unit_of_measure FROM objects_activity_types a JOIN objects_machine_activities ma ON a.id = ma.activity_type_id ";
            if ($request_id > 0) {
                $sql .= " JOIN objects_project_schedules ps ON a.id = ps.activity_type_id WHERE ps.request_id = " . $request_id;
            }
            $sql .= " ORDER BY a.activity_name";
            $res = $db_conn->query($sql);
            $activities = [];
            while ($row = $res->fetch_assoc()) {
                $activities[] = $row;
            }
            echo json_encode(['success' => true, 'data' => $activities]);
            break;

        case 'get_planning_objects':
            $sql = "SELECT request_id, обект_име as object_name FROM requests_main ORDER BY обект_име ASC";
            $res = $db_conn->query($sql);
            $objects = [];
            while ($row = $res->fetch_assoc()) {
                if (!empty(trim($row['object_name']))) {
                    $objects[] = $row;
                }
            }
            echo json_encode(['success' => true, 'data' => $objects]);
            break;

        case 'get_machines_by_activity':
            $activity_type_id = (int) ($_GET['activity_type_id'] ?? 0);
            $capability_name = trim($_GET['capability_name'] ?? '');
            $request_id = (int) ($_GET['request_id'] ?? 0);

            if ($activity_type_id > 0) {
                $sql = "SELECT DISTINCT m.id, m.machine_name FROM heavy_machines m JOIN objects_machine_activities ma ON m.id = ma.machine_id WHERE ma.activity_type_id = ?";
                $params = [$activity_type_id];
                $types = "i";

                if (!empty($capability_name)) {
                    $sql .= " AND TRIM(ma.capability_name) = ? ";
                    $params[] = $capability_name;
                    $types .= "s";
                }

                if ($request_id > 0) {
                    $sql .= " AND m.id IN (
                        SELECT machine_id FROM objects_machine_assignments oma JOIN objects_project_schedules ps ON oma.schedule_id = ps.schedule_id WHERE ps.request_id = ?
                        UNION SELECT machine_id FROM objects_machine_schedules WHERE request_id = ?
                        UNION SELECT machine_id FROM objects_machine_movements WHERE to_site_id = ? OR from_site_id = ?
                    ) ";
                    array_push($params, $request_id, $request_id, $request_id, $request_id);
                    $types .= "iiii";
                }

                $sql .= " ORDER BY m.machine_name ASC";
                $stmt = $db_conn->prepare($sql);
                $stmt->bind_param($types, ...$params);
                $stmt->execute();
                $res = $stmt->get_result();
                $machines = [];
                while ($row = $res->fetch_assoc()) {
                    $m_name = trim($row['machine_name']);
                    if (!empty($m_name) && $m_name[0] === '[') {
                        $decoded = json_decode($m_name, true);
                        if (is_array($decoded) && isset($decoded[0]['value'])) {
                            $m_name = trim($decoded[0]['value']);
                        }
                    }
                    $row['machine_name'] = $m_name;
                    $machines[] = $row;
                }
            } else {
                $sql = "SELECT m.id, m.machine_name, ma.activity_type_id, ma.capability_name FROM heavy_machines m LEFT JOIN objects_machine_activities ma ON m.id = ma.machine_id ";
                if ($request_id > 0) {
                    $sql .= " WHERE m.id IN (
                        SELECT machine_id FROM objects_machine_assignments oma JOIN objects_project_schedules ps ON oma.schedule_id = ps.schedule_id WHERE ps.request_id = " . intval($request_id) . "
                        UNION SELECT machine_id FROM objects_machine_schedules WHERE request_id = " . intval($request_id) . "
                        UNION SELECT machine_id FROM objects_machine_movements WHERE to_site_id = " . intval($request_id) . " OR from_site_id = " . intval($request_id) . "
                    ) ";
                }
                $sql .= " ORDER BY m.machine_name ASC";
                $res = $db_conn->query($sql);
                $machines_raw = [];
                while ($row = $res->fetch_assoc()) {
                    $mid = $row['id'];
                    $m_name = trim($row['machine_name']);
                    if (!empty($m_name) && $m_name[0] === '[') {
                        $decoded = json_decode($m_name, true);
                        if (is_array($decoded) && isset($decoded[0]['value'])) {
                            $m_name = trim($decoded[0]['value']);
                        }
                    }
                    if (!isset($machines_raw[$mid]))
                        $machines_raw[$mid] = ['id' => $mid, 'machine_name' => $m_name, 'allowed_activities' => [], 'capabilities_map' => []];
                    if ($row['activity_type_id']) {
                        $aid = (int) $row['activity_type_id'];
                        if (!in_array($aid, $machines_raw[$mid]['allowed_activities']))
                            $machines_raw[$mid]['allowed_activities'][] = $aid;
                        if ($row['capability_name']) {
                            if (!isset($machines_raw[$mid]['capabilities_map'][$aid]))
                                $machines_raw[$mid]['capabilities_map'][$aid] = [];
                            $machines_raw[$mid]['capabilities_map'][$aid][] = $row['capability_name'];
                        }
                    }
                }
                $machines = array_values($machines_raw);
            }
            echo json_encode(['success' => true, 'data' => $machines]);
            break;

        case 'get_forecast_dates':
            $m_id = (int) ($_GET['machine_id'] ?? 0);
            $r_id = (int) ($_GET['request_id'] ?? 0);
            $a_id = (int) ($_GET['activity_type_id'] ?? 0);
            $cap = $_GET['capability_name'] ?? '';
            $sub = $_GET['activity_subtype'] ?? '';

            $sql = "SELECT id, start_date, end_date, notes FROM objects_machine_schedules 
                    WHERE machine_id = ? AND request_id = ? AND activity_type_id = ?
                    AND IFNULL(capability_name, '') = IFNULL(?, '')
                    AND IFNULL(activity_subtype, '') = IFNULL(?, '')
                    ORDER BY start_date ASC";
            $stmt = $db_conn->prepare($sql);
            $stmt->bind_param("iiiss", $m_id, $r_id, $a_id, $cap, $sub);
            $stmt->execute();
            $res = $stmt->get_result();
            $forecasts = [];
            while ($row = $res->fetch_assoc()) {
                $forecasts[] = $row;
            }
            echo json_encode(['success' => true, 'data' => $forecasts]);
            break;

        case 'find_available_machines':
            $find_start = $_GET['start_date'] ?? '';
            $find_end = $_GET['end_date'] ?? '';
            $find_activity = (int) ($_GET['activity_type_id'] ?? 0);
            if (empty($find_start) || empty($find_end)) {
                echo json_encode(['success' => false, 'message' => 'Dates required.']);
                exit;
            }
            $sql_machines = "SELECT DISTINCT m.id, m.machine_name FROM heavy_machines m";
            if ($find_activity > 0)
                $sql_machines .= " JOIN objects_machine_activities ma ON m.id = ma.machine_id AND ma.activity_type_id = ?";
            $sql_machines .= " ORDER BY m.machine_name";
            $stmt_m = $db_conn->prepare($sql_machines);
            if ($find_activity > 0)
                $stmt_m->bind_param("i", $find_activity);
            $stmt_m->execute();
            $res_m = $stmt_m->get_result();
            $available = [];
            while ($m_row = $res_m->fetch_assoc()) {
                $mid = $m_row['id'];
                $available[] = ['id' => $mid, 'machine_name' => $m_row['machine_name'], 'is_busy' => false];
            }
            echo json_encode(['success' => true, 'data' => $available]);
            break;

        case 'get_unplanned_projects':
            $sql = "SELECT s.*, r.обект_име as object_name, c.client_name, a.activity_name, a.unit_of_measure,
                           (SELECT GROUP_CONCAT(CONCAT(hm.id, ':', hm.machine_name, ':', IFNULL(oma.start_date, '')) SEPARATOR '||')
                            FROM objects_machine_assignments oma
                            JOIN heavy_machines hm ON oma.machine_id = hm.id
                            WHERE oma.schedule_id = s.schedule_id AND (oma.end_date IS NULL OR oma.end_date = '0000-00-00')) as assigned_machines,
                           (SELECT COUNT(*) FROM objects_machine_schedules oms 
                            WHERE oms.request_id = s.request_id 
                            AND oms.activity_type_id = s.activity_type_id 
                            AND IFNULL(oms.capability_name, '') = IFNULL(s.capability_name, '')
                            AND IFNULL(oms.activity_subtype, '') = IFNULL(s.activity_subtype, '')) as forecast_count
                    FROM objects_project_schedules s
                    LEFT JOIN requests_main r ON s.request_id = r.request_id
                    LEFT JOIN clients_main c ON s.client_id = c.client_id
                    LEFT JOIN objects_activity_types a ON s.activity_type_id = a.id
                    WHERE s.schedule_id NOT IN (
                        SELECT schedule_id FROM objects_machine_assignments 
                        WHERE (end_date IS NULL OR end_date = '0000-00-00')
                        AND (start_date IS NOT NULL AND start_date != '0000-00-00' AND start_date != '00.00.0000')
                    )
                    AND s.schedule_id NOT IN (
                        SELECT DISTINCT schedule_id FROM objects_machine_movements WHERE schedule_id IS NOT NULL AND schedule_id > 0
                    )
                    ORDER BY s.schedule_id ASC";
            $res = $db_conn->query($sql);
            $projects = [];
            while ($row = $res->fetch_assoc()) {
                // Calculate display_vid format: "Capability — Subtype"
                $vid = $row['capability_name'] ?: '';
                if (!empty($row['activity_subtype'])) {
                    $vid = ($vid ? $vid . ' — ' : '') . $row['activity_subtype'];
                }
                $row['display_vid'] = $vid ?: '-';
                $projects[] = $row;
            }
            echo json_encode(['success' => true, 'data' => $projects]);
            break;

        case 'assign_machine_to_project':
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);
            $machine_id = (int) ($_POST['machine_id'] ?? 0);
            if (!$schedule_id || !$machine_id) {
                echo json_encode(['success' => false, 'message' => 'Invalid data.']);
                exit;
            }
            $stmt = $db_conn->prepare("INSERT INTO objects_machine_assignments (schedule_id, machine_id, start_date) VALUES (?, ?, NULL)");
            $stmt->bind_param("ii", $schedule_id, $machine_id);
            if ($stmt->execute())
                echo json_encode(['success' => true, 'message' => 'Success.']);
            else
                echo json_encode(['success' => false, 'message' => 'Error.']);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
} finally {
    CloseCon($db_conn);
}
