import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import "@fastify/request-context";
import { API_DEPRECATED_VERSIONS, API_VERSION, API_VERSION_PREFIX, apiVersionPrefix, type ApiVersion, StringValueSchema } from "@workspace/shared";
import { z } from "zod";

import type { RequestWithTrace } from "../common/middleware/correlation-id.middleware";
import { readFirstHeader, readReplyHeader } from "../common/utils/http-headers";
import { parsePreSerializationValue, serializePreSerializationValue } from "../common/utils/serialize-pre-serialization-value";
import { LogService } from "../modules/logs/logs.service";
import { VersionController } from "../modules/health/version.controller";
import { apiVersionOfUrl } from "./fastify-api-version";

/** CSP nonce pair stamped by `@fastify/helmet` on HTML responses. */
const CspNonceSchema = z
	.object({
		style: z.string(),
		script: z.string(),
	})
	.strict();

type CspNonce = z.output<typeof CspNonceSchema>;

/** Per-route config tweaks applied in the onRoute hook. */
interface FastifyRouteOptions {
	readonly url?: string;
	config?: Record<string, string | number | boolean | { readonly max: number; readonly timeWindow: string }>;
}

interface RequestContextStore {
	set(key: "correlationId" | "traceId", value: string | undefined): void;
}

const RequestContextStoreSchema = z.object({
	set: z.function({
		input: z.tuple([z.enum(["correlationId", "traceId"]), z.union([z.string(), z.undefined()])]),
		output: z.void(),
	}),
});

function readRequestContextStore(target: object): RequestContextStore | undefined {
	const parsed = RequestContextStoreSchema.safeParse(Reflect.get(target, "requestContext"));
	return parsed.success ? parsed.data : undefined;
}

function mirrorCorrelationIds(request: { readonly id: string; readonly raw: RequestWithTrace }): void {
	const rawRequest: RequestWithTrace = request.raw;
	const correlationId: string | undefined = rawRequest.correlationId ?? request.id;
	if (rawRequest.correlationId !== undefined) {
		Reflect.set(request, "correlationId", rawRequest.correlationId);
	}
	if (rawRequest.traceId !== undefined) {
		Reflect.set(request, "traceId", rawRequest.traceId);
	}
	const contextStore = readRequestContextStore(request);
	if (contextStore !== undefined) {
		contextStore.set("correlationId", correlationId);
		contextStore.set("traceId", correlationId);
	}
}

function readCspNonce(reply: object): CspNonce | undefined {
	if (!("cspNonce" in reply)) {
		return undefined;
	}
	const parsed = CspNonceSchema.safeParse(Reflect.get(reply, "cspNonce"));
	return parsed.success ? parsed.data : undefined;
}

/** Wires Fastify-native hooks for routing tweaks, tracing, access logs, and serialization. */
export function registerFastifyHooks(app: NestFastifyApplication): void {
	const server = app.getHttpAdapter().getInstance();

	server.addHook("onRoute", (routeOptions: FastifyRouteOptions): void => {
		const url: string = routeOptions.url ?? "";

		if (url === "/notifications/email-webhook") {
			routeOptions.config = {
				...(routeOptions.config ?? {}),
				rateLimit: { max: 60, timeWindow: "1 minute" },
			};
		}

		if (url.includes("/stream") || url.includes("/events")) {
			routeOptions.config = {
				...(routeOptions.config ?? {}),
				requestTimeout: 0,
			};
		}
	});

	server.addHook("onRequest", (request, _reply, done): void => {
		const acceptVersion: string | undefined = readFirstHeader(request.headers["accept-version"]);
		if (acceptVersion !== undefined) {
			const requested: ApiVersion | undefined = VersionController.toApiVersion(acceptVersion);
			if (requested !== undefined && requested !== API_VERSION) {
				const rewritten: string = request.url.replace(API_VERSION_PREFIX, apiVersionPrefix(requested));
				request.raw.url = rewritten;
			}
		}
		done();
	});

	server.addHook("preHandler", (request, _reply, done): void => {
		mirrorCorrelationIds(request);
		done();
	});

	server.addHook("onSend", (request, reply, payload, done): void => {
		reply.header("x-request-id", request.id);
		const servedVersion: string | undefined = apiVersionOfUrl(request.url);
		if (servedVersion !== undefined) {
			reply.header("x-api-version", servedVersion);
			const deprecated = API_DEPRECATED_VERSIONS.find((entry) => entry.version === servedVersion);
			if (deprecated !== undefined) {
				reply.header("Sunset", deprecated.sunsetAt);
			}
		}
		const contentType: string | undefined = readReplyHeader(reply.getHeader("content-type"));
		const payloadText = StringValueSchema.safeParse(payload);
		if (!payloadText.success || !contentType?.includes("text/html")) {
			done(null, payload);
			return;
		}

		const csp: string | undefined = readReplyHeader(reply.getHeader("content-security-policy"));
		if (csp !== undefined) {
			reply.header("Content-Security-Policy", csp.replace(/style-src 'self' 'nonce-[^;']*'/, "style-src 'self' 'unsafe-inline'"));
		}

		const nonce = readCspNonce(reply);
		if (nonce === undefined) {
			done(null, payloadText.data);
			return;
		}

		done(null, payloadText.data.replace(/<style>/g, `<style nonce="${nonce.style}">`).replace(/<script>/g, `<script nonce="${nonce.script}">`));
	});

	server.addHook("onResponse", (request, reply, done): void => {
		const logService: LogService = app.get(LogService);
		const servedVersion: string | undefined = apiVersionOfUrl(request.url);
		logService.info(
			`HTTP ${request.method} ${servedVersion === undefined ? "" : `${servedVersion} `}${request.url} ${String(reply.statusCode)} ${reply.elapsedTime.toFixed(1)}ms (${request.id})`,
		);
		done();
	});

	server.addHook("onError", (request, _reply, error, done): void => {
		const logService: LogService = app.get(LogService);
		logService.error(`HTTP ${request.method} ${request.url} failed: ${error.message} (${request.id})`, {
			trace: error.stack,
			metadata: { requestId: request.id, url: request.url, method: request.method },
		});
		done();
	});

	server.addHook("preSerialization", (_request, _reply, payload, done): void => {
		const parsed = parsePreSerializationValue(payload);
		if (parsed === null) {
			done(null, payload);
			return;
		}
		done(null, serializePreSerializationValue(parsed));
	});
}
