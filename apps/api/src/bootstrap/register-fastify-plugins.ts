import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyCompress from "@fastify/compress";
import fastifyEtag from "@fastify/etag";
import fastifyHelmet from "@fastify/helmet";
import fastifyUnderPressure from "@fastify/under-pressure";

import { TypedConfigService } from "../config/typed-config.service";

export interface RegisterFastifyPluginsOptions {
	readonly isDev: boolean;
}

/**
 * Registers Fastify plugins on the underlying server instance.
 *
 * Nest's `app.register()` types assume a bare `FastifyInstance`, while
 * `@fastify/*` plugins are typed against their module augmentations — registering
 * on `getInstance()` keeps runtime behaviour identical and avoids the mismatch.
 */
export async function registerFastifyPlugins(app: NestFastifyApplication, options: RegisterFastifyPluginsOptions, config: TypedConfigService): Promise<void> {
	const server = app.getHttpAdapter().getInstance();
	const hardeningEnabled: boolean = config.http.securityHardeningEnabled;

	await server.register(fastifyCookie);
	// `application/x-www-form-urlencoded` (Twilio's signed callbacks, the RFC 8058 one-click unsubscribe
	// POST, ADR 070) is parsed by Nest's Fastify adapter itself at init; registering it here as well
	// makes Fastify refuse to start (FST_ERR_CTP_ALREADY_PRESENT).
	await server.register(fastifyMultipart, {
		limits: {
			files: 5,
			fileSize: 5_242_880,
		},
	});

	if (!options.isDev) {
		await server.register(fastifyCompress, { global: true, threshold: 1024 });
		await server.register(fastifyEtag, { weak: true });
	}

	if (hardeningEnabled) {
		// No global per-IP limit here: the `preAuth` policy (ADR 071) counts every request per client IP in the
		// shared store, before authentication, so the limit holds across API instances.
		await server.register(fastifyUnderPressure, {
			maxEventLoopDelay: 1000,
			maxHeapUsedBytes: 512 * 1024 * 1024,
		});
		await server.register(fastifyHelmet, {
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
	}
}
