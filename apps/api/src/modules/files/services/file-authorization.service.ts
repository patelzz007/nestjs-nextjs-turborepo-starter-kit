import { ForbiddenException, Injectable } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import {
	FileCategorySchema,
	MERCHANT_CAPABILITY,
	merchantRoleHasCapability,
	type CreateFileUploadUrlInput,
	type FileCategory,
	type MerchantCapability,
	type OrganizationMembershipRole,
} from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationKernelService } from "../../authorization/kernel/authorization-kernel.service";
import { MERCHANT_CAPABILITY_CEDAR_ACTIONS } from "../../organization/constants/merchant-capability-cedar-actions";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";

/** The authenticated caller acting on a stored file. */
export interface FileActor {
	readonly id: string;
	readonly isSuperAdmin: boolean;
}

/** System operation that resolves the caller's organization role (users can't read other members' rows under RLS). */
export const FILE_AUTHORIZATION_OPERATION = "files.authorization";

/** What the caller wants to do with an existing file. */
type FileAction = "complete" | "read" | "delete";

/** Organization-owned categories and the merchant capability each action needs. */
type OrganizationFileCategory = Extract<FileCategory, "STORE_LOGO" | "STORE_BANNER" | "MERCHANT_KYB">;

interface OrganizationFileRule {
	/** Upload, complete and delete — changes what the organization shows or submits. */
	readonly manage: MerchantCapability;
	/** Metadata and signed download URLs. */
	readonly read: MerchantCapability;
	readonly deniedMessage: string;
}

const ORGANIZATION_FILE_RULES: Readonly<Record<OrganizationFileCategory, OrganizationFileRule>> = {
	STORE_LOGO: { manage: MERCHANT_CAPABILITY.manageLocations, read: MERCHANT_CAPABILITY.viewLocations, deniedMessage: "Your organization role cannot change store branding" },
	STORE_BANNER: { manage: MERCHANT_CAPABILITY.manageLocations, read: MERCHANT_CAPABILITY.viewLocations, deniedMessage: "Your organization role cannot change store branding" },
	MERCHANT_KYB: {
		manage: MERCHANT_CAPABILITY.manageVerification,
		read: MERCHANT_CAPABILITY.manageVerification,
		deniedMessage: "Only organization owners can manage verification documents",
	},
};

const FORBIDDEN_ERROR: Readonly<Record<FileAction | "upload", string>> = {
	upload: "FILE_UPLOAD_FORBIDDEN",
	complete: "FILE_UPLOAD_FORBIDDEN",
	read: "FILE_VIEW_FORBIDDEN",
	delete: "FILE_DELETE_FORBIDDEN",
};

function forbidden(action: FileAction | "upload", message: string): ForbiddenException {
	return new ForbiddenException({ message, error: FORBIDDEN_ERROR[action] });
}

function organizationRule(category: FileCategory): OrganizationFileRule | null {
	switch (category) {
		case "STORE_LOGO":
		case "STORE_BANNER":
		case "MERCHANT_KYB":
			return ORGANIZATION_FILE_RULES[category];
		case "PRODUCT_IMAGE":
		case "USER_AVATAR":
			return null;
	}
}

/**
 * Authorization for every authenticated `/files` operation. Invite-token
 * onboarding uploads authorize through their own token and never reach this.
 *
 * - USER_AVATAR   → upload only for the caller's own account; afterwards the uploader
 * - PRODUCT_IMAGE → upload needs `PRODUCT:UPDATE` (Authorization Kernel); afterwards the uploader
 * - STORE_LOGO / STORE_BANNER → upload/complete/delete need `merchant:manage_locations`;
 *   reading needs active membership (`merchant:view_locations`, every role)
 * - MERCHANT_KYB  → every action needs `merchant:manage_verification` (owner-only)
 *
 * Organization capabilities that guard an API action go through
 * {@link OrganizationRewardAuthService.requireMembershipCapability} — the
 * merchant role table, then the tenant Cedar policy, audited — exactly like the
 * rest of the merchant API. Platform SuperAdmins may act in any category.
 */
