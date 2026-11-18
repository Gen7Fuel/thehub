const ROLES = new Set(['api', 'worker', 'scheduler', 'all']);

function getRole() {
  const role = process.env.HUB_PROCESS_ROLE || 'all';
  if (!ROLES.has(role)) throw new Error('Invalid HUB_PROCESS_ROLE');
  return role;
}
function selectRole(role) {
  if (!ROLES.has(role) || (process.env.HUB_PROCESS_ROLE && getRole() !== role)) {
    throw new Error('Entry point conflicts with HUB_PROCESS_ROLE');
  }
  process.env.HUB_PROCESS_ROLE = role;
}
const runsWorkers = () => ['worker', 'all'].includes(getRole());
const runsSchedules = () => ['scheduler', 'all'].includes(getRole());
module.exports = { getRole, selectRole, runsWorkers, runsSchedules };
