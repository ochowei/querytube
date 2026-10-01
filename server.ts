import express from 'express';
import app from './server/app.js';

// Vercel detects Express from this root entrypoint and invokes the exported app.
// The local and Cloud Run server lifecycle lives in server/dev.ts.
void express;

export default app;
export * from './server/app.js';