@Injectable()
export class FileAuthorizationService {
	public constructor(
		private readonly kernel: AuthorizationKernelService,
		private readonly tenantTx: TenantTransactionService,
		private readonly organizationAuth: OrganizationRewardAuthService,
	) {}

	public async assertCanUpload(actor: FileActor, input: CreateFileUploadUrlInput): Promise<void> {
		if (actor.isSuperAdmin) {
			return;
		}

		switch (input.category) {
			case "USER_AVATAR":
				if (input.userId !== actor.id) {
					throw forbidden("upload", "Cannot upload an avatar for another user");
				}
				return;
			case "PRODUCT_IMAGE":
				if (input.productId === undefined) {
					throw forbidden("upload", "A product is required for product images");
				}
				await this.kernel.authorize({ subject: { userId: actor.id, isSuperAdmin: false }, action: "UPDATE", resource: "PRODUCT", resourceId: input.productId });
				return;
			case "STORE_LOGO":
			case "STORE_BANNER":
			case "MERCHANT_KYB": {
				const rule = ORGANIZATION_FILE_RULES[input.category];
				await this.assertOrganizationCapability("upload", actor.id, input.organizationId ?? null, rule.manage, rule.deniedMessage);
				return;
			}
		}
	}

	/** Re-checked at completion: completing a branding upload rebinds the organization's logo/banner. */
	public assertCanComplete(actor: FileActor, file: StoredFile): Promise<void> {
		return this.assertCanAct("complete", actor, file);
	}

	public assertCanRead(actor: FileActor, file: StoredFile): Promise<void> {
		return this.assertCanAct("read", actor, file);
	}

	/** Organization files are deleted by whoever holds the capability now — not by a former member who uploaded them. */
	public assertCanDelete(actor: FileActor, file: StoredFile): Promise<void> {
		return this.assertCanAct("delete", actor, file);
	}

	private async assertCanAct(action: FileAction, actor: FileActor, file: StoredFile): Promise<void> {
		if (actor.isSuperAdmin) {
			return;
		}

		const rule = organizationRule(FileCategorySchema.parse(file.category));
		if (rule === null) {
			if (file.uploadedById !== actor.id) {
				throw forbidden(action, "Not allowed to access this file");
			}
			return;
		}

		const capability = action === "read" ? rule.read : rule.manage;
		await this.assertOrganizationCapability(action, actor.id, file.organizationId, capability, rule.deniedMessage);
	}

	private async assertOrganizationCapability(
		action: FileAction | "upload",
		userId: string,
		organizationId: string | null,
		capability: MerchantCapability,
		message: string,
	): Promise<void> {
		if (organizationId === null) {
			throw forbidden(action, message);
		}
		const role = await this.findActiveRole(userId, organizationId);
		if (role === null) {
			throw forbidden(action, message);
		}
		// Membership-only capabilities (e.g. viewing store branding) have no
		// tenant Cedar action; the role table is the whole rule for them.
		if (MERCHANT_CAPABILITY_CEDAR_ACTIONS[capability] === null) {
			if (!merchantRoleHasCapability(role, capability)) {
				throw forbidden(action, message);
			}
			return;
		}
		await this.organizationAuth.requireMembershipCapability({ userId, organizationId, role }, capability);
	}

	private async findActiveRole(userId: string, organizationId: string): Promise<OrganizationMembershipRole | null> {
		const membership = await this.tenantTx.withSystemOperation(
			{
				operation: FILE_AUTHORIZATION_OPERATION,
				reason: "Resolve the caller's organization role for a file operation",
				actorUserId: userId,
			},
			async (tx) =>
				tx.organizationMembership.findFirst({
					where: { userId, organizationId, status: "ACTIVE", isDeleted: false, organization: { isDeleted: false } },
					select: { role: true },
				}),
		);
		return membership?.role ?? null;
	}
}
