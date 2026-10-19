import { merchantRoleHasCapability, type CreateFileUploadUrlInput, type FileCategory, type MerchantCapability } from "@workspace/shared";

import { fileForbidden, type FileAccessAction, type FileAccessSubject, type FileActor, type FileCategoryAccessRule } from "../../../files/public-api";
import type { MembershipRoleLookupPort, MerchantCapabilityGatePort, OrganizationFileCapabilities } from "../ports/organization-file-access.port";

/**
 * Organization files are decided by the caller's CURRENT membership and
 * capability, never by who uploaded them, so a demoted or former member cannot
 * complete, read or delete them. A file without an organization is refused.
 */
export class OrganizationFileAccessRule implements FileCategoryAccessRule {
	public constructor(
		public readonly categories: readonly FileCategory[],
		private readonly capabilities: OrganizationFileCapabilities,
		private readonly memberships: MembershipRoleLookupPort,
		private readonly gate: MerchantCapabilityGatePort,
	) {}

	public async assertCanUpload(actor: FileActor, request: CreateFileUploadUrlInput): Promise<void> {
		await this.assertCapability("upload", actor.userId, request.organizationId ?? null, this.capabilities.manage);
	}

	public async assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		await this.assertCapability(action, actor.userId, file.organizationId, action === "read" ? this.capabilities.read : this.capabilities.manage);
	}

	private async assertCapability(action: FileAccessAction | "upload", userId: string, organizationId: string | null, capability: MerchantCapability): Promise<void> {
		if (organizationId === null) {
			throw fileForbidden(action, this.capabilities.deniedMessage);
		}
		const role = await this.memberships.activeRole(userId, organizationId);
		if (role === null) {
			throw fileForbidden(action, this.capabilities.deniedMessage);
		}
		if (this.gate.isMembershipOnly(capability)) {
			if (!merchantRoleHasCapability(role, capability)) {
				throw fileForbidden(action, this.capabilities.deniedMessage);
			}
			return;
		}
		await this.gate.requireMembershipCapability({ userId, organizationId, role }, capability);
	}
}
