import * as fs from 'fs';
import * as path from 'path';

// Load .env manualy since we are running a standalone script
const envPath = path.resolve(__dirname, '.env');
console.log('Loading .env from:', envPath);
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach((line: string) => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            if (key && val && !key.startsWith('#')) {
                process.env[key] = val;
            }
        }
    });
} else {
    console.error("No .env file found");
}

// Dynamic import to ensure process.env is set before module load
async function run() {
    try {
        const { logDevice } = await import('./lib/supabase');
        const uuid = 'debug-uuid-' + Math.floor(Math.random() * 10000);
        console.log('Invoking logDevice with', uuid);

        // We override console.error and warn to capture it because logDevice logs internally
        const originalConsoleError = console.error;
        console.error = (...args) => {
            console.log('CAPTURED ERROR:', ...args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a));
            originalConsoleError(...args);
        };
        const originalConsoleWarn = console.warn;
        console.warn = (...args) => {
            console.log('CAPTURED WARN:', ...args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a));
            originalConsoleWarn(...args);
        };

        const result = await logDevice(uuid);

        if (result) {
            console.log('Success:', result);
        } else {
            console.log('Result is null');
        }
    } catch (err) {
        console.error("Top level error:", err);
    }
}

run();
