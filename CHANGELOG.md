# Changelog - Objects Module

All notable changes to the Objects module will be documented in this file.

## [0.1.16] - 2026-10-09

### Added
- **"Сондиране" Activity**: Added a new main activity type "Сондиране" (`install.sql`, and the upgrade script `db/upgrade_2026-10-09_objects_without_client.sql`, which inserts it only if missing).
- **Сондиране Uses Drilling Capabilities**: In the schedule modal, choosing "Сондиране" fills "Вид дейност" with every capability that contains "Сондаж", regardless of the activity it is mapped to. The machine filter, the activity list when machines are chosen, and the capability validation on save use the same rule (new `getActivityMappingRows` helper in `objects_project_schedules_core.js`).

### Changed
- **Schedule Modal "Дейност" Field**: Replaced the native drop-down with a Tagify single-select (same look as "Вид дейност"); the hidden native select remains the value holder and is kept in sync. Activity is now validated manually on save.
- **Manage Machines Page (`objects_manage_machines.php`)**: Added light and dark theme support. Header, table, search box, badges and the add/edit modal fields now use theme-aware styles and the shared styled input wrappers.
- **Native Select Styling**: Added dark theme colors for native select option lists inside styled wrappers (`css/objects.css`).

## [0.1.15] - 2026-10-09

### Changed
- **Objects Dashboard Theme Support (`objects_dashboard.php`, `objects_dashboard.js`)**: The dashboard now works in both light and dark themes. Hard-coded light/dark classes (`text-dark`, `bg-light`, `text-secondary`, `text-muted`) were replaced with theme-aware styles, and the sticky table header, dividers, progress bars and empty-state boxes follow the active theme.
- **Theme-Aware Charts**: Chart axis text, grid lines, bar colors, the doughnut gray slice and tooltips adapt to the current theme, and the charts are redrawn automatically when the theme is switched.
- **Design Consistency**: KPI cards now use the shared `stat-card-glass` / `stat-icon-wrapper` design. The search field and the status drop-down use the shared `tagify-styled-wrapper` input style, and the status drop-down has proper arrow and option colors in both themes.
- **Search Container Header**: Redesigned the "Търсене на обекти" title with an accent icon badge and a short description line.

### Removed
- **Dashboard Title Buttons**: Removed the "Графици" and "Нов Обект" buttons from the dashboard title row (the latter opened a modal that does not exist on that page).

## [0.1.14] - 2026-10-09

### Added
- **Inquiry Records in the Schedule Modal**: After choosing an object in the "Нов График" modal, the order lines of that inquiry (requests module) are listed (new `get_request_records` action in `objects_project_schedules_api.php`). Selecting a line fills the form using the same rules as the requests "Нова заявка" draft modal: "Проект" is split by `+` into projects (`количество x размер`), and "Вид" is matched against the machine capability names to set the activity and "Вид дейност"; an unmatched "Вид" is placed in "Допълнително описание".
- **Multiple Projects per Record**: The first project fills the main quantity fields; additional projects are shown as extra rows and are saved as separate schedule rows sharing the same activity, dates, status and machines.
- **Automatic End Date**: For new schedules, the end date is calculated from the start date and the longest project using working days.

### Changed
- **Schedule Modal Layout**: Reordered into numbered sections: Обект, Дейност, Количества, Срокове и статус (start date, end date and status now share one row). Field ids are unchanged.
- **"Допълнително описание" field** is now visible and saved as the activity subtype.
- **Capability Rules**: For new schedules only a value from the machine mapping is saved as "Вид дейност" (mandatory for Анкери, Армопакети, Профили, Торкрет); other text is saved as the description.
- **Planned Days** are now rounded up (`ceil(количество / дневен план)`).
- **New Object Modal**: Removed the "Клиент" field; objects are added to the schedule with the object only.

### Database
- `objects_project_schedules.client_id` and `activity_type_id` are now nullable, `total_quantity`, `daily_productivity_plan` and `planned_days` default to 0, and the client foreign key is `ON DELETE SET NULL` (`install.sql`).
- Added activity type 9 "Торкрет" to the seed data.
- New upgrade script `db/upgrade_2026-10-09_objects_without_client.sql` for existing databases (schema changes plus import of clients, heavy machines and machine capabilities; safe to re-run).

## [0.1.13] - 2026-08-27

### Fixed
- **Database Installation & Role Creation (`install.sql`)**: Resolved a critical Foreign Key dependency ordering conflict where `objects_machine_movements` was created before `objects_project_schedules`. Reordered the table definitions in `install.sql` and moved the initial role insertions (`objects_admin`, `objects_editor`, `objects_viewer`) to the top of the script, wrapped with `SET FOREIGN_KEY_CHECKS = 0/1` to ensure reliable automatic installation across all environments.
- **Module Authorization Consistency**: Added missing `hasAnyRole(['objects_admin', 'objects_editor', 'objects_viewer'])` access control checks to `objects_machine_planning.php` and `objects_machine_schedules.php` to align with the core security model.

## [0.1.12] - 2026-05-13
 
