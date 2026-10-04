import { Prisma } from "@prisma/client";

import type { AppError } from "../../../common/errors/app-error";

/** Prisma: unique constraint violated — a concurrent request inserted the same unique key first. */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/** Whether `error` is a database unique-constraint violation. */
export function isUniqueConstraintViolation(error: Error): boolean {
	return error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION;
}

/**
 * Run `work` (typically a whole transaction) and translate a unique-constraint
 * violation — the database's verdict on a concurrent duplicate — into the
 * typed application error `toConflict` builds. Every other failure propagates
 * unchanged.
 */
export async function withUniqueViolationAs<T>(work: () => Promise<T>, toConflict: (cause: Error) => AppError): Promise<T> {
	try {
		return await work();
	} catch (error) {
		if (error instanceof Error && isUniqueConstraintViolation(error)) {
			throw toConflict(error);
		}
		throw error;
	}
}
