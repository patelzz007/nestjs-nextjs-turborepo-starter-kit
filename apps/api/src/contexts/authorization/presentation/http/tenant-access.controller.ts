import { Controller, Delete, Get, HttpStatus, Patch, Post, Put } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	OkResponseSchema,
	TenantGrantCreateSchema,
	TenantGrantListResponseSchema,
	TenantGrantResponseSchema,
	TenantMemberAccessResponseSchema,
	TenantMemberRoleSchema,
	TenantRoleCreateSchema,
	TenantRoleHoldersSchema,
	TenantRoleListResponseSchema,
	TenantRoleReassignSchema,
	TenantRoleResponseSchema,
	TenantRoleUpdateSchema,
	TenantRouteKeySchema,
	TenantShareCreateSchema,
	TenantShareListResponseSchema,
	TenantShareResponseSchema,
	UuidParamSchema,
	type OkResponse,
	type TenantGrantCreateInput,
	type TenantGrantResponse,
	type TenantMemberAccessResponse,
	type TenantMemberRoleInput,
	type TenantRoleCreateInput,
	type TenantRoleHolders,
	type TenantRoleReassignInput,
	type TenantRoleResponse,
	type TenantRoleUpdateInput,
	type TenantShareCreateInput,
	type TenantShareResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ApiErrorResponseDto } from "../../../../platform/presentation/http/dto/api-response.dto";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParam } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { TenantAccessService } from "../../application/services/tenant-access.service";

/**
 * A tenant administers its own access (ADR 067): its roles, its members' roles, extra permissions
 * (grants, permanent or until a time) and records shared with one member. Every route is a TENANT
 * route — the caller's membership in the named tenant is what `TenantAccessService` decides on, deny
 * by default; the guardrails (Owner role fixed, at least one Owner, nothing given beyond your own role
 * or stores) are checked in the same transaction as the write.
 */
@ApiTags("Tenant Access")
@Controller(apiPath("/tenants"))
@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "The caller's role does not allow this, or it would give more than their own role or stores" })
@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "No such tenant, role, member, grant or share in it" })
export class TenantAccessController {
	public constructor(private readonly access: TenantAccessService) {}

	@Get(":tenantSlug/access/roles")
	@ApiOperation({ summary: "The tenant's roles, with their permissions and how many members hold each" })
	@ZodResponse(TenantRoleListResponseSchema, { description: "The tenant's roles" })
	public roles(@CurrentActor() actor: ActorContext, @ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string): Promise<readonly TenantRoleResponse[]> {
		return this.access.listRoles({ actor, tenantSlug });
	}

	@Post(":tenantSlug/access/roles")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Create a role from tenant permissions the caller's own role holds" })
	@ZodResponse(TenantRoleResponseSchema, { status: HttpStatus.CREATED, description: "Role created" })
	public createRole(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodBody(TenantRoleCreateSchema) body: TenantRoleCreateInput,
	): Promise<TenantRoleResponse> {
		return this.access.createRole({ actor, tenantSlug }, body);
	}

	@Patch(":tenantSlug/access/roles/:roleId")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Rename a role or replace its permissions (never the Owner role)" })
	@ZodResponse(TenantRoleResponseSchema, { description: "Role updated" })
	public updateRole(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("roleId", UuidParamSchema) roleId: string,
		@ZodBody(TenantRoleUpdateSchema) body: TenantRoleUpdateInput,
	): Promise<TenantRoleResponse> {
		return this.access.updateRole({ actor, tenantSlug }, roleId, body);
	}