### Added
- **Sticky Table Headers**: Implemented persistent header visibility for the Machine Schedules matrix, keeping month names and dates pinned to the top while scrolling vertically through long machine lists.
- **Fixed-Height Scrollable Container**: Optimized the Machine Schedules layout with a dedicated fixed-height container (`calc(100vh - 350px)`) and internal vertical scrolling, providing a more stable and professional planning environment.
- **Flexible Tooltip Width**: Enhanced popover windows with dynamic width scaling based on content. This prevents awkward text wrapping for long object names and logistical details, significantly improving readability.
- **Dynamic Iconography for Active Status**: Implemented a truck-excavator-truck pattern for "Active" (Активен) assignments. The calendar now shows a truck icon on the start and end dates, and the excavator SVG icon on middle dates to provide better logistical context.
- **Enhanced Planning Legend**: Updated the matrix legend to show both Truck and Excavator icons for "Active Object", ensuring visual parity with the mobilization status representation.
- **Improved Day Popovers**: Added the "Period" (dates) row to active assignments in the day events popover window, matching the detail level provided for planned mobilization items.
- **Machine Schedules UI Parity**: Synchronized the Machine Schedules calendar tooltips with the Planning module's rich format. Popovers now include **Activity** (Дейност), **Type** (Вид), and **Period** (Период) for all entries.
- **Schedules Conflict Banners**: Integrated the red "**Застъпване на обекти!**" (Object Overlap) warning banner into the Machine Schedules tooltips to alert users of scheduling conflicts.
- **Calendar Refresh Feature**: Added a dedicated "**Refresh**" (Обнови) button to the Machine Schedules page with a spinning animation to provide visual feedback during data fetching.
- **Automatic Today Focus**: Implemented smart auto-scrolling that automatically centers the current date in the viewport upon loading or refreshing the calendar, eliminating the need for manual horizontal scrolling to find today's activities.
 
### Changed
- **Mobilization Terminology Standardization**: Renamed all remaining "Planned" (Планиран) and "Transport" (Транспорт) status labels to **"Мобилизация"** (Mobilization) across legends, tooltips, and badges for a cohesive and unified user experience.
- **Refined Mobilization Iconography**: Reintroduced the calendar icon for middle days of mobilization assignments to maintain visual continuity, while keeping truck icons strictly on the start and end dates.
- **Enhanced Tooltip Data**: Popovers now consistently include the **"Период"** (Period) row showing the full date range of the assignment, providing better temporal context for both active and mobilization tasks.
- **Smart Tooltip Suppression**: Refined the deduplication logic in `objects_machine_schedules.js` to automatically hide redundant "Мобилизация" status blocks on middle days when a machine is already in an "Active" work state for the same project.
- **Refined Mobilization Popover Logic**: Updated the Machine Planning matrix popovers (`planning_ui.js`) to eliminate redundancy while preserving vital logistics context. On middle dates covered by an object schedule, duplicate mobilization blocks are hidden entirely. On start and end dates, the popover preserves the core "Мобилизация" header with arrival/departure source lines (`Пристигнал от:` / `Заминава за:`) and explicitly displays the overall mobilization timeframe (`Период:` / `Дата:`), while suppressing the duplicate planned activity status row.
- **Standardized Schedules Iconography**: Replaced legacy status icons in the Machine Schedules module (Completed/Paused) with standardized square checkboxes (`bi-check2-square`) and filled pause icons (`bi-pause-fill`) to ensure complete visual parity with the Machine Planning module.
- **Full-Page Seamless Scrolling**: Eliminated inner bounded scroll containers and restrictions in the Machine Schedules module, refactoring the table layout to support fluid, page-level vertical scrolling.
- **Persistent Header and Column Visibility**: Implemented sticky positioning for the table header and machine name columns on the Machine Schedules page, keeping critical orientation context pinned to the viewport during extensive scrolling across all scheduling views.
- **Machine Schedules Conflict Indicators**: Replaced the numerical circle badges for object overlaps with a sleek red horizontal line at the bottom of the status icons. This change aligns the Machine Schedules matrix with the Planning module's design language, providing a cleaner and more standardized conflict visualization.
- **Matrix Legend Update**: Updated the schedules legend to accurately reflect the new red-line conflict indicator.
- **Standardized Excavator SVG**: Standardized the excavator SVG across the planning and schedules modules for consistent visual branding.
- **Schedules Default View**: Set the **Gantt (Гант)** view as the default display mode for the Machine Schedules module.
- **Streamlined Calendar Controls**: Refactored the Matrix/Gantt and Refresh buttons into independent, borderless elements with consistent spacing, optimizing the layout for the new refresh animation.ntt and Refresh buttons into independent, borderless elements with consistent spacing, optimizing the layout for the new refresh animation.

## [0.1.11] - 2026-05-05

### Added
- **Mini-Calendar Forecast Preview**: Implemented a visual "mini-calendar" in the Mobilization (Мобилизация) modal. When selecting an activity and machine, the system now renders one or two months to show any existing forecasted dates, helping users align actual movements with original plans.
- **Enhanced Planning Colors**: Overhauled the mini-calendar and summary cards with a high-contrast Indigo/Slate theme, significantly improving visibility and readability in both light and dark modes.
- **Unplanned Projects Forecast Tracking**: Updated the unplanned projects table to display a "Forecasted" indicator (Calendar icon) for activities that have a saved forecast, while keeping them visible in the list until fully mobilized.
- **Conflict Warning Banners**: Added explicit alert banners to calendar popovers ("Застъпване на обекти!" and "Дублирани събития") to provide immediate clarity on scheduling issues when hovering over events.
- **Machine Schedules Synchronization**: Ported the consolidated day-events modal, conflict detection (with active-status suppression), and premium scoreboard styling to the Machine Schedules overview page, ensuring full functional parity with the Planning module.
- **Improved Multi-Event Visibility**: Updated event deduplication logic to include unique assignment IDs, ensuring that multiple different activities for the same machine on the same day are all visible in popovers and modals.

