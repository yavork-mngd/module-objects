<?php
// /modules/objects/objects_dashboard_api.php
require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

$conn = OpenCon(); // Initialize the DB connection

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_dashboard_stats':
        global $conn;
        getDashboardStats($conn);
        break;

    case 'get_dashboard_charts':
        global $conn;
        getDashboardCharts($conn);
        break;

    case 'get_dashboard_tables':
        global $conn;
        getDashboardTables($conn);
        break;

    case 'search_objects':
        global $conn;
        getDashboardSearch($conn);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}

function getDashboardStats($conn)
{
    ini_set('display_errors', 0);
    ob_start();
    try {
        $stmt_active = $conn->query("SELECT COUNT(*) AS total FROM objects_project_schedules WHERE status IN ('стартирали', 'в пауза')");
        if (!$stmt_active)
            throw new Exception($conn->error);
        $active_activities = $stmt_active->fetch_assoc()['total'];

        $stmt_machines = $conn->query("SELECT (SELECT COUNT(*) FROM heavy_machines) AS total_machines, (SELECT COUNT(DISTINCT oma.machine_id) FROM objects_machine_assignments oma JOIN objects_project_schedules ops ON oma.schedule_id = ops.schedule_id WHERE ops.status = 'стартирали') AS active_machines");
        if (!$stmt_machines)
            throw new Exception($conn->error);
        $machines_row = $stmt_machines->fetch_assoc();
        $total_machines = $machines_row['total_machines'] ?: 1;
        $active_machines = $machines_row['active_machines'] ?: 0;
        $machine_utilization_ratio = "$active_machines / $total_machines";

        $today = date('Y-m-d');
        $stmt_reports = $conn->prepare("SELECT COUNT(*) AS total FROM objects_daily_progress_logs WHERE work_date = ?");
        $stmt_reports->bind_param("s", $today);
        $stmt_reports->execute();
        $today_reports = $stmt_reports->get_result()->fetch_assoc()['total'];

        $stmt_clients = $conn->query("SELECT COUNT(DISTINCT client_id) AS total FROM objects_project_schedules WHERE status = 'стартирали'");
        if (!$stmt_clients)
            throw new Exception($conn->error);
        $active_clients = $stmt_clients->fetch_assoc()['total'];

        ob_end_clean();
        echo json_encode(['success' => true, 'data' => ['active_activities' => $active_activities, 'machine_utilization_ratio' => $machine_utilization_ratio, 'today_reports' => $today_reports, 'active_clients' => $active_clients]]);
    } catch (Exception $e) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'API Error (Stats): ' . $e->getMessage()]);
    }
}

function getDashboardCharts($conn)
{
    ini_set('display_errors', 0);
    ob_start();
    try {
        $stmt_top = $conn->query("
            SELECT s.schedule_id, r.обект_име AS request_name, a.activity_name, a.unit_of_measure, s.total_quantity, COALESCE(SUM(l.quantity_completed), 0) AS completed_quantity
            FROM objects_project_schedules s
            LEFT JOIN requests_main r ON s.request_id = r.request_id
            LEFT JOIN objects_activity_types a ON s.activity_type_id = a.id
            LEFT JOIN objects_daily_progress_logs l ON s.schedule_id = l.schedule_id
            WHERE s.status IN ('стартирали', 'в пауза', 'не стартирали') AND s.total_quantity > 0
            GROUP BY s.schedule_id, r.обект_име, a.activity_name, s.total_quantity
            ORDER BY s.total_quantity DESC LIMIT 5
        ");
        $top_objects = [];
        if ($stmt_top) {
            while ($row = $stmt_top->fetch_assoc()) {
                $top_objects[] = $row;
            }
        }

        $stmt_deployment = $conn->query("
            SELECT 
                (SELECT COUNT(DISTINCT oma.machine_id) FROM objects_machine_assignments oma JOIN objects_project_schedules ops ON oma.schedule_id = ops.schedule_id WHERE ops.status = 'стартирали') AS working,
                (SELECT COUNT(DISTINCT oma.machine_id) FROM objects_machine_assignments oma JOIN objects_project_schedules ops ON oma.schedule_id = ops.schedule_id WHERE ops.status IN ('не стартирали', 'в пауза') AND oma.machine_id NOT IN (SELECT oma2.machine_id FROM objects_machine_assignments oma2 JOIN objects_project_schedules ops2 ON oma2.schedule_id = ops2.schedule_id WHERE ops2.status = 'стартирали')) AS idle_on_site,
                (SELECT COUNT(*) FROM objects_machine_movements WHERE movement_date >= CURDATE() AND movement_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)) AS in_transit,
                (SELECT COUNT(*) FROM heavy_machines) - (SELECT COUNT(DISTINCT oma3.machine_id) FROM objects_machine_assignments oma3 JOIN objects_project_schedules ops3 ON oma3.schedule_id = ops3.schedule_id WHERE ops3.status IN ('стартирали', 'не стартирали', 'в пауза')) AS at_base
        ");
        $deployment = ['working' => 0, 'idle_on_site' => 0, 'in_transit' => 0, 'at_base' => 0];
        if ($stmt_deployment) {
            $deployment = $stmt_deployment->fetch_assoc();
            if ($deployment['at_base'] < 0)
                $deployment['at_base'] = 0;
        }

        ob_end_clean();
        echo json_encode(['success' => true, 'data' => ['top_objects' => $top_objects, 'machine_deployment' => $deployment]]);
    } catch (Exception $e) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'API Error (Charts): ' . $e->getMessage()]);
    }
}

