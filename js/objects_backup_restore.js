// /modules/objects/js/objects_backup_restore.js

document.addEventListener('DOMContentLoaded', function () {
    initDragAndDrop();
});

function initDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('import_file');

    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('active'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            fileInput.files = files;
            updateFilename(files[0].name);
        }
    }, false);

    fileInput.addEventListener('change', function () {
        if (this.files.length > 0) {
            updateFilename(this.files[0].name);
        }
    });
}

function updateFilename(name) {
    const filenameDisplay = document.getElementById('selected_filename');
    if (filenameDisplay) {
        filenameDisplay.textContent = 'Избран файл: ' + name;
        filenameDisplay.classList.remove('d-none');
    }
}

/**
 * Utility to show the global confirmation modal
 * @param {Object} options { title, text, confirmText, cancelText, type }
 * @returns {Promise<boolean>}
 */
function showConfirm(options) {
    return new Promise(resolve => {
        const modalEl = document.getElementById('confirmationModal');
        const modalBody = document.getElementById('confirmationModalBody');
        const modalTitle = document.getElementById('confirmationModalLabel');
        const confirmBtn = document.getElementById('btn-confirm-action');

        if (!modalEl || !modalBody || !confirmBtn) {
            console.warn('Confirmation modal elements not found, falling back to window.confirm');
            resolve(confirm(options.text));
            return;
        }

        // Set content
        modalBody.innerHTML = options.text;
        if (modalTitle && options.title) {
            modalTitle.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-${options.type || 'danger'} me-2"></i> ${options.title}`;
        }
        confirmBtn.innerText = options.confirmText || 'Потвърди';
        confirmBtn.className = `btn btn-${options.type || 'danger'} rounded-pill px-4`;

        // Setup modal
        const modal = new bootstrap.Modal(modalEl);

        // One-time listener for confirm
        const handleConfirm = () => {
            modal.hide();
            modalEl.removeEventListener('hidden.bs.modal', handleCancel);
            resolve(true);
        };

        // One-time listener for cancel/hide
        const handleCancel = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            resolve(false);
        };

        confirmBtn.addEventListener('click', handleConfirm, { once: true });
        modalEl.addEventListener('hidden.bs.modal', handleCancel, { once: true });

        modal.show();
    });
}

async function startExport() {
    const form = document.getElementById('exportForm');
    const formData = new FormData(form);
    formData.append('action', 'export');

    try {
        const response = await fetch('objects_backup_restore_api.php', {
            method: 'POST',
            body: formData
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const errorText = await response.text();
            throw new Error('Сървърът върна неочакван отговор.<br><small>' + errorText.substring(0, 100) + '...</small>');
        }

        const result = await response.json();

        if (result.success) {
            const dataStr = JSON.stringify(result.data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const a = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.href = url;
            a.download = `backup_technoinject_${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (window.showToast) showToast({ message: 'Резервното копие беше изтеглено успешно!', type: 'success' });
        } else {
            if (window.showToast) showToast({ message: 'Грешка при експорт: ' + (result.message || 'Неизвестна грешка'), type: 'danger' });
        }
    } catch (error) {
        console.error('Export error:', error);
        if (window.showToast) showToast({ message: error.message || 'Възникна системна грешка при експорт.', type: 'danger' });
    }
}

async function startImport() {
    const fileInput = document.getElementById('import_file');
    if (fileInput.files.length === 0) {
        if (window.showToast) showToast({ message: 'Моля, изберете JSON файл за възстановяване.', type: 'warning' });
        return;
    }

    const confirmRestore = await showConfirm({
        title: 'Потвърждение за възстановяване',
        text: 'Сигурни ли сте, че искате да заредите тези данни? Тази операция не може да бъде отменена.',
        type: 'success',
        confirmText: 'Да, започни'
    });

    if (!confirmRestore) return;

    const form = document.getElementById('importForm');
    const formData = new FormData(form);
    formData.append('action', 'import');

    try {
        const response = await fetch('objects_backup_restore_api.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            let statsMsg = `Импортирани: ${result.stats.inserted}, Обновени: ${result.stats.updated}, Пропуснати: ${result.stats.skipped}`;
            if (window.showToast) showToast({ message: result.message + '<br><small>' + statsMsg + '</small>', type: 'success' });

            fileInput.value = '';
            document.getElementById('selected_filename').classList.add('d-none');
        } else {
            if (window.showToast) showToast({ message: 'Грешка при импорт: ' + result.message, type: 'danger' });
        }
    } catch (error) {
        console.error('Import error:', error);
        if (window.showToast) showToast({ message: 'Възникна системна грешка при импорт.', type: 'danger' });
    }
}

async function startClear() {
    const form = document.getElementById('clearForm');
    const formData = new FormData(form);
    const selectedModules = formData.getAll('modules[]');

    if (selectedModules.length === 0) {
        if (window.showToast) showToast({ message: 'Моля, изберете поне един модул за изчистване.', type: 'warning' });
        return;
    }

    const confirmClear = await showConfirm({
        title: 'ВНИМАНИЕ: Изчистване на данни',
        text: 'Сигурни ли сте, че искате да изтриете избраните тестови данни? Тази операция е НЕОБРАТИМА.',
        type: 'danger',
        confirmText: 'Да, ИЗТРИЙ ДАННИТЕ'
    });

    if (!confirmClear) return;

    formData.append('action', 'clear');

    try {
        const response = await fetch('objects_backup_restore_api.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            if (window.showToast) showToast({ message: result.message, type: 'success' });
            form.reset();
        } else {
            if (window.showToast) showToast({ message: 'Грешка: ' + result.message, type: 'danger' });
        }
    } catch (error) {
        console.error('Clear error:', error);
        if (window.showToast) showToast({ message: 'Възникна системна грешка при изчистване.', type: 'danger' });
    }
}
