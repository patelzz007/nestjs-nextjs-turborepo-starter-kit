import { z } from "zod";

/** Fastify header values — a scalar or repeated header lines. */
export const HttpHeaderValueSchema = z.union([z.string(), z.array(z.string())]);

export type HttpHeaderValue = z.output<typeof HttpHeaderValueSchema>;

/** Parsed query-string map from Fastify. */
export const FastifyQuerySchema = z.record(z.string(), HttpHeaderValueSchema);

export type FastifyQuery = z.output<typeof FastifyQuerySchema>;

/** Reply header values are usually a string once `getHeader` is called. */
export const ReplyHeaderValueSchema = z.union([z.string(), z.number(), z.array(z.string())]);

export type ReplyHeaderValue = z.output<typeof ReplyHeaderValueSchema>;

// ── Boundary schemas (replaces `typeof` guards at request edges) ─────────

/** Headers record as typed by Fastify — string or string[] values. */
export const HeadersRecordSchema = z.record(z.string(), HttpHeaderValueSchema);

export type HeadersRecord = z.output<typeof HeadersRecordSchema>;

/** Minimal request-like shape for IP resolution at public boundaries. */
export const RequestLikeSchema = z.object({
	headers: HeadersRecordSchema.optional(),
	ip: z.string().optional(),
});

export type RequestLike = z.output<typeof RequestLikeSchema>;

/** Route params record — Fastify types params as opaque `object`. */
export const RouteParamsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export type RouteParams = z.output<typeof RouteParamsSchema>;

/** Correlation / request-id header — string or undefined. */
export const OptionalStringHeaderSchema = z.union([z.string(), z.array(z.string())]).optional();

export type OptionalStringHeader = z.output<typeof OptionalStringHeaderSchema>;

/** Forwarded-For header — string, string[], or undefined. */
export const ForwardedForHeaderSchema = z.union([z.string(), z.array(z.string())]).optional();

export type ForwardedForHeader = z.output<typeof ForwardedForHeaderSchema>;
