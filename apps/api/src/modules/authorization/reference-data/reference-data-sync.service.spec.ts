import type { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi, type MockInstance } from "vitest";

import type { OperatorIdentityProvider } from "../../../common/operator-identity";
import { RequestContextService } from "../../../common/context/request-context";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { REFERENCE_DATA_SYNC_OPERATION, ReferenceDataSyncService } from "./reference-data-sync.service";
import { NO_CHANGE, type ReferenceDataSection, type SectionChange } from "./reference-data.types";

const OPERATOR = { osUser: "deploy", host: "api-1" };

function section(name: string, change: SectionChange | Error, log: string[]): ReferenceDataSection {
	return {
		name,
		sync: (): Promise<SectionChange> => {
			log.push(`sync:${name}`);
			return change instanceof Error ? Promise.reject(change) : Promise.resolve(change);
		},
	};
}

function build(
	sections: readonly ReferenceDataSection[],
	log: string[],
): { readonly service: ReferenceDataSyncService; readonly record: MockInstance<AuthorizationAuditService["record"]> } {
	const db = createTestPrisma();
	const audit = new AuthorizationAuditService(new RequestContextService());
	const record = vi.spyOn(audit, "record").mockImplementation(() => {
		log.push("audit");
		return Promise.resolve();
	});
	const operator: OperatorIdentityProvider = { current: () => OPERATOR };
	const run = async <T>(handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
		log.push("begin");
		try {
			const result = await handler(db);
			log.push("commit");
			return result;
		} catch (error) {
			log.push("rollback");
			throw error;
		}
	};
	return { service: new ReferenceDataSyncService(run, sections, audit, operator), record };
}

describe("ReferenceDataSyncService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes nothing — not even an audit row — when every section is already up to date", async () => {
		const log: string[] = [];
		const { service, record } = build([section("a", NO_CHANGE, log), section("b", NO_CHANGE, log)], log);

		const report = await service.sync();

		expect(report.totalChanges).toBe(0);
		expect(record).not.toHaveBeenCalled();
		expect(log).toEqual(["begin", "sync:a", "commit", "begin", "sync:b", "commit"]);
	});

	it("audits each changed section in the same transaction, as the system operation, naming the operator", async () => {
		const log: string[] = [];
		const { service, record } = build([section("a", { created: 2, updated: 1, restored: 0, retired: 0 }, log), section("b", NO_CHANGE, log)], log);

		const report = await service.sync();

		expect(report.totalChanges).toBe(3);
		expect(log).toEqual(["begin", "sync:a", "audit", "commit", "begin", "sync:b", "commit"]);
		const entry = record.mock.calls[0]?.[0];
		expect(entry).toMatchObject({ action: "REFERENCE_DATA_SYNCED", actor: { kind: "SYSTEM_OPERATION", operation: REFERENCE_DATA_SYNC_OPERATION } });
		expect(JSON.parse(entry?.detail ?? "{}")).toEqual({ section: "a", created: 2, updated: 1, restored: 0, retired: 0, ranBy: OPERATOR });
	});

	it("runs one transaction per section: a failing section rolls back alone and earlier sections stay committed", async () => {
		const log: string[] = [];
		const { service } = build([section("a", { ...NO_CHANGE, created: 1 }, log), section("b", new Error("boom"), log), section("c", NO_CHANGE, log)], log);

		await expect(service.sync()).rejects.toThrow("boom");

		expect(log).toEqual(["begin", "sync:a", "audit", "commit", "begin", "sync:b", "rollback"]);
	});

	it("rolls a section back when its audit row cannot be written", async () => {
		const log: string[] = [];
		const { service, record } = build([section("a", { ...NO_CHANGE, created: 1 }, log)], log);
		record.mockRejectedValue(new Error("audit failed"));

		await expect(service.sync()).rejects.toThrow("audit failed");

		expect(log).toEqual(["begin", "sync:a", "rollback"]);
	});
});
