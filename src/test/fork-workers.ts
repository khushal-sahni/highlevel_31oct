import { fork, ChildProcess } from 'child_process';
import { join } from 'path';

export async function runForkedSteps(): Promise<void> {
  const children = await Promise.all([forkOneStep(), forkOneStep()]);
  for (const child of children) {
    child.send({ go: true });
  }
  await Promise.all(children.map((child) => waitForExit(child)));
}

function forkOneStep(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    let ready = false;
    const child = fork(join(__dirname, '../workers/worker-one-step.ts'), [], {
      execArgv: ['-r', 'ts-node/register/transpile-only'],
      env: { ...process.env, DATABASE_POOL_MAX: '1', CHUNK_PAUSE_MS: '0' },
    });
    child.on('message', (message: unknown) => {
      if (ready || !isReady(message)) {
        return;
      }
      ready = true;
      resolve(child);
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (!ready) {
        reject(new Error(`one-step worker exited ${code}`));
      }
    });
  });
}

function isReady(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  return 'ready' in message;
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`one-step worker exited ${code}`));
    });
  });
}
