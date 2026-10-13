/**
 * planning_globals.js
 * Shared state and configuration for the Machine Planning module.
 */

const PlanningState = {
    allActivitiesData: [],
    allMachinesData: [],
    currentMachineCapabilities: [],

    // For pre-selection persistence
    desiredActivityId: null,
    desiredCapabilityName: null,

    tagifyFromSite: null,
    tagifyToSite: null,
    tagifyMovementClient: null,
    tagifyMovementObject: null,
    tagifyMovementSchedule: null,
    tagifyMovementMachine: null,
    tagifySubtypeFilter: null,
    tagifyObjectName: null,
    tagifyObjectNameStandalone: null,
    tagifyEstimateMachine: null,
    movementOptions: null,
    tempActionData: { startDate: null, machineId: null },
    expandedUnplannedGroups: new Set()
};

const activityColorMap = {};
const BADGE_COLORS = ['#0d6efd', '#198754', '#6f42c1', '#dc3545', '#fd7e14', '#20c997', '#0dcaf0'];
let colorIndex = 0;
