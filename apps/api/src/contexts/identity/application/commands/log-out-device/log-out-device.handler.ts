import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { DeviceSessionSignedOut, DeviceSessionsRevoked } from "../../../domain/events/identity.events";
import type { OwnSessionRevocation } from "../../../domain/repositories/device-session.repository";
import { revokedByUser } from "../../../domain/value-objects/session-revoker.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { IdentityTelemetryPort } from "../../ports/identity-telemetry.port";
import { IDENTITY_TELEMETRY, IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { LogOutDeviceCommand } from "./log-out-device.command";

/**
 * Signs out the session whose refresh token the request presented (`deletedBy` = the user). Idempotent:
 * an unknown, foreign or already revoked session still succeeds — with telemetry only, since there
 * was no write for the event to be atomic with.
 */
@CommandHandler(LogOutDeviceCommand)
export class LogOutDeviceHandler implements ICommandHandler<LogOutDeviceCommand, void> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(IDENTITY_TELEMETRY) private readonly telemetry: IdentityTelemetryPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: LogOutDeviceCommand): Promise<void> {
		const { input } = command;
		const startedAt: EpochMs = this.clock.now();
		const actor: ActorContext = command.actor;
		const outcome: OwnSessionRevocation = await this.uow.run(actor, async (scope: IdentityScope): Promise<OwnSessionRevocation> => {
			const now: EpochMs = this.clock.now();
			const revocation: OwnSessionRevocation = await scope.sessions.revokeOwn(input.sessionId, input.userId, revokedByUser(input.userId), now);
			if (revocation === "revoked") {
				scope.events.collect(new DeviceSessionSignedOut(input.userId, input.sessionId, "logout-device", startedAt, now));
				scope.events.collect(new DeviceSessionsRevoked([input.userId], "session_revoked", now));
			}
			return revocation;
		});
		if (outcome !== "revoked") {
			await this.telemetry.recordSessionAction({ action: "logout-device", userId: input.userId, error: null, durationMs: this.clock.now() - startedAt });
		}
	}
}