### Changed
- **Smarter Action Disabling**: Implemented context-aware buttons in the "Обекти без машина" table. The "Прогноза" and "Мобилизация" buttons now automatically disable and show informative tooltips when an activity is already forecasted or fully assigned.
- **Improved Visibility Logic**: Modified the unplanned projects API to ensure objects remain visible even when a forecast exists, only removing them once an actual arrival or movement has been recorded.
- **Refined Conflict Indicators**: Standardized the indicator bars at the bottom of calendar icons. Solid red represents true conflicts (different objects), while a dual-color gradient (half status-color, half red) identifies duplicate events for the same object.
- **Terminological Refinement**: Renamed "Planned" status to **"Мобилизиран"** (Mobilized) in all popovers and tooltips. Also updated the field "Планиран:" to **"Обект:"** in popover headers to better reflect the destination site.
- **Planning Calendar Simplification**: Redesigned the machine planning matrix to focus exclusively on logistical planning. Execution-related status icons (Active, Completed, Problem) are now filtered out to reduce visual clutter.
- **Unified Mobilization Status**: Renamed the "Planned" status to "Мобилизация" across the main planning UI elements. The calendar now uses a dual-icon system (Truck for boundaries, Calendar for duration) to represent this unified status.

### Fixed
- **Automated Assignment Cleanup**: Implemented a cascading deletion hook that automatically removes orphaned machine assignments when a forecast (Прогноза) is deleted, ensuring the unplanned projects list stays clean and accurate.
- **Visual Status Distinction**: Refined the unplanned projects list to clearly distinguish between machines that are "Forecasted" (Cyan) and those already "Mobilized" (Blue).

## [0.1.10] - 2026-05-05

### Added
- **Cascading Object Filter**: Added an "Обект" (Object) filter to the Machine Planning interface. This filter cascades dynamically, narrowing down the available "Дейност" (Activity) and "Машина" (Machine) options to only those associated with the selected object.
- **New API Endpoint**: Introduced the `get_planning_objects` API endpoint and updated `get_all_activities` and `get_machines_by_activity` to handle the new `request_id` context.

### Changed
- **Unplanned Projects Focus**: Altered the criteria for the "Обекти без машина" (previously "Обекти без дата") container. The table now displays all project activities that do not currently have a machine assigned, regardless of whether execution dates have been set or not.

### Fixed
- **Conflict Indicator Logic**: Fixed a bug where the "Застъпване на обекти" (Object Overlap) badge would falsely light up red when a machine was mobilizing to/from an object while simultaneously having a forecast for the same object. The conflict logic now correctly standardizes project names across movement, forecast, and execution layers, explicitly ignoring "База" (Base) to eliminate false positive conflicts.
- **Multiple Assignments Visibility**: Resolved a critical issue where overlapping planned activities were being incorrectly deduplicated and hidden from the calendar. The system now properly distinguishes between multiple movements and assignments for the same machine, ensuring they are all rendered individually in popovers and correctly trigger the red conflict indicator when they belong to different objects.
- **Server-Side Suppressions**: Removed legacy backend logic that was suppressing planned/estimated records if an actual execution window existed, allowing for full visibility of multi-layered project schedules.
- **Active Status Badge Suppression**: Implemented a rule to hide the conflict/overlap badge whenever a machine is in "Active" (Excavator) status. This prioritizes the visibility of production work on the calendar while keeping full conflict details accessible within the hover popover.
- **Context-Aware Modal Buttons**: Updated "Графици и събития за деня" (Day Events) modal to display "Информация" (Information) button for Active status.
- Standardized visual presentation of "Данни за реална позиция" (Actual Position Data) modal using premium glassy styling for all input fields.
- Fixed minor layout issues in machine planning matrix conflict detection.

## [0.1.9] - 2026-05-04

### Added
- **Form Component Reordering**: Moved "Количества и срокове" and "Изпълнение" sections to the top of the "Редактирай График" modal window for better visual hierarchy.
- **Unified Day Events Modal**: Added a clean single modal window to replace fragmented multiple modal views when interacting with the calendar matrix.
- **Delete and Edit Support for Planned Status**: Allowed deleting a planned machine assignment directly via the day events modal, unsetting/detaching the machine from the object's schedule.
- **Improved Unplanned Projects Filtering**: Updated the waitlist of unplanned projects to automatically exclude any projects that already have a linked mobilization movement date set.
- **Mobilization Button for Unplanned Rows**: Added a "Мобилизация" button to rows in the unplanned activities list, automatically pre-filling the Object, Activity, and machine when clicked.
- **Enhanced Auto-fill for Mobilization Rows**: Ensured the specific activity field auto-populates correctly alongside the object name when opening the mobilization modal from the unplanned list.
- **Robust Tagify Mobilization Auto-fill**: Bypassed whitelist validation via `force=true` and directly set both Tagify's `.settings.whitelist` and `.whitelist` properties to fix data population race conditions.
- **Asynchronous Flag Reset for Cascading Inputs**: Wrapped the `PlanningState.autoFillingMovement` flag reset in a `setTimeout` to prevent microtask event loop race conditions from clearing programmatically set activity tags.

