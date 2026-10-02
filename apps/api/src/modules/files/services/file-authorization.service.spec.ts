import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import type { CreateFileUploadUrlInput, FileCategory, OrganizationMembershipRole } from "@workspace/shared";

import { createTestAuthorizationKernel, createTestPrisma } from "../../../../test/support/test-service-graph";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationException } from "../../authorization/exceptions/authorization.exception";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "../../organization/services/organization-audit.service";
import { OrganizationContextService } from "../../organization/services/organization-context.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { FILE_AUTHORIZATION_OPERATION, FileAuthorizationService } from "./file-authorization.service";

const mocks = vi.hoisted(() => ({
	authorize: vi.fn(),
	membershipFindFirst: vi.fn(),
	withSystemOperation: vi.fn(),
}));

vi.mock("../../authorization/kernel/authorization-kernel.service", () => ({
	AuthorizationKernelService: class {
		public readonly authorize = mocks.authorize;
	},
}));

vi.mock("../../organization/services/organization-context.service", () => ({
	OrganizationContextService: class {},
}));

vi.mock("../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public readonly withSystemOperation = async <T>(context: object, work: (tx: object) => Promise<T>): Promise<T> => {
			mocks.withSystemOperation(context);
			return work({ organizationMembership: { findFirst: mocks.membershipFindFirst } });
		};
	},
}));

const actor = { id: "user-1", isSuperAdmin: false };
const base: Pick<CreateFileUploadUrlInput, "fileName" | "mimeType" | "sizeBytes" | "checksumSha256"> = {
	fileName: "f.png",
	mimeType: "image/png",
	sizeBytes: 10,
	checksumSha256: "a".repeat(64),
};

function input(overrides: Partial<CreateFileUploadUrlInput>): CreateFileUploadUrlInput {
	return { ...base, category: "USER_AVATAR", ...overrides };
}

function storedFile(category: FileCategory, overrides: Partial<StoredFile> = {}): StoredFile {
	return {
		id: "file-1",
		category,
		visibility: category === "MERCHANT_KYB" ? "PRIVATE" : "PUBLIC",
		originalName: "f.png",
		mimeType: "image/png",
		sizeBytes: 10,
		expectedChecksum: "a".repeat(64),
		actualChecksum: null,
		storageProvider: null,
		storageContainer: null,
		objectRevision: null,
		storageBucket: "private",
		storagePath: "orgs/org-1/f.png",
		publicPath: null,
		objectGeneration: null,
		status: "READY",
		scanStatus: null,
		scannedAt: null,
		scanResult: null,
		uploadedById: "user-1",
		organizationId: category === "STORE_LOGO" || category === "STORE_BANNER" || category === "MERCHANT_KYB" ? "org-1" : null,
		isDeleted: false,
		deletedAt: null,
		createdAt: 0n,
		updatedAt: 0n,
		...overrides,
	};
}

interface ServiceUnderTest {
	readonly service: FileAuthorizationService;
	readonly requireCedarAction: Mock;
}

/** Real FileAuthorizationService + real OrganizationRewardAuthService; only membership lookup and the Cedar call are stubbed. */
function build(): ServiceUnderTest {
	const prisma = createTestPrisma();
	const tenantTx = new TenantTransactionService(prisma);
	const cedar = new CedarPolicyEvaluatorService(tenantTx);
	const audit = new OrganizationAuditService(tenantTx);
	const organizationAuth = new OrganizationRewardAuthService(tenantTx, new OrganizationContextService(tenantTx, cedar, audit), cedar, audit);
	const requireCedarAction = vi.fn().mockResolvedValue(undefined);
	vi.spyOn(organizationAuth, "requireCedarAction").mockImplementation(requireCedarAction);
	return { service: new FileAuthorizationService(createTestAuthorizationKernel(prisma), tenantTx, organizationAuth), requireCedarAction };
}

function memberAs(role: OrganizationMembershipRole | null): void {
	mocks.membershipFindFirst.mockResolvedValue(role === null ? null : { role });
}

