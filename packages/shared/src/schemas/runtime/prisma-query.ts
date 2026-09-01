import { z } from "zod";

/**
 * Runtime shape of Prisma's `query` event. The generated client does not
 * export query-event types under driver adapters (Prisma 7).
 */
export const PrismaQueryEventSchema = z
	.object({
		timestamp: z.date(),
		query: z.string(),
		params: z.string(),
		duration: z.number(),
	})
	.strict();

export type PrismaQueryEvent = z.output<typeof PrismaQueryEventSchema>;

type PrismaQueryOnFn = (event: "query", callback: (event: PrismaQueryEvent) => void) => object;

const prismaQueryOnSchema = z.custom<PrismaQueryOnFn>((val) => val instanceof Function, {
	message: "Expected PrismaClient.$on",
});

/** Structural `$on("query", …)` surface used to subscribe without type assertions. */
export const PrismaQuerySubscriberSchema = z.object({
	$on: prismaQueryOnSchema,
});
