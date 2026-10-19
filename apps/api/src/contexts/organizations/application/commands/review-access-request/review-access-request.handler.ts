import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Membership } from "../../../domain/aggregates/membership.aggregate";
import { LocationScope } from "../../../domain/value-objects/location-scope.value-object";
import { notFound, requireUserActor } from "../../organization-actor";
import type { OrganizationsScope } from "../../organizations-scope";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { MERCHANT_ACCESS, ORGANIZATION_DIRECTORY, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { ReviewAccessRequestCommand } from "./review-access-request.command";

/** Who the duplicate membership belongs to when an approval races another one. */
const REQUESTER_ALREADY_MEMBER_MESSAGE = "The requester is already a member of this organization";

/**
 * The PENDING → reviewed transition is a compare-and-set, so two concurrent
 * reviews cannot both win; the membership and the audit row commit with it.
 * The granted role (never OWNER, per the contract) and store scope cannot
 * exceed the reviewer's own scope.
 */
@CommandHandler(ReviewAccessRequestCommand)
export class ReviewAccessRequestHandler implements ICommandHandler<ReviewAccessRequestCommand, void> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReviewAccessRequestCommand): Promise<void> {
		const { actor, input } = command;
		const reviewer = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.orgSlug);
		const grant = await this.merchantAccess.assertCapability(actor, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageTeam });
		const granted = input.approve ? LocationScope.of(input.locationScopeType, input.locationIds) : null;
		if (granted !== null) {
			LocationScope.of(grant.locationScope, grant.locationIds).assertCanGrant(granted);
		}

		await this.uow.runSystemOperation("organization.access_request.review", actor, async (scope): Promise<void> => {
			const request = await scope.accessRequests.findInOrganization(member.organizationId, input.requestId);
			if (request === null) {
				throw notFound();
			}
			const now = this.clock.now();
			const auditBase = {
				organizationId: member.organizationId,
				actorUserId: reviewer.userId,
				policyVersion: member.policyVersion,
				resourceType: "OrganizationAccessRequest",
				resourceId: request.id,
			};

			if (!input.approve || granted === null) {
				request.reject(reviewer.userId, now);
				await scope.accessRequests.save(request);
				await scope.audit.record({ ...auditBase, action: "membership.access_request_rejected", metadata: { requesterUserId: request.requesterUserId } });
				scope.events.collectFrom(request);
				return;
			}

			request.approve(reviewer.userId, now);
			await scope.accessRequests.save(request);
			granted.assertAllActive(await scope.locations.countActiveAmong(member.organizationId, granted.locationIds));
			const membership = Membership.grant(scope.memberships.nextId(), member.organizationId, request.requesterUserId, input.role, granted, now);
			await scope.memberships.add(membership, REQUESTER_ALREADY_MEMBER_MESSAGE);
			await scope.audit.record({
				...auditBase,
				action: "membership.access_request_approved",
				metadata: {
					requesterUserId: request.requesterUserId,
					membershipId: membership.id,
					role: input.role,
					locationScopeType: input.locationScopeType,
					locationIds: input.locationIds.join(","),
				},
			});
			scope.events.collectFrom(request);
			scope.events.collectFrom(membership);
		});
	}
}
