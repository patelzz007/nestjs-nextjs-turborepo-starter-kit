import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OrganizationMembershipResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MembershipUpdateDuringImpersonationError } from "../../../domain/errors/organizations.errors";
import { actingInOrganization, requireUserActor } from "../../organization-actor";
import { toMembershipResponse } from "../../organization-responses";
import type { OrganizationsScope } from "../../organizations-scope";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { ORGANIZATION_DIRECTORY, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
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
export class RenameOwnMembershipHandler implements ICommandHandler<RenameOwnMembershipCommand, OrganizationMembershipResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RenameOwnMembershipCommand): Promise<OrganizationMembershipResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.orgSlug);
		if (user.impersonatorUserId !== null) {
			throw new MembershipUpdateDuringImpersonationError();
		}

		return this.uow.run(actingInOrganization(user, member.organizationId), async (scope): Promise<OrganizationMembershipResponse> => {
			const membership = await scope.memberships.getOwnActiveForUpdate(member.organizationId, user.userId);
			if (membership === null) {
				throw new NotFoundError();
			}
			const previousDisplayName = membership.rename(input.displayName, this.clock.now());
			const stored = await scope.memberships.save(membership);
			await scope.audit.record({
				organizationId: member.organizationId,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION,
				resourceType: "OrganizationMembership",
				resourceId: membership.id,
				metadata: { previousDisplayName, displayName: input.displayName },
			});
			scope.events.collectFrom(membership);
			return toMembershipResponse(stored);
		});
	}
}
