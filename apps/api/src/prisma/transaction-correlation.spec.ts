import { describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../test/support/test-api-env";
import { PrismaService } from "./prisma.service";
import { MissingTransactionCorrelationIdError, readTransactionCorrelationId } from "./transaction-correlation";

vi.mock("./prisma.service", () => ({ PrismaService: class {} }));

/** A fake transaction (a module-mocked, connection-less PrismaService) whose `$queryRaw` answers `rows`, plus that mock. */
function transactionReturning(rows: readonly object[]): { readonly tx: PrismaService; readonly queryRaw: ReturnType<typeof vi.fn> } {
	const queryRaw = vi.fn().mockResolvedValue(rows);
	return { tx: Object.assign(new PrismaService(createTestTypedConfig()), { $queryRaw: queryRaw }), queryRaw };
}

describe("readTransactionCorrelationId", () => {
	it("returns the correlation id the transaction runs under (app.correlation_id)", async () => {
		const { tx, queryRaw } = transactionReturning([{ correlation_id: "req-7f3a_9" }]);

		await expect(readTransactionCorrelationId(tx)).resolves.toBe("req-7f3a_9");
		expect(queryRaw).toHaveBeenCalledTimes(1);
	});

	it("fails loudly outside a TenantTransactionService transaction instead of returning nothing", async () => {
		await expect(readTransactionCorrelationId(transactionReturning([{ correlation_id: null }]).tx)).rejects.toBeInstanceOf(MissingTransactionCorrelationIdError);
	});

	it("rejects a value that is not a valid correlation id", async () => {
		await expect(readTransactionCorrelationId(transactionReturning([{ correlation_id: "not a\nvalid id" }]).tx)).rejects.toThrow();
	});
});
