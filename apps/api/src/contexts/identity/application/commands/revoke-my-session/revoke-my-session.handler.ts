import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, RevokeSessionResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { DeviceSessionNotFoundError, SessionRevokeDuringImpersonationError } from "../../../domain/errors/identity.errors";
import { DeviceSessionSignedOut, DeviceSessionsRevoked } from "../../../domain/events/identity.events";
import type { OwnSessionRevocation } from "../../../domain/repositories/device-session.repository";
import { revokedByUser } from "../../../domain/value-objects/session-revoker.value-object";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { RevokeMySessionCommand } from "./revoke-my-session.command";

/**
 * Signs out one of the caller's devices from the device list (ADR 034). Refused during impersonation
 * (the user would be recorded as the actor of a sign-out they never made). Any id that is not one of
 * the caller's sessions is 404, never 403. Idempotent: an already revoked session answers success.
 */
@CommandHandler(RevokeMySessionCommand)
export class RevokeMySessionHandler implements ICommandHandler<RevokeMySessionCommand, RevokeSessionResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RevokeMySessionCommand): Promise<RevokeSessionResponse> {
		const { actor, input } = command;
		if (actor.kind !== "user") {
			throw new DeviceSessionNotFoundError();
		}
		if (actor.impersonatorUserId !== null) {
			throw new SessionRevokeDuringImpersonationError();
		}
		const startedAt: EpochMs = this.clock.now();
		const outcome: OwnSessionRevocation = await this.uow.run(actor, async (scope: IdentityScope): Promise<OwnSessionRevocation> => {
			const now: EpochMs = this.clock.now();
			const revocation: OwnSessionRevocation = await scope.sessions.revokeOwn(input.sessionId, actor.userId, revokedByUser(actor.userId), now);
			if (revocation === "revoked") {
				scope.events.collect(new DeviceSessionSignedOut(actor.userId, input.sessionId, "revoke-device", startedAt, now));
				scope.events.collect(new DeviceSessionsRevoked([actor.userId], "session_revoked", now));
			}
			return revocation;
		});
		if (outcome === "not_found") {
			throw new DeviceSessionNotFoundError();
		}
		const revokedCurrentSession: boolean = input.sessionId === actor.sessionId;
		return { message: revokedCurrentSession ? "Signed out of this device" : "Device signed out", revokedCurrentSession };
	}
}
