import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { bindInTransactionHandler } from "../../../../platform/application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../../../platform/application/events/in-transaction-event-registry";
import { bindFileReferenceGuard, FileCategoryAccessRegistry, FileReferenceGuardRegistry } from "../../../files/public-api";
import { BindStoreAssetOnFileVerdict } from "../../application/event-handlers/in-transaction/bind-store-asset-on-file-verdict.in-transaction-handler";
import { ReleaseKybEvidenceOnFileDeleted } from "../../application/event-handlers/in-transaction/release-kyb-evidence-on-file-deleted.in-transaction-handler";
import { ReleaseStoreAssetOnFileDeleted } from "../../application/event-handlers/in-transaction/release-store-asset-on-file-deleted.in-transaction-handler";
import type { TenantFileAccessPort } from "../../application/ports/tenant-file-access.port";
import { TENANT_FILE_ACCESS } from "../../application/ports/tenants.tokens";
import { KybEvidenceRetentionGuard } from "../../application/services/kyb-evidence-retention.guard";
import { KYB_EVIDENCE_CAPABILITIES, STORE_BRANDING_CAPABILITIES } from "../../application/services/tenant-file-capabilities";
import { TenantFileScopeFactory } from "./prisma-tenant-file-bindings";

/**
 * Tenants owns STORE_LOGO, STORE_BANNER and MERCHANT_KYB: who may act on
 * them, the asset row a READY branding file becomes, the KYB links a deleted
 * upload retires (mechanism 1, in the files transaction) and the retention of
 * submitted evidence.
 */
@Injectable()
export class TenantsFileRegistrations implements OnModuleInit {
	public constructor(
		private readonly access: FileCategoryAccessRegistry,
		@Inject(FileReferenceGuardRegistry) private readonly guards: FileReferenceGuardRegistry<Prisma.TransactionClient>,
		@Inject(InTransactionEventRegistry) private readonly handlers: InTransactionEventRegistry<Prisma.TransactionClient>,
		@Inject(TENANT_FILE_ACCESS) private readonly tenantFiles: TenantFileAccessPort,
	) {}

	public onModuleInit(): void {
		const scopes = new TenantFileScopeFactory();
		this.access.register(this.tenantFiles.ruleFor(["STORE_LOGO", "STORE_BANNER"], STORE_BRANDING_CAPABILITIES));
		this.access.register(this.tenantFiles.ruleFor(["MERCHANT_KYB"], KYB_EVIDENCE_CAPABILITIES));
		this.guards.register(bindFileReferenceGuard(new KybEvidenceRetentionGuard(), scopes));
		this.handlers.register(bindInTransactionHandler(new BindStoreAssetOnFileVerdict(), scopes));
		this.handlers.register(bindInTransactionHandler(new ReleaseStoreAssetOnFileDeleted(), scopes));
		this.handlers.register(bindInTransactionHandler(new ReleaseKybEvidenceOnFileDeleted(), scopes));
	}
}
