import type { Prisma } from "@prisma/client";
import { JsonValueSchema, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../application/actor-context";
import { toRlsTransactionScope, USER_OWNED_DATA_SCOPE, type RlsTransactionScope } from "../unit-of-work/actor-to-rls-context";

/** The one `TenantTransactionService` method an exporter needs. */
export interface PersonTransactions {
	withRlsContext<TResult>(scope: RlsTransactionScope, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * Reads for a personal-data export under **the person's own RLS context** (ADR 077): the same scope their
 * own requests get, so the database itself keeps an export to rows that person may read.
 */
export function readAsPerson<TResult>(transactions: PersonTransactions, person: ActorContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
	return transactions.withRlsContext(toRlsTransactionScope(person, USER_OWNED_DATA_SCOPE), work);
}

/** Epoch-millisecond columns (BigInt) as JSON numbers; null stays null. */
export function epochOrNullJson(value: bigint | null): number | null {
	return value === null ? null : Number(value);
}

const BigIntSchema = z.bigint();

/** A value `JSON.stringify` hands its replacer for a database row. */
type JsonReplacerValue = bigint | object | string | number | boolean | null;

/**
 * Database rows as export JSON: BigInt columns (epoch milliseconds, counters) become numbers, `Date`s ISO
 * strings, JSON columns stay JSON. Parsed back through `JsonValueSchema`, so the export is valid JSON.
 */
export function rowsToJson(rows: readonly object[]): JsonValue {
	// The replacer sees every value; a BigInt (which `JSON.stringify` refuses) comes back as a number.
	const text = JSON.stringify(rows, (_key: string, value: JsonReplacerValue): JsonReplacerValue => {
		const big = BigIntSchema.safeParse(value);
		return big.success ? Number(big.data) : value;
	});
	return JsonValueSchema.parse(JSON.parse(text));
}
