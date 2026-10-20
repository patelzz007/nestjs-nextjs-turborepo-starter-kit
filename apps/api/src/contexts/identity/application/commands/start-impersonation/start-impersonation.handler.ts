import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, type EpochMs, type ImpersonateServiceResponse, type UserPermissions } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { ImpersonationSession, type ImpersonationParty } from "../../../domain/aggregates/impersonation-session.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { ImpersonationTargetNotFoundError, ImpersonatorNotSuperAdminError } from "../../../domain/errors/identity.errors";
import { assertCanRequestImpersonation, assertImpersonationGrants } from "../../../domain/policies/impersonation-start.policy";
import type { ImpersonationTenantFacts } from "../../ports/impersonation-tenant-facts.port";
import type { IdentityScope } from "../../identity-scope";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import type { IdentitySettings } from "../../ports/identity-settings.port";
import type { IdentityTokensPort } from "../../ports/identity-tokens.port";
import {
	ID_GENERATOR,
	IDENTITY_SETTINGS,
	IDENTITY_TOKENS,
	IDENTITY_UNIT_OF_WORK,
	IMPERSONATION_START_OPERATION,
	IMPERSONATION_TENANT_FACTS,
} from "../../ports/identity.tokens";
import { auditOriginOf } from "../../services/audit-origin";
import { accountViewOf, buildFlatUser, buildUserResponse } from "../../services/user-response.assembler";
import { StartImpersonationCommand } from "./start-impersonation.command";

function partyOf(account: UserAccount | null): ImpersonationParty | null {
	return account === null ? null : { userId: account.id, isSuperAdmin: account.isSuperAdmin, isActive: account.isActive, isDeleted: account.isDeleted };
}

/**
 * A SuperAdmin starts impersonating a user. The step-up rule is checked first, then — in ONE
 * transaction under the impersonator's row lock (D36) — every eligibility rule and the "one live
 * session per administrator" rule, the session with its START audit row, the session-bound token
 * and the `impersonation.action` outbox event.
 */
@CommandHandler(StartImpersonationCommand)
export class StartImpersonationHandler implements ICommandHandler<StartImpersonationCommand, ImpersonateServiceResponse> {
	private readonly logger: Logger = new Logger(StartImpersonationHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(IMPERSONATION_TENANT_FACTS) private readonly tenantFacts: ImpersonationTenantFacts,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: StartImpersonationCommand): Promise<ImpersonateServiceResponse> {
		const { actor, input } = command;
		const startedAt: EpochMs = this.clock.now();
		if (actor.kind !== "user") {
			throw new ImpersonatorNotSuperAdminError();
		}
		assertCanRequestImpersonation(
			{ mfaAssuredAt: input.mfaAssuredAt === null ? null : epochMs(input.mfaAssuredAt), isImpersonating: actor.impersonatorUserId !== null },
			this.settings.mfaStepUpTtlMs,
			startedAt,
		);
		const permissions: UserPermissions = await this.grants.getUserPermissionDetails(input.targetUserId);
		const membershipTenantIds = await this.tenantFacts.membershipTenantIds(input.targetUserId);
		const approvedGrants = await this.tenantFacts.approvedGrants(actor.userId, startedAt);
		const supportAccessGrantIds: readonly string[] = assertImpersonationGrants(membershipTenantIds, approvedGrants);

		const started = await this.uow.runSystemOperation(
			IMPERSONATION_START_OPERATION,
			actor,
			async (scope: IdentityScope): Promise<{ readonly accessToken: string; readonly target: UserAccount }> => {
				const now: EpochMs = this.clock.now();
				const impersonator: UserAccount | null = await scope.accounts.lockById(actor.userId);
				const target: UserAccount | null = actor.userId === input.targetUserId ? impersonator : await scope.accounts.findById(input.targetUserId);
				const session: ImpersonationSession = ImpersonationSession.start(
					{
						id: this.ids.next(),
						impersonator: partyOf(impersonator),
						target: partyOf(target),
						targetUserId: input.targetUserId,
						impersonatorHasLiveSession: await scope.impersonations.hasLiveSessionFor(actor.userId, now),
						supportAccessGrantIds,
						origin: { ...auditOriginOf(actor), ipAddress: input.ipAddress, userAgent: input.userAgent },
						actionStartedAt: startedAt,
					},
					now,
				);
				if (target === null) {
					// Unreachable: `start` refuses a missing target first. Kept so the type narrows without a cast.
					throw new ImpersonationTargetNotFoundError();
				}
				await scope.impersonations.add(session);
				const accessToken: string = await this.tokens.generateImpersonationToken(buildFlatUser(accountViewOf(target), permissions, now), actor.userId, session.id);
				scope.events.collectFrom(session);
				return { accessToken, target };
			},
		);

		this.logger.warn({ event: "impersonation.started", superAdminId: actor.userId, targetUserId: input.targetUserId });
		return {
			accessToken: started.accessToken,
			message: `Now impersonating ${started.target.email.value}`,
			impersonating: true,
			originalUserId: actor.userId,
			user: buildUserResponse(accountViewOf(started.target), permissions, this.clock.now()),
		};
	}
}
