import net from 'node:net';
import { performance } from 'node:perf_hooks';

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

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

function transitionTo(nextState, reason) {
    if (currentState === nextState) {
        return;
    }

    const previousState = currentState;
    currentState = nextState;

    log(`STATE ${previousState} -> ${nextState} | ${reason}`);
}

function recordSuccess(latencyMs) {
    consecutiveFailures = 0;
    consecutiveSuccesses += 1;

    if (currentState === STATES.UNHEALTHY) {
        transitionTo(
            STATES.RECOVERING,
            'Redis responded successfully; verifying recovery'
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
                `RECOVERING | success ${consecutiveSuccesses}/${RECOVERY_THRESHOLD}`
            );
        }

        return;
    }

    if (currentState === STATES.SUSPECT) {
        transitionTo(
            STATES.HEALTHY,
            'Redis responded successfully again'
        );
    }

    log(`HEALTHY | PONG | ${latencyMs.toFixed(2)} ms`);
}

function recordFailure(reason) {
    consecutiveSuccesses = 0;
    consecutiveFailures += 1;

    if (consecutiveFailures >= FAILURE_THRESHOLD) {
        transitionTo(
            STATES.UNHEALTHY,
            `${consecutiveFailures} consecutive failures; latest: ${reason}`
        );

        return;
    }

    if (currentState === STATES.RECOVERING) {
        transitionTo(
            STATES.UNHEALTHY,
            `Recovery verification failed: ${reason}`
        );

        return;
    }

    if (currentState !== STATES.UNHEALTHY) {
        transitionTo(
            STATES.SUSPECT,
            `failure ${consecutiveFailures}/${FAILURE_THRESHOLD}: ${reason}`
        );
    }
}

function checkRedis() {
    // Do not start another check if one is already running.
    if (shuttingDown || checkInProgress) {
        return;
    }

    checkInProgress = true;

    const startedAt = performance.now();

    const socket = net.createConnection({
        host: REDIS_HOST,
        port: REDIS_PORT
    });

    let completed = false;

    function finish(success, reason = '') {
        // Prevent multiple events from counting as multiple checks.
        if (completed) {
            return;
        }

        completed = true;

        socket.destroy();
        checkInProgress = false;

        const latencyMs = performance.now() - startedAt;

        if (success) {
            recordSuccess(latencyMs);
        } else {
            log(`CHECK FAILED | ${reason}`);
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
                `unexpected Redis response: ${JSON.stringify(response)}`
            );
        }
    });

    socket.once('timeout', () => {
        finish(false, `timeout after ${CHECK_TIMEOUT_MS} ms`);
    });

    socket.once('error', (error) => {
        finish(
            false,
            `${error.code ?? 'SOCKET_ERROR'}: ${error.message}`
        );
    });
}

function shutdown() {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    clearInterval(intervalId);

    log('Shutdown requested; stopping new health checks.');
}

log(`RedisHeal monitor starting for ${REDIS_HOST}:${REDIS_PORT}`);

log(
    `Interval=${CHECK_INTERVAL_MS}ms, ` +
    `timeout=${CHECK_TIMEOUT_MS}ms, ` +
    `failure threshold=${FAILURE_THRESHOLD}, ` +
    `recovery threshold=${RECOVERY_THRESHOLD}`
);

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

// Run the first health check immediately.
checkRedis();

// Continue checking Redis every 3 seconds.
intervalId = setInterval(checkRedis, CHECK_INTERVAL_MS);