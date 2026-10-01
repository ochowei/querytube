import { Router, Request, Response } from 'express';
import { FirestoreService } from './firestoreService.js';

// Simple in-memory sliding window rate limiter (100 req/min per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;

function publicApiRateLimiter(req: Request, res: Response, next: () => void): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    });
    return;
  }

  record.count++;
  next();
}

export function createPublicApiRouter(firestoreService: FirestoreService): Router {
  const router = Router();

  // Apply rate limiter to all public API endpoints
  router.use(publicApiRateLimiter);

  /**
   * GET /api/public/users/:userId/query-sets
   * List public Query Sets for a specific user
   */
  router.get('/users/:userId/query-sets', async (req: Request, res: Response) => {
    const { userId } = req.params;
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid userId parameter' });
      return;
    }

    try {
      const items = await firestoreService.getPublicQuerySets(userId);
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve query sets' });
    }
  });

  /**
   * GET /api/public/users/:userId/query-sets/:querySetId
   * Get single public Query Set
   */
  router.get('/users/:userId/query-sets/:querySetId', async (req: Request, res: Response) => {
    const { userId, querySetId } = req.params;
    if (!userId || !querySetId) {
      res.status(400).json({ error: 'Bad Request', message: 'Missing required parameters' });
      return;
    }

    try {
      const querySet = await firestoreService.getPublicQuerySet(userId, querySetId);
      if (!querySet) {
        res.status(404).json({ error: 'Not Found', message: 'Query set not found or not public' });
        return;
      }

      res.json(querySet);
    } catch (err: any) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve query set' });
    }
  });

  /**
   * GET /api/public/users/:userId/search-runs
   * List public search runs for a user (optionally filtered by querySetId)
   * Independent from Query Set visibility
   */
  router.get('/users/:userId/search-runs', async (req: Request, res: Response) => {
    const { userId } = req.params;
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid userId parameter' });
      return;
    }

    const limitQuery = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const limit = isNaN(limitQuery) ? 50 : Math.max(1, Math.min(100, limitQuery));
    const querySetId = typeof req.query.querySetId === 'string' && req.query.querySetId.trim()
      ? req.query.querySetId.trim()
      : undefined;

    try {
      const runs = await firestoreService.getPublicSearchRuns(userId, querySetId, limit);
      res.json({ items: runs });
    } catch (err: any) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve search runs' });
    }
  });

  /**
   * GET /api/public/users/:userId/search-runs/:runId
   * Get search run details for a public Search Run
   * Independent from Query Set visibility
   */
  router.get('/users/:userId/search-runs/:runId', async (req: Request, res: Response) => {
    const { userId, runId } = req.params;
    if (!userId || !runId) {
      res.status(400).json({ error: 'Bad Request', message: 'Missing required parameters' });
      return;
    }

    try {
      const runDetails = await firestoreService.getPublicSearchRunDetails(userId, runId);
      if (!runDetails) {
        res.status(404).json({ error: 'Not Found', message: 'Search run not found or not public' });
        return;
      }

      res.json(runDetails);
    } catch (err: any) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve search run details' });
    }
  });

  /**
   * GET /api/public/users/:userId/query-sets/:querySetId/search-runs
   * Backward-compatible convenience endpoint equivalent to /api/public/users/:userId/search-runs?querySetId=:querySetId
   */
  router.get('/users/:userId/query-sets/:querySetId/search-runs', async (req: Request, res: Response) => {
    const { userId, querySetId } = req.params;
    if (!userId || !querySetId) {
      res.status(400).json({ error: 'Bad Request', message: 'Missing required parameters' });
      return;
    }

    const limitQuery = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const limit = isNaN(limitQuery) ? 50 : Math.max(1, Math.min(100, limitQuery));

    try {
      const runs = await firestoreService.getPublicSearchRuns(userId, querySetId, limit);
      res.json({ items: runs });
    } catch (err: any) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve search runs' });
    }
  });

  return router;
}
