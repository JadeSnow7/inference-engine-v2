import { spawn } from 'child_process';
import { resolve } from 'path';

const frontendDir = resolve('./frontend');
const previewUrl = 'http://127.0.0.1:4173';

function runCommand(label, command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    console.log(label);
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: options.stdio ?? 'inherit',
      env: { ...process.env, ...(options.env ?? {}) },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${label} failed with code ${code}`));
    });
  });
}

async function waitForPreview(url) {
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 500));
  }

  throw new Error(`Preview server did not become ready: ${lastError?.message ?? 'timeout'}`);
}

async function run() {
  await runCommand('Building production frontend...', 'npm', ['run', 'build'], {
    cwd: frontendDir,
  });

  console.log('Starting production preview server...');
  const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: frontendDir,
    stdio: 'inherit'
  });

  try {
    await waitForPreview(previewUrl);

    await runCommand('Running audit_screenshots...', 'node', ['scripts/audit_screenshots.mjs'], {
      stdio: 'inherit',
      env: { AUDIT_APP_URL: previewUrl },
    });

    console.log('audit finished with code 0');
  } finally {
    preview.kill();
  }
}
run().catch(error => {
  console.error(error);
  process.exit(1);
});
