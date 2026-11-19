// ============================================
// presentation/http/flag-groups.controller.ts — the console's Flag groups (ADR 087)
// ============================================
// Platform staff only, under their own permission: a listed group can hold user ids (FEATURE_FLAG_GROUP:LIST to
// read, UPDATE to change). Every change carries a reason; a group a live or pending rule names can't be removed.

import { Get, HttpCode, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	ChangeFlagGroupMembersResultSchema,
	ChangeFlagGroupMembersSchema,
	CreateFlagGroupSchema,
	FlagGroupListSchema,
	FlagGroupMemberListQuerySchema,
	FlagGroupMemberSchema,
	FlagGroupPathSchema,
	FlagGroupSchema,
	OkResponseSchema,
	RemoveFlagGroupSchema,
	UpdateFlagGroupSchema,
	type ChangeFlagGroupMembersInput,
	type ChangeFlagGroupMembersResult,
	type CreateFlagGroupInput,
	type FlagGroup,
	type FlagGroupList,
	type FlagGroupMember,
	type FlagGroupMemberListQuery,
	type FlagGroupPath,
	type OkResponse,
	type PaginatedServiceResult,
	type RemoveFlagGroupInput,
	type UpdateFlagGroupInput,
} from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { FEATURE_FLAGS_READ_OPERATION, FEATURE_FLAGS_WRITE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { FlagGroupService } from "../../application/services/flag-group.service";
import { FLAG_GROUPS } from "../../feature-flags.tokens";

@ApiTags("Flag groups")
@ApiBearerAuth()
@AdminAccessOnly("Flag groups are for the admin console.")
@ApiController("/admin/flag-groups")
export class FlagGroupsController {
	public constructor(@Inject(FLAG_GROUPS) private readonly groups: FlagGroupService) {}

	@RequirePermission("LIST", "FEATURE_FLAG_GROUP")
	@Get()
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "Every flag group: its conditions or member count, and the flags and configs whose rules name it" })
	@ZodResponse(FlagGroupListSchema, { description: "The groups" })
	public list(@CurrentActor() actor: ActorContext): Promise<FlagGroupList> {
		return this.groups.list(actor);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG_GROUP")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post()
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Create a flag group: conditions, or a list of one rollout unit's subjects (added afterwards)", description: "409 FLAG_GROUP_KEY_TAKEN." })
	@ZodResponse(FlagGroupSchema, { status: HttpStatus.CREATED, description: "The group" })
	public create(@CurrentActor() actor: ActorContext, @ZodBody(CreateFlagGroupSchema) input: CreateFlagGroupInput): Promise<FlagGroup> {
		return this.groups.create(actor, input);
	}

	@RequirePermission("LIST", "FEATURE_FLAG_GROUP")
	@Get(":groupId")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "One flag group" })
	@ZodResponse(FlagGroupSchema, { description: "The group" })
	public find(@CurrentActor() actor: ActorContext, @ZodParams(FlagGroupPathSchema) path: FlagGroupPath): Promise<FlagGroup> {
		return this.groups.find(actor, path.groupId);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG_GROUP")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put(":groupId")
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Change a group's name, description or (a condition group's) conditions, with a reason — its key and kind never change" })
	@ZodResponse(FlagGroupSchema, { description: "The group" })
	public update(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FlagGroupPathSchema) path: FlagGroupPath,
		@ZodBody(UpdateFlagGroupSchema) input: UpdateFlagGroupInput,
	): Promise<FlagGroup> {
		return this.groups.update(actor, path.groupId, input);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG_GROUP")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":groupId/remove")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Remove a group no rule names any more, with a reason", description: "409 FLAG_GROUP_IN_USE while a live or pending rule names it." })
	@ZodResponse(OkResponseSchema, { description: "Removed" })
	public async remove(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FlagGroupPathSchema) path: FlagGroupPath,
		// The reason is validated here and kept by the request audit with the rest of the call.
		@ZodBody(RemoveFlagGroupSchema) _input: RemoveFlagGroupInput,
	): Promise<OkResponse> {
		await this.groups.remove(actor, path.groupId);
		return { ok: true };
	}

	@RequirePermission("LIST", "FEATURE_FLAG_GROUP")
	@Get(":groupId/members")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "One page of a listed group's subjects, newest first, with their names" })
	@ZodPaginatedResponse(FlagGroupMemberSchema, { description: "The members" })
	public members(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FlagGroupPathSchema) path: FlagGroupPath,
		@ZodListQuery(FlagGroupMemberListQuerySchema) query: FlagGroupMemberListQuery,
	): Promise<PaginatedServiceResult<FlagGroupMember>> {
		return this.groups.members(actor, path.groupId, query);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG_GROUP")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":groupId/members")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({
		summary: "Add or remove up to 1,000 listed subjects at once, with a reason",
		description: "A group holds at most 10,000. User, tenant and location ids must exist (422 FLAG_GROUP_INVALID).",
	})
	@ZodResponse(ChangeFlagGroupMembersResultSchema, { description: "How many changed, and the group's size" })
	public changeMembers(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FlagGroupPathSchema) path: FlagGroupPath,
		@ZodBody(ChangeFlagGroupMembersSchema) input: ChangeFlagGroupMembersInput,
	): Promise<ChangeFlagGroupMembersResult> {
		return this.groups.changeMembers(actor, path.groupId, input);
	}
}
