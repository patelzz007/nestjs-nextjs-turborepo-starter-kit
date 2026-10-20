import { Command } from "@nestjs/cqrs";
import type { MerchantApiKeyCreated, MerchantCreateApiKeyInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /tenants/:tenantSlug/api-keys`: mint a key (its plaintext is shown once). */
export class IssueApiKeyCommand extends Command<MerchantApiKeyCreated> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantCreateApiKeyInput & { readonly tenantId: string },
	) {
		super();
	}
}
