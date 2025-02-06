#!/usr/bin/env node

/**
 * Cross-platform Docker test runner
 * Automatically detects OS and runs appropriate script
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'help';

// Determine which script to run based on OS
const isWindows = os.platform() === 'win32';
const scriptName = isWindows ? 'test-docker.bat' : 'test-docker.sh';
const scriptPath = path.join(__dirname, scriptName);

// Build command based on OS
let cmd, cmdArgs;
if (isWindows) {
    // On Windows, run the batch file directly
    cmd = scriptPath;
    cmdArgs = args;
} else {
    // On Unix-like systems, ensure script is executable and run with sh
    cmd = 'sh';
    cmdArgs = [scriptPath, ...args];
}

console.log(`Running Docker tests on ${os.platform()}...`);
console.log(`Command: ${cmd} ${cmdArgs.join(' ')}`);

// Spawn the process
const child = spawn(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: isWindows,
    cwd: path.join(__dirname, '..')
});

// Handle process exit
child.on('exit', (code) => {
    process.exit(code);
});

// Handle errors
child.on('error', (err) => {
    console.error('Failed to run Docker tests:', err);
    process.exit(1);
});