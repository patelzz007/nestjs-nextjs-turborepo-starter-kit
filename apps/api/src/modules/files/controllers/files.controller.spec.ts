import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig, type TestEnv } from "../../../../test/support/test-api-env";
import { createTestAuthorizationKernel, createTestPrisma } from "../../../../test/support/test-service-graph";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "../../organization/services/organization-audit.service";
import { OrganizationContextService } from "../../organization/services/organization-context.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { LocalObjectStorageAdapter } from "../../storage/adapters/local/local-object-storage.adapter";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileAuthorizationService } from "../services/file-authorization.service";
import { FileService } from "../services/file.service";
import { FilesController } from "./files.controller";

const mocks = vi.hoisted(() => ({ applyProcessingResult: vi.fn() }));

vi.mock("../services/file.service", () => ({
	FileService: class {
		public readonly applyProcessingResult = mocks.applyProcessingResult;
	},
}));
vi.mock("../services/file-authorization.service", () => ({ FileAuthorizationService: class {} }));
vi.mock("../../organization/services/organization-context.service", () => ({ OrganizationContextService: class {} }));
vi.mock("../repositories/stored-file.repository", () => ({ StoredFileRepository: class {} }));

/** TEST-ONLY processing-callback secret (≥ 32 characters). */
const CALLBACK_SECRET = "test-only-processing-callback-secret-not-real-07";
const RESULT = { fileId: "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a", status: "READY" } satisfies { fileId: string; status: "READY" };

function controllerWith(env: TestEnv = {}): FilesController {
	const config = createTestTypedConfig(env);
	const prisma = createTestPrisma(config);
	const storage = new LocalObjectStorageAdapter(config);
	const repository = new StoredFileRepository(prisma);
	const tenantTx = new TenantTransactionService(prisma);
	const cedar = new CedarPolicyEvaluatorService(tenantTx);
	const audit = new OrganizationAuditService(tenantTx);
	return new FilesController(
		config,
		new FileService(config, repository, storage, storage, null),
		new FileAuthorizationService(
			createTestAuthorizationKernel(prisma),
			tenantTx,
			new OrganizationRewardAuthService(tenantTx, new OrganizationContextService(tenantTx, cedar, audit), cedar, audit),
		),
		repository,
		storage,
	);
}

describe("FilesController.processingCallback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.applyProcessingResult.mockResolvedValue(undefined);
	});

	it("applies the result when the shared secret matches", async () => {
		await expect(controllerWith({ STORAGE_PROCESSING_CALLBACK_SECRET: CALLBACK_SECRET }).processingCallback(CALLBACK_SECRET, RESULT)).resolves.toEqual({ success: true });
		expect(mocks.applyProcessingResult).toHaveBeenCalledWith(RESULT);
	});

	it("rejects a wrong or missing secret", async () => {
		const controller = controllerWith({ STORAGE_PROCESSING_CALLBACK_SECRET: CALLBACK_SECRET });

		await expect(controller.processingCallback("wrong", RESULT)).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(controller.processingCallback(undefined, RESULT)).rejects.toBeInstanceOf(UnauthorizedException);
		expect(mocks.applyProcessingResult).not.toHaveBeenCalled();
	});

	it("fails closed in every environment when no secret is configured (no dev bypass)", async () => {
		for (const env of [{ NODE_ENV: "development" }, { NODE_ENV: "test" }]) {
			await expect(controllerWith(env).processingCallback(undefined, RESULT)).rejects.toBeInstanceOf(UnauthorizedException);
		}
		expect(mocks.applyProcessingResult).not.toHaveBeenCalled();
	});
});
