import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { SupportAccessGrantAggregate } from "../../../domain/aggregates/support-access-grant.aggregate";
import { SupportAccessApproverNotOwnerError, SupportAccessGrantNotFoundError, SupportAccessGrantNotPendingError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, SUPPORT_ACCESS_APPROVE_OPERATION } from "../../ports/authorization.tokens";
import { requireUserActor } from "../../services/rbac-actor";
import { SupportAccessGrantLocator } from "../../services/support-access-grant-locator";
import { SUPPORT_ACCESS_AUDIT_ACTIONS, SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE } from "../../services/support-access-audit";
import { ApproveSupportAccessCommand } from "./approve-support-access.command";

/**
 * Authorization is resource-scoped: the caller must be an active OWNER of the tenant the grant
 * belongs to (read from the grant). The owner membership and the pending, unexpired state are re-checked
 * in the transaction that flips the status (compare-and-set).
 */
@CommandHandler(ApproveSupportAccessCommand)
export class ApproveSupportAccessHandler implements ICommandHandler<ApproveSupportAccessCommand, void> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		private readonly locator: SupportAccessGrantLocator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ApproveSupportAccessCommand): Promise<void> {
		const { grantId } = command;
		const actor = requireUserActor(command.actor);
		const tenantId: string = await this.locator.tenantOf(actor, grantId);
		await this.uow.runSystemOperation(SUPPORT_ACCESS_APPROVE_OPERATION, actor, async (scope: AuthorizationScope): Promise<void> => {
			if (!(await scope.supportTenants.isActiveOwner(tenantId, actor.userId))) {
				throw new SupportAccessApproverNotOwnerError();
			}
			const grant: SupportAccessGrantAggregate | null = await scope.supportGrants.findById(grantId);
			if (grant === null) {
				throw new SupportAccessGrantNotFoundError();
			}
			grant.approve(actor.userId, this.clock.now());
			if ((await scope.supportGrants.save(grant)) === "lost") {
				throw new SupportAccessGrantNotPendingError();
			}
			await scope.tenantAudit.record({
				tenantId,
				actorUserId: actor.userId,
				action: SUPPORT_ACCESS_AUDIT_ACTIONS.approved,
				resourceType: SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE,
				resourceId: grantId,
				decision: "Allow",
			});
		});
	}
}
