import { Controller, Delete, Get, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import {
	apiPath,
	SetUserPreferenceBodySchema,
	UserPreferencePathSchema,
	UserPreferenceSchema,
	UserPreferencesSchema,
	type AccessTokenPayload,
	type SetUserPreferenceBody,
	type UserPreference,
	type UserPreferencePath,
	type UserPreferences,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { self } from "../../../../platform/presentation/http/security/decorators/permission-target";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ResetOwnPreferenceCommand } from "../../application/commands/reset-own-preference/reset-own-preference.command";
import { SetOwnPreferenceCommand } from "../../application/commands/set-own-preference/set-own-preference.command";
import { ListOwnPreferencesQuery } from "../../application/queries/list-own-preferences/list-own-preferences.query";

/** The signed-in user's remembered choices (a board's grouping, "Show subtasks"), checked against the shared registry. */
@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class PreferencesController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	// Page-load reads and ordinary authenticated edits: not credential endpoints, so only the `default` throttler applies.
	@SkipThrottle({ strict: true })
	@ApiBearerAuth()
	@Get("/preferences")
	@RequirePermission("READ", "PROFILE", { resourceId: self(), description: "A user reads their own preferences" })
	@ApiOperation({ summary: "The signed-in user's preferences; a key that is absent uses the page's default" })
	@ZodResponse(UserPreferencesSchema, { description: "The stored preferences the registry still accepts" })
	public list(@GetUser() user: AccessTokenPayload, @CurrentActor() actor: ActorContext): Promise<UserPreferences> {
		return this.queryBus.execute(new ListOwnPreferencesQuery(actor, user.sub));
	}

	@SkipThrottle({ strict: true })
	@ApiBearerAuth()
	@Put("/preferences/:key")
	@RequirePermission("UPDATE", "PROFILE", { resourceId: self(), description: "A user remembers one of their own choices" })
	@ApiOperation({ summary: "Remember one choice", description: "400 when the key does not accept the value (the shared preference registry)." })
	@ZodResponse(UserPreferenceSchema, { description: "The stored preference, with its new version" })
	public set(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(UserPreferencePathSchema) params: UserPreferencePath,
		@ZodBody(SetUserPreferenceBodySchema) body: SetUserPreferenceBody,
		@CurrentActor() actor: ActorContext,
	): Promise<UserPreference> {
		return this.commandBus.execute(new SetOwnPreferenceCommand(actor, user.sub, { key: params.key, value: body.value }));
	}

	@SkipThrottle({ strict: true })
	@ApiBearerAuth()
	@Delete("/preferences/:key")
	@RequirePermission("UPDATE", "PROFILE", { resourceId: self(), description: "A user resets one of their own choices to the default" })
	@ApiOperation({ summary: "Reset one choice to the default (soft delete); answers the preferences left" })
	@ZodResponse(UserPreferencesSchema, { description: "The preferences left" })
	public reset(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(UserPreferencePathSchema) params: UserPreferencePath,
		@CurrentActor() actor: ActorContext,
	): Promise<UserPreferences> {
		return this.commandBus.execute(new ResetOwnPreferenceCommand(actor, user.sub, params.key));
	}
}