	@Delete(":tenantSlug/access/roles/:roleId")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Delete a role no member holds", description: "409 with `holderCount` and `holdersVersion` while members hold it: reassign them first." })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Members still hold the role" })
	@ZodResponse(OkResponseSchema, { description: "Role deleted" })
	public async deleteRole(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("roleId", UuidParamSchema) roleId: string,
	): Promise<OkResponse> {
		await this.access.deleteRole({ actor, tenantSlug }, roleId);
		return { ok: true };
	}

	@Get(":tenantSlug/access/roles/:roleId/holders")
	@ApiOperation({ summary: "The members holding a role, and the version of that list to quote when reassigning them" })
	@ZodResponse(TenantRoleHoldersSchema, { description: "The role's holders" })
	public holders(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("roleId", UuidParamSchema) roleId: string,
	): Promise<TenantRoleHolders> {
		return this.access.roleHolders({ actor, tenantSlug }, roleId);
	}

	@Post(":tenantSlug/access/roles/:roleId/reassign")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Move every holder of a role to a new role in one step", description: "409 when the holders changed since `holdersVersion` was read." })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "The role's holders changed" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Holders reassigned" })
	public async reassign(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("roleId", UuidParamSchema) roleId: string,
		@ZodBody(TenantRoleReassignSchema) body: TenantRoleReassignInput,
	): Promise<OkResponse> {
		await this.access.reassignHolders({ actor, tenantSlug }, roleId, body);
		return { ok: true };
	}

	@Post(":tenantSlug/access/roles/:roleId/reset")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Make a role equal the template it was copied from again" })
	@ZodResponse(TenantRoleResponseSchema, { status: HttpStatus.CREATED, description: "Role reset to its template" })
	public resetRole(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("roleId", UuidParamSchema) roleId: string,
	): Promise<TenantRoleResponse> {
		return this.access.resetRole({ actor, tenantSlug }, roleId);
	}

	@Get(":tenantSlug/access/members/:membershipId")
	@ApiOperation({ summary: "One member's access: their role and stores" })
	@ZodResponse(TenantMemberAccessResponseSchema, { description: "The member" })
	public member(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("membershipId", UuidParamSchema) membershipId: string,
	): Promise<TenantMemberAccessResponse> {
		return this.access.memberAccess({ actor, tenantSlug }, membershipId);
	}

	@Put(":tenantSlug/access/members/:membershipId/role")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Change a member's role", description: "Only an Owner makes an Owner; the last Owner keeps the Owner role." })
	@ZodResponse(OkResponseSchema, { description: "Member's role changed" })
	public async changeMemberRole(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("membershipId", UuidParamSchema) membershipId: string,
		@ZodBody(TenantMemberRoleSchema) body: TenantMemberRoleInput,
	): Promise<OkResponse> {
		await this.access.changeMemberRole({ actor, tenantSlug }, membershipId, body.roleId);
		return { ok: true };
	}

	@Delete(":tenantSlug/access/members/:membershipId")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Remove a member: their role, grants and shares stop at once" })
	@ZodResponse(OkResponseSchema, { description: "Member removed" })
	public async removeMember(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("membershipId", UuidParamSchema) membershipId: string,
	): Promise<OkResponse> {
		await this.access.removeMember({ actor, tenantSlug }, membershipId);
		return { ok: true };
	}

	@Get(":tenantSlug/access/members/:membershipId/grants")
	@ApiOperation({ summary: "A member's extra permissions still in force, newest first, with their end time" })
	@ZodResponse(TenantGrantListResponseSchema, { description: "The member's grants" })
	public grants(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("membershipId", UuidParamSchema) membershipId: string,
	): Promise<readonly TenantGrantResponse[]> {
		return this.access.listGrants({ actor, tenantSlug }, membershipId);
	}

	@Post(":tenantSlug/access/members/:membershipId/grants")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({
		summary: "Give a member an extra permission, permanent or until `expiresAt`",
		description: "Only a permission the caller's own role gives, within the caller's stores.",
	})
	@ZodResponse(TenantGrantResponseSchema, { status: HttpStatus.CREATED, description: "Permission granted" })
	public grant(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("membershipId", UuidParamSchema) membershipId: string,
		@ZodBody(TenantGrantCreateSchema) body: TenantGrantCreateInput,
	): Promise<TenantGrantResponse> {
		return this.access.grant({ actor, tenantSlug }, membershipId, body);
	}

	@Delete(":tenantSlug/access/grants/:grantId")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Take an extra permission back (its granter always may)" })
	@ZodResponse(OkResponseSchema, { description: "Permission revoked" })
	public async revokeGrant(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("grantId", UuidParamSchema) grantId: string,
	): Promise<OkResponse> {
		await this.access.revokeGrant({ actor, tenantSlug }, grantId);
		return { ok: true };
	}

	@Get(":tenantSlug/access/shares")
	@ApiOperation({ summary: "The records shared with single members, newest first" })
	@ZodResponse(TenantShareListResponseSchema, { description: "The tenant's shares" })
	public shares(@CurrentActor() actor: ActorContext, @ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string): Promise<readonly TenantShareResponse[]> {
		return this.access.listShares({ actor, tenantSlug });
	}

	@Post(":tenantSlug/access/shares")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Share one record with one member, to view or edit, permanent or until `expiresAt`" })
	@ZodResponse(TenantShareResponseSchema, { status: HttpStatus.CREATED, description: "Record shared" })
	public share(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodBody(TenantShareCreateSchema) body: TenantShareCreateInput,
	): Promise<TenantShareResponse> {
		return this.access.share({ actor, tenantSlug }, body);
	}

	@Delete(":tenantSlug/access/shares/:shareId")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Stop sharing a record (its sharer always may)" })
	@ZodResponse(OkResponseSchema, { description: "Share removed" })
	public async unshare(
		@CurrentActor() actor: ActorContext,
		@ZodParam("tenantSlug", TenantRouteKeySchema) tenantSlug: string,
		@ZodParam("shareId", UuidParamSchema) shareId: string,
	): Promise<OkResponse> {
		await this.access.unshare({ actor, tenantSlug }, shareId);
		return { ok: true };
	}
}
