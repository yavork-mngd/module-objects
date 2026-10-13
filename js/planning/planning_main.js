/**
 * planning_main.js
 * Entry point for the Machine Planning module. Initializes components and event listeners.
 */

document.addEventListener('DOMContentLoaded', function () {

    // Initial data loading sequence
    loadObjectFilter().then(() => loadActivityFilter()).then(() => {
        // loadMachinesDropdown also populates PlanningState.allMachinesData
        return loadMachinesDropdown();
    }).then(() => {
        // Now that machines are loaded, we can render unplanned projects with dropdowns
        loadUnplannedProjects();
        // Initialize Tagify for forecast modals (#22)
        if (typeof initObjectNameTagify === 'function') initObjectNameTagify();
        if (typeof initEstimateMachineTagify === 'function') initEstimateMachineTagify();

        // Support opening specific forecast from external links (e.g. schedules page)
        const urlParams = new URLSearchParams(window.location.search);
        const editForecastId = urlParams.get('edit_forecast');
        if (editForecastId && typeof openEstimateEditor === 'function') {
            openEstimateEditor(editForecastId);
        }
    });

    // Initialize datepickers
    if (typeof flatpickr !== 'undefined') {
        document.querySelectorAll(".planning-datepicker").forEach(el => {
            el._flatpickr = flatpickr(el, {
                locale: {
                    firstDayOfWeek: 1 // Monday
                },
                dateFormat: "Y-m-d", // Submission format (Backend expects YYYY-MM-DD)
                altInput: true,
                altFormat: "d.m.Y", // Display format (dd.mm.yyyy)
                allowInput: true
            });
        });
    }

    // Main Filter Listeners
    const machinePicker = document.getElementById('ganttMachinePicker');
    if (machinePicker) {
        machinePicker.addEventListener('change', function () {
            loadYearMatrix();
            // Re-render unplanned projects to update "Already Assigned" states if needed
            // though with per-row selection this is less critical
        });
    }

    const yearPicker = document.getElementById('ganttYearPicker');
    if (yearPicker) {
        yearPicker.addEventListener('change', loadYearMatrix);
    }

    const objectFilter = document.getElementById('objectFilter');
    if (objectFilter) {
        objectFilter.addEventListener('change', function () {
            const reqId = this.value;
            loadActivityFilter(reqId).then(() => {
                const actId = document.getElementById('activityFilter').value;
                loadMachinesDropdown(actId, '', true, reqId);
            });
        });
    }

    const activityFilter = document.getElementById('activityFilter');
    if (activityFilter) {
        activityFilter.addEventListener('change', function () {
            const reqId = document.getElementById('objectFilter') ? document.getElementById('objectFilter').value : 0;
            loadMachinesDropdown(this.value, '', true, reqId);
        });
    }



    const estActivitySelect = document.getElementById('est_activity_type_id');
    if (estActivitySelect) {
        estActivitySelect.addEventListener('change', function () {
            populateEstCapabilityDropdown(this.value);
        });
    }

    // Standalone Modal Listeners
    const standaloneMachineSelect = document.getElementById('standalone_machine_id');
    if (standaloneMachineSelect) {
        standaloneMachineSelect.addEventListener('change', function () {
            loadEstimateMachineCapabilities(this.value, 'standalone_');
        });
    }

    const standaloneActivitySelect = document.getElementById('standalone_est_activity_type_id');
    if (standaloneActivitySelect) {
        standaloneActivitySelect.addEventListener('change', function () {
            populateEstCapabilityDropdown(this.value, 'standalone_');
        });
    }

    // Standalone Save Handler
    const standaloneSaveBtn = document.getElementById('standalone_saveEstimateBtn');
    if (standaloneSaveBtn) {
        standaloneSaveBtn.addEventListener('click', function () {
            const form = document.getElementById('standaloneEstimateForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            const formData = new FormData(form);

            // If Tagify is used, Ensure we send the plain value for object_name
            if (typeof PlanningState !== 'undefined' && PlanningState.tagifyObjectNameStandalone && Array.isArray(PlanningState.tagifyObjectNameStandalone.value) && PlanningState.tagifyObjectNameStandalone.value.length > 0) {
                const selected = PlanningState.tagifyObjectNameStandalone.value[0];
                formData.set('object_name', selected.original_name || selected.value);
                if (selected.request_id) formData.append('request_id', selected.request_id);
                if (selected.schedule_id) formData.append('schedule_id', selected.schedule_id);
            }

            standaloneSaveBtn.disabled = true;

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php`, {
                method: 'POST',
                body: formData
            })
                .then(res => res.json())
                .then(response => {
                    if (response.success) {
                        showToast({ message: response.message, type: 'success' });
                        bootstrap.Modal.getInstance(document.getElementById('standaloneEstimateModal')).hide();
                        loadYearMatrix();
                        loadUnplannedProjects();
                    } else {
                        showToast({ message: response.message, type: 'danger' });
                    }
                })
                .finally(() => { standaloneSaveBtn.disabled = false; });
        });
    }

    const standaloneDeleteBtn = document.getElementById('standalone_deleteEstimateBtn');
    if (standaloneDeleteBtn) {
        standaloneDeleteBtn.addEventListener('click', function () {
            const id = document.getElementById('standalone_estimate_id').value;
            if (confirm("Тази прогноза ще бъде изтрита! Сигурни ли сте?")) {
                const params = new URLSearchParams();
                params.append('action', 'delete_estimate');
                params.append('estimate_id', id);

                fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php`, {
                    method: 'POST',
                    body: params
                }).then(res => res.json()).then(res => {
                    if (res.success) {
                        showToast({ message: res.message, type: 'success' });
                        bootstrap.Modal.getInstance(document.getElementById('standaloneEstimateModal')).hide();
                        loadYearMatrix();
                        loadUnplannedProjects();
                    } else {
                        showToast({ message: res.message, type: 'danger' });
                    }
                }).catch(() => showToast({ message: 'Сървърна грешка.', type: 'danger' }));
            }
        });
    }

    const saveEstimateBtn = document.getElementById('saveEstimateBtn');
    if (saveEstimateBtn) {
        saveEstimateBtn.addEventListener('click', function () {
            const form = document.getElementById('estimateForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // If Tagify is used, Ensure we send the plain value for object_name (#22)
            const formData = new FormData(form);
            if (PlanningState.tagifyObjectName && Array.isArray(PlanningState.tagifyObjectName.value) && PlanningState.tagifyObjectName.value.length > 0) {
                const selected = PlanningState.tagifyObjectName.value[0];
                formData.set('object_name', selected.original_name || selected.value);
                if (selected.request_id) formData.set('request_id', selected.request_id);
                if (selected.schedule_id) formData.set('schedule_id', selected.schedule_id);
            }
            if (PlanningState.tagifyEstimateMachine && Array.isArray(PlanningState.tagifyEstimateMachine.value) && PlanningState.tagifyEstimateMachine.value.length > 0) {
                formData.set('machine_id', PlanningState.tagifyEstimateMachine.value[0].id);
            }

            const originalText = saveEstimateBtn.innerHTML;
            saveEstimateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Запазване...';
            saveEstimateBtn.disabled = true;

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php`, {
                method: 'POST',
                body: formData
            })
                .then(res => res.json())
                .then(response => {
                    if (response.success) {
                        showToast({ message: response.message, type: 'success' });
                        bootstrap.Modal.getInstance(document.getElementById('estimateModal')).hide();
                        loadYearMatrix();
                        loadUnplannedProjects();
                    } else {
                        showToast({ message: response.message, type: 'danger' });
                    }
                })
                .catch(() => showToast({ message: 'Сървърна грешка.', type: 'danger' }))
                .finally(() => {
                    saveEstimateBtn.innerHTML = originalText;
                    saveEstimateBtn.disabled = false;
                });
        });
    }

    const deleteEstimateBtn = document.getElementById('deleteEstimateBtn');
    if (deleteEstimateBtn) {
        deleteEstimateBtn.addEventListener('click', function () {
            const id = document.getElementById('estimate_id').value;
            confirmPlanningAction({
                title: 'Изтриване на прогноза',
                message: 'Тази прогноза ще бъде изтрита трайно! Сигурни ли сте?',
                onConfirm: function () {
                    const params = new URLSearchParams();
                    params.append('action', 'delete_estimate');
                    params.append('estimate_id', id);

                    fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_planning_api.php`, {
                        method: 'POST',
                        body: params
                    }).then(res => res.json()).then(res => {
                        if (res.success) {
                            showToast({ message: res.message, type: 'success' });
                            const estModalEl = document.getElementById('estimateModal');
                            if (estModalEl) {
                                const inst = bootstrap.Modal.getInstance(estModalEl);
                                if (inst) inst.hide();
                            }
                            loadYearMatrix();
                            loadUnplannedProjects();
                        } else {
                            showToast({ message: res.message, type: 'danger' });
                        }
                    }).catch(() => showToast({ message: 'Сървърна грешка.', type: 'danger' }));
                }
            });
        });
    }

    const saveMovementBtn = document.getElementById('saveMovementBtn');
    if (saveMovementBtn) {
        saveMovementBtn.addEventListener('click', function () {
            const form = document.getElementById('movementForm');
            if (!form.checkValidity()) { form.reportValidity(); return; }

            const formData = new FormData(form);
            saveMovementBtn.disabled = true;

            fetch(`${APP_CONFIG.BASE_URL}modules/objects/objects_machine_movements_api.php`, {
                method: 'POST',
                body: formData
            }).then(res => res.json()).then(data => {
                if (data.success) {
                    showToast({ message: data.message, type: 'success' });
                    bootstrap.Modal.getInstance(document.getElementById('movementModal')).hide();
                    loadYearMatrix();
                } else {
                    showToast({ message: data.message, type: 'danger' });
                }
            }).finally(() => { saveMovementBtn.disabled = false; });
        });
    }

    window.openStandaloneMovement = function (event) {
        if (event) event.stopPropagation();
        const d = new Date();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        PlanningState.tempActionData.startDate = `${yyyy}-${mm}-${dd}`;
        PlanningState.tempActionData.machineId = document.getElementById('ganttMachinePicker').value || '';
        proceedToMovement();
    }



    const smid = document.getElementById('standalone_machine_id');
    if (smid) {
        smid.addEventListener('change', function () {
            if (typeof updateEstimateObjectAutocomplete === 'function') {
                updateEstimateObjectAutocomplete(this.value);
            }
        });
    }
});
