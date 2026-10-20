import { describe, expect, it } from "vitest";

import { systemActor } from "../../../application/actor-context";
import type { OutboxTransaction } from "../../outbox/platform-outbox.service";
import { toRlsTransactionScope, type RlsTransactionScope } from "../actor-to-rls-context";
import { PrismaReadExecutor } from "../prisma-read-executor";
import type { RlsTransactionRunner } from "../prisma-unit-of-work";

const DATABASE: OutboxTransaction = {
	outboxEvent: {
		createMany: (): Promise<{ readonly count: number }> => Promise.resolve({ count: 0 }),
	},
};

describe("PrismaReadExecutor", () => {
	it("stamps the actor RLS scope for the query and returns the read result", async () => {
		const actor = systemActor("outbox.enqueue", "job", "org-1", "Read under the actor", null);
		const scopes: RlsTransactionScope[] = [];
		const runner: RlsTransactionRunner<OutboxTransaction> = {
			withRlsContext: <TResult>(scope: RlsTransactionScope, handler: (db: OutboxTransaction) => Promise<TResult>): Promise<TResult> => {
				scopes.push(scope);
				return handler(DATABASE);
			},
		};

		const seen = await new PrismaReadExecutor(runner).read(actor, (db): Promise<string> => {
			expect(db).toBe(DATABASE);
			return Promise.resolve("row");
		});

		expect(seen).toBe("row");
		expect(scopes).toEqual([toRlsTransactionScope(actor)]);
	});
});
