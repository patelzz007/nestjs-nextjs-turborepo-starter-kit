import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { OrganizationAssetSlot, OrganizationFileBindings, OrganizationFileScope } from "../../application/ports/organization-file-bindings.port";
import { newRowId } from "@workspace/shared";

function softDeleted(deletedBy: string, deletedAt: number): { readonly isDeleted: true; readonly deletedAt: bigint; readonly deletedBy: string; readonly updatedAt: bigint } {
	const at = BigInt(deletedAt);
	return { isDeleted: true, deletedAt: at, deletedBy, updatedAt: at };
}

class PrismaOrganizationFileBindings implements OrganizationFileBindings {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/** `(organization_id, asset_type)` is unique: the upsert replaces the previous asset and revives a released row. */
	public async bindStoreAsset(organizationId: string, slot: OrganizationAssetSlot, fileId: string, boundAt: number): Promise<void> {
		await this.db.organizationAsset.upsert({
			where: { organizationId_assetType: { organizationId, assetType: slot } },
			create: { id: newRowId(), organizationId, assetType: slot, fileId },
			update: { fileId, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: BigInt(boundAt) },
		});
	}

	public async releaseStoreAsset(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		await this.db.organizationAsset.updateMany({ where: { fileId, isDeleted: false }, data: softDeleted(deletedBy, deletedAt) });
	}

	public async releaseKybEvidence(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		await this.db.organizationKybFile.updateMany({ where: { fileId, isDeleted: false }, data: { ...softDeleted(deletedBy, deletedAt), isActive: false } });
	}

	/** Retired links count too: a submitted document stays part of the review history. */
	public async isKybEvidence(fileId: string): Promise<boolean> {
		const reference = await this.db.organizationKybFile.findFirst({ where: { fileId }, select: { id: true } });
		return reference !== null;
	}
}

/** Binds organizations' file-backed rows to the files transaction that reacts to a file event. Never cached. */
export class OrganizationFileScopeFactory implements ScopeFactory<OrganizationFileScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient): OrganizationFileScope {
		return { organizationFiles: new PrismaOrganizationFileBindings(db) };
	}
}
