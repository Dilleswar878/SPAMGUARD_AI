import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const FLASK_PORT = Number(process.env.FLASK_PORT || 5001);
const FLASK_BACKEND_URL =
  process.env.FLASK_BACKEND_URL || `http://127.0.0.1:${FLASK_PORT}`;

let flaskProcess: ChildProcess | null = null;

function resolvePythonExecutable(): string {
  const venvPython = path.join(__dirname, 'backend', '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return 'python3';
}

function startFlaskBackend(): void {
  if (process.env.DISABLE_AUTO_FLASK === 'true') {
    return;
  }
  const backendDir = path.join(__dirname, 'backend');
  const appScript = path.join(backendDir, 'app.py');
  if (!fs.existsSync(appScript)) {
    console.warn('[server] backend/app.py not found; skipping auto-spawn.');
    return;
  }

  const pythonBin = resolvePythonExecutable();
  console.log(`[server] Starting Flask ML backend via ${pythonBin} on port ${FLASK_PORT}...`);

  flaskProcess = spawn(pythonBin, [appScript], {
    cwd: backendDir,
    env: {
      ...process.env,
      FLASK_PORT: String(FLASK_PORT),
      FLASK_HOST: '127.0.0.1',
      FLASK_DEBUG: 'false',
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  flaskProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[flask] ${chunk}`);
  });
  flaskProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[flask] ${chunk}`);
  });
  flaskProcess.on('exit', (code) => {
    console.log(`[server] Flask process exited with code ${code}`);
    flaskProcess = null;
  });
}

function shutdown(): void {
  if (flaskProcess && !flaskProcess.killed) {
    flaskProcess.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function createServer() {
  startFlaskBackend();

  const app = express();

  // Reverse-proxy all /api/* requests directly to the Python Flask backend
  app.use('/api', (req, res) => {
    const targetUrl = new URL(req.originalUrl, FLASK_BACKEND_URL);
    const headers: http.OutgoingHttpHeaders = { ...req.headers };
    delete headers.host;

    const proxyReq = http.request(
      targetUrl,
      {
        method: req.method,
        headers,
        timeout: 60000,
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 502);
        Object.entries(proxyRes.headers).forEach(([key, val]) => {
          if (val !== undefined) {
            res.setHeader(key, val);
          }
        });
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Flask backend request timed out.',
          backend_unreachable: true,
        });
      }
    });

    proxyReq.on('error', () => {
      if (!res.headersSent) {
        res.status(503).json({
          error:
            'Flask ML backend is not reachable. Ensure Python Flask server is running on port ' +
            FLASK_PORT +
            '.',
          backend_unreachable: true,
        });
      }
    });

    req.pipe(proxyReq);
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] SpamGuard AI running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
