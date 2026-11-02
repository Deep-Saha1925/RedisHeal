
import net from 'node:net';

const startTime = performance.now();

const socket = net.createConnection({
    host: '127.0.0.1',
    port: 6379
});

socket.setTimeout(2000);

socket.on('connect', () => {
    console.log('Connected to Redis');
    socket.write('PING\r\n');
});

socket.on('data', (data) => {
    const response = data.toString().trim();
    const latency = (performance.now() - startTime).toFixed(2);

    if (response === '+PONG') {
        console.log(`HEALTHY | Response: PONG | Latency: ${latency} ms`);
    } else {
        console.log(`UNEXPECTED RESPONSE: ${response}`);
        process.exitCode = 1;
    }

    socket.end();
});

socket.on('timeout', () => {
    console.log('UNHEALTHY | Redis health check timed out');
    process.exitCode = 1;
    socket.destroy();
});

socket.on('error', (err) => {
    console.log(`UNHEALTHY | ${err.message}`);
    process.exitCode = 1;
});
