import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import type { CreateFileUploadUrlInput } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationException } from "../../authorization/exceptions/authorization.exception";
import { AuthorizationKernelService } from "../../authorization/kernel/authorization-kernel.service";
import { FileUploadAuthorizationService } from "./file-upload-authorization.service";

const mocks = vi.hoisted(() => ({
	authorize: vi.fn(),
	membershipFindFirst: vi.fn(),
}));

vi.mock("../../authorization/kernel/authorization-kernel.service", () => ({
	AuthorizationKernelService: class {
		public readonly authorize = mocks.authorize;
	},
}));

vi.mock("../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public readonly withSystemOperation = async <T>(_context: object, work: (tx: object) => Promise<T>): Promise<T> =>
			work({ organizationMembership: { findFirst: mocks.membershipFindFirst } });
	},
}));

const actor = { id: "user-1", isSuperAdmin: false };
const base = { fileName: "f.png", mimeType: "image/png", sizeBytes: 10, checksumSha256: "a".repeat(64) };

function input(overrides: Partial<CreateFileUploadUrlInput>): CreateFileUploadUrlInput {
	return { ...base, category: "USER_AVATAR", ...overrides };
}

const service = (): FileUploadAuthorizationService => new FileUploadAuthorizationService(new AuthorizationKernelService(), new TenantTransactionService());

describe("FileUploadAuthorizationService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.authorize.mockResolvedValue(undefined);
		mocks.membershipFindFirst.mockResolvedValue(null);
	});

	it("allows only your own avatar", async () => {
		await expect(service().assertCanUpload(actor, input({ userId: "user-1" }))).resolves.toBeUndefined();
		await expect(service().assertCanUpload(actor, input({ userId: "user-2" }))).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("requires PRODUCT:UPDATE through the kernel for product images", async () => {
		mocks.authorize.mockRejectedValue(new AuthorizationException());

		await expect(service().assertCanUpload(actor, input({ category: "PRODUCT_IMAGE", productId: "p-1" }))).rejects.toBeInstanceOf(AuthorizationException);
		expect(mocks.authorize).toHaveBeenCalledWith({ subject: { userId: "user-1", isSuperAdmin: false }, action: "UPDATE", resource: "PRODUCT", resourceId: "p-1" });
	});

	it("lets owners and admins (not cashiers) change store branding", async () => {
		const logo = input({ category: "STORE_LOGO", organizationId: "org-1", assetType: "LOGO" });

		mocks.membershipFindFirst.mockResolvedValue({ role: "ADMIN" });
		await expect(service().assertCanUpload(actor, logo)).resolves.toBeUndefined();

		mocks.membershipFindFirst.mockResolvedValue({ role: "CASHIER" });
		await expect(service().assertCanUpload(actor, logo)).rejects.toBeInstanceOf(ForbiddenException);

		mocks.membershipFindFirst.mockResolvedValue(null);
		await expect(service().assertCanUpload(actor, logo)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("restricts KYB documents to organization owners", async () => {
		const kyb = input({ category: "MERCHANT_KYB", organizationId: "org-1" });

		mocks.membershipFindFirst.mockResolvedValue({ role: "OWNER" });
		await expect(service().assertCanUpload(actor, kyb)).resolves.toBeUndefined();

		mocks.membershipFindFirst.mockResolvedValue({ role: "ADMIN" });
		await expect(service().assertCanUpload(actor, kyb)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("lets platform SuperAdmins upload in any category", async () => {
		await expect(service().assertCanUpload({ id: "root", isSuperAdmin: true }, input({ category: "MERCHANT_KYB", organizationId: "org-9" }))).resolves.toBeUndefined();
		expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
	});
});
