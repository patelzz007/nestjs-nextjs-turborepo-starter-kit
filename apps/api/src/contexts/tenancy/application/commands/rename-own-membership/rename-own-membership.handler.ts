import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { MembershipResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MembershipUpdateDuringImpersonationError } from "../../../domain/errors/tenants.errors";
import { actingInTenant, requireUserActor } from "../../tenant-actor";
import { toMembershipResponse } from "../../tenant-responses";
import type { TenantsScope } from "../../tenants-scope";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { RenameOwnMembershipCommand } from "./rename-own-membership.command";

/** Audit action of a member changing their own display name. */
export const OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION = "membership.display_name_updated";

/**
 * The caller is a live ACTIVE member (uniform 404 otherwise) and only ever
 * changes THEIR OWN row, selected by the session's user id. No team
 * capability is needed. An impersonation session cannot change it: the
 * display name is the member's self-representation. The row is locked, so two
 * concurrent edits serialize and each audit row records the value it replaced.
 */
@CommandHandler(RenameOwnMembershipCommand)
export class RenameOwnMembershipHandler implements ICommandHandler<RenameOwnMembershipCommand, MembershipResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RenameOwnMembershipCommand): Promise<MembershipResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		if (user.impersonatorUserId !== null) {
			throw new MembershipUpdateDuringImpersonationError();
		}

		return this.uow.run(actingInTenant(user, member.tenantId), async (scope): Promise<MembershipResponse> => {
			const membership = await scope.memberships.getOwnActiveForUpdate(member.tenantId, user.userId);
			if (membership === null) {
				throw new NotFoundError();
			}
			const previousDisplayName = membership.rename(input.displayName, this.clock.now());
			const stored = await scope.memberships.save(membership);
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION,
				resourceType: "Membership",
				resourceId: membership.id,
				metadata: { previousDisplayName, displayName: input.displayName },
			});
			scope.events.collectFrom(membership);
			return toMembershipResponse(stored);
		});
	}
}
