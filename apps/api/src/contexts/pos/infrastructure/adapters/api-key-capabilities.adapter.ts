import type { Prisma } from "@prisma/client";
import type { CapabilitySlug } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { ApiKeyCapabilitiesPort } from "../../../organizations/public-api";
import { API_KEY_SCOPE_CAPABILITIES } from "../../domain/policies/api-key-scope.policy";

/** Organizations' `ApiKeyCapabilitiesPort`: the key's scope, read under the key's own RLS session, mapped to its capabilities. */
export class ApiKeyCapabilitiesAdapter implements ApiKeyCapabilitiesPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public async capabilitiesOf(actor: Extract<ActorContext, { kind: "api_key" }>): Promise<readonly CapabilitySlug[] | null> {
		const key = await this.reads.read(actor, async (db: Prisma.TransactionClient) =>
			db.organizationApiKey.findFirst({ where: { id: actor.apiKeyId, organizationId: actor.organizationId, isDeleted: false, revokedAt: null }, select: { scope: true } }),
		);
		return key === null ? null : API_KEY_SCOPE_CAPABILITIES[key.scope];
	}
}