### Changed
- **Optimized Edit Schedule Layout**: Placed start and end dates on the same row, and moved the status field to its own line.
- **Hidden Input Field and Label for Machines**: Completely hid the visual "Машини" input field and label from the "Редактирай График" modal using a `display: none !important;` container while preserving the underlying functional elements.
- **Removed Remove Machine Button**: Deleted the "Премахни машина" button from the top-right corner of the machine cards.
- **Locked Additional Machine Inputs**: Set all remaining fields on the machine cards (От, Към, Превозвач, and Бележка) to read-only and disabled state.
- **Enabled Zero Quantity Logging**: Updated backend API and JavaScript modals to accept 0 as a valid quantity, while enforcing that a note must be added.
- **Fixed Zero Quantity Matrix Display**: Updated the matrix calendar rendering logic to correctly display and mark days with exactly 0 quantity.
- **Terminology Shift**: Renamed 'Транспорт' to 'Мобилизация' for the buttons, legend, and modal headers on the machine planning page.
- **Calendar Popover Sorting**: Updated popover statuses ordering to show Active/Problem/Completed at the top, followed by Planned, then Mobilization, and finally Forecast at the bottom.
- **Departure Status Localization**: Adjusted popover headers for Planned and Mobilization on departure days to display the current object instead of the destination object.
- **Improved Conflict Detection**: Refined matrix overlap/conflict badge logic to correctly ignore self-overlap on departure days.

## [0.1.8] - 2026-04-30

### Added
- **Unified Machine Planning Popovers**: Standardized popover content for all machine states (Planned, Transport, Active) to ensure that activity details and "Planned" status badges are consistently visible on transit days (Truck icons).
- **Movement-to-Project Metadata Linkage**: Enhanced the backend and frontend to fetch and display project-specific "Notes" (Забележки) within the logistical movement section of the popover.
- **Project Linkage in Movements**: Added a new mandatory "Проект / Обект" (Project / Object) selection field to the "Ново Движение" (New Movement) modal, establishing a direct architectural link between the Machine Movements and Project Schedules modules.
- **Auto-Sync to Assignments**: Movements linked to a project schedule now automatically create or update the corresponding machine assignment records, ensuring logistical arrival/departure dates are perfectly synchronized with the schedule's start/end dates.
- **New Utility Functions**: Implemented the `formatRange(start, end)` helper in `planning_utils.js` to standardize date range displays in popovers.
- **Movement Modal on Planning Page**: Ported the "Ново Движение" (New Movement) modal from the Machine Movements page (`objects_machine_movements.php`) to the Machine Planning page (`objects_machine_planning.php`), allowing users to create movements directly from the planning calendar without navigating away.
- **Activity-Based Machine Filtering (Planning)**: The Machine selection field in the Planning page's movement modal now dynamically filters based on the selected activity (Дейност). Only machines with the matching `activity_type_id` and `capability_name` are displayed, mirroring the filtering behavior already present on the Movements page.
- **Collapsible Quarterly Rows**: Reorganized the 12-month calendar grid into four toggleable quarterly rows to reduce visual clutter. Implemented auto-expansion for the current month's row and added premium row headers with smooth chevron transitions.
- **Dynamic Quarter Titles**: Updated the calendar row headers to display clear month ranges (e.g., "Януари - Март") instead of generic quarterly numbers.
- **Gantt Chart View (Machine Schedules)**: Added a new "Gantt View" to the Machine Schedules module (`objects_machine_schedules.php`), featuring Microsoft Project-style horizontal activity bars, automated vertical stacking (lanes) for overlaps, and a seamless toggle between Matrix and Gantt modes.

### Changed
- **Enriched 'Обект за прогноза' Field**: Enhanced the "Обект за прогноза" input in the forecast modal to show full activity context (name, specification, quantity, and dimensions), mirroring the detailed display of the "Дейност" field in the movement modal.
- **Refined Popover Hierarchy**: Reorganized the machine planning popover to provide a clear visual separation between logistical info and planned activity. Transit days now feature a dashed line separator (`border-dashed`) and a dedicated "Planned" sub-header for activity details. Also reordered sections to prioritize logistical **Movements** at the top.
- **Dynamic Logistics Visibility**: Optimized the popover to show "Carrier" and "Movement Notes" exclusively for transit/movement days, keeping "Planned" middle-day views clean and focused on production details.
- **Context-Aware Conflict Highlighting**: Refined the "Overlap Indicator Badge" logic to show a **bright red background** specifically when multiple *different* objects overlap on the same day. For overlapping layers of the same object (e.g., Forecast and Planned), the badge maintains its premium **Electric Indigo to Violet gradient**.
- **Themed Action Buttons (Planning Table)**: Standardized the styling of action buttons ("Запиши", "Прогноза", "Транспорт") within the unplanned projects table to match the color tokens and border styles of the planning legend, creating a unified visual language across the module.
- **Terminology Shift (Mobilization to Transport)**: Renamed "Мобилизация" (Mobilization) to "Транспорт" (Transport) in the planning legend, page header, and movement modals to better reflect the logistical action of machine transit.
- **Refined Header Navigation**: Updated the main "Транспорт" header button with the premium "Planned" cyan theme, ensuring high visibility and consistency with the project planning status logic.
- **Enriched Status Details**: Integrated comprehensive activity metadata (Activity Name, Capability, Subtype) into the popover for "Planned" middle-range movement days.
- **Standardized Visual Branding**: Updated the "Planned" status badge to use the `pop-badge-planned` class, ensuring consistent **Cyan/Teal** coloring across all calendar icons.
- **Cross-Module Consistency**: Successfully transferred the advanced icon logic (Grey Truck for transit, Cyan Calendar for middle days) and status priority system to the **Machine Schedules** module.
- **Enhanced Machine Schedules UI**: Synchronized the Schedules color palette with the Planning theme and added a "Transport" item to the calendar legend for better clarity.
- **Cyrillic-Aware Object Tracking**: Updated the object name normalization regex in the Machine Schedules module to correctly support Bulgarian characters, ensuring accurate conflict detection and badge counts for Cyrillic object names.
- **Smart Machine Filtering**: The Machine selection dropdown in the movement modal now dynamically filters based on the selected project's activity. It strictly displays only machines that possess the required capabilities and activity subtypes for the selected task.
- **Smart Destination Auto-fill**: Selecting a project in the movement modal now automatically populates the "Към (Обект/База)" destination field with the project's specific location, reducing data entry friction.
- **Enriched Project Display**: Upgraded the project dropdown options to display comprehensive details, including the specific Activity Name, Capability, and Subtype, formatted logically (e.g., `Object | Activity (Capability — Subtype) | Dates`).
- **Project Schedule Simplification**: Removed the redundant "Прогн. начална дата" (Estimated Start Date) and "Прогн. крайна дата" (Estimated End Date) fields from the "Редактирай График" (Edit Schedule) modal. Logistical dates and machine presence are now exclusively controlled and synchronized by the Machine Movements module.
- **Graceful Empty Dates**: Improved the display logic for unplanned projects; activities without defined start or end dates now display a clean "без дати" (no dates) label instead of defaulting to an epoch placeholder like "01.01.1970".
- **Database Schema Update**: Finalized the integration by adding the `schedule_id` column and foreign key constraints to the `objects_machine_movements` table definition in the core `install.sql` script, removing legacy inline migration checks.

