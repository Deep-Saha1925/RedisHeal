
import { execFile } from 'node:child_process';

import { log, logError } from './logger.js';

import {
    recordRecoveryAttempt,
    recordDockerRestartResult
} from './stats.js';

const CONTAINER_NAME = 'redisheal-redis';
const COOLDOWN_MS = 30000;

let recoveryInProgress = false;
let lastRecoveryTime = 0;

function runDockerCommand(args) {
    return new Promise((resolve, reject) => {
        execFile(
            'docker',
            args,
            { timeout: 15000 },
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr.trim() || error.message));
                    return;
                }

                resolve(stdout.trim());
            }
        );
    });
}

export async function recoverRedis() {
    if (recoveryInProgress) {
        log('Recovery already in progress. Skipping.');
        return false;
    }

    const now = Date.now();

    if (now - lastRecoveryTime < COOLDOWN_MS) {
        log('Recovery cooldown active. Skipping restart.');
        return false;
    }

    recoveryInProgress = true;
    lastRecoveryTime = now;

    recordRecoveryAttempt();

    try {
        log(`Restarting Docker container: ${CONTAINER_NAME}`, 'RECOVERY');

        const output = await runDockerCommand([
            'restart',
            CONTAINER_NAME
        ]);

        recordDockerRestartResult(true, output);

        log(`Docker restart command completed: ${output}`, 'RECOVERY');
        log('Waiting for monitor to verify Redis health.', 'RECOVERY');

        return true;
    } catch (error) {
        recordDockerRestartResult(false, error.message);

        logError(`Redis recovery failed: ${error.message}`);

        return false;
    } finally {
        recoveryInProgress = false;
    }
}