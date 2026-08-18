import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCompress from "@fastify/compress";
import fastifyEtag from "@fastify/etag";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyRequestContext from "@fastify/request-context";
import fastifyUnderPressure from "@fastify/under-pressure";
import { nanoid } from "nanoid";
import type { FastifyReply, FastifyRequest } from "fastify";
import { API_DEPRECATED_VERSIONS, API_VERSION, API_VERSION_PREFIX, apiDocsPath, apiVersionPrefix, type ApiVersion } from "@workspace/shared";

import { AppModule } from "./app.module";
import { setupApiDocs } from "./common/api-docs";
import { LogService } from "./modules/logs/logs.service";
import { VersionController } from "./modules/health/version.controller";

/** The subset of the Fastify instance surface the bootstrap needs. */
interface FastifyBootstrapHooks {
	readonly addHook: {
		(name: "onRequest" | "onResponse", fn: (request: FastifyRequest, reply: FastifyReply, done: () => void) => void): void;
		(name: "preHandler", fn: (request: FastifyRequest & { raw: { correlationId?: string; traceId?: string } }, reply: FastifyReply, done: () => void) => void): void;
		(
			name: "onSend",
			fn: (request: FastifyRequest, reply: FastifyReply, payload: string | Buffer | null, done: (error: Error | null, payload?: string | Buffer | null) => void) => void,
		): void;
		(name: "onError", fn: (request: FastifyRequest, reply: FastifyReply, error: Error, done: () => void) => void): void;
		(name: "onRoute", fn: (routeOptions: FastifyRouteOptions) => void): void;
	};
}

interface FastifyRouteOptions {
	readonly url?: string;
	config?: Record<string, unknown>;
}

/** Extract the version segment of a versioned URL (`"/api/v1/foo"` → `"v1"`). */
function apiVersionOfUrl(url: string): string | undefined {
	const match: RegExpExecArray | null = /\/api\/(v\d+)\//.exec(url);
	return match?.[1];
}

