import { execFile } from 'node:child_process';
import { log, logError } from './logger.js';

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
                    reject(
                        new Error(stderr.trim() || error.message)
                    );
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

    try {
        log(`Starting recovery for container: ${CONTAINER_NAME}`);

        const output = await runDockerCommand([
            'restart',
            CONTAINER_NAME
        ]);

        log(`Docker restart response: ${output}`);
        log('Restart command completed. Waiting for health checks.');

        return true;
    } catch (error) {
        logError(`Redis recovery failed: ${error.message}`);
        return false;
    } finally {
        recoveryInProgress = false;
    }
}