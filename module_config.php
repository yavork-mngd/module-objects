<?php
// /src/modules/objects/module_config.php

return [
    'version' => '0.1.16',
    'header_links' => [
        [
            'title' => 'Обекти',
            'url' => 'modules/objects/objects_dashboard.php',
            'roles' => ['objects_admin', 'objects_editor', 'objects_viewer'],
            'active_on_path' => '/modules/objects/'
        ]
    ],
    'sidebar_links' => [
        [
            'title' => 'Табло Обекти',
            'url' => 'modules/objects/objects_dashboard.php',
            'icon' => 'bi-speedometer2',
            'visible_on_path' => '/modules/objects/',
            'roles' => ['objects_admin', 'objects_editor', 'objects_viewer'],
            'active_on' => ['objects_dashboard.php']
        ],
        [
            'title' => 'Дейности',
            'url' => 'modules/objects/objects_project_schedules.php',
            'icon' => 'bi-calendar-range',
            'visible_on_path' => '/modules/objects/',
            'roles' => ['objects_admin', 'objects_editor', 'objects_viewer'],
            'active_on' => [
                'objects_project_schedules.php'
            ]
        ],
        [
            'title' => 'Машини',
            'breadcrumb_title' => 'Управление на Механизация',
            'url' => 'modules/objects/objects_machines.php',
            'icon' => 'bi-truck',
            'visible_on_path' => '/modules/objects/',
            'roles' => ['objects_admin', 'objects_editor', 'objects_viewer'],
            'active_on' => [
                'objects_machines.php',
                'objects_machine_planning.php',
                'objects_machine_schedules.php',
                'objects_machine_movements.php'
            ]
        ],
        [
            'title' => 'Настройки',
            'breadcrumb_title' => 'Настройки на Обекти',
            'url' => 'modules/objects/objects_options.php',
            'icon' => 'bi-gear',
            'visible_on_path' => '/modules/objects/',
            'roles' => ['objects_admin', 'objects_editor'],
            'active_on' => [
                'objects_options.php',
                'objects_manage_clients.php',
                'objects_manage_machines.php'
            ]
        ]
    ],


    'stylesheets' => [],
    'scripts' => [
        'modules/objects/js/objects_dashboard.js',
        'modules/objects/js/objects_machine_movements.js',
        'modules/objects/js/objects_manage_clients.js',
        'modules/objects/js/objects_manage_machines.js',
        'modules/objects/js/objects_project_schedules_core.js',
        'modules/objects/js/objects_project_schedules_form.js',
        'modules/objects/js/objects_project_schedules_logs.js',
        'modules/objects/js/objects_project_schedules_matrix.js',
        'modules/objects/js/objects_project_schedules_timeline.js'
    ],

    'js_init' => [
        [
            'selector' => 'objects-dashboard-container',
            'function' => 'initObjectsDashboard'
        ],
        [
            'selector' => 'objects-project-schedules-container',
            'function' => 'initProjectSchedules'
        ],
        [
            'selector' => 'objects-machine-movements-container',
            'function' => 'initMachineMovements'
        ],
        [
            'selector' => 'objects-manage-clients-container',
            'function' => 'initManageClients'
        ],
        [
            'selector' => 'objects-manage-machines-container',
            'function' => 'initManageMachines'
        ]
    ]
];
