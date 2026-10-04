import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationErasureService } from "./organization-erasure.service";

vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));
vi.mock("../../authorization-cedar/services/cedar-policy-evaluator.service", () => ({ CedarPolicyEvaluatorService: class {} }));

const ORG_ID = "6f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const ACTOR_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const POLICY_VERSION = 2;

describe("OrganizationErasureService", () => {
	const tx = { organization: { update: vi.fn() }, organizationAuditLog: { create: vi.fn() } };
	const tenantTx = { withSystemOperation: vi.fn() };
	const cedar = { getActivePolicyVersion: vi.fn() };
	let service: OrganizationErasureService;

	beforeEach(async () => {
		vi.clearAllMocks();
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (client: typeof tx) => Promise<object>) => work(tx));
		cedar.getActivePolicyVersion.mockResolvedValue(POLICY_VERSION);
		const moduleRef = await Test.createTestingModule({
			providers: [
				OrganizationErasureService,
				OrganizationAuditService,
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: CedarPolicyEvaluatorService, useValue: cedar },
			],
		}).compile();
		service = moduleRef.get(OrganizationErasureService);
	});

	it("writes the erasure audit row inside the erasing transaction with the real actor and policy version", async () => {
		tx.organization.update.mockResolvedValue({});
		tx.organizationAuditLog.create.mockResolvedValue({});

		await service.executeErasure(ORG_ID, ACTOR_ID);

		expect(tenantTx.withSystemOperation).toHaveBeenCalledTimes(1);
		expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
			{
				data: { organizationId: ORG_ID, actorUserId: ACTOR_ID, policyVersion: POLICY_VERSION, action: "organization.erased" },
			},
		]);
	});

	it("records no audit row when the tombstone write fails", async () => {
		tx.organization.update.mockRejectedValue(new Error("write failed"));

		await expect(service.executeErasure(ORG_ID, ACTOR_ID)).rejects.toThrow("write failed");
		expect(tx.organizationAuditLog.create).not.toHaveBeenCalled();
	});
});