- **Simplified Movement Interface**: Removed the redundant "Клиент" (Client) field from the "Ново Движение" (New Movement) modal and expanded the "Обект" (Object) selector to span the full width for a cleaner layout.
- **Global Object Selection**: Refactored the object selector to display all available project schedules directly, eliminating the multi-step client-to-site cascading dependency and reducing clicks.
- **Enriched Activity Metadata**: Upgraded the "Дейност" (Activity) dropdown to display `total_quantity` and `dimension_info` (e.g., `120.0 | 18.0`) instead of date ranges, providing more relevant logistical context for machine assignments.
- **Smart Activity Filtering**: Implemented an automated filter in the API and UI that hides activities with already set start/end dates, ensuring the selection list remains focused on upcoming, unscheduled tasks.
- **Legacy Edit Stability**: Engineered a whitelist persistence layer that ensures movements already linked to dated activities remain visible and valid when editing historical records.
- **JS Architecture Cleanup**: Refactored `planning_modals.js` to remove legacy client-side dependencies and resolved critical syntax issues in the Tagify data mapping logic.

### Fixed
- **Machine Assignment Sync**: Resolved a data persistence issue where removing a machine tag from an activity on the Machine Planning page did not correctly propagate the detachment to the Project Schedules page. Updated the API to perform a full `DELETE` for assignments that haven't started yet and set the `end_date` to yesterday for started assignments, ensuring they disappear immediately from "Current" views.
- **Global Function Collision**: Resolved a critical bug where `objects_machine_movements.js` (loaded globally on all module pages) was overwriting planning-specific functions (`resetMovementModal`, `editMovement`, `loadMachineMovementsOptions`) with its own versions that reference different DOM element IDs. Wrapped all movements-page-specific code inside a container guard (`if (document.getElementById('objects-machine-movements-container'))`) to prevent cross-page interference.
- **Duplicate Tagify Library Loading**: Removed a redundant `<script>` tag for Tagify JS on the planning page that conflicted with the global Tagify loaded via `import_js.php`, which could cause constructor conflicts and silent rendering failures.
- **Tagify Dropdown Configuration**: Synchronized all Tagify instances in the planning modal with the proven configuration from the movements page, including `classname: "tags-look"`, `closeOnSelect: true`, and `maxItems: 50` settings for consistent dropdown rendering.
- **Movement Logic Corruption**: Fixed a series of JS syntax errors and broken object mappings in the `loadMachineMovementsOptions` function resulting from iterative UI refactoring.

## [0.1.7] - 2026-04-24

### Changed
- **Unified Icon Priority System**: Implemented a robust hierarchy for machine calendar icons where logistical movements (Truck) take precedence over active work (Excavator), which in turn takes precedence over planned or forecast states.
- **Enhanced Logistical Visualization**: Developed a virtual movement injection system that ensures "Arrival" and "Departure" indicators (Truck icons) appear reliably at the start and end of every assignment, providing clearer logistical context.
- **Refined Popover Hierarchy**: Standardized tooltip content across both Planning and Schedules modules to display primary work details (Activity, Type, Status) at the top, with logistical "Transport" details positioned clearly at the bottom.
- **Improved Logistical Labeling**: Enhanced the popover logic to dynamically show "Пристига от" (Arrival from) or "Заминава за" (Departure to) with accurate origin/destination information, defaulting to "База" (Base) when specific site names are unavailable.
- **Smart Tooltip Deduplication**: Engineered a strict deduplication engine for tooltips that prevents redundant status labels (like multiple "Planned" or "Transport" entries) when project data layers overlap.
- **Extended Dashboard Movement Tracking**: Broadened the "Upcoming Movements" reporting window to a 45-day range (-14 days past to +30 days future) to provide better visibility into logistical schedules.
- **Deep-Link Dashboard Navigation**: Implemented smart deep-linking for dashboard warning arrows, allowing users to jump directly to an expanded and filtered view of a specific object on the schedules page in a new tab.

### Fixed
- **Red Overlap Badge Suppression**: Resolved an issue where the red conflict indicator was incorrectly shown for single-project work days. The badge is now intelligently suppressed when the primary icon is an Excavator and all records belong to the same project.
- **Duplicate Status Entries**: Fixed a bug where travel days would sometimes hide the underlying project activity; both work details and logistics are now displayed together in a unified view.
- **Cross-Module Synchronization**: Synchronized the rendering logic between the **Machine Planning** and **Machine Schedules** modules to ensure a consistent visual experience across the entire platform.
- **Decoupled Movement Dates**: Fixed the dashboard movement query to correctly capture decoupled arrival and departure dates, as well as planned assignments from the machine planning module.
- **Dashboard UI Polish**: Optimized action button styling for "perfectly rounded" circles and implemented an animation bypass logic that skips fade-in transitions when navigating via deep links for a faster user experience.

