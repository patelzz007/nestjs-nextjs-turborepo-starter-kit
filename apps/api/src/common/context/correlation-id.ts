// ============================================
// common/context/correlation-id.ts - One correlation id per HTTP request
// ============================================
// The correlation id is chosen ONCE per request and reused everywhere:
// Fastify's `request.id` (pino `correlationId` binding, via `genReqId`), the
// request context, the `X-Correlation-Id` response header, the success and
// error envelopes' `meta.correlationId`, and the outbox rows.
//
// A client-supplied `X-Correlation-Id` / `X-Request-Id` is untrusted input:
// it is accepted only when it matches `CorrelationIdSchema` (bounded length,
// log-safe charset); otherwise a fresh id is generated.

import type { IncomingMessage } from "node:http";

import { nanoid } from "nanoid";
import { z } from "zod";

import { readFirstHeader } from "../utils/http-headers";

/** Longest correlation id accepted from a client (also the outbox column's budget). */
export const MAX_CORRELATION_ID_LENGTH = 64;

/** Response header echoing the correlation id. */
export const CORRELATION_ID_HEADER = "X-Correlation-Id";

/** Request headers a caller may use to propagate its own correlation id, in precedence order. */
const INCOMING_CORRELATION_HEADERS: readonly ["x-correlation-id", "x-request-id"] = ["x-correlation-id", "x-request-id"];

/**
 * A correlation id safe to put in logs, headers and database rows: 1–64
 * characters of letters, digits, `.`, `_`, `:` or `-` (UUIDs, nanoids, W3C
 * trace ids and most vendor request ids fit). No whitespace, no control
 * characters, no log-injection surface.
 */
export const CorrelationIdSchema = z
	.string()
	.min(1)
	.max(MAX_CORRELATION_ID_LENGTH)
	.regex(/^[A-Za-z0-9._:-]+$/);

/** Minimal header bag shared by Node's `IncomingMessage` and Fastify's request. */
export interface CorrelationHeaders {
	readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

/** The caller's correlation id when it passes validation, otherwise `undefined`. */
export function readIncomingCorrelationId(request: CorrelationHeaders): string | undefined {
	for (const name of INCOMING_CORRELATION_HEADERS) {
		const candidate: string | undefined = readFirstHeader(request.headers[name]);
		if (candidate === undefined) {
			continue;
		}
		const parsed = CorrelationIdSchema.safeParse(candidate.trim());
		if (parsed.success) {
			return parsed.data;
		}
	}
	return undefined;
}

/** A fresh, URL-safe correlation id. */
export function generateCorrelationId(): string {
	return nanoid();
}

/**
 * Per raw request memo. Fastify's `genReqId`, the request-context
 * middleware, and the error filter can each ask for the id and always get the
 * SAME value, even when an invalid header forced a generated one.
 */
const correlationIds = new WeakMap<IncomingMessage, string>();

/** The request's correlation id — the validated incoming id, or a generated one — decided once. */
export function correlationIdFor(raw: IncomingMessage): string {
	const existing: string | undefined = correlationIds.get(raw);
	if (existing !== undefined) {
		return existing;
	}
	const correlationId: string = readIncomingCorrelationId(raw) ?? generateCorrelationId();
	correlationIds.set(raw, correlationId);
	return correlationId;
}
