import { Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { apiContract, apiPath, OwnProfileSchema, type OwnProfile, type UpdateOwnProfileInput } from "@workspace/shared";

import { ZodBody } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { Authorize, self } from "../../authorization/decorators/authorize.decorator";
import { GetUser } from "../decorators/get-user.decorator";
import type { AccessTokenPayload } from "../services/token.service";
import { OwnProfileService } from "./own-profile.service";
import { toProfileActor } from "./profile-actor";

/**
 * Self-service profile — the same endpoints for every app (admin, merchant, web).
 *
 * | Endpoint | Authorization |
 * |---|---|
 * | `GET /auth/profile` | authenticated, full session; `READ PROFILE` on the caller's OWN record (`self()`, implicit self-grant). Impersonation: allowed (the impersonator sees the user's profile). |
 * | `PATCH /auth/profile` | authenticated, full session; `UPDATE PROFILE` on the caller's OWN record; refused with 403 `PROFILE_UPDATE_DURING_IMPERSONATION` for an impersonation session; 409 `CONFLICT` on a stale `version`. |
 *
 * There is no target id in either route: the profile is always the token
 * subject's own, so no request can address another user's profile. RLS
 * (`users_own`) backs the read; the write runs under `auth.profile.update`
 * scoped to that id. Restricted (enrollment) sessions are refused by
 * `RestrictedSessionGuard` — neither route is on its allowlist.
 */
@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class ProfileController {
	public constructor(private readonly ownProfile: OwnProfileService) {}

	// A page-load read and an ordinary authenticated edit: not credential endpoints, so only the `default` throttler applies.
	@SkipThrottle({ strict: true })
	@ApiBearerAuth()
	@Get("/profile")
	@Authorize({ action: "READ", resource: "PROFILE", resourceId: self(), description: "A user reads their own profile" })
	@ApiOperation({ summary: "Get the signed-in user's own profile (name, avatar, optimistic-lock version)" })
	@ZodResponse(OwnProfileSchema, { description: "The signed-in user's own profile" })
	public async getOwnProfile(@GetUser() user: AccessTokenPayload): Promise<OwnProfile> {
		return this.ownProfile.getOwnProfile(toProfileActor(user));
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
	public async updateOwnProfile(@GetUser() user: AccessTokenPayload, @ZodBody(apiContract.auth.updateProfile.input) body: UpdateOwnProfileInput): Promise<OwnProfile> {
		return this.ownProfile.updateOwnProfile(toProfileActor(user), body);
	}
}