## [0.1.6] - 2026-04-23

### Changed
- **Standardized Input Styling**: Implemented a unified "Apple Glass" aesthetic for all input fields in the **Редактирай График** (Edit Schedule) modal. This involves wrapping text, number, date, and select inputs in a `.tagify-styled-wrapper` to match the look and feel of the Tagify components.
- **Custom Select Interface**: Developed a specialized transparent interface for dropdown selectors within the styled wrapper, including custom SVG icons for the dropdown arrow that adapt to both light and dark themes.
- **Enhanced Tagify Integration**: Refined global CSS to ensure Tagify components seamlessly integrate into the new styled wrappers by suppressing redundant borders and backgrounds when nested.
- **Improved Focus Feedback**: Synchronized the focus-within states of the custom styled wrappers with the native Tagify focus effects for a more responsive and consistent user experience.
- **Refined Machine Assignment UI**: Streamlined the machine assignment cards by removing redundant inner boxes and backgrounds, allowing the glassy input fields to be more distinct and integrated into the overall modal design.
- **Explicit Monday Calendars**: Standardized all Flatpickr instances across the module to start the week on Monday by explicitly configuring the `firstDayOfWeek` property, ensuring consistency with regional standards.

### Fixed
- **Active Machine Visibility Fix**: Resolved a critical data fetching issue in the schedules API where machines with a planned departure date were hidden from the main table. The system now correctly displays all machines that are currently on site or scheduled to be in the future.


## [0.1.5] - 2026-04-22

### Changed
- **Field Locking in Edit Modal**: Implemented a structural enhancement that locks the **Обект** (Object), **Дейност** (Activity), and **Вид дейност** (Activity Subtype) fields when editing an existing schedule. This prevents accidental re-categorization of records that have already been initialized.
- **UI Interface Optimization**: Replaced the interactive Tagify and Dropdown selectors with a clean, read-only display mode during editing. This simplifies the interface and clearly indicates which data is immutable in the current context.
- **Context-Aware Field states**: Engineered a dynamic UI toggle that automatically restores full interactivity to the "Activity" and "Type" fields when adding new records to an existing object, balancing data integrity with workflow flexibility.

### Fixed
- **Backup & Cleanup Integrity**: Updated the data maintenance engine to include the `objects_machine_assignments` table in both the **Cleanup** (Изчистване) and **Export** (Backup) processes. This ensures that when resetting object data, all machine-to-project mappings are properly cleared, preventing orphaned records and maintaining database referential integrity.
- **Forecast Consolidation**: Resolved a critical bug in the machine planning deduplication logic where a field name mismatch (`forecast_id` vs `estimate_id`) caused multiple forecasts on the same day to be incorrectly merged into a single icon.
- **Multi-Activity Visibility**: Implemented robust record-based deduplication for both the Planning and Schedules calendars, ensuring that multiple forecasts or activities for the same machine and object are correctly identified, triggering the red "Overlap Indicator" badge and listing all entries in popovers.
- **Enhanced Icon Priority**: Refined icon precedence on the Machine Schedules page to show the **Transport (Truck)** icon over Forecast and Planned icons during overlaps, ensuring logistical movements remain visible.
- **Dynamic Popover Positioning**: Engineered a smart, context-aware positioning system for tooltips and popovers across all machine calendars. Tooltips now automatically flip between top and bottom positions based on available screen space and respect horizontal boundaries to prevent content from being cut off.
- **Machine Date Decoupling**: Fully decoupled machine arrival and departure dates from project execution dates in the "Edit Schedule" modal. Removed automatic date-sliding and default fallbacks in the API, ensuring that machine movement dates are strictly manual inputs.
- **Manual Assignment Dates**: Removed the forced population of `CURDATE()` when assigning machines via the Unplanned Queue and Forecast Auto-assign logic. All new machine assignments now initialize with empty arrival dates, providing total manual control.
- **JS Form Cleanup**: Sanitized the machine assignment logic in the project schedules core to ensure new machines are initialized with empty arrival/departure dates, preventing accidental auto-population from the execution section.
- **Precise Calendar Rendering**: Decoupled "Actual" and "Planned" work windows in both Planning and Machine Schedules modules. The calendar now accurately distinguishes between the actual start date (Excavator icon) and the preceding planned window (Planned icon).
- **Logistical Precision Fix**: Strictly gated "Virtual Transport" injection to use explicit assignment dates only. This prevents the "Arrived from Base" status from automatically appearing on the first day of a project if no arrival date has been set.
- **Improved UI Deduplication**: Enhanced the record merging logic in the Planning module to prevent duplicate "Planned" status entries in popovers by normalizing the deduplication key to distinguish only between "work" and "travel" states.
- **Module Sync**: Synchronized all calendar logic improvements between the Machine Planning and Machine Schedules modules for total visual and functional consistency.
- **UI Stability Fixes**: Resolved a `ReferenceError` in `planning_unplanned.js` and fixed a "Double Toast" notification bug where a "Network Error" would falsely appear after a successful machine assignment.

## [0.1.4] - 2026-04-21

