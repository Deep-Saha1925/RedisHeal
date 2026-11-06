
import net from 'node:net';
import { performance } from 'node:perf_hooks';

import { recoverRedis } from './recovery.js';
import { log, logState } from './logger.js';

import {
    recordCheck,
    recordIncident,
    recordSuccessfulRecovery
} from './stats.js';

const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;

const CHECK_INTERVAL_MS = 3000;
const CHECK_TIMEOUT_MS = 2000;

const FAILURE_THRESHOLD = 3;
const RECOVERY_THRESHOLD = 2;

const STATES = Object.freeze({
    HEALTHY: 'HEALTHY',
    SUSPECT: 'SUSPECT',
    UNHEALTHY: 'UNHEALTHY',
    RECOVERING: 'RECOVERING'
});

let currentState = STATES.HEALTHY;
let consecutiveFailures = 0;
let consecutiveSuccesses = 0;
let checkInProgress = false;
let shuttingDown = false;
let intervalId;

function transitionTo(nextState, reason) {
    if (currentState === nextState) return;

    const previousState = currentState;
    currentState = nextState;

    logState(previousState, nextState, reason);

    if (nextState === STATES.UNHEALTHY) {
        recordIncident(reason);
        log('Automatic recovery triggered.', 'RECOVERY');
        void recoverRedis();
    }

    if (
        nextState === STATES.HEALTHY &&
        previousState === STATES.RECOVERING
    ) {
        recordSuccessfulRecovery();
        log('Redis recovery verified successfully.', 'RECOVERY');
    }
}

function recordSuccess(latencyMs) {
    consecutiveFailures = 0;
    consecutiveSuccesses++;

    if (currentState === STATES.UNHEALTHY) {
        transitionTo(
            STATES.RECOVERING,
            'Redis responded; verifying recovery'
        );
        return;
    }

    if (currentState === STATES.RECOVERING) {
        if (consecutiveSuccesses >= RECOVERY_THRESHOLD) {
            transitionTo(
                STATES.HEALTHY,
                `${consecutiveSuccesses} consecutive successful checks`
            );
        } else {
            log(
                `Recovery verification: ${consecutiveSuccesses}/${RECOVERY_THRESHOLD}`,
                'RECOVERY'
            );
        }
        return;
    }

    if (currentState === STATES.SUSPECT) {
        transitionTo(STATES.HEALTHY, 'Redis responded successfully again');
    }

    log(`Redis PONG | ${latencyMs.toFixed(2)} ms`);
}

function recordFailure(reason) {
    consecutiveSuccesses = 0;
    consecutiveFailures++;

    if (currentState === STATES.UNHEALTHY) {
        log(`Redis remains unhealthy: ${reason}`, 'WARNING');

        // The recovery module enforces a 30-second cooldown.
        void recoverRedis();
        return;
    }

    if (currentState === STATES.RECOVERING) {
        transitionTo(
            STATES.UNHEALTHY,
            `Recovery verification failed: ${reason}`
        );
        return;
    }

    if (consecutiveFailures >= FAILURE_THRESHOLD) {
        transitionTo(
            STATES.UNHEALTHY,
            `${consecutiveFailures} consecutive failures: ${reason}`
        );
        return;
    }

    transitionTo(
        STATES.SUSPECT,
        `Failure ${consecutiveFailures}/${FAILURE_THRESHOLD}: ${reason}`
    );
}

function checkRedis() {
    if (shuttingDown || checkInProgress) return;

    checkInProgress = true;

    const startedAt = performance.now();

    const socket = net.createConnection({
        host: REDIS_HOST,
        port: REDIS_PORT
    });

    let completed = false;

    function finish(success, reason = '') {
        if (completed) return;

        completed = true;
        socket.destroy();
        checkInProgress = false;

        const latencyMs = performance.now() - startedAt;

        recordCheck(success, latencyMs);

        if (success) {
            recordSuccess(latencyMs);
        } else {
            log(`Health check failed: ${reason}`, 'WARNING');
            recordFailure(reason);
        }
    }

    socket.setTimeout(CHECK_TIMEOUT_MS);

    socket.once('connect', () => {
        socket.write('PING\r\n');
    });

    socket.once('data', (data) => {
        const response = data.toString().trim();

        if (response === '+PONG') {
            finish(true);
        } else {
            finish(
                false,
                `Unexpected Redis response: ${JSON.stringify(response)}`
            );
        }
    });

    socket.once('timeout', () => {
        finish(false, `Timeout after ${CHECK_TIMEOUT_MS} ms`);
    });

    socket.once('error', (error) => {
        finish(
            false,
            `${error.code ?? 'SOCKET_ERROR'}: ${error.message}`
        );
    });
}

function shutdown() {
    if (shuttingDown) return;

    shuttingDown = true;
    clearInterval(intervalId);

    log('RedisHeal monitor shutting down.');
}

log('RedisHeal monitoring system started.');
log(`Target: ${REDIS_HOST}:${REDIS_PORT}`);
log(`Check interval: ${CHECK_INTERVAL_MS} ms`);
log(`Failure threshold: ${FAILURE_THRESHOLD}`);
log(`Recovery threshold: ${RECOVERY_THRESHOLD}`);

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

checkRedis();
intervalId = setInterval(checkRedis, CHECK_INTERVAL_MS);