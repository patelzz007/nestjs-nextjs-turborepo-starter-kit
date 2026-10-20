import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, RefreshTokenPayload, StopImpersonationServiceResponse, UserPermissions } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { DeviceSession } from "../../../domain/aggregates/device-session.aggregate";
import { ImpersonationSession } from "../../../domain/aggregates/impersonation-session.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { ImpersonationSessionInvalidError, RefreshTokenInvalidError, RefreshTokenRevokedError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { IdentityTokensPort } from "../../ports/identity-tokens.port";
import { IDENTITY_TOKENS, IDENTITY_UNIT_OF_WORK, IMPERSONATION_STOP_OPERATION } from "../../ports/identity.tokens";
import { auditOriginOf } from "../../services/audit-origin";
import { accountViewOf, buildFlatUser } from "../../services/user-response.assembler";
import { StopImpersonationCommand } from "./stop-impersonation.command";

/**
 * Stops impersonating. The administrator is validated FIRST (still an active SuperAdmin — otherwise
 * nothing is restored), together with the device session the restored token binds to (`sid`): the
 * jti of the administrator's own presented refresh token, which must name one of their live sessions; then the session is ended by compare-and-set with its STOP audit row and
 * outbox event in one transaction, which revokes the impersonation token; a replayed stop finds the
 * session ended and mints nothing.
 */
@CommandHandler(StopImpersonationCommand)
export class StopImpersonationHandler implements ICommandHandler<StopImpersonationCommand, StopImpersonationServiceResponse> {
	private readonly logger: Logger = new Logger(StopImpersonationHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: StopImpersonationCommand): Promise<StopImpersonationServiceResponse> {
		const { actor, input } = command;
		const startedAt: EpochMs = this.clock.now();
		// Signature and expiry first (401 otherwise); the token must be the administrator's own.
		const refresh: RefreshTokenPayload = await this.tokens.verifyRefreshToken(input.presentedRefreshToken);
		if (refresh.sub !== input.impersonatorId) {
			throw new RefreshTokenInvalidError("The refresh token does not belong to the impersonating administrator");
		}
		const impersonator: UserAccount = await this.uow.runSystemOperation(IMPERSONATION_STOP_OPERATION, actor, async (scope: IdentityScope): Promise<UserAccount> => {
			const account: UserAccount | null = await scope.accounts.findById(input.impersonatorId);
			ImpersonationSession.assertImpersonatorRestorable(
				account === null ? null : { userId: account.id, isSuperAdmin: account.isSuperAdmin, isActive: account.isActive, isDeleted: account.isDeleted },
			);
			if (account === null) {
				throw new ImpersonationSessionInvalidError();
			}
			const now: EpochMs = this.clock.now();
			const device: DeviceSession | null = await scope.sessions.findById(refresh.jti);
			if (!device?.isLiveFor(input.impersonatorId, now)) {
				throw new RefreshTokenRevokedError();
			}
			const session: ImpersonationSession | null = await scope.impersonations.findById(input.impersonationSessionId);
			if (session === null) {
				throw new ImpersonationSessionInvalidError();
			}
			session.stop(
				{ impersonatorId: input.impersonatorId, targetUserId: input.targetUserId },
				{ ...auditOriginOf(actor), ipAddress: input.ipAddress, userAgent: input.userAgent },
				startedAt,
				now,
			);
			await scope.impersonations.saveEnded(session);
			scope.events.collectFrom(session);
			return account;
		});

		const permissions: UserPermissions = await this.grants.getUserPermissionDetails(impersonator.id);
		const accessToken: string = await this.tokens.generateAccessToken(buildFlatUser(accountViewOf(impersonator), permissions, this.clock.now()), refresh.jti);
		this.logger.warn({ event: "impersonation.ended", impersonatorId: input.impersonatorId, targetUserId: input.targetUserId, sessionId: input.impersonationSessionId });
		return { message: "Impersonation ended. Original session restored.", accessToken };
	}
}
