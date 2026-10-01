import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendOutputDirectory = path.join(repositoryRoot, 'public');
const port = Number(process.env.PORT || process.env.DEV_PORT || 3000);

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(frontendOutputDirectory));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendOutputDirectory, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on 0.0.0.0:${port}`);
  });
}

void startServer().catch((error: unknown) => {
  console.error('Failed to start the development server.', error);
  process.exitCode = 1;
});
