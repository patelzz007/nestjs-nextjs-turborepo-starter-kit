import type { FileUploadRequest, FileCategory, MerchantCapability } from "@workspace/shared";

import { fileForbidden, type FileAccessAction, type FileAccessSubject, type FileActor, type FileCategoryAccessRule } from "../../../files/public-api";
import type { MembershipRoleLookupPort, MerchantCapabilityGatePort, TenantFileCapabilities } from "../ports/tenant-file-access.port";

/**
 * Tenant files are decided by the caller's CURRENT membership and
 * capability, never by who uploaded them, so a demoted or former member cannot
 * complete, read or delete them. A file without a tenant is refused.
 */
export class TenantFileAccessRule implements FileCategoryAccessRule {
	public constructor(
		public readonly categories: readonly FileCategory[],
		private readonly capabilities: TenantFileCapabilities,
		private readonly memberships: MembershipRoleLookupPort,
		private readonly gate: MerchantCapabilityGatePort,
	) {}

	public async assertCanUpload(actor: FileActor, request: FileUploadRequest): Promise<void> {
		await this.assertCapability("upload", actor.userId, request.tenantId ?? null, this.capabilities.manage);
	}

	public async assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		await this.assertCapability(action, actor.userId, file.tenantId, action === "read" ? this.capabilities.read : this.capabilities.manage);
	}

	private async assertCapability(action: FileAccessAction | "upload", userId: string, tenantId: string | null, capability: MerchantCapability): Promise<void> {
		if (tenantId === null) {
			throw fileForbidden(action, this.capabilities.deniedMessage);
		}
		const role = await this.memberships.activeRole(userId, tenantId);
		if (role === null) {
			throw fileForbidden(action, this.capabilities.deniedMessage);
		}
		await this.gate.requireMembershipCapability({ userId, tenantId, role }, capability);
	}
}