### Fixed
- **Automatic Machine Assignment**: Re-engineered the forecast saving logic in `objects_machine_planning_api.php` to automatically assign the selected machine to the "Машини" column in the unplanned projects table.
- **Assignment Data Integrity**: Ensured that all machine assignments created via the forecast modal include a `start_date` (CURDATE()), resolving an issue where assignments would fail to save or display correctly due to missing date fields.
- **Robust Bulk Matching Logic**: Improved the "Bulk support" engine to use `IFNULL` normalization, ensuring that matching unplanned activities are correctly identified and updated even when specification fields contain empty strings instead of NULL values.
- **Guaranteed UI Feedback**: Forced the assignment of the primary `schedule_id` during forecast creation to provide immediate visual confirmation in the unplanned projects list.
- **Machine Movement Visibility Fix**: Resolved a critical issue where machine arrival and departure information was missing from the calendar. The system now correctly recognizes `arrival_date` and `departure_date` in the movement history.
- **Corrected Icon Priorities**: Fixed a bug where travel days were incorrectly showing "Active" (Excavator) icons instead of "Movement" (Truck) icons. Adjusted priorities so that the Excavator is only shown on actual work days, while ensuring movement data remains visible in popovers during overlaps.
- **Assignment Status Isolation**: Fixed a date-overwriting bug in the backend that caused the "Active" status to bleed into transport days.
- **Unified Logistical Popovers**: Synchronized the machine planning popover layout and transport labeling ("Пристигнал от", "Заминава за") with the Machine Schedules page for a cohesive user experience.
- **Aggressive Logistical Deduplication**: Implemented a smart merging layer in the planning UI that consolidates multiple daily movement records for the same machine into a single, clean transport summary, resolving redundant popover sections.
- **Logistical String Normalization**: Fixed a string-merging bug where origin sites were being incorrectly concatenated (e.g., "База / Object") by prioritizing manual user entries over inferred site names.
- **Transport Overlap Suppression**: Resolved a visual regression where generic virtual travel indicators were showing alongside detailed movement records.
- **Backend Movement Integrity**: Hardened the project schedules API to prevent the creation of redundant movement records by cross-referencing existing assignments before inserting new logistical logs.
- **Active Project Icon Continuity**: Updated the calendar logic to ensure the Excavator icon persists through the entire planned period for "Active" projects, providing a more intuitive and contiguous project timeline.
- **Dynamic Popover Status Toggling**: Implemented smart labeling in popovers that automatically switches between "Планиран" and "Активен" (Изпълнение) based on the project's actual start date.
- **Multi-Phase Popover Visibility**: Added support for displaying both the Active and Planned status details simultaneously in the popover when these phases overlap, ensuring no scheduling information is lost during transitions.
- **Intelligent Overlap Suppression**: Refined the red overlap badge logic to hide redundant "2" indicators specifically when the machine is "Active" and the overlap is just a historical layer of the same project.
- **Hardened Project Unification**: Implemented aggressive object name normalization to unify all record types (Location, Estimate, Movement) under a single project identity for cleaner calendar rendering.
- **Transport Transparency**: Ensured that overlap indicators remain visible on transit days (Truck icon) to notify users of scheduled work activities underlying the movement.
- **Cross-Module Sync**: Successfully transferred and synchronized all refined icon, tooltip, and badge suppression logic to the **Machine Schedules** matrix, ensuring perfect visual and functional consistency across the entire module.
- **Enhanced Popover Detail**: Expanded the historical "Planned" section in popovers to include **Activity** and **Type** rows, providing full context for original schedules.
- **UI Typography Standardization**: Normalised popover typography by removing redundant opacity and small-font classes from the "Planned" block, ensuring first-class visual weight for all status records.
- **Structural Badge Normalization**: Wrapped all status badges in a nested container to prevent stretching and maintain consistent spacing/font-weight across all categories.
- **Reference Error Resolution**: Fixed a `ReferenceError` where `currentDayStr` was undefined during popover generation.

## [0.1.3] - 2026-04-20

### Added
- **Machine Planning History System**: Re-engineered the planning timeline to support a "Multi-Layer" view (Forecast, Plan, Execution, and Logistics). The calendar now preserves all historical stages for a given day, allowing users to track how an initial forecast transitioned into an actual assignment.
- **Machine Logistics Overhaul**: Re-architected movement tracking by evolving `machine_movements` into a more robust `objects_machine_movements` table with dedicated columns for `arrival_date`, `departure_date`, `departure_from`, and `arrive_to`.
- **Advanced Transport UI**: Upgraded the machine assignment card with dedicated inputs for origin/destination and logistical remarks.
- **Logistical Context Awareness**: Upgraded the popover engine to dynamically provide localized context. It now automatically identifies if an icon represents an arrival ("Arrived From") or a departure ("Moving To") by comparing the daily entry against the machine's location history.
- **Enhanced Aesthetic Hierarchy**: Introduced a dedicated **Indigo/Purple** theme for Forecasts (Прогноза) to clearly distinguish them from official Plans (Yellow).
- **Responsive Popover Layout**: Increased popover max-width (500px) and implemented text-wrapping for a premium feel.

### Fixed
- **Logistical Overlap Logic**: Implemented "Virtual Movement Injection" to ensure that machine travel days always trigger red "Overlap" badges even when they coincide with work starts/ends.
- **Status Normalization**: Unified terminology by removing Roman numerals and simplifying category labels to "Изпълнение", "График", "Прогноза", and "Транспорт".
- **Hardened Range Deduplication**: Updated both the PHP and JS engines to filter duplicate operational records, automatically suppressing redundant estimated ranges if a confirmed actual assignment exists.
- **API Resilience**: Fixed logistical label fallbacks in the backend to properly support manual origin/destination fields and "Base" (База) fallbacks.
- **Unplanned Queue Data Restoration**: Fixed missing data in the "Обекти без дата" table by updating the API to correctly calculate `display_vid` and fetch all `assigned_machines`.
- **Calendar Visibility**: Resolved critical issues where activities were missing or duplicated, consolidating logistical info boxes for a cleaner timeline.

