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
