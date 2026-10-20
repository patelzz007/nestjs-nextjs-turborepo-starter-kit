import { Query } from "@nestjs/cqrs";
import type { AdminMerchantInvitePreviewQuery, EmailPreview } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Renders the merchant invite email for a live preview (sends nothing). */
export class PreviewMerchantInviteEmailQuery extends Query<EmailPreview> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminMerchantInvitePreviewQuery,
	) {
		super();
	}
}