function getDashboardTables($conn)
{
    ini_set('display_errors', 0);
    ob_start();
    try {
        $upcoming_movements = [];
        try {
            $stmt_movements = $conn->query("
                SELECT movement_date, machine_name, from_site, to_site, carrier FROM (
                    -- 1. Manual Departures
                    SELECT 
                        m.departure_date as movement_date, h.machine_name, 
                        COALESCE(rf.обект_име, m.departure_from, 'База') AS from_site, 
                        COALESCE(rt.обект_име, m.arrive_to, 'База') AS to_site, 
                        CONCAT('Тръгва: ', COALESCE(m.carrier, '')) as carrier
                    FROM objects_machine_movements m
                    JOIN heavy_machines h ON m.machine_id = h.id
                    LEFT JOIN requests_main rf ON m.from_site_id = rf.request_id
                    LEFT JOIN requests_main rt ON m.to_site_id = rt.request_id
                    WHERE m.departure_date IS NOT NULL AND m.departure_date != '0000-00-00'
                    
                    UNION ALL
                    
                    -- 2. Manual Arrivals
                    SELECT 
                        m.arrival_date as movement_date, h.machine_name, 
                        COALESCE(rf.обект_име, m.departure_from, 'База') AS from_site, 
                        COALESCE(rt.обект_име, m.arrive_to, 'База') AS to_site, 
                        CONCAT('Пристига: ', COALESCE(m.carrier, '')) as carrier
                    FROM objects_machine_movements m
                    JOIN heavy_machines h ON m.machine_id = h.id
                    LEFT JOIN requests_main rf ON m.from_site_id = rf.request_id
                    LEFT JOIN requests_main rt ON m.to_site_id = rt.request_id
                    WHERE m.arrival_date IS NOT NULL AND m.arrival_date != '0000-00-00'
                    AND (m.departure_date IS NULL OR m.departure_date != m.arrival_date)

                    UNION ALL
                    
                    -- 3. Legacy Movement Date (if no arrival/departure)
                    SELECT 
                        m.movement_date, h.machine_name, 
                        COALESCE(rf.обект_име, m.departure_from, 'База') AS from_site, 
                        COALESCE(rt.обект_име, m.arrive_to, 'База') AS to_site, 
                        m.carrier
                    FROM objects_machine_movements m
                    JOIN heavy_machines h ON m.machine_id = h.id
                    LEFT JOIN requests_main rf ON m.from_site_id = rf.request_id
                    LEFT JOIN requests_main rt ON m.to_site_id = rt.request_id
                    WHERE (m.arrival_date IS NULL OR m.arrival_date = '0000-00-00')
                    AND (m.departure_date IS NULL OR m.departure_date = '0000-00-00')
                    AND m.movement_date != '0000-00-00'

                    UNION ALL
                    
                    -- 4. Planned Arrivals from Assignments
                    SELECT 
                        oma.start_date as movement_date, hm.machine_name, 'База' as from_site, 
                        COALESCE(rm.обект_име, 'Обект') as to_site, 'Планирано пристигане' as carrier
                    FROM objects_machine_assignments oma
                    JOIN heavy_machines hm ON oma.machine_id = hm.id
                    JOIN objects_project_schedules ops ON oma.schedule_id = ops.schedule_id
                    JOIN requests_main rm ON ops.request_id = rm.request_id
                    WHERE oma.movement_id IS NULL AND oma.start_date IS NOT NULL AND oma.start_date != '0000-00-00'
                    
                    UNION ALL
                    
                    -- 5. Planned Departures from Assignments
                    SELECT 
                        oma.end_date as movement_date, hm.machine_name, 
                        COALESCE(rm.обект_име, 'Обект') as from_site, 'База' as to_site, 'Планирано заминаване' as carrier
                    FROM objects_machine_assignments oma
                    JOIN heavy_machines hm ON oma.machine_id = hm.id
                    JOIN objects_project_schedules ops ON oma.schedule_id = ops.schedule_id
                    JOIN requests_main rm ON ops.request_id = rm.request_id
                    WHERE oma.movement_id IS NULL AND oma.end_date IS NOT NULL AND oma.end_date != '0000-00-00'
                ) as combined
                WHERE movement_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND movement_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                ORDER BY movement_date ASC LIMIT 30
            ");
            if ($stmt_movements) {
                while ($row = $stmt_movements->fetch_assoc()) {
                    $upcoming_movements[] = $row;
                }
            } else {
                throw new Exception($conn->error);
            }
        } catch (Exception $moveEx) {
            $upcoming_movements = "Error: " . $moveEx->getMessage();
        }

        $warnings = [];
        try {
            $stmt_warnings = $conn->query("
                SELECT s.schedule_id, r.request_id, r.обект_име AS request_name, a.activity_name, s.start_date, s.end_date, s.estimated_start_date, s.estimated_end_date, s.status, s.daily_productivity_plan,
                       COALESCE((SELECT SUM(quantity_completed) FROM objects_daily_progress_logs WHERE schedule_id = s.schedule_id), 0) AS total_completed
                FROM objects_project_schedules s
                JOIN requests_main r ON s.request_id = r.request_id
                JOIN objects_activity_types a ON s.activity_type_id = a.id
                WHERE s.status != 'приключили'
                AND (
                    (s.end_date IS NOT NULL AND s.end_date != '0000-00-00' AND s.end_date < CURDATE())
                    OR (s.estimated_end_date IS NOT NULL AND s.estimated_end_date != '0000-00-00' AND s.estimated_end_date < CURDATE())
                    OR (s.status = 'не стартирали' AND s.start_date IS NOT NULL AND s.start_date != '0000-00-00' AND s.start_date < CURDATE())
                    OR (s.status IN ('проблем', 'в пауза'))
                    OR (s.start_date > s.estimated_start_date AND s.estimated_start_date != '0000-00-00')
                    OR (s.end_date > s.estimated_end_date AND s.estimated_end_date != '0000-00-00')
                )
                LIMIT 20
            ");
            if ($stmt_warnings) {
                while ($row = $stmt_warnings->fetch_assoc()) {
                    $today = date('Y-m-d');
                    $is_lagging = false;

                    // Productivity check
                    if ($row['status'] === 'стартирали' && $row['daily_productivity_plan'] > 0 && $row['start_date'] != '0000-00-00') {
                        $work_start = new DateTime($row['start_date']);
                        $now = new DateTime($today);
                        $days_passed = $work_start->diff($now)->days + 1;
                        if ($days_passed > 0) {
                            $expected_progress = $days_passed * $row['daily_productivity_plan'];
                            if ($row['total_completed'] < $expected_progress * 0.9) { // 10% tolerance
                                $is_lagging = true;
                            }
                        }
                    }

                    if ($row['status'] === 'не стартирали' && $row['start_date'] < $today && $row['start_date'] !== '0000-00-00') {
                        $row['reason'] = 'Закъснял старт (Планиран за ' . date('d.m.Y', strtotime($row['start_date'])) . ')';
                        $row['severity'] = 'danger';
                    } elseif ($row['end_date'] && $row['end_date'] !== '0000-00-00' && $row['end_date'] < $today) {
                        $row['reason'] = 'Просрочена крайна дата (' . date('d.m.Y', strtotime($row['end_date'])) . ')';
                        $row['severity'] = 'danger';
                    } elseif ($row['status'] === 'проблем') {
                        $row['reason'] = 'Отчетен проблем';
                        $row['severity'] = 'danger';
                    } elseif ($row['start_date'] > $row['estimated_start_date'] && $row['estimated_start_date'] != '0000-00-00' && $row['start_date'] != '0000-00-00') {
                        $row['reason'] = 'Старт след прогнoза (' . date('d.m.Y', strtotime($row['start_date'])) . ')';
                        $row['severity'] = 'warning';
                    } elseif ($row['end_date'] > $row['estimated_end_date'] && $row['estimated_end_date'] != '0000-00-00' && $row['end_date'] != '0000-00-00') {
                        $row['reason'] = 'Край след прогнoза (' . date('d.m.Y', strtotime($row['end_date'])) . ')';
                        $row['severity'] = 'warning';
                    } elseif ($is_lagging) {
                        $row['reason'] = 'Ниска продуктивност (под дневния план)';
                        $row['severity'] = 'warning';
                    } elseif ($row['estimated_end_date'] && $row['estimated_end_date'] !== '0000-00-00' && $row['estimated_end_date'] < $today) {
                        $row['reason'] = 'Просрочена прогнозна дата (' . date('d.m.Y', strtotime($row['estimated_end_date'])) . ')';
                        $row['severity'] = 'warning';
                    } elseif ($row['status'] === 'в пауза') {
                        $row['reason'] = 'Дейността е в пауза';
                        $row['severity'] = 'warning';
                    } else {
                        $row['reason'] = 'Изоставаща дейност';
                        $row['severity'] = 'warning';
                    }
                    $warnings[] = $row;
                }
            } else {
                throw new Exception($conn->error);
            }
        } catch (Exception $warnEx) {
            $warnings = "Error: " . $warnEx->getMessage();
        }

        $feed = [];
        try {
            $stmt_feed = $conn->query("
                (SELECT 'progress' AS type, l.work_date AS date_log, l.created_at AS absolute_time, l.quantity_completed AS qty, r.обект_име AS request_name, a.activity_name AS action_desc, l.notes AS msg
                FROM objects_daily_progress_logs l
                JOIN objects_project_schedules s ON l.schedule_id = s.schedule_id
                JOIN requests_main r ON s.request_id = r.request_id
                JOIN objects_activity_types a ON s.activity_type_id = a.id
                ORDER BY absolute_time DESC LIMIT 10)
                UNION ALL
                (SELECT 'note' AS type, DATE(n.created_at) AS date_log, n.created_at AS absolute_time, NULL AS qty, r.обект_име AS request_name, n.category AS action_desc, n.note_text AS msg
                FROM objects_schedule_notes n
                JOIN objects_project_schedules s ON n.schedule_id = s.schedule_id
                JOIN requests_main r ON s.request_id = r.request_id
                ORDER BY absolute_time DESC LIMIT 10)
                ORDER BY absolute_time DESC LIMIT 10
            ");
            if ($stmt_feed) {
                while ($row = $stmt_feed->fetch_assoc()) {
                    $feed[] = $row;
                }
            }
        } catch (Exception $feedEx) {
            $feed = "Error: " . $feedEx->getMessage();
        }

        ob_end_clean();
        echo json_encode(['success' => true, 'data' => ['upcoming_movements' => $upcoming_movements, 'warnings' => $warnings, 'feed' => $feed]]);
    } catch (Exception $e) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'API Error (Tables): ' . $e->getMessage()]);
    }
}

