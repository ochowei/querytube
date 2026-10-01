export type IdTokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

export class AuthenticatedFetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AuthenticatedFetchError';
  }
}

/** Fetch an API resource with one bounded Firebase token refresh on 401. */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  getIdToken: IdTokenProvider,
  onSessionExpired: () => void
): Promise<Response> {
  const send = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const token = await getIdToken();
  if (!token) {
    throw new AuthenticatedFetchError('Unable to obtain a Firebase ID token.');
  }

  const firstResponse = await send(token);
  if (firstResponse.status !== 401) return firstResponse;

  const refreshedToken = await getIdToken(true);
  if (!refreshedToken) {
    throw new AuthenticatedFetchError('Unable to refresh the Firebase ID token.', 401);
  }

  const retryResponse = await send(refreshedToken);
  if (retryResponse.status === 401) {
    onSessionExpired();
    throw new AuthenticatedFetchError('Your session has expired. Please sign in again.', 401);
  }

  return retryResponse;
}
