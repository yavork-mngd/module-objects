<?php
// /modules/objects/objects_manage_clients_api.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

ob_start();

require_once __DIR__ . '/../../sys/config.php';
require_once __DIR__ . '/../../sys/auth.php';
require_once __DIR__ . '/../../sys/dbcon.php';
require_once __DIR__ . '/../../sys/log_functions.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Access Denied.']);
    exit();
}

$action = $_REQUEST['action'] ?? null;
$db_conn = OpenCon();

try {
    switch ($action) {

        // --- Get All Clients (with optional search filter) ---
        case 'get_clients':
            $search = $_REQUEST['search'] ?? '';

            $sql = "SELECT * FROM clients_main";
            $params = [];
            $types = "";

            if (!empty($search)) {
                $sql .= " WHERE client_name LIKE ? OR primary_contact_name LIKE ? OR primary_contact_email LIKE ? OR primary_contact_phone LIKE ?";
                $like = "%" . $search . "%";
                $params = [$like, $like, $like, $like];
                $types = "ssss";
            }

            $sql .= " ORDER BY client_name ASC";

            $stmt = $db_conn->prepare($sql);
            if (!empty($params)) {
                $stmt->bind_param($types, ...$params);
            }
            $stmt->execute();
            $result = $stmt->get_result();

            $clients = [];
            while ($row = $result->fetch_assoc()) {
                $clients[] = $row;
            }

            ob_clean();
            echo json_encode(['success' => true, 'data' => $clients]);
            break;

        // --- Get Single Client ---
        case 'get_client':
            $client_id = (int) ($_REQUEST['client_id'] ?? 0);
            $stmt = $db_conn->prepare("SELECT * FROM clients_main WHERE client_id = ?");
            $stmt->bind_param("i", $client_id);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();

            ob_clean();
            if ($result) {
                echo json_encode(['success' => true, 'data' => $result]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Client not found.']);
            }
            break;

        // --- Save Client (Create or Update) ---
        case 'save_client':
            $client_id = (int) ($_POST['client_id'] ?? 0);
            $client_name = $_POST['client_name'] ?? '';
            $client_address = $_POST['client_address'] ?? '';
            $contact_name = $_POST['primary_contact_name'] ?? '';
            $contact_phone = $_POST['primary_contact_phone'] ?? '';
            $contact_email = $_POST['primary_contact_email'] ?? '';
            $contact_notes = $_POST['primary_contact_notes'] ?? '';
            $general_notes = $_POST['general_notes'] ?? '';
            $internal_notes = $_POST['internal_notes'] ?? '';

            // Process additional contacts
            $extra_names = $_POST['extra_contact_name'] ?? [];
            $extra_phones = $_POST['extra_contact_phone'] ?? [];
            $extra_emails = $_POST['extra_contact_email'] ?? [];
            $extra_notes = $_POST['extra_contact_notes'] ?? [];
            $additional_contacts = [];

            if (is_array($extra_names)) {
                for ($i = 0; $i < count($extra_names); $i++) {
                    $name = trim($extra_names[$i] ?? '');
                    if (!empty($name)) {
                        $additional_contacts[] = [
                            'name' => $name,
                            'phone' => trim($extra_phones[$i] ?? ''),
                            'email' => trim($extra_emails[$i] ?? ''),
                            'notes' => trim($extra_notes[$i] ?? '')
                        ];
                    }
                }
            }

            $additional_contacts_json = !empty($additional_contacts) ? json_encode($additional_contacts, JSON_UNESCAPED_UNICODE) : null;

            if (empty($client_name) || empty($contact_name) || empty($contact_phone) || empty($contact_email)) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Please fill all mandatory fields.']);
                exit;
            }

            if ($client_id > 0) {
                // Update
                $sql = "UPDATE clients_main SET 
                        client_name=?, client_address=?, 
                        primary_contact_name=?, primary_contact_phone=?, primary_contact_email=?, primary_contact_notes=?,
                        general_notes=?, internal_notes=?, additional_contacts=?
                        WHERE client_id=?";
                $stmt = $db_conn->prepare($sql);
                $stmt->bind_param(
                    "sssssssssi",
                    $client_name,
                    $client_address,
                    $contact_name,
                    $contact_phone,
                    $contact_email,
                    $contact_notes,
                    $general_notes,
                    $internal_notes,
                    $additional_contacts_json,
                    $client_id
                );
                $msg = "Client updated successfully.";
                $log_action = 'CLIENT_UPDATE';
            } else {
                // Insert
                $sql = "INSERT INTO clients_main 
                        (client_name, client_address, primary_contact_name, primary_contact_phone, primary_contact_email, primary_contact_notes, general_notes, internal_notes, additional_contacts) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $db_conn->prepare($sql);
                $stmt->bind_param(
                    "sssssssss",
                    $client_name,
                    $client_address,
                    $contact_name,
                    $contact_phone,
                    $contact_email,
                    $contact_notes,
                    $general_notes,
                    $internal_notes,
                    $additional_contacts_json
                );
                $msg = "Client added successfully.";
                $log_action = 'CLIENT_CREATE';
            }

            if ($stmt->execute()) {
                logAppEvent('INFO', $log_action, "User saved client: $client_name", $_SESSION['user_id'], $_SESSION['username'] ?? 'User');
                ob_clean();
                echo json_encode(['success' => true, 'message' => $msg]);
            } else {
                throw new Exception("Database operation failed: " . $stmt->error);
            }
            break;

        // --- Delete Client ---
        case 'delete_client':
            // Optional: Check permissions before deleting
            // if (!hasRole('admin')) { ... }

            $client_id = (int) ($_POST['client_id'] ?? 0);

            if ($client_id <= 0) {
                ob_clean();
                echo json_encode(['success' => false, 'message' => 'Invalid client ID.']);
                exit;
            }

            $stmt = $db_conn->prepare("DELETE FROM clients_main WHERE client_id = ?");
            $stmt->bind_param("i", $client_id);

            if ($stmt->execute()) {
                logAppEvent('INFO', 'CLIENT_DELETE', "User deleted client ID: $client_id", $_SESSION['user_id'], $_SESSION['username'] ?? 'User');
                ob_clean();
                echo json_encode(['success' => true, 'message' => 'Client deleted successfully.']);
            } else {
                throw new Exception("Database operation failed: " . $stmt->error);
            }
            break;

        default:
            ob_clean();
            echo json_encode(['success' => false, 'message' => 'Invalid action.']);
            break;
    }
} catch (Exception $e) {
    ob_clean();
    logAppEvent('ERROR', 'CLIENT_API_ERROR', $e->getMessage(), $_SESSION['user_id'], $_SESSION['username'] ?? 'User');
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}
