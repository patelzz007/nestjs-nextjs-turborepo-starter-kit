import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { OwnProfileSchema, type OwnProfile } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserProfile } from "../../../domain/aggregates/user-profile.aggregate";
import { ProfileNotFoundError } from "../../../domain/errors/identity.errors";
import { assertOwnProfileWritable, toProfileActor } from "../../../domain/policies/own-profile-write.policy";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK, OWN_PROFILE_UPDATE_OPERATION } from "../../ports/identity.tokens";
import { UpdateOwnProfileCommand } from "./update-own-profile.command";

/**
 * Edits the signed-in user's own profile. Refused for an impersonation session. ONE transaction under
 * `auth.profile.update`: the compare-and-set on the version the client read, the re-read of the
 * result and the request's HTTP audit row commit or roll back together; after commit the cached
 * `/auth/me` and `/auth/permissions` payloads are dropped (`UserProfileChanged`).
 */
@CommandHandler(UpdateOwnProfileCommand)
export class UpdateOwnProfileHandler implements ICommandHandler<UpdateOwnProfileCommand, OwnProfile> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: UpdateOwnProfileCommand): Promise<OwnProfile> {
		const { actor, input } = command;
		assertOwnProfileWritable(toProfileActor({ sub: input.userId, isImpersonating: input.isImpersonating }));
		return this.uow.runSystemOperation(OWN_PROFILE_UPDATE_OPERATION, actor, async (scope: IdentityScope): Promise<OwnProfile> => {
			const profile: UserProfile | null = await scope.profiles.findLive(input.userId);
			if (profile === null) {
				throw new ProfileNotFoundError(input.userId);
			}
			profile.edit(input.body.version, { ...(input.body.fullName === undefined ? {} : { fullName: input.body.fullName }) }, this.clock.now());
			await scope.profiles.save(profile);
			const updated: OwnProfile | null = await scope.profiles.readOwnProfile(input.userId);
			if (updated === null) {
				throw new ProfileNotFoundError(input.userId);
			}
			await scope.requestAudit.recordSuccess(OwnProfileSchema.parse(updated));
			scope.events.collectFrom(profile);
			return updated;
		});
	}
}