## [0.1.2] - 2026-04-19

### Added
- **Multi-Month Timeline**: Expanded the Machine Schedules Matrix to support continuous, multi-month views (1 to 12 months) with a dynamic duration selector and range-aware API.
- **Hierarchical Sticky Headers**: Implemented a two-level header system that groups days by month/year with 'Freeze Pane' persistence, ensuring clear orientation across long-range timelines.
- **Unified Control Suite**: Upgraded all matrix filters (Month, Year, and Duration) to the premium, theme-aware Tagify interface for a perfectly consistent "Apple Glass" user experience.
- **Machine Planning Standardization**: Migrated machine planning to a robust, schema-based architecture by adding a dedicated `activity_subtype` column to the `objects_machine_schedules` table.
- **Legacy Compatibility**: Added an automatic "Pipe Splitter" to the Excel import process and unplanned projects "Grab" logic to handle both new separate columns and legacy `Capability | Subtype` strings.
- **Smart Date Synchronization**: Implemented intelligent auto-sync across the project planning workflow. Correcting a project's dates (Actual or Planned) now automatically updates all tethered machine assignments and linked forecast records in unison, preventing "ghost" icons on the timeline.
- **UI Label Parity**: Renamed modal terminology to "Планирана начална/крайна дата" for better UX and improved popover labeling to distinguish between "Planned" and "Real" objects across all views.
- **Date Decoupling Architecture**: Decoupled machine assignment dates (Arrival/Departure) from project lifecycle dates, allowing for independent transport scheduling while maintaining calendar integrity.
- **Travel-Day Iconography**: Implemented specialized "Truck" icons to represent machine movement days that fall outside the active work window, ensuring clear distinction between transport and production.
- **Machine Planning Dashboard Restoration**: Successfully reconstructed the core Machine Planning API from legacy checkpoints after a critical deletion, fully restoring the Unplanned Queue and Bulk Auto-Assign features.

### Fixed
- **UI Design Evolution**: Implemented a premium "Apple Glass" layout for all machine-related popovers and tooltips, featuring left-aligned flowing text, bold object names, and theme-aware contrast emphasis for maximum readability.
- **Matrix Stability**: Resolved a critical date-stretching bug in the Machine Schedules Matrix by replacing aggressive '2099' fallbacks with context-aware "Open-Ended" logic.
- **Ghost Filter**: Implemented a smart deduplication mechanism to hide 1-day "phantom" planned assignments, ensuring the calendar remains clean and prioritized for explicit forecasts.
- **Icon & Status Synchronization**: Unified the icon system (Excavator for Active, Graph for Forecast) and human-readable labels ("Активен", "Прогноза", "Планиран") across the Planning Dashboard and Schedules Matrix.
- **Critical Forecast Modal Fix**: Resolved a `ReferenceError` in `planning_unplanned.js` that blocked "Прогноза" (Forecast) creation.
- **Instant Population**: Implemented "Instant Grab" logic for the forecast modal, ensuring activity data is populated immediately from the waitlist.
- **Matrix Tooltips & Popovers**: Corrected the SQL and UI logic to properly distinguish complex overlapping activities for a single machine.
- Resolved "Unknown column 'primary_contact_notes'" error during backup restoration by updating `install.sql`.
- Resolved multiple "Unknown column 'machine_id'" database errors in the Objects Dashboard and Requests Upload API.
- Fixed Forecast machine assignment logic by correctly linking records via the bridge assignment table.
- Hardened Forecast data passing to preserve `schedule_id` and `request_id` context during the planning flow.
- Redesigned the Machine selection field with a modern, badge-based interface.
- **Active Status Hardening**: Resolved a backend override that previously forced "Planned" items to "Active" status if they had assigned dates. The system now strictly respects the "Не стартирали" (Not Started) status.
- **Zero-Date Resilience**: Sanitized legacy `0000-00-00` dates in the API and frontend rendering engine, ensuring reliable fallbacks to project dates and accurate icon anchoring across the calendar.
- **Enhanced Status Iconography**: Standardized the use of Excavator (Active), Square (Planned), Check-circle (Completed), and Warning-triangle (Problem) icons across the entire machine planning suite.
- **Popover Label Consistency**: Corrected the popover logic in the Planning Dashboard to ensure "Не стартирали" projects are correctly labeled as "Планиран Обект" in tooltips.
- Implemented icon consolidation and an overlap indicator (red badge) for concurrent machine activities.
- **Automated Travel Deduplication**: Engineered a smart filtering layer that prioritizes explicit movement/carrier records over generic travel assignments to eliminate redundant icons and calendar clutter.
- **Movement-to-Site SQL Resolution**: Fixed "Unknown column" errors by implementing deep-join logic to resolve and display movement destinations within the planning matrix and dashboard tooltips.
- **Cyrillic Schema Alignment**: Corrected SQL queries across the Objects module to use the proper `обект_име` column for `requests_main` compatibility.

## [0.1.1] - 2026-04-19

### Added
- Hierarchical breadcrumb support with specific titles for machine and settings sections.
- Configured `breadcrumb_title` for "Управление на Механизация" and "Настройки на Обекти".

[0.1.0] - 2026-04-19

### Added
- Initial setup of the Objects module.
- Version tracking initialized at 0.1.0.
- Core features for managing project objects, machines, and schedules.
