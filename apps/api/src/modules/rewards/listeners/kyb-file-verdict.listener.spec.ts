import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { MerchantKybDocumentService } from "../services/merchant-kyb-document.service";
import { KybFileVerdictListener } from "./kyb-file-verdict.listener";

const ORG_ID = "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c";
const EVENT = {
	fileId: "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a",
	category: "MERCHANT_KYB",
	organizationId: ORG_ID,
	uploadedById: "u",
	outcome: "QUARANTINED",
} satisfies Parameters<KybFileVerdictListener["onVerdict"]>[1];

describe("KybFileVerdictListener", () => {
	const kybDocuments = { reconcileOrgKybStatusInTx: vi.fn() };
	let listener: KybFileVerdictListener;

	beforeEach(async () => {
		vi.clearAllMocks();
		const moduleRef = await Test.createTestingModule({ providers: [KybFileVerdictListener, { provide: MerchantKybDocumentService, useValue: kybDocuments }] }).compile();
		listener = moduleRef.get(KybFileVerdictListener);
	});

	it("listens to MERCHANT_KYB files only", () => {
		expect(listener.categories).toEqual(["MERCHANT_KYB"]);
	});

	it("re-derives the organization's review status inside the verdict transaction", async () => {
		const tx = createTestPrisma();

		await listener.onVerdict(tx, EVENT);

		expect(kybDocuments.reconcileOrgKybStatusInTx).toHaveBeenCalledWith(tx, ORG_ID);
	});

	it("ignores a KYB file that belongs to no organization", async () => {
		await listener.onVerdict(createTestPrisma(), { ...EVENT, organizationId: null });

		expect(kybDocuments.reconcileOrgKybStatusInTx).not.toHaveBeenCalled();
	});
});
