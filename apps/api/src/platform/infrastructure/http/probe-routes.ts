import { HEALTH_PING_ROUTE } from "@workspace/shared";

/**
 * Paths of the automated health probes (HealthController). Load balancers,
 * orchestrators and uptime monitors call them every few seconds with no
 * principal, and every open app times `GET /health/ping` once a minute to show
 * the connection's quality — so they are the one exemption from the global
 * HTTP audit trail (docs/adr/025-global-http-audit-log.md): auditing them would
 * bury every human action under probe noise. `GET /health/deep` (human
 * diagnostics) and `GET /` stay audited.
 */
export const HEALTH_PROBE_PATHS = {
	liveness: "health/live",
	readiness: "health/ready",
	/** The apps' connection-quality probe (packages/shared lib/network-quality). */
	ping: HEALTH_PING_ROUTE,
	/** Deprecated alias kept for existing uptime monitors. */
	legacy: "health",
} satisfies Record<string, string>;

/** The probe routes as Fastify reports their templates (`request.routeOptions.url`). */
export const UNAUDITED_PROBE_ROUTES: ReadonlySet<string> = new Set<string>(Object.values(HEALTH_PROBE_PATHS).map((path: string): string => `/${path}`));
