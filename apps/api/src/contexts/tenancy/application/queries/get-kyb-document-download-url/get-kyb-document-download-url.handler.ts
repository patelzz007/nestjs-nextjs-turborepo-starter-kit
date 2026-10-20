import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantKybDocumentDownloadResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import { kybDocumentScanStatusOf } from "../../../domain/policies/kyb-evidence.policy";
import { actingInTenant, requireUserActor } from "../../tenant-actor";
import type { KybFileAccessPort } from "../../ports/kyb-files.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { KYB_FILE_ACCESS, KYB_READ, MERCHANT_ACCESS, TENANT_DIRECTORY } from "../../ports/tenants.tokens";
import { GetKybDocumentDownloadUrlQuery, type KybDocumentRequester } from "./get-kyb-document-download-url.query";

/** Any id that is not part of the tenant's active evidence is the same 404, whoever owns the file. */
@QueryHandler(GetKybDocumentDownloadUrlQuery)
export class GetKybDocumentDownloadUrlHandler implements IQueryHandler<GetKybDocumentDownloadUrlQuery, MerchantKybDocumentDownloadResponse> {
	public constructor(
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(KYB_FILE_ACCESS) private readonly files: KybFileAccessPort,
	) {}

	public async execute(query: GetKybDocumentDownloadUrlQuery): Promise<MerchantKybDocumentDownloadResponse> {
		const { actor, input } = query;
		const { tenantId, readActor } = await this.authorize(actor, input.requester);
		const document = await this.kyb.findActiveEvidence(readActor, tenantId, input.documentId, input.requester.kind);
		if (document === null) {
			throw new NotFoundError({ code: "KYB_DOCUMENT_NOT_FOUND", message: "Document not found" });
		}
		const download = await this.files.createDownloadUrl(document.id, input.disposition);
		return { documentId: input.documentId, scanStatus: kybDocumentScanStatusOf(document), downloadUrl: download.downloadUrl, expiresAt: download.expiresAt };
	}

	private async authorize(actor: ActorContext, requester: KybDocumentRequester): Promise<{ readonly tenantId: string; readonly readActor: ActorContext }> {
		if (requester.kind === "admin") {
			return { tenantId: requester.tenantId, readActor: actor };
		}
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(user, requester.tenantSlug);
		await this.merchantAccess.assertCapability(user, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageVerification });
		return { tenantId: member.tenantId, readActor: actingInTenant(user, member.tenantId) };
	}
}