async function bootstrap(): Promise<void> {
	// rawBody: true — the Resend webhook controller reads `req.rawBody` so the
	// signature check covers the exact bytes Resend sent (the JSON body parser
	// would otherwise re-encode whitespace and break verification).
	//
	// Adapter options (Fastify-native improvements):
	//  - `exposeHeadRoutes` — HEAD routes for every GET (cheap uptime probes).
	//  - `trustProxy` — behind cloudflared/nginx the socket address is the
	//    tunnel, not the client; trusting X-Forwarded-For gives real client IPs
	//    to rate limiting + audit logs (cloudflared only forwards what the
	//    Cloudflare edge set, so it's not spoofable through the tunnel).
	//  - `keepAliveTimeout` — detect dead keep-alive sockets faster than Node's
	//    default (which sits just below common LB idle timeouts).
	//  - `bodyLimit` — 1 MiB cap per request.
	//  - `logger` — pino with redaction so secrets never reach logs.
	const adapter = new FastifyAdapter({
		bodyLimit: 1024 * 1024,
		exposeHeadRoutes: true,
		trustProxy: process.env.TRUST_PROXY === "1",
		keepAliveTimeout: 65_000,
		logger: {
			level: process.env.LOG_LEVEL ?? "warn",
			redact: {
				paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
				censor: "[REDACTED]",
			},
		},
		genReqId: (req: { readonly headers?: Readonly<Record<string, string | string[] | undefined>> }): string => {
			const header: string | string[] | undefined = req.headers?.["x-request-id"] ?? req.headers?.["x-correlation-id"];
			if (typeof header === "string" && header.length > 0) {
				return header;
			}
			return nanoid();
		},
	});

	const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { rawBody: true });

	app.enableShutdownHooks();

	// ── API versioning (explicit paths — see @workspace/shared apiPath) ────
	// Every business controller builds its physical path with `apiPath()` from
	// `@workspace/shared` (e.g. `@Controller(apiPath("/auth"))` → `/api/v1/auth`),
	// and the client transport prepends the SAME `API_VERSION_PREFIX` constant.
	// No Nest `enableVersioning` machinery — no `VERSION_NEUTRAL` workarounds.
	// `GET /` + `GET /health` + the Resend webhook stay unversioned by not
	// using `apiPath()`.

	// ── Config from env (see apps/api/.env) ────────────────────────
	const port = Number(process.env.PORT ?? "8080") || 8080;
	const corsOrigins: string[] = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001")
		.split(",")
		.map((origin: string): string => origin.trim())
		.filter((origin: string): boolean => origin.length > 0);

	// ── Plugins ────────────────────────────────────────────────────
	// @fastify/cookie decorates `request.cookies` + adds `reply.setCookie`.
	await app.register(fastifyCookie);

	// @fastify/request-context — AsyncLocalStorage-backed per-request context.
	// The correlation/trace ids are mirrored onto it in preHandler below so ANY
	// code spawned during a request (async jobs, loggers, the telescope capture
	// pipeline) can read them without threading the request object around.
	await app.register(fastifyRequestContext, { hook: "preHandler" });

	// @fastify/compress — gzip/brotli on JSON responses (Nest's compression
	// middleware is Express-only, so nothing compressed the API before).
	await app.register(fastifyCompress, { global: true, threshold: 1024 });

	// @fastify/etag — ETag/If-None-Match support for idempotent GETs.
	await app.register(fastifyEtag, { weak: true });

	// @fastify/rate-limit — per-IP defense in depth. A generous global ceiling
	// for every route; the webhook gets a much tighter cap via onRoute below.
	// The key includes the API version so a v2 canary is never starved by v1
	// traffic (and vice versa) while both are live during a migration. The
	// `Accept-version` rewrite hook (registered BELOW) runs after this plugin's
	// onRequest hook, so a legacy client's requested version is read from the
	// header directly here — the bucket always keys on the version actually
	// served, regardless of hook ordering.
	await app.register(fastifyRateLimit, {
		global: true,
		max: 300,
		timeWindow: "1 minute",
		keyGenerator: (request: FastifyRequest): string => {
			const acceptVersion: unknown = request.headers["accept-version"];
			const requested: ApiVersion | undefined = typeof acceptVersion === "string" && acceptVersion.length > 0 ? VersionController.toApiVersion(acceptVersion) : undefined;
			const version: string = requested ?? apiVersionOfUrl(request.url) ?? "unversioned";
			// `request.ip` is always a string on Fastify (socket or forwarded).
			return `${request.ip}:${version}`;
		},
		errorResponseBuilder: (
			_request: FastifyRequest,
			context: { readonly statusCode: number; readonly after: string },
		): {
			readonly statusCode: number;
			readonly error: string;
			readonly message: string;
		} => ({
			statusCode: context.statusCode,
			error: "Too Many Requests",
			message: `Rate limit exceeded — retry after ${context.after}.`,
		}),
	});

	// @fastify/under-pressure — event-loop-delay + heap only. Do NOT call
	// Prisma here: this plugin runs healthCheck during `register()` and waits
	// until it resolves. A hung DB connect (pg default timeout is infinite)
	// then surfaces as `AVV_ERR_PLUGIN_EXEC_TIMEOUT` for this plugin.
	// Postgres liveness stays on `GET /health`.
	await app.register(fastifyUnderPressure, {
		maxEventLoopDelay: 1000,
		maxHeapUsedBytes: 512 * 1024 * 1024,
	});

	// CORS (plugins must be registered before the routes they affect).
	app.enableCors({
		origin: corsOrigins,
		credentials: true,
		// `Last-Event-ID` is required for SSE replay reconnects: the Telescope
		// stream client sends it (fetch-based SSE) to resume from the last
		// received seq. It is not a CORS-safelisted header, so without it here
		// every reconnect preflight is rejected.
		allowedHeaders: ["Content-Type", "X-Client-Type", "Accept", "Last-Event-ID"],
	});

	// ── Security headers ─────────────────────────────────────────
	// @fastify/helmet (helmet v8 on Fastify 5) sets CSP, HSTS, nosniff,
	// X-Frame-Options, Referrer-Policy, CORP… on every response. Tuning notes:
	//  - `enableCSPNonces` generates a per-request CSP nonce (`reply.cspNonce`)
	//    and appends `'nonce-…'` to script-src/style-src, so inline HTML is
	//    allow-listed by nonce instead of `'unsafe-inline'`. Swagger's only
	//    inline content is two <style> blocks — its three scripts are external
	//    same-origin files — so script-src drops `'unsafe-inline'` entirely;
	//    the onSend hook below stamps the nonce onto those <style> tags.
	//  - `style-src-attr 'unsafe-inline'` — Swagger UI's rendered components set
	//    inline `style="…"` attributes at runtime, and nonces do not apply to
	//    attributes; this narrow allowance (attributes only, not <style>
	//    elements) is what lets the docs page render.
	//  - `crossOriginResourcePolicy: cross-origin` — the web/admin apps fetch
	//    JSON from :8080 cross-origin; `same-origin` (helmet's default) would
	//    block resource embedding across ports.
	//  - `upgrade-insecure-requests` is removed so plain-http local dev
	//    (http://localhost:8080) isn't force-upgraded to https.
	await app.register(fastifyHelmet, {
		enableCSPNonces: true,
		contentSecurityPolicy: {
			useDefaults: true,
			directives: {
				scriptSrc: ["'self'"],
				styleSrc: ["'self'"],
				styleSrcAttr: ["'unsafe-inline'"],
				imgSrc: ["'self'", "data:"],
				fontSrc: ["'self'", "data:"],
				connectSrc: ["'self'"],
				objectSrc: ["'none'"],
				upgradeInsecureRequests: null,
			},
		},
		crossOriginResourcePolicy: { policy: "cross-origin" },
		referrerPolicy: { policy: "no-referrer" },
		hsts: {
			maxAge: 31_536_000,
			includeSubDomains: true,
			preload: true,
		},
	});

	// ── Fastify-native hooks (route tweaks + observability) ────────
	const fastifyInstance: FastifyBootstrapHooks = app.getHttpAdapter().getInstance();

	// Per-route rate limits + SSE request-timeout exemption. The `method`
	// field can be a string OR a string array, so matching on the URL alone is
	// the safe discriminator here (routes are registered with unique URLs).
	fastifyInstance.addHook("onRoute", (routeOptions: FastifyRouteOptions): void => {
		const url: string = routeOptions.url ?? "";

		// The public delivery webhook gets a tight per-IP cap (60/min) — the
		// global 300/min baseline is a wide net; the webhook is a DoS target.
		if (url === "/notifications/email-webhook") {
			routeOptions.config = {
				...(routeOptions.config ?? {}),
				rateLimit: { max: 60, timeWindow: "1 minute" },
			};
		}

		// SSE streams must not be killed by the request timeout — `@Sse()` is a
		// long-lived connection by design.
		if (url.includes("/stream") || url.includes("/events")) {
			routeOptions.config = {
				...(routeOptions.config ?? {}),
				requestTimeout: 0,
			};
		}
	});

	// Accept-version rewrite — clients that can't change their paths (curl,
	// legacy scripts, deployed-before-API consumers) pin a version with the
	// `Accept-version: v2` header; we remap `/api/v1/...` → `/api/v2/...`
	// before routing. This is the escape hatch that lets the server ship a new
	// major without breaking old clients — a v2 controller needs no client
	// changes to be reached by header-carrying callers.
	fastifyInstance.addHook("onRequest", (request, _reply, done): void => {
		const acceptVersion: unknown = request.headers["accept-version"];
		if (typeof acceptVersion === "string" && acceptVersion.length > 0) {
			const requested: ApiVersion | undefined = VersionController.toApiVersion(acceptVersion);
			if (requested !== undefined && requested !== API_VERSION) {
				// Fastify's `request.url` getter reads `raw.url`, so writing the
				// raw property rewrites the routed URL without fighting the
				// readonly type on `request.url`.
				const rewritten: string = request.url.replace(API_VERSION_PREFIX, apiVersionPrefix(requested));
				request.raw.url = rewritten;
			}
		}
		done();
	});

	// Correlation-id mirror (Fastify request ↔ raw Node request) — the Nest
	// middleware (middie) stamps ids on `request.raw`; mirror onto the
	// FastifyRequest + request-context so guards/interceptors read one source.
	fastifyInstance.addHook("preHandler", (request, _reply, done): void => {
		const correlationId: string | undefined = request.raw.correlationId ?? request.id;
		if (request.raw.correlationId !== undefined) {
			request.correlationId = request.raw.correlationId;
		}
		if (request.raw.traceId !== undefined) {
			request.traceId = request.raw.traceId;
		}
		request.requestContext.set("correlationId", correlationId);
		request.requestContext.set("traceId", correlationId);
		done();
	});

	// Single onSend hook: (1) expose `x-request-id` for client correlation —
	// headers must be set here, `onResponse` runs after they're committed;
	// (2) stamp the CSP nonce onto Swagger's inline HTML tags (see helmet
	// comment above). JSON/Buffer/stream payloads pass through untouched.
	fastifyInstance.addHook("onSend", (request, reply, payload, done): void => {
		reply.header("x-request-id", request.id);
		// Version metadata: which API version answered, plus a `Sunset` notice
		// for deprecated versions so clients can schedule their migration.
		const servedVersion: string | undefined = apiVersionOfUrl(request.url);
		if (servedVersion !== undefined) {
			reply.header("x-api-version", servedVersion);
			const deprecated = API_DEPRECATED_VERSIONS.find((entry) => entry.version === servedVersion);
			if (deprecated !== undefined) {
				reply.header("Sunset", deprecated.sunsetAt);
			}
		}
		const contentType: unknown = reply.getHeader("content-type");
		if (typeof payload !== "string" || typeof contentType !== "string" || !contentType.includes("text/html")) {
			done(null, payload);
			return;
		}

		// The docs page is the ONLY text/html the API serves (Swagger UI).
		// Nonces cover the static HTML's inline `<style>`/`<script>` tags, but
		// Swagger UI renders via React and injects `<style>` elements at runtime
		// (e.g. the topbar logo SVG's `fill` rules) — those carry no nonce and the
		// strict `style-src 'self' 'nonce-…'` would block them, leaving the header
		// logo unrendered (dark-on-dark). Relax `style-src` to `'unsafe-inline'`
		// for this page ONLY (the runtime styles are swagger-ui-dist's own static
		// CSS-in-JS, not attacker-controlled), while `script-src` stays
		// nonce-strict — the security property that was actually tightened.
		const csp: unknown = reply.getHeader("content-security-policy");
		if (typeof csp === "string") {
			reply.header("Content-Security-Policy", csp.replace(/style-src 'self' 'nonce-[^;']*'/, "style-src 'self' 'unsafe-inline'"));
		}

		const nonce = reply.cspNonce;
		done(null, payload.replace(/<style>/g, `<style nonce="${nonce.style}">`).replace(/<script>/g, `<script nonce="${nonce.script}">`));
	});

	// Access-log every response (method · version · path · status · duration).
	fastifyInstance.addHook("onResponse", (request, reply, done): void => {
		const logService: LogService = app.get(LogService);
		const servedVersion: string | undefined = apiVersionOfUrl(request.url);
		logService.info(
			`HTTP ${request.method} ${servedVersion === undefined ? "" : `${servedVersion} `}${request.url} ${String(reply.statusCode)} ${reply.elapsedTime.toFixed(1)}ms (${request.id})`,
		);
		done();
	});

	// Log every 5xx with request context (the hook fires for unhandled errors).
	fastifyInstance.addHook("onError", (request, _reply, error, done): void => {
		const logService: LogService = app.get(LogService);
		logService.error(`HTTP ${request.method} ${request.url} failed: ${error.message} (${request.id})`, {
			trace: error.stack,
			metadata: { requestId: request.id, url: request.url, method: request.method },
		});
		done();
	});

	// ── Favicon + docs redirect ──────────────────────────────────
	// NestJS logo on dark rounded square
	const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14.131.047c-.173 0-.334.037-.483.087.316.21.49.49.576.806.007.043.019.074.025.117a.681.681 0 0 1 .013.112c.024.545-.143.614-.26.936-.18.415-.13.861.086 1.22a.74.74 0 0 0 .074.137c-.235-1.568 1.073-1.803 1.314-2.293.019-.428-.334-.713-.613-.911a1.37 1.37 0 0 0-.732-.21zM16.102.4c-.024.143-.006.106-.012.18-.006.05-.006.112-.012.161-.013.05-.025.1-.044.149-.012.05-.03.1-.05.149l-.067.142c-.02.025-.031.05-.05.075l-.037.055a2.152 2.152 0 0 1-.093.124c-.037.038-.068.081-.112.112v.006c-.037.031-.074.068-.118.1-.13.099-.278.173-.415.266-.043.03-.087.056-.124.093a.906.906 0 0 0-.118.099c-.043.037-.074.074-.111.118-.031.037-.068.08-.093.124a1.582 1.582 0 0 0-.087.13c-.025.05-.043.093-.068.142-.019.05-.037.093-.05.143a2.007 2.007 0 0 0-.043.155c-.006.025-.006.056-.012.08-.007.025-.007.05-.013.075 0 .05-.006.105-.006.155 0 .037 0 .074.006.111 0 .05.006.1.019.155.006.05.018.1.03.15.02.049.032.098.05.148.013.03.031.062.044.087l-1.426-.552c-.241-.068-.477-.13-.719-.186l-.39-.093c-.372-.074-.75-.13-1.128-.167-.013 0-.019-.006-.031-.006A11.082 11.082 0 0 0 8.9 2.855c-.378.025-.756.074-1.134.136a12.45 12.45 0 0 0-.837.174l-.279.074c-.092.037-.18.08-.266.118l-.205.093c-.012.006-.024.006-.03.012-.063.031-.118.056-.174.087a2.738 2.738 0 0 0-.236.118c-.043.018-.086.043-.124.062a.559.559 0 0 1-.055.03c-.056.032-.112.063-.162.094a1.56 1.56 0 0 0-.148.093c-.044.03-.087.055-.124.086-.006.007-.013.007-.019.013-.037.025-.08.056-.118.087l-.012.012-.093.074c-.012.007-.025.019-.037.025-.031.025-.062.056-.093.08-.006.013-.019.02-.025.025-.037.038-.074.069-.111.106-.007 0-.007.006-.013.012a1.742 1.742 0 0 0-.111.106c-.007.006-.007.012-.013.012a1.454 1.454 0 0 0-.093.1c-.012.012-.03.024-.043.036a1.374 1.374 0 0 1-.106.112c-.006.012-.018.019-.024.03-.05.05-.093.1-.143.15l-.018.018c-.1.106-.205.211-.317.304-.111.1-.229.192-.347.273a3.777 3.777 0 0 1-.762.421c-.13.056-.267.106-.403.149-.26.056-.527.161-.756.18-.05 0-.105.012-.155.018l-.155.037-.149.056c-.05.019-.099.044-.148.068-.044.031-.093.056-.137.087a1.011 1.011 0 0 0-.124.106c-.043.03-.087.074-.124.111-.037.043-.074.08-.105.124-.031.05-.068.093-.093.143a1.092 1.092 0 0 0-.087.142c-.025.056-.05.106-.068.161-.019.05-.037.106-.056.161-.012.05-.025.1-.03.15 0 .005-.007.012-.007.018-.012.056-.012.13-.019.167C.006 7.95 0 7.986 0 8.03a.657.657 0 0 0 .074.31v.006c.019.037.044.075.069.112.024.037.05.074.08.111.031.031.068.069.106.1a.906.906 0 0 0 .117.099c.149.13.186.173.378.272.031.019.062.031.1.05.006 0 .012.006.018.006 0 .013 0 .019.006.031a1.272 1.272 0 0 0 .08.298c.02.037.032.074.05.111.007.013.013.025.02.031.024.05.049.093.073.137l.093.13c.031.037.069.08.106.118.037.037.074.068.118.105 0 0 .006.006.012.006.037.031.074.062.112.087a.986.986 0 0 0 .136.08c.043.025.093.05.142.069a.73.73 0 0 0 .124.043c.007.006.013.006.025.012.025.007.056.013.08.019-.018.335-.024.65.026.762.055.124.328-.254.6-.688-.036.428-.061.93 0 1.079.069.155.44-.329.763-.862 4.395-1.016 8.405 2.02 8.826 6.31-.08-.67-.905-1.041-1.283-.948-.186.458-.502 1.047-1.01 1.413.043-.41.025-.83-.062-1.24a4.009 4.009 0 0 1-.769 1.562c-.588.043-1.177-.242-1.487-.67-.025-.018-.031-.055-.05-.08-.018-.043-.037-.087-.05-.13a.515.515 0 0 1-.037-.13c-.006-.044-.006-.087-.006-.137v-.093a.992.992 0 0 1 .031-.13c.013-.043.025-.086.044-.13.024-.043.043-.087.074-.13.105-.298.105-.54-.087-.682a.706.706 0 0 0-.118-.062c-.024-.006-.055-.018-.08-.025l-.05-.018a.847.847 0 0 0-.13-.031.472.472 0 0 0-.13-.019 1.01 1.01 0 0 0-.136-.012c-.031 0-.062.006-.093.006a.484.484 0 0 0-.137.019c-.043.006-.086.012-.13.024a1.068 1.068 0 0 0-.13.044c-.043.018-.08.037-.124.056-.037.018-.074.043-.118.062-1.444.942-.582 3.148.403 3.787-.372.068-.75.148-.855.229l-.013.012c.267.161.546.298.837.416.397.13.818.247 1.004.297v.006a5.996 5.996 0 0 0 1.562.112c2.746-.192 4.996-2.281 5.405-5.033l.037.161c.019.112.043.23.056.347v.006c.012.056.018.112.025.162v.024c.006.056.012.112.012.162.006.068.012.136.012.204v.1c0 .03.007.067.007.098 0 .038-.007.075-.007.112v.087c0 .043-.006.08-.006.124 0 .025 0 .05-.006.08 0 .044-.006.087-.006.137-.006.018-.006.037-.006.055l-.02.143c0 .019 0 .037-.005.056-.007.062-.019.118-.025.18v.012l-.037.174v.018l-.037.167c0 .007-.007.02-.007.025a1.663 1.663 0 0 1-.043.168v.018c-.019.062-.037.118-.05.174-.006.006-.006.012-.006.012l-.056.186c-.024.062-.043.118-.068.18-.025.062-.043.124-.068.18-.025.062-.05.117-.074.18h-.007c-.024.055-.05.117-.08.173a.302.302 0 0 1-.019.043c-.006.006-.006.013-.012.019a5.867 5.867 0 0 1-1.742 2.082c-.05.031-.099.069-.149.106-.012.012-.03.018-.043.03a2.603 2.603 0 0 1-.136.094l.018.037h.007l.26-.037h.006c.161-.025.322-.056.483-.087.044-.006.093-.019.137-.031l.087-.019c.043-.006.086-.018.13-.024.037-.013.074-.02.111-.031.62-.15 1.221-.354 1.798-.595a9.926 9.926 0 0 1-3.85 3.142c.714-.05 1.426-.167 2.114-.366a9.903 9.903 0 0 0 5.857-4.68 9.893 9.893 0 0 1-1.667 3.986 9.758 9.758 0 0 0 1.655-1.376 9.824 9.824 0 0 0 2.61-5.268c.21.98.272 1.99.18 2.987 4.474-6.241.371-12.712-1.346-14.416-.006-.013-.012-.019-.012-.031-.006.006-.006.006-.006.012 0-.006 0-.006-.007-.012 0 .074-.006.148-.012.223a8.34 8.34 0 0 1-.062.415c-.03.136-.068.273-.105.41-.044.13-.093.266-.15.396a5.322 5.322 0 0 1-.185.378 4.735 4.735 0 0 1-.477.688c-.093.111-.192.21-.292.31a3.994 3.994 0 0 1-.18.155l-.142.124a3.459 3.459 0 0 1-.347.241 4.295 4.295 0 0 1-.366.211c-.13.062-.26.118-.39.174a4.364 4.364 0 0 1-.818.223c-.143.025-.285.037-.422.05a4.914 4.914 0 0 1-.297.012 4.66 4.66 0 0 1-.422-.025 3.137 3.137 0 0 1-.421-.062 3.136 3.136 0 0 1-.415-.105h-.007c.137-.013.273-.025.41-.05a4.493 4.493 0 0 0 .818-.223c.136-.05.266-.112.39-.174.13-.062.248-.13.372-.204.118-.08.235-.161.347-.248.112-.087.217-.18.316-.279.105-.093.198-.198.291-.304.093-.111.18-.223.26-.334.013-.019.026-.044.038-.062.062-.1.124-.199.18-.298a4.272 4.272 0 0 0 .334-.775c.044-.13.075-.266.106-.403.025-.142.05-.278.062-.415.012-.142.025-.285.025-.421 0-.1-.007-.199-.013-.298a6.726 6.726 0 0 0-.05-.415 4.493 4.493 0 0 0-.092-.415c-.044-.13-.087-.267-.137-.397-.05-.13-.111-.26-.173-.384-.069-.124-.137-.248-.211-.366a6.843 6.843 0 0 0-.248-.34c-.093-.106-.186-.212-.285-.317a3.878 3.878 0 0 0-.161-.155c-.28-.217-.57-.421-.862-.607a1.154 1.154 0 0 0-.124-.062 2.415 2.415 0 0 0-.589-.26Z" fill="#e0234e"/></svg>`;

	// Swagger: served at the versioned docs home (`apiDocsPath()` → `/v1/docs`),
	// with `/docs` redirecting there so bookmarks/curl keep working.
	//
	// Favicon: the docs HTML requests `./favicon-32x32.png` relative to the docs
	// page (i.e. `/v1/docs/favicon-32x32.png`), which the swagger static plugin
	// would otherwise answer with swagger's default PNG. These explicit routes
	// are registered BEFORE Swagger's static assets (Fastify matches in
	// registration order) so both the versioned docs path AND the legacy `/docs`
	// path bounce to our custom favicon instead.
	const httpAdapter = app.getHttpAdapter();
	httpAdapter.get("/docs", (_req: FastifyRequest, reply: FastifyReply): void => {
		reply.redirect(apiDocsPath());
	});
	const docsPath: string = apiDocsPath();
	for (const faviconFile of ["/favicon-32x32.png", "/favicon-16x16.png"]) {
		// Versioned docs path (what the browser actually requests today).
		httpAdapter.get(`${docsPath}${faviconFile}`, (_req: FastifyRequest, reply: FastifyReply): void => {
			reply.redirect("/favicon.ico");
		});
		// Legacy `/docs` path — keep working for old bookmarks.
		httpAdapter.get(`/docs${faviconFile}`, (_req: FastifyRequest, reply: FastifyReply): void => {
			reply.redirect("/favicon.ico");
		});
	}
	httpAdapter.get("/favicon.ico", (_req: FastifyRequest, reply: FastifyReply): void => {
		reply.header("Content-Type", "image/svg+xml").send(faviconSvg);
	});

	const config = new DocumentBuilder().setTitle("Freebuff API").setDescription("REST API for the Freebuff admin platform").setVersion("1.0").addBearerAuth().build();

	const document = SwaggerModule.createDocument(app, config);
	setupApiDocs(app, document);

	await app.listen(port);
	console.warn(`🚀 API running on http://localhost:${String(port)}`);
	console.warn(`📖 Swagger docs at http://localhost:${String(port)}${apiDocsPath()}`);
}
void bootstrap();
