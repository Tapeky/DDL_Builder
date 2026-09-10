import { spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const commands = [
  ['docker', ['compose', 'up', '-d', '--wait']],
  [pnpm, ['db:generate']],
  [pnpm, ['db:migrate']],
  [pnpm, ['data:sync']],
  [pnpm, ['dev']],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });

  if (result.error) {
    console.error(`Impossible d'exécuter ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
