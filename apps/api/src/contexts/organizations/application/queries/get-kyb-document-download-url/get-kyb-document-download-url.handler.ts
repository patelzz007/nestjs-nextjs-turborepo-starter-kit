import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantKybDocumentDownloadResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import { kybDocumentScanStatusOf } from "../../../domain/policies/kyb-evidence.policy";
import { actingInOrganization, requireUserActor } from "../../organization-actor";
import type { KybFileAccessPort } from "../../ports/kyb-files.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { KYB_FILE_ACCESS, KYB_READ, MERCHANT_ACCESS, ORGANIZATION_DIRECTORY } from "../../ports/organizations.tokens";
import { GetKybDocumentDownloadUrlQuery, type KybDocumentRequester } from "./get-kyb-document-download-url.query";

/** Any id that is not part of the organization's active evidence is the same 404, whoever owns the file. */
@QueryHandler(GetKybDocumentDownloadUrlQuery)
export class GetKybDocumentDownloadUrlHandler implements IQueryHandler<GetKybDocumentDownloadUrlQuery, MerchantKybDocumentDownloadResponse> {
	public constructor(
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(KYB_FILE_ACCESS) private readonly files: KybFileAccessPort,
	) {}

	public async execute(query: GetKybDocumentDownloadUrlQuery): Promise<MerchantKybDocumentDownloadResponse> {
		const { actor, input } = query;
		const { organizationId, readActor } = await this.authorize(actor, input.requester);
		const document = await this.kyb.findActiveEvidence(readActor, organizationId, input.documentId, input.requester.kind);
		if (document === null) {
			throw new NotFoundError({ code: "KYB_DOCUMENT_NOT_FOUND", message: "Document not found" });
		}
		const download = await this.files.createDownloadUrl(document.id, input.disposition);
		return { documentId: input.documentId, scanStatus: kybDocumentScanStatusOf(document), downloadUrl: download.downloadUrl, expiresAt: download.expiresAt };
	}

	private async authorize(actor: ActorContext, requester: KybDocumentRequester): Promise<{ readonly organizationId: string; readonly readActor: ActorContext }> {
		if (requester.kind === "admin") {
			return { organizationId: requester.organizationId, readActor: actor };
		}
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(user, requester.orgSlug);
		await this.merchantAccess.assertCapability(user, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageVerification });
		return { organizationId: member.organizationId, readActor: actingInOrganization(user, member.organizationId) };
	}
}
