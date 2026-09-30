import { ForbiddenException, Injectable } from "@nestjs/common";
import type { OrganizationMembershipRole } from "@prisma/client";
import type { CreateFileUploadUrlInput } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationKernelService } from "../../authorization/kernel/authorization-kernel.service";

/** The authenticated caller requesting an upload ticket. */
export interface FileUploadActor {
	readonly id: string;
	readonly isSuperAdmin: boolean;
}

/** Organization roles allowed to change store branding (logo / banner). */
const STORE_ASSET_ROLES: ReadonlySet<OrganizationMembershipRole> = new Set<OrganizationMembershipRole>(["OWNER", "ADMIN"]);

function forbidden(message: string): ForbiddenException {
	return new ForbiddenException({ message, error: "FILE_UPLOAD_FORBIDDEN" });
}

/**
 * Per-category authorization for `POST /files/upload-url` (the authenticated
 * browser upload path). Invite-token onboarding uploads authorize through
 * their own token and never reach this check.
 *
 * - USER_AVATAR   → only for the caller's own account
 * - PRODUCT_IMAGE → `PRODUCT:UPDATE` on that product (Authorization Kernel)
 * - STORE_LOGO / STORE_BANNER → active OWNER or ADMIN of the organization
 * - MERCHANT_KYB  → active OWNER of the organization (KYB is owner-only)
 * Platform SuperAdmins may upload in any category.
 */
@Injectable()
export class FileUploadAuthorizationService {
	public constructor(
		private readonly kernel: AuthorizationKernelService,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async assertCanUpload(actor: FileUploadActor, input: CreateFileUploadUrlInput): Promise<void> {
		if (actor.isSuperAdmin) {
			return;
		}

		switch (input.category) {
			case "USER_AVATAR":
				if (input.userId !== actor.id) {
					throw forbidden("Cannot upload an avatar for another user");
				}
				return;
			case "PRODUCT_IMAGE": {
				if (input.productId === undefined) {
					throw forbidden("A product is required for product images");
				}
				await this.kernel.authorize({ subject: { userId: actor.id, isSuperAdmin: false }, action: "UPDATE", resource: "PRODUCT", resourceId: input.productId });
				return;
			}
			case "STORE_LOGO":
			case "STORE_BANNER":
				await this.assertOrganizationRole(actor.id, input.organizationId, STORE_ASSET_ROLES, "Only organization owners or admins can change store branding");
				return;
			case "MERCHANT_KYB":
				await this.assertOrganizationRole(
					actor.id,
					input.organizationId,
					new Set<OrganizationMembershipRole>(["OWNER"]),
					"Only organization owners can upload verification documents",
				);
				return;
		}
	}

	private async assertOrganizationRole(userId: string, organizationId: string | undefined, allowed: ReadonlySet<OrganizationMembershipRole>, message: string): Promise<void> {
		if (organizationId === undefined) {
			throw forbidden(message);
		}
		const membership = await this.tenantTx.withSystemOperation(
			{ operation: "files.upload_authorization", reason: "Resolve uploader organization role", correlationId: `upload-auth:${userId}`, actorUserId: userId },
			async (tx) =>
				tx.organizationMembership.findFirst({
					where: { userId, organizationId, status: "ACTIVE", isDeleted: false, organization: { isDeleted: false } },
					select: { role: true },
				}),
		);
		if (membership === null || !allowed.has(membership.role)) {
			throw forbidden(message);
		}
	}
}
