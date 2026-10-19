import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { SupportAccessGrantAggregate } from "../../../domain/aggregates/support-access-grant.aggregate";
import { SupportAccessGrantNotFoundError, SupportAccessGrantNotRevocableError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, CEDAR_POLICY_EVALUATOR, SUPPORT_ACCESS_REVOKE_OPERATION } from "../../ports/authorization.tokens";
import type { CedarPolicyEvaluatorPort } from "../../ports/cedar-policy-evaluator.port";
import { requireUserActor } from "../../services/rbac-actor";
import { SupportAccessGrantLocator } from "../../services/support-access-grant-locator";
import { SUPPORT_ACCESS_AUDIT_ACTIONS, SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE } from "../../services/support-access-audit";
import { RevokeSupportAccessCommand } from "./revoke-support-access.command";

/** A terminal grant is a 409: never revived, never re-revoked. Compare-and-set on the loaded status. */
@CommandHandler(RevokeSupportAccessCommand)
export class RevokeSupportAccessHandler implements ICommandHandler<RevokeSupportAccessCommand, void> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		private readonly locator: SupportAccessGrantLocator,
		@Inject(CEDAR_POLICY_EVALUATOR) private readonly cedar: CedarPolicyEvaluatorPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RevokeSupportAccessCommand): Promise<void> {
		const { grantId } = command;
		const actor = requireUserActor(command.actor);
		const organizationId: string = await this.locator.organizationOf(actor, grantId);
		const policyVersion: number = await this.cedar.getActivePolicyVersion(organizationId);
		await this.uow.runSystemOperation(SUPPORT_ACCESS_REVOKE_OPERATION, actor, async (scope: AuthorizationScope): Promise<void> => {
			const grant: SupportAccessGrantAggregate | null = await scope.supportGrants.findById(grantId);
			if (grant === null) {
				throw new SupportAccessGrantNotFoundError();
			}
			grant.revoke(this.clock.now());
			if ((await scope.supportGrants.save(grant)) === "lost") {
				throw new SupportAccessGrantNotRevocableError();
			}
			await scope.organizationAudit.record({
				organizationId,
				actorUserId: actor.userId,
				policyVersion,
				action: SUPPORT_ACCESS_AUDIT_ACTIONS.revoked,
				resourceType: SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE,
				resourceId: grantId,
			});
		});
	}
}
