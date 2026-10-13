<?php
// Set headers to display as plain text
header('Content-Type: text/plain; charset=utf-8');

$filename = 'Contacts.csv';

if (!file_exists($filename)) {
    die("Error: Could not find the file '$filename'");
}

$clients = [];

// Open and parse the CSV file
if (($handle = fopen($filename, 'r')) !== false) {
    while (($row = fgetcsv($handle, 1000, ',')) !== false) {
        // Based on the snippet, your CSV columns appear to be:
        // [0] empty, [1] Company Name, [2] Contact Name, [3] Phone, [4] Email
        if (count($row) < 5)
            continue;

        $companyName = trim($row[1]);
        $contactName = trim($row[2]);
        $phone = trim($row[3]);
        $email = trim($row[4]);

        // Skip rows without a company name
        if (empty($companyName))
            continue;

        $contactData = [
            'name' => $contactName,
            'phone' => $phone,
            'email' => $email
        ];

        // Grouping logic
        if (!isset($clients[$companyName])) {
            // First time seeing this company: assign as Primary Contact
            $clients[$companyName] = [
                'primary' => $contactData,
                'additional' => []
            ];
        } else {
            // Company already exists: add to Additional Contacts JSON array
            $clients[$companyName]['additional'][] = $contactData;
        }
    }
    fclose($handle);
}

// Generate the SQL queries
echo "SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n";
echo "START TRANSACTION;\n\n";

foreach ($clients as $companyName => $data) {
    $primary = $data['primary'];
    $additional = $data['additional'];

    // Escape strings for SQL to prevent syntax errors (e.g., quotes in names)
    $esc_company = addslashes($companyName);
    $esc_p_name = addslashes($primary['name']);
    $esc_p_phone = addslashes($primary['phone']);
    $esc_p_email = addslashes($primary['email']);

    // Process JSON for additional contacts
    if (!empty($additional)) {
        // JSON_UNESCAPED_UNICODE ensures Cyrillic characters render correctly
        $json = json_encode($additional, JSON_UNESCAPED_UNICODE);
        $esc_json = "'" . addslashes($json) . "'";
    } else {
        $esc_json = "NULL";
    }

    $sql = "INSERT INTO `clients_main` (`client_name`, `primary_contact_name`, `primary_contact_phone`, `primary_contact_email`, `additional_contacts`) ";
    $sql .= "VALUES ('$esc_company', '$esc_p_name', '$esc_p_phone', '$esc_p_email', $esc_json);\n";

    echo $sql;
}

echo "\nCOMMIT;\n";
?>