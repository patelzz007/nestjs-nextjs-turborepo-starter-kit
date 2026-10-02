import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyCompress from "@fastify/compress";
import fastifyEtag from "@fastify/etag";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyUnderPressure from "@fastify/under-pressure";
import type { FastifyRequest } from "fastify";
import { type ApiVersion } from "@workspace/shared";

import { RateLimitError } from "../common/errors/app-error";
import { TypedConfigService } from "../config/typed-config.service";
import { readFirstHeader } from "../common/utils/http-headers";
import { VersionController } from "../modules/health/version.controller";
import { apiVersionOfUrl } from "./fastify-api-version";

/** Milliseconds per second — converts the rate-limit window TTL to a `Retry-After` value. */
const MS_PER_SECOND = 1000;

/** The part of @fastify/rate-limit's error context the builder reads. */
export interface RateLimitErrorContext {
	readonly after: string;
	readonly ttl: number;
}

/**
 * @fastify/rate-limit throws whatever this returns from its onRequest hook;
 * Nest routes it through its Fastify error handler into GlobalExceptionFilter,
 * so rate-limited clients get the standard error envelope (code RATE_LIMITED)
 * plus `Retry-After`.
 */
export function rateLimitErrorResponseBuilder(_request: FastifyRequest, context: RateLimitErrorContext): RateLimitError {
	return new RateLimitError({
		message: `Rate limit exceeded — retry after ${context.after}.`,
		details: { retryAfterSeconds: Math.max(1, Math.ceil(context.ttl / MS_PER_SECOND)) },
	});
}

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
	const hardeningEnabled: boolean = config.securityHardeningEnabled;

	await server.register(fastifyCookie);
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
		await server.register(fastifyRateLimit, {
			global: true,
			max: 300,
			timeWindow: "1 minute",
			keyGenerator: (request: FastifyRequest): string => {
				const acceptVersionHeader: string | undefined = readFirstHeader(request.headers["accept-version"]);
				const requested: ApiVersion | undefined = acceptVersionHeader !== undefined ? VersionController.toApiVersion(acceptVersionHeader) : undefined;
				const version: string = requested ?? apiVersionOfUrl(request.url) ?? "unversioned";
				return `${request.ip}:${version}`;
			},
			errorResponseBuilder: rateLimitErrorResponseBuilder,
		});
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
