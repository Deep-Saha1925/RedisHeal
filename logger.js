
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectDirectory = path.dirname(currentFile);

const logDirectory = path.join(projectDirectory, 'logs');
const logFile = path.join(logDirectory, 'redisheal.log');

// Create the logs folder automatically if it doesn't exist.
fs.mkdirSync(logDirectory, { recursive: true });

export function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();

    const logEntry = `[${timestamp}] [${level}] ${message}`;

    console.log(logEntry);

    fs.appendFileSync(logFile, logEntry + '\n', 'utf8');
}

export function logState(previousState, nextState, reason) {
    log(
        `STATE ${previousState} -> ${nextState} | ${reason}`,
        'STATE'
    );
}

export function logError(message) {
    log(message, 'ERROR');
}
