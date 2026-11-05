import type { Prisma } from "@prisma/client";

import { actingUserId } from "../../application/actor-context";
import {
	ACCOUNT_ERASE_OPERATION,
	ACCOUNT_ERASURE_REQUEST_OPERATION,
	type ErasureBlocker,
	type ErasureSubject,
	type PersonalDataEraser,
} from "../../application/personal-data/personal-data-erasure.registry";
import type { SystemDatabaseContext } from "../../../prisma/tenant-context";

/** The transaction method an eraser or blocker needs. */
export interface ErasureSystemTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * A context's eraser (ADR 077) from the work it does on its own tables, run in one transaction under the
 * `privacy.account.erase` system operation (whose table scope lists exactly what erasure may touch).
 * `work` returns the per-table results (`{ count }`); their sum is the eraser's result.
 */
export function systemOperationEraser(
	section: string,
	transactions: ErasureSystemTransactions,
	work: (tx: Prisma.TransactionClient, subject: ErasureSubject) => Promise<readonly { readonly count: number }[]>,
): PersonalDataEraser {
	return {
		section,
		erase: (subject: ErasureSubject): Promise<number> =>
			transactions.withSystemOperation({ operation: ACCOUNT_ERASE_OPERATION, reason: `Erasure: ${section}`, actorUserId: actingUserId(subject.actor) }, async (tx) =>
				(await work(tx, subject)).reduce((total, result) => total + result.count, 0),
			),
	};
}

/**
 * A context's erasure blocker (ADR 077): `blocked` reads its tables under the `privacy.account.erasure.request`
 * system operation and returns the people-readable reason when the erasure must wait, or null.
 */
export function systemOperationBlocker(
	name: string,
	transactions: ErasureSystemTransactions,
	blocked: (tx: Prisma.TransactionClient, userId: string, email: string) => Promise<string | null>,
): ErasureBlocker {
	return {
		name,
		blockers: async (userId: string, email: string): Promise<readonly string[]> => {
			const reason = await transactions.withSystemOperation({ operation: ACCOUNT_ERASURE_REQUEST_OPERATION, reason: `Erasure: check ${name}`, actorUserId: null }, (tx) =>
				blocked(tx, userId, email),
			);
			return reason === null ? [] : [reason];
		},
	};
}
