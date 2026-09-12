import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyCompress from "@fastify/compress";
import fastifyEtag from "@fastify/etag";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyRequestContext from "@fastify/request-context";
import fastifyUnderPressure from "@fastify/under-pressure";
import type { FastifyRequest } from "fastify";
import { type ApiVersion } from "@workspace/shared";

import { TypedConfigService } from "../config/typed-config.service";
import { readFirstHeader } from "../common/utils/http-headers";
import { VersionController } from "../modules/health/version.controller";
import { apiVersionOfUrl } from "./fastify-api-version";

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
	await server.register(fastifyRequestContext, { hook: "preHandler" });

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
