import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TenantAssetSlot, TenantFileBindings, TenantFileScope } from "../../application/ports/tenant-file-bindings.port";
import { newRowId } from "@workspace/shared";

function softDeleted(deletedBy: string, deletedAt: number): { readonly isDeleted: true; readonly deletedAt: bigint; readonly deletedBy: string; readonly updatedAt: bigint } {
	const at = BigInt(deletedAt);
	return { isDeleted: true, deletedAt: at, deletedBy, updatedAt: at };
}

class PrismaTenantFileBindings implements TenantFileBindings {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/** `(tenant_id, asset_type)` is unique: the upsert replaces the previous asset and revives a released row. */
	public async bindStoreAsset(tenantId: string, slot: TenantAssetSlot, fileId: string, boundAt: number): Promise<void> {
		await this.db.tenantAsset.upsert({
			where: { tenantId_assetType: { tenantId, assetType: slot } },
			create: { id: newRowId(), tenantId, assetType: slot, fileId },
			update: { fileId, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: BigInt(boundAt) },
		});
	}

	public async releaseStoreAsset(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		await this.db.tenantAsset.updateMany({ where: { fileId, isDeleted: false }, data: softDeleted(deletedBy, deletedAt) });
	}

	public async releaseKybEvidence(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		await this.db.tenantKybFile.updateMany({ where: { fileId, isDeleted: false }, data: { ...softDeleted(deletedBy, deletedAt), isActive: false } });
	}

	/** Retired links count too: a submitted document stays part of the review history. */
	public async isKybEvidence(fileId: string): Promise<boolean> {
		const reference = await this.db.tenantKybFile.findFirst({ where: { fileId }, select: { id: true } });
		return reference !== null;
	}
}

/** Binds tenants' file-backed rows to the files transaction that reacts to a file event. Never cached. */
export class TenantFileScopeFactory implements ScopeFactory<TenantFileScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient): TenantFileScope {
		return { tenantFiles: new PrismaTenantFileBindings(db) };
	}
}
