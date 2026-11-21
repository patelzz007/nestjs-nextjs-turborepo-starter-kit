/**
 * Headers on every pre-render request: one connection per page, never a reused one.
 *
 * Pre-rendering fetches each page from a Vite preview server running in the same process, so the two share one event
 * loop. The server closes a connection that sits idle for its keep-alive timeout (5 s). When a page render holds the
 * loop past that (the first page builds the whole content store, and CI builds the other apps alongside), the client
 * can send its next request down an idle connection just before the server's overdue timer closes it. The request
 * then dies with `fetch failed` (`read ECONNRESET`) and fails the build. With no idle connection left to reuse, that
 * cannot happen.
 */
export const PRERENDER_REQUEST_HEADERS: Readonly<Record<string, string>> = { connection: "close" };
