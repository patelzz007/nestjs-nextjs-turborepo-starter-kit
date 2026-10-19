import { Inject, Injectable } from "@nestjs/common";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import type { SupportAccessGrantAggregate } from "../../domain/aggregates/support-access-grant.aggregate";
import { SupportAccessGrantNotFoundError } from "../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, SUPPORT_ACCESS_VERIFY_OPERATION } from "../ports/authorization.tokens";

/**
 * The organization a grant belongs to, read from the grant record (never from the request) under
 * `support_access.verify`. Its active policy version is then read before the transition's own transaction.
 */
@Injectable()
export class SupportAccessGrantLocator {
	public constructor(@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>) {}

	/** @throws SupportAccessGrantNotFoundError for an unknown grant. */
	public async organizationOf(actor: ActorContext, grantId: string): Promise<string> {
		return this.uow.runSystemOperation(SUPPORT_ACCESS_VERIFY_OPERATION, actor, async (scope: AuthorizationScope): Promise<string> => {
			const grant: SupportAccessGrantAggregate | null = await scope.supportGrants.findById(grantId);
			if (grant === null) {
				throw new SupportAccessGrantNotFoundError();
			}
			return grant.organizationId;
		});
	}
}