function getDashboardSearch($conn)
{
    ini_set('display_errors', 0);
    $search = trim($_GET['search'] ?? '');
    $status = $_GET['status'] ?? 'active';
    ob_start();
    try {
        $where_clauses = [];
        $params = [];
        $types = "";
        if (!empty($search)) {
            $where_clauses[] = "(r.обект_име LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $types .= "s";
        }
        if ($status === 'active') {
            $where_clauses[] = "s.status IN ('стартирали', 'в пауза')";
        } elseif ($status === 'archived') {
            $where_clauses[] = "s.status = 'приключили'";
        }
        $where_sql = count($where_clauses) > 0 ? "WHERE " . implode(" AND ", $where_clauses) : "";
        $query = "
            SELECT r.request_id, r.обект_име AS request_name, GROUP_CONCAT(DISTINCT a.activity_name SEPARATOR ', ') AS activities, MAX(s.status) AS latest_status, SUM(s.total_quantity) AS total_qty, COALESCE(SUM(l.quantity_completed), 0) AS completed_qty, MAX(a.unit_of_measure) AS unit
            FROM requests_main r
            JOIN objects_project_schedules s ON r.request_id = s.request_id
            JOIN objects_activity_types a ON s.activity_type_id = a.id
            LEFT JOIN objects_daily_progress_logs l ON s.schedule_id = l.schedule_id
            $where_sql
            GROUP BY r.request_id, r.обект_име
            ORDER BY r.request_id DESC LIMIT 50
        ";
        $stmt = $conn->prepare($query);
        if ($params)
            $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $res = $stmt->get_result();
        $objects = [];
        while ($row = $res->fetch_assoc()) {
            $objects[] = $row;
        }
        ob_end_clean();
        echo json_encode(['success' => true, 'data' => $objects]);
    } catch (Exception $e) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'API Error (Search): ' . $e->getMessage()]);
    }
}
