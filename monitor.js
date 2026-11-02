
import net from 'node:net';

const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;

const CHECK_INTERVAL = 3000;
const FAILURE_THRESHOLD = 3;
const RECOVERY_THRESHOLD = 2;

let consecutiveFailures = 0;
let consecutiveSuccesses = 0;

let currentState = 'HEALTHY';

// will implement the monitoring logic.

function recordSuccess() {

    consecutiveFailures = 0;
    consecutiveSuccesses++;

    if (
        currentState === 'UNHEALTHY' &&
        consecutiveSuccesses >= RECOVERY_THRESHOLD
    ) {
        currentState = 'HEALTHY';
        console.log('Redis recovered! State: HEALTHY');
    } 
    else if (currentState === 'SUSPECT') {
        currentState = 'HEALTHY';
        console.log('Redis is responding again. State: HEALTHY');
    }

    console.log(`Success count: ${consecutiveSuccesses}`);
}