// /modules/objects/js/objects_manage_machines.js

window.initManageMachines = function () {
    const searchInput = document.getElementById('search_mapping');
    if (!searchInput) return; // Exit if we are not on the manage machines page

    loadOptions();
    loadMappings();

    // Real-time Search
    let searchTimeout;
    // Remove existing listener to avoid duplicates if re-initialized
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadMappings(this.value.trim());
        }, 300); // 300ms debounce
    });
};

let allActivities = [];

function loadOptions() {
    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_manage_machines_api.php?action=get_options`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const machineSelect = document.getElementById('machine_id');
                machineSelect.innerHTML = '<option value="" disabled selected>Р