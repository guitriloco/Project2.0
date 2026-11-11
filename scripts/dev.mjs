import { spawn } from 'node:child_process'

const root = new URL('..', import.meta.url).pathname
const processes = [
  spawn('npm', ['run', 'dev'], {
    cwd: `${root}/frontend`,
    env: { ...process.env, PORT: '3000', HOSTNAME: '0.0.0.0', XEREBRO_BACKEND_URL: process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001' },
    stdio: 'inherit',
  }),
  spawn('npx', ['tsx', 'src/app.ts'], {
    cwd: `${root}/backend`,
    env: { ...process.env, PORT: process.env.BACKEND_PORT ?? '3001', HOST: '0.0.0.0' },
    stdio: 'inherit',
  }),
]

function shutdown(signal) {
  for (const child of processes) child.kill(signal)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
for (const child of processes) child.on('exit', (code) => {
  if (code && code !== 130) process.exitCode = code
})
