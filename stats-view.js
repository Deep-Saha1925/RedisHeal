
import { getStats } from './stats.js';

const stats = getStats();

console.log('\n========== REDISHEAL STATISTICS ==========\n');

console.log(`Total health checks:          ${stats.totalChecks}`);
console.log(`Successful checks:            ${stats.successfulChecks}`);
console.log(`Failed checks:                ${stats.failedChecks}`);

console.log(`Average response latency:     ${stats.averageLatencyMs} ms`);

console.log(`Recovery attempts:             ${stats.recoveryAttempts}`);
console.log(`Docker restart successes:      ${stats.dockerRestartCommandsSucceeded}`);
console.log(`Docker restart failures:       ${stats.dockerRestartCommandsFailed}`);

console.log(`Verified Redis recoveries:     ${stats.successfulRecoveries}`);

console.log('\nLast incident:');
console.log(stats.lastIncident ?? 'No incidents recorded');

console.log('\nLast recovery:');
console.log(stats.lastRecovery ?? 'No recovery attempts recorded');

console.log('\n==========================================\n');