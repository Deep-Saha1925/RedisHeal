
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectDirectory = path.dirname(currentFile);

const statsDirectory = path.join(projectDirectory, 'data');
const statsFile = path.join(statsDirectory, 'stats.json');

fs.mkdirSync(statsDirectory, { recursive: true });

const defaultStats = {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    totalLatencyMs: 0,
    recoveryAttempts: 0,
    dockerRestartCommandsSucceeded: 0,
    dockerRestartCommandsFailed: 0,
    successfulRecoveries: 0,
    lastIncident: null,
    lastRecovery: null
};

function loadStats() {
    try {
        if (fs.existsSync(statsFile)) {
            return {
                ...defaultStats,
                ...JSON.parse(fs.readFileSync(statsFile, 'utf8'))
            };
        }
    } catch (error) {
        console.error('Could not read statistics:', error.message);
    }

    return { ...defaultStats };
}

let stats = loadStats();

function saveStats() {
    const temporaryFile = `${statsFile}.tmp`;

    fs.writeFileSync(
        temporaryFile,
        JSON.stringify(stats, null, 2),
        'utf8'
    );

    fs.renameSync(temporaryFile, statsFile);
}

export function recordCheck(success, latencyMs) {
    stats.totalChecks++;
    stats.totalLatencyMs += latencyMs;

    if (success) {
        stats.successfulChecks++;
    } else {
        stats.failedChecks++;
    }

    saveStats();
}

export function recordIncident(reason) {
    stats.lastIncident = {
        time: new Date().toISOString(),
        reason
    };

    saveStats();
}

export function recordRecoveryAttempt() {
    stats.recoveryAttempts++;

    stats.lastRecovery = {
        time: new Date().toISOString(),
        result: 'IN_PROGRESS'
    };

    saveStats();
}

export function recordDockerRestartResult(success, details = '') {
    if (success) {
        stats.dockerRestartCommandsSucceeded++;
    } else {
        stats.dockerRestartCommandsFailed++;
    }

    stats.lastRecovery = {
        time: new Date().toISOString(),
        result: success ? 'RESTART_COMMAND_SUCCEEDED' : 'RESTART_COMMAND_FAILED',
        details
    };

    saveStats();
}

export function recordSuccessfulRecovery() {
    stats.successfulRecoveries++;

    stats.lastRecovery = {
        time: new Date().toISOString(),
        result: 'HEALTHY'
    };

    saveStats();
}

export function getStats() {
    const averageLatency = stats.totalChecks === 0
        ? 0
        : stats.totalLatencyMs / stats.totalChecks;

    return {
        ...stats,
        averageLatencyMs: Number(averageLatency.toFixed(2))
    };
}
