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
import { SetOwnLanguageCommand } from "./set-own-language.command";

/**
 * Saves the signed-in person's language (enhancement 5.2) on their account, the one the apps open in after
 * sign-in and notifications are written in. Refused during impersonation, like every own-profile write. ONE
 * transaction under `auth.profile.update` with the request's audit row; after commit the cached `/auth/me`
 * is dropped (`UserProfileChanged`).
 */
@CommandHandler(SetOwnLanguageCommand)
export class SetOwnLanguageHandler implements ICommandHandler<SetOwnLanguageCommand, OwnProfile> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SetOwnLanguageCommand): Promise<OwnProfile> {
		const { actor, input } = command;
		assertOwnProfileWritable(toProfileActor({ sub: input.userId, isImpersonating: input.isImpersonating }));
		return this.uow.runSystemOperation(OWN_PROFILE_UPDATE_OPERATION, actor, async (scope: IdentityScope): Promise<OwnProfile> => {
			const profile: UserProfile | null = await scope.profiles.findLive(input.userId);
			if (profile === null) {
				throw new ProfileNotFoundError(input.userId);
			}
			profile.chooseLanguage(input.language, this.clock.now());
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
