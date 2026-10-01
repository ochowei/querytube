import express from 'express';
import app from './server/app.js';

// Reusable root Express entrypoint. Vercel uses api/index.ts with the Vite preset.
// The local and Cloud Run server lifecycle lives in server/dev.ts.
void express;

export default app;
export * from './server/app.js';
