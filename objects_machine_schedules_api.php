<?php
// /modules/api/objects_machine_schedules_api.php

ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../../sys/config.php';

$db_conn = null;
$action = $_POST['action'] ?? $_GET['action'] ?? '';

try {
    header('Content-Type: application/json');

    if (!isLoggedIn()) {
        echo json_encode(['success' => false, 'message' => 'Не сте оторизирани.']);
        exit;
    }

    $db_conn = OpenCon();
    switch ($action) {

        case 'get_schedules':
            // Fetch all schedules, grouped by machine, ordered logically
            $sql = "
                SELECT ms.*, 
                       hm.machine_name,
                       rm.object_name, rm.object_address
                FROM objects_machine_schedules ms
                JOIN heavy_machines hm ON ms.machine_id = hm.id
                JOIN requests_main rm ON ms.request_id = rm.request_id
                ORDER BY hm.machine_name ASC, ms.start_date ASC
            ";
            $res = $db_conn->query($sql);

            $schedules = [];
            while ($row = $res->fetch_assoc()) {
                $schedules[] = $row;
            }

            // Re-structure to group by machine, then by status
            $grouped = [];
            foreach ($schedules as $row) {
                $machineId = $row['machine_id'];
                $status = $row['status'];

                if (!isset($grouped[$machineId])) {
                    $grouped[$machineId] = [
                        'machine_id' => $machineId,
                        'machine_name' => $row['machine_name'],
                        'statuses' => [
                            'completed' => [],
                            'active' => [],
                            'upcoming' => []
                        ]
                    ];
                }

                $grouped[$machineId]['statuses'][$status][] = $row;
            }

            // Convert to indexed array
            $result = array_values($grouped);
            echo json_encode(['success' => true, 'data' => $result]);
            break;

        case 'save_schedule':
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);
            $machine_id = (int) ($_POST['machine_id'] ?? 0);
            $request_id = (int) ($_POST['request_id'] ?? 0);
            $status = $_POST['status'] ?? 'upcoming';
            $start_date = $_POST['start_date'] ?? null;
            $end_date = $_POST['end_date'] ?? null;
            $notes = $_POST['notes'] ?? '';
            $activity_type_id = (int) ($_POST['activity_type_id'] ?? 0);
            $capability_name = $_POST['capability_name'] ?? null;
            $activity_subtype = $_POST['activity_subtype'] ?? '';

            if (!$machine_id || !$request_id || !$start_date || !$end_date) {
                echo json_encode(['success' => false, 'message' => 'Липсват задължителни полета.']);
                exit;
            }

            if ($schedule_id > 0) {
                // Update
                $stmt = $db_conn->prepare("UPDATE objects_machine_schedules SET machine_id=?, request_id=?, start_date=?, end_date=?, status=?, notes=?, activity_type_id=?, capability_name=?, activity_subtype=? WHERE id=?");
                $stmt->bind_param("iisssssisi", $machine_id, $request_id, $start_date, $end_date, $status, $notes, $activity_type_id, $capability_name, $activity_subtype, $schedule_id);
                $stmt->execute();
            } else {
                // Insert
                $stmt = $db_conn->prepare("INSERT INTO objects_machine_schedules (machine_id, request_id, start_date, end_date, status, notes, activity_type_id, capability_name, activity_subtype) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->bind_param("iisssssis", $machine_id, $request_id, $start_date, $end_date, $status, $notes, $activity_type_id, $capability_name, $activity_subtype);
                $stmt->execute();
            }

            echo json_encode(['success' => true, 'message' => 'Успешно запазено.']);
            break;

        case 'delete_schedule':
            $schedule_id = (int) ($_POST['schedule_id'] ?? 0);
            if ($schedule_id > 0) {
                $stmt = $db_conn->prepare("DELETE FROM objects_machine_schedules WHERE id=?");
                $stmt->bind_param("i", $schedule_id);
                $stmt->execute();
                echo json_encode(['success' => true, 'message' => 'Успешно изтрито.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Невалидно ID за изтриване.']);
            }
            break;

        case 'search_objects':
            // Endpoint to search for requests_main (Обекти)
            $term = $_GET['term'] ?? '';
            $termParam = "%" . $term . "%";
            $stmt = $db_conn->prepare("SELECT request_id as id, object_name as text FROM requests_main WHERE object_name LIKE ? OR object_address LIKE ? LIMIT 20");
            $stmt->bind_param("ss", $termParam, $termParam);
            $stmt->execute();

            $results = [];
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $results[] = $row;
            }
            echo json_encode(['results' => $results]);
            break;

        case 'get_machine_matrix':
            $start_month = $_GET['month'] ?? date('Y-m'); // 'YYYY-MM'
            $num_months = (int) ($_GET['duration'] ?? 2); // Default to current and next month
            if ($num_months < 1)
                $num_months = 1;

            $start_of_range = $start_month . '-01';

            // Calculate the end of the range based on num_months
            $start_dt = new DateTime($start_of_range);
            $end_dt = clone $start_dt;
            $end_dt->modify('+' . ($num_months - 1) . ' months');
            $end_of_range = $end_dt->format('Y-m-t'); // 't' gives last day of month

            // 1. Get Calendar days from the calendar table for the whole range
            $days = [];
            $stmt_cal = $db_conn->prepare("SELECT day, month, year, fulldate, weekend, day_name FROM calendar WHERE fulldate BETWEEN ? AND ? ORDER BY fulldate ASC");
            $stmt_cal->bind_param("ss", $start_of_range, $end_of_range);
            $stmt_cal->execute();
            $res_cal = $stmt_cal->get_result();

            $bg_days = [
                'Monday' => 'По',
                'Tuesday' => 'Вт',
                'Wednesday' => 'Ср',
                'Thursday' => 'Че',
                'Friday' => 'Пе',
                'Saturday' => 'Съ',
                'Sunday' => 'Не'
            ];
            while ($row = $res_cal->fetch_assoc()) {
                $row['day_name'] = $bg_days[$row['day_name']] ?? $row['day_name'];
                $days[] = $row;
            }

            // Also expose range boundaries to frontend
            $start_of_month = $start_of_range;
            $end_of_month = $end_of_range;
            $stmt_cal->close();

            // 2. Get all machines
            $res_machines = $db_conn->query("SELECT id, machine_name FROM heavy_machines ORDER BY machine_name ASC");
            $machines = [];
            $machine_seen = [];
            while ($row = $res_machines->fetch_assoc()) {
                if (!isset($machine_seen[$row['id']])) {
                    $machines[] = $row;
                    $machine_seen[$row['id']] = true;
                }
            }

            // 3. Get schedules for the month
            $start_of_month = $start_of_range;
            $end_of_month = $end_of_range;

            // We look at objects_project_schedules via assignments
            $sql = "SELECT s.schedule_id, s.request_id, oma.machine_id, 
                           NULLIF(oma.start_date, '0000-00-00') as assign_start, 
                           NULLIF(oma.end_date, '0000-00-00') as assign_end,                            (SELECT обект_име FROM requests_main WHERE request_id = m.to_site_id) as to_site_name_obj,
                            m.arrive_to as manual_to, m.departure_from as manual_from, m.carrier,
                            (SELECT r_prev.обект_име 
                             FROM objects_machine_assignments oma_prev
                             JOIN objects_project_schedules ps_prev ON oma_prev.schedule_id = ps_prev.schedule_id
                             JOIN requests_main r_prev ON ps_prev.request_id = r_prev.request_id
                             WHERE oma_prev.machine_id = oma.machine_id 
                               AND oma_prev.end_date < oma.start_date
                             ORDER BY oma_prev.end_date DESC LIMIT 1) as from_site_name,
                           NULLIF(s.start_date, '0000-00-00') as start_date, 
                           NULLIF(s.end_date, '0000-00-00') as end_date, 
                           NULLIF(s.estimated_start_date, '0000-00-00') as estimated_start_date, 
                           NULLIF(s.estimated_end_date, '0000-00-00') as estimated_end_date, 
                           s.status, r.обект_име as обект_име,
                           at.activity_name, s.capability_name, s.activity_subtype 
                    FROM objects_machine_assignments oma
                    JOIN objects_project_schedules s ON oma.schedule_id = s.schedule_id
                    LEFT JOIN requests_main r ON s.request_id = r.request_id
                    LEFT JOIN objects_activity_types at ON s.activity_type_id = at.id
                    LEFT JOIN objects_machine_movements m ON oma.movement_id = m.id
                    WHERE 
                        COALESCE(NULLIF(oma.start_date, '0000-00-00'), NULLIF(s.estimated_start_date, '0000-00-00'), NULLIF(s.start_date, '0000-00-00')) <= ? 
                        AND (
                            COALESCE(NULLIF(oma.end_date, '0000-00-00'), NULLIF(s.estimated_end_date, '0000-00-00'), NULLIF(s.end_date, '0000-00-00')) >= ? 
                            OR COALESCE(NULLIF(oma.end_date, '0000-00-00'), NULLIF(s.estimated_end_date, '0000-00-00'), NULLIF(s.end_date, '0000-00-00')) IS NULL
                        )
                    ORDER BY oma.start_date ASC";


            $stmt_sched = $db_conn->prepare($sql);
            $stmt_sched->bind_param("ss", $end_of_month, $start_of_month);
            $stmt_sched->execute();
            $res_schedules = $stmt_sched->get_result();

            $schedules_raw = [];
            while ($row = $res_schedules->fetch_assoc()) {
                $schedules_raw[] = $row;
            }
            $stmt_sched->close();

            // 4. Get forecasts (objects_machine_schedules)
            $sql_forecasts = "SELECT s.id as forecast_id, s.machine_id, s.start_date, s.end_date, s.request_id,
                                     COALESCE(s.object_name, r.обект_име) as object_name,
                                     at.activity_name, s.capability_name, s.activity_subtype 
                              FROM objects_machine_schedules s 
                              LEFT JOIN requests_main r ON s.request_id = r.request_id
                              LEFT JOIN objects_activity_types at ON s.activity_type_id = at.id
                              WHERE s.start_date <= ? AND (s.end_date >= ? OR s.end_date IS NULL OR s.end_date = '0000-00-00')
                                AND s.start_date > '0000-00-00'
                              ORDER BY s.start_date ASC";
            $stmt_f = $db_conn->prepare($sql_forecasts);
            $stmt_f->bind_param("ss", $end_of_month, $start_of_month);
            $stmt_f->execute();
            $res_forecasts = $stmt_f->get_result();
            $forecasts_raw = [];
            while ($row = $res_forecasts->fetch_assoc()) {
                $forecasts_raw[] = $row;
            }
            $stmt_f->close();

            // Map schedules to an easily consumable format for JS:
            $logs_by_machine_date = [];
            $actual_assignments_map = []; // Track machine_id -> request_id -> active periods
            foreach ($schedules_raw as $s) {
                $m_id = $s['machine_id'];
                if (!isset($logs_by_machine_date[$m_id])) {
                    $logs_by_machine_date[$m_id] = [];
                }

                // Preserve original project dates for frontend logic
                $status_clean = mb_strtolower($s['status'] ?? '', 'UTF-8');
                $is_active = (strpos($status_clean, 'старт') !== false || strpos($status_clean, 'active') !== false || strpos($status_clean, 'започнал') !== false)
                    && strpos($status_clean, 'не') === false;

                // Determine "Effective Dates" for deduplication (must match JS rendering logic)
                $eff_start = $s['assign_start'] ?: ($is_active ? ($s['start_date'] ?: $s['estimated_start_date']) : ($s['estimated_start_date'] ?: $s['start_date']));
                $eff_end = $s['assign_end'] ?: ($is_active ? ($s['end_date'] ?: $s['estimated_end_date']) : ($s['estimated_end_date'] ?: $s['end_date']));

                // Handle open-ended assignments for ACTIVE projects only
                if ($is_active && (empty($eff_end) || $eff_end == '0000-00-00')) {
                    $eff_end = $end_of_month;
                }

                $logs_by_machine_date[$m_id][] = $s;

                // Build deduplication map using effective dates
                if ($s['request_id']) {
                    $actual_assignments_map[$m_id][$s['request_id']][] = [
                        'start' => $eff_start,
                        'end' => $eff_end
                    ];
                }
            }

            $forecasts_by_machine = [];
            foreach ($forecasts_raw as $f) {
                $m_id = $f['machine_id'];
                $r_id = $f['request_id'];

                // DATA SAFETY: If this forecast has a related actual assignment for the same project,
                // and that assignment is just a single-day placeholder (like 'Today'), we prioritize the Forecast.
                $is_duplicate = false;
                if ($r_id && isset($actual_assignments_map[$m_id][$r_id])) {
                    foreach ($actual_assignments_map[$m_id][$r_id] as $period) {
                        // Conventional overlap check
                        if ($f['start_date'] <= $period['end'] && $f['end_date'] >= $period['start']) {
                            $is_duplicate = true;
                            break;
                        }

                        // NEW: "Proximity" check. If there's an actual assignment starting 'today' (or very close)
                        // but it's only 1 day long, and our forecast starts right after it, it's likely a ghost.
                        if ($period['start'] == $period['end']) {
                            $gap = (strtotime($f['start_date']) - strtotime($period['start'])) / 86400;
                            if ($gap >= 0 && $gap <= 2) { // 1-2 day gap is considered a ghost of the same plan
                                // We won't mark as 'duplicate' (which hides the forecast), 
                                // instead we should ideally hide the ACTUAL in the actuals loop,
                                // but for now, we'll let this pass and handle it in the next data pass.
                            }
                        }
                    }
                }

                if ($is_duplicate) {
                    // We no longer silently 'continue' (hidden). 
                    // Instead, we mark it so JS can handle precedence without losing the overlap data.
                    $f['is_redundant_forecast'] = true;
                }

                if (!isset($forecasts_by_machine[$m_id])) {
                    $forecasts_by_machine[$m_id] = [];
                }

                // DATA SAFETY: Ensure forecasts have an end date for the JS loop
                if (empty($f['end_date']) || $f['end_date'] == '0000-00-00') {
                    $f['end_date'] = $f['start_date'];
                }

                $forecasts_by_machine[$m_id][] = $f;
            }

            echo json_encode([
                'success' => true,
                'days' => $days,
                'machines' => $machines,
                'schedules' => $logs_by_machine_date,
                'forecasts' => $forecasts_by_machine
            ]);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} catch (Throwable $e) {
    error_log("objects_machine_schedules_api.php error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    ob_clean();
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
} finally {
    CloseCon($db_conn);
}
