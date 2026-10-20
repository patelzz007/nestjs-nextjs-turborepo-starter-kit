import { Controller, Get, Patch } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { apiContract, apiPath, OwnProfileSchema, type AccessTokenPayload, type OwnProfile, type UpdateOwnProfileInput } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Authorize, self } from "../../../../platform/presentation/http/security/decorators/authorize.decorator";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { UpdateOwnProfileCommand } from "../../application/commands/update-own-profile/update-own-profile.command";
import { GetOwnProfileQuery } from "../../application/queries/get-own-profile/get-own-profile.query";

/** The signed-in user's own profile (name, avatar, optimistic-lock version). */
@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class ProfileController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	// A page-load read and an ordinary authenticated edit: not credential endpoints, so only the `default` throttler applies.
	@SkipThrottle({ strict: true })
	@ApiBearerAuth()
	@Get("/profile")
	@Authorize({ action: "READ", resource: "PROFILE", resourceId: self(), description: "A user reads their own profile" })
	@ApiOperation({ summary: "Get the signed-in user's own profile (name, avatar, optimistic-lock version)" })
	@ZodResponse(OwnProfileSchema, { description: "The signed-in user's own profile" })
	public async getOwnProfile(@GetUser() user: AccessTokenPayload, @CurrentActor() actor: ActorContext): Promise<OwnProfile> {
		return this.queryBus.execute(new GetOwnProfileQuery(actor, { userId: user.sub }));
	}

	@SkipThrottle({ strict: true })
	@ApiBearerAuth()
	@Patch("/profile")
	@Authorize({ action: "UPDATE", resource: "PROFILE", resourceId: self(), description: "A user edits their own profile (never during impersonation)" })
	@ApiOperation({
		summary: "Edit the signed-in user's own profile",
		description:
			"Send the `version` read from GET /auth/profile: the change applies only while the profile is still at that version (409 CONFLICT otherwise — reload and retry). Refused (403 PROFILE_UPDATE_DURING_IMPERSONATION) for an impersonation session. The avatar is managed through /files (category USER_AVATAR).",
	})
	@ZodResponse(OwnProfileSchema, { description: "The updated profile, with its new version" })
	public async updateOwnProfile(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(apiContract.auth.updateProfile.input) body: UpdateOwnProfileInput,
		@CurrentActor() actor: ActorContext,
	): Promise<OwnProfile> {
		return this.commandBus.execute(new UpdateOwnProfileCommand(actor, { userId: user.sub, isImpersonating: user.isImpersonating === true, body }));
	}
}
