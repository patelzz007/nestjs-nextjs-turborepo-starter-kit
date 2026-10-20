import { Query } from "@nestjs/cqrs";
import type { FileDownloadDisposition, MerchantKybDocumentDownloadResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Who asks: the merchant (by route key, `merchant:manage_verification`) or a platform admin (by id, `LIST MERCHANT_ORG`). */
export type KybDocumentRequester = { readonly kind: "member"; readonly tenantSlug: string } | { readonly kind: "admin"; readonly tenantId: string };

export interface GetKybDocumentDownloadUrlInput {
	readonly requester: KybDocumentRequester;
	readonly documentId: string;
	readonly disposition: FileDownloadDisposition;
}

/** A short-lived signed URL for one document of the tenant's active KYB evidence. */
export class GetKybDocumentDownloadUrlQuery extends Query<MerchantKybDocumentDownloadResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetKybDocumentDownloadUrlInput,
	) {
		super();
	}
}
