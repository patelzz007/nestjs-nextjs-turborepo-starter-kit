import { Prisma } from "@prisma/client";
import { z } from "zod";

/** Prisma: unique constraint violated. */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * The part of a P2002 `meta` the Postgres driver adapter fills in: the index
 * that rejected the row (`driverAdapterError.cause.constraint.index`). Parsed,
 * never trusted — an unexpected shape simply yields no index.
 */
const UniqueViolationMetaSchema = z.object({
	driverAdapterError: z.object({
		cause: z.object({
			constraint: z.object({ index: z.string().min(1) }),
		}),
	}),
});

/**
 * Whether `error` is a unique violation of exactly `indexName`. Checking the
 * index matters: a P2002 from any OTHER unique index in the same transaction
 * is a different failure and must not be mistaken for, say, a duplicate
 * idempotency key.
 */
export function isUniqueViolationOf(error: Error, indexName: string): boolean {
	if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== PRISMA_UNIQUE_CONSTRAINT_VIOLATION) {
		return false;
	}
	const meta = UniqueViolationMetaSchema.safeParse(error.meta);
	return meta.success && meta.data.driverAdapterError.cause.constraint.index === indexName;
}
