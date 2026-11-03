
import net from 'node:net';

const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;

const CHECK_INTERVAL = 3000;
const FAILURE_THRESHOLD = 3;
const RECOVERY_THRESHOLD = 2;

let consecutiveFailures = 0;
let consecutiveSuccesses = 0;

let currentState = 'HEALTHY';
let checkInProgress = false;

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

function recordFailure() {

    consecutiveSuccesses = 0;
    consecutiveFailures++;

    if (consecutiveFailures >= FAILURE_THRESHOLD) {

        currentState = 'UNHEALTHY';

        console.log('Redis is UNHEALTHY!');
        console.log('Recovery may be required.');

    } 
    else {

        currentState = 'SUSPECT';

        console.log(`Redis is SUSPECT. Failures: ${consecutiveFailures}`);
    }
}


function checkRedis() {

    const socket = net.createConnection({
        host: REDIS_HOST,
        port: REDIS_PORT
    });

    let completed = false;

    function finish(success) {

        if (completed) return;
        completed = true;

        if (success) {
            recordSuccess();
        } else {
            recordFailure();
        }

        socket.destroy();
    }

    socket.setTimeout(2000);

    socket.on('connect', () => {
        socket.write('PING\r\n');
    });

    socket.on('data', (data) => {

        const response = data.toString().trim();

        if (response === '+PONG') {
            finish(true);
        } else {
            finish(false);
        }
    });

    socket.on('timeout', () => {
        console.log('Redis connection timed out');
        finish(false);
    });

    socket.on('error', (err) => {
        console.log(`Redis connection error: ${err.message}`);
        finish(false);
    });
}

console.log('RedisHeal monitoring started...');

checkRedis();

setInterval(() => {
    checkRedis();
}, CHECK_INTERVAL);