import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { RequestContextService } from "../../../common/context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { REWARDHUB_DEFAULT_TENANT_CEDAR } from "../../organization/utils/rewardhub-policy-seed.util";
import { POLICY_BUNDLE_CACHE_TTL_MS } from "../constants/policy-control-plane.constants";
import { CedarWasmPolicyEngine } from "../engine/cedar-wasm-policy-engine";
import { CedarPolicyEvaluatorService } from "./cedar-policy-evaluator.service";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public readonly withSystemOperation = async <T>(_context: object, work: (tx: object) => Promise<T>): Promise<T> =>
			work({ authorizationPolicyVersion: { findMany: mocks.findMany } });
	},
}));

const ORG = "org-1";
const START_MS = 1_790_000_000_000;

function evaluator(): CedarPolicyEvaluatorService {
	return new CedarPolicyEvaluatorService(new TenantTransactionService(createTestPrisma(), new RequestContextService()), new CedarWasmPolicyEngine());
}

describe("CedarPolicyEvaluatorService bundle cache", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START_MS);
		mocks.findMany.mockReset();
		mocks.findMany.mockResolvedValue([{ version: 2, cedarSource: REWARDHUB_DEFAULT_TENANT_CEDAR }]);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("serves a cached bundle until it expires, then reloads (backstop when an invalidation message is lost)", async () => {
		const cedar = evaluator();

		expect(await cedar.getActivePolicyVersion(ORG)).toBe(2);
		vi.setSystemTime(START_MS + POLICY_BUNDLE_CACHE_TTL_MS - 1);
		await cedar.getActivePolicyVersion(ORG);
		expect(mocks.findMany).toHaveBeenCalledTimes(1);

		mocks.findMany.mockResolvedValue([{ version: 3, cedarSource: REWARDHUB_DEFAULT_TENANT_CEDAR }]);
		vi.setSystemTime(START_MS + POLICY_BUNDLE_CACHE_TTL_MS);
		expect(await cedar.getActivePolicyVersion(ORG)).toBe(3);
		expect(mocks.findMany).toHaveBeenCalledTimes(2);
	});

	it("reloads immediately after an organization or global invalidation", async () => {
		const cedar = evaluator();
		await cedar.getActivePolicyVersion(ORG);

		cedar.invalidateOrganization(ORG);
		await cedar.getActivePolicyVersion(ORG);
		cedar.invalidateAll();
		await cedar.getActivePolicyVersion(ORG);

		expect(mocks.findMany).toHaveBeenCalledTimes(3);
	});
});