describe("FileAuthorizationService uploads", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		mocks.authorize.mockResolvedValue(undefined);
		memberAs(null);
	});

	it("allows only your own avatar", async () => {
		const { service } = build();

		await expect(service.assertCanUpload(actor, input({ userId: "user-1" }))).resolves.toBeUndefined();
		await expect(service.assertCanUpload(actor, input({ userId: "user-2" }))).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("requires PRODUCT:UPDATE through the kernel for product images", async () => {
		mocks.authorize.mockRejectedValue(new AuthorizationException());

		await expect(build().service.assertCanUpload(actor, input({ category: "PRODUCT_IMAGE", productId: "p-1" }))).rejects.toBeInstanceOf(AuthorizationException);
		expect(mocks.authorize).toHaveBeenCalledWith({ subject: { userId: "user-1", isSuperAdmin: false }, action: "UPDATE", resource: "PRODUCT", resourceId: "p-1" });
	});

	it("checks store branding against the tenant Cedar policy after the role table", async () => {
		memberAs("ADMIN");
		const { service, requireCedarAction } = build();

		await expect(service.assertCanUpload(actor, input({ category: "STORE_LOGO", organizationId: "org-1", assetType: "LOGO" }))).resolves.toBeUndefined();
		expect(requireCedarAction).toHaveBeenCalledWith("user-1", "org-1", "rewardhub:manage_locations", "RewardHub", "org-1", "ADMIN");
		expect(mocks.withSystemOperation).toHaveBeenCalledWith(expect.objectContaining({ operation: FILE_AUTHORIZATION_OPERATION }));
	});

	it("denies the upload when the tenant Cedar policy narrows the role", async () => {
		memberAs("OWNER");
		const { service, requireCedarAction } = build();
		requireCedarAction.mockRejectedValue(new ForbiddenException());

		await expect(service.assertCanUpload(actor, input({ category: "MERCHANT_KYB", organizationId: "org-1" }))).rejects.toBeInstanceOf(ForbiddenException);
		expect(requireCedarAction).toHaveBeenCalledWith("user-1", "org-1", "rewardhub:manage_verification", "RewardHub", "org-1", "OWNER");
	});

	it("denies non-members", async () => {
		const { service, requireCedarAction } = build();

		await expect(service.assertCanUpload(actor, input({ category: "STORE_BANNER", organizationId: "org-1", assetType: "BANNER" }))).rejects.toBeInstanceOf(ForbiddenException);
		expect(requireCedarAction).not.toHaveBeenCalled();
	});

	it.each([
		["OWNER", true, true],
		["ADMIN", true, false],
		["CASHIER", false, false],
		["POLICY_ADMIN", false, false],
		["MEMBER", false, false],
	] satisfies [OrganizationMembershipRole, boolean, boolean][])(
		"applies the merchant role table to %s (store branding allowed: %s, KYB allowed: %s)",
		async (role: OrganizationMembershipRole, brandingAllowed: boolean, kybAllowed: boolean): Promise<void> => {
			memberAs(role);
			const { service } = build();
			const banner = service.assertCanUpload(actor, input({ category: "STORE_BANNER", organizationId: "org-1", assetType: "BANNER" }));
			const kyb = service.assertCanUpload(actor, input({ category: "MERCHANT_KYB", organizationId: "org-1" }));

			await (brandingAllowed ? expect(banner).resolves.toBeUndefined() : expect(banner).rejects.toBeInstanceOf(ForbiddenException));
			await (kybAllowed ? expect(kyb).resolves.toBeUndefined() : expect(kyb).rejects.toBeInstanceOf(ForbiddenException));
		},
	);

	it("lets platform SuperAdmins upload in any category", async () => {
		await expect(build().service.assertCanUpload({ id: "root", isSuperAdmin: true }, input({ category: "MERCHANT_KYB", organizationId: "org-9" }))).resolves.toBeUndefined();
		expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
	});
});

describe("FileAuthorizationService existing files", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		memberAs(null);
	});

	it("lets any member read store branding (membership only — no Cedar action)", async () => {
		memberAs("MEMBER");
		const { service, requireCedarAction } = build();

		await expect(service.assertCanRead({ id: "someone-else", isSuperAdmin: false }, storedFile("STORE_LOGO"))).resolves.toBeUndefined();
		expect(requireCedarAction).not.toHaveBeenCalled();
	});

	it("never hands an organization's files to a non-member", async () => {
		const { service } = build();
		const outsider = { id: "outsider", isSuperAdmin: false };

		await expect(service.assertCanRead(outsider, storedFile("STORE_BANNER"))).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.assertCanRead(outsider, storedFile("MERCHANT_KYB"))).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("keeps KYB documents owner-only for reading", async () => {
		memberAs("ADMIN");
		await expect(build().service.assertCanRead(actor, storedFile("MERCHANT_KYB"))).rejects.toBeInstanceOf(ForbiddenException);

		memberAs("OWNER");
		const { service, requireCedarAction } = build();
		await expect(service.assertCanRead(actor, storedFile("MERCHANT_KYB"))).resolves.toBeUndefined();
		expect(requireCedarAction).toHaveBeenCalledWith("user-1", "org-1", "rewardhub:manage_verification", "RewardHub", "org-1", "OWNER");
	});

	it("re-checks the capability when a branding upload completes (a demoted uploader cannot rebind the logo)", async () => {
		memberAs("CASHIER");

		await expect(build().service.assertCanComplete(actor, storedFile("STORE_LOGO"))).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("lets a current admin delete branding they did not upload, but not a former member who did", async () => {
		memberAs("ADMIN");
		await expect(build().service.assertCanDelete({ id: "admin-2", isSuperAdmin: false }, storedFile("STORE_BANNER"))).resolves.toBeUndefined();

		memberAs(null);
		await expect(build().service.assertCanDelete(actor, storedFile("STORE_BANNER"))).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("limits personal files to their uploader", async () => {
		const { service } = build();
		const avatar = storedFile("USER_AVATAR");

		await expect(service.assertCanRead(actor, avatar)).resolves.toBeUndefined();
		await expect(service.assertCanDelete(actor, storedFile("PRODUCT_IMAGE"))).resolves.toBeUndefined();
		await expect(service.assertCanRead({ id: "user-2", isSuperAdmin: false }, avatar)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.assertCanDelete({ id: "user-2", isSuperAdmin: false }, avatar)).rejects.toBeInstanceOf(ForbiddenException);
		expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
	});

	it("lets platform SuperAdmins act on any file", async () => {
		const root = { id: "root", isSuperAdmin: true };

		await expect(build().service.assertCanDelete(root, storedFile("MERCHANT_KYB"))).resolves.toBeUndefined();
		expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
	});
});
