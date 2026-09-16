import { Injectable, Logger } from "@nestjs/common";
import type {
	AuthorizationContext,
	AuthorizationDecision,
	AuthorizationEvaluationStep,
	AuthorizationRequest,
	AuthorizationResult,
} from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { PolicyEngineService } from "./policy-engine.service";
import { AclService } from "./acl.service";

/**
 * Authorization Kernel - inspired by CASL, Oso, Cerbos, Permit.io, OpenFGA.
 *
 * Decision precedence:
 * 1. SuperAdmin bypass -> ALLOW
 * 2. Explicit ACL DENY -> DENY
 * 3. Explicit ACL ALLOW -> ALLOW
 * 4. Role permissions -> ALLOW
 * 5. Policy conditions -> ALLOW/DENY
 * 6. Default -> DENY
 */
@Injectable()
export class AuthorizationKernelService {
	private readonly logger = new Logger(AuthorizationKernelService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly policyEngine: PolicyEngineService,
		private readonly aclService: AclService,
	) {}

	/**
	 * Check if an action is allowed without throwing.
	 * Returns ALLOW or DENY decision.
	 */
	public async can(request: AuthorizationRequest): Promise<AuthorizationDecision> {
		const result = await this.explain(request);
		return result.decision;
	}

	/**
	 * Get detailed explanation of authorization decision.
	 * Returns full evaluation steps.
	 */
	public async explain(request: AuthorizationRequest): Promise<AuthorizationResult> {
		const startTime = Date.now();
		const evaluation: AuthorizationEvaluationStep[] = [];

		// Step 1: SuperAdmin bypass
		if (request.subject.isSuperAdmin) {
			evaluation.push({
				source: "superadmin",
				effect: "ALLOW",
				reason: "SuperAdmin bypass - unrestricted access",
			});

			return {
				decision: "ALLOW",
				request,
				evaluation,
				durationMs: Date.now() - startTime,
			};
		}

		// Step 2: Explicit ACL DENY (highest priority)
		const aclDeny = await this.aclService.checkAcl({
			subjectId: request.subject.userId,
			action: request.action,
			resourceType: request.resource,
			resourceId: request.resourceId,
			effect: "DENY",
		});

		if (aclDeny) {
			evaluation.push({
				source: "acl",
				effect: "DENY",
				reason: `Explicit ACL DENY: ${aclDeny.reason ?? "No reason provided"}`,
				details: { aclId: aclDeny.id },
			});

			return {
				decision: "DENY",
				request,
				evaluation,
				durationMs: Date.now() - startTime,
			};
		}

		// Step 3: Explicit ACL ALLOW
		const aclAllow = await this.aclService.checkAcl({
			subjectId: request.subject.userId,
			action: request.action,
			resourceType: request.resource,
			resourceId: request.resourceId,
			effect: "ALLOW",
		});

		if (aclAllow) {
			evaluation.push({
				source: "acl",
				effect: "ALLOW",
				reason: `Explicit ACL ALLOW: ${aclAllow.reason ?? "No reason provided"}`,
				details: { aclId: aclAllow.id },
			});

			return {
				decision: "ALLOW",
				request,
				evaluation,
				durationMs: Date.now() - startTime,
			};
		}

		evaluation.push({
			source: "acl",
			effect: "NO_MATCH",
			reason: "No explicit ACL entry found",
		});

		// Step 4: Role-based permissions
		const hasPermission = await this.hasRolePermission(request.subject.userId, request.action, request.resource);

		if (hasPermission) {
			evaluation.push({
				source: "role",
				effect: "ALLOW",
				reason: "User has required permission via role",
			});

			// Step 5: Check policies/conditions
			const policyResult = await this.policyEngine.evaluate(request);

			if (policyResult.decision === "DENY") {
				evaluation.push(...policyResult.evaluation);

				return {
					decision: "DENY",
					request,
					evaluation,
					durationMs: Date.now() - startTime,
				};
			}

			evaluation.push(...policyResult.evaluation);

			return {
				decision: "ALLOW",
				request,
				evaluation,
				durationMs: Date.now() - startTime,
			};
		}

		evaluation.push({
			source: "role",
			effect: "NO_MATCH",
			reason: "User does not have required permission",
		});

		// Step 6: Check ownership (OWN scope)
		if (request.resourceId !== undefined) {
			const ownershipResult = await this.checkOwnership(request);

			if (ownershipResult.owned) {
				evaluation.push({
					source: "ownership",
					effect: "ALLOW",
					reason: "User owns the resource",
				});

				return {
					decision: "ALLOW",
					request,
					evaluation,
					durationMs: Date.now() - startTime,
				};
			}

			evaluation.push({
				source: "ownership",
				effect: "NO_MATCH",
				reason: ownershipResult.reason,
			});
		}

		// Step 7: Check relationship-based access (ReBAC)
		const relationshipResult = await this.checkRelationships(request);

		if (relationshipResult.allowed) {
			evaluation.push({
				source: "relationship",
				effect: "ALLOW",
				reason: relationshipResult.reason,
			});

			return {
				decision: "ALLOW",
				request,
				evaluation,
				durationMs: Date.now() - startTime,
			};
		}

		evaluation.push({
			source: "relationship",
			effect: "NO_MATCH",
			reason: relationshipResult.reason,
		});

		// Default: DENY
		evaluation.push({
			source: "default",
			effect: "DENY",
			reason: "No authorization rule matched - default deny",
		});

		return {
			decision: "DENY",
			request,
			evaluation,
			durationMs: Date.now() - startTime,
		};
	}

	/**
	 * Authorize an action, throwing ForbiddenException if denied.
	 */
	public async authorize(request: AuthorizationRequest): Promise<void> {
		const decision = await this.can(request);

		if (decision === "DENY") {
			const error = new Error("Authorization denied");
			throw error;
		}
	}

	/**
	 * Generate a Prisma WHERE filter based on authorization rules.
	 * Used for filtering query results at the database level.
	 */
	public async filter(context: AuthorizationContext, action: string, resource: string): Promise<Record<string, unknown>> {
		// SuperAdmin: no filter
		if (context.isSuperAdmin === true) {
			return {};
		}

		const filters: Record<string, unknown>[] = [];

		// Organization isolation
		if (context.organizationId !== undefined) {
			filters.push({ organizationId: context.organizationId });
		}

		// Location isolation
		if (context.locationId !== undefined) {
			filters.push({ locationId: context.locationId });
		}

		// Ownership filter
		filters.push({ userId: context.userId });

		// Combine filters with OR
		if (filters.length === 0) {
			// No filters means deny all
			return { id: null };
		}

		if (filters.length === 1) {
			return filters[0];
		}

		return { OR: filters };
	}


	/**
	 * Check if user has permission via role assignments.
	 */
	private async hasRolePermission(userId: string, action: string, resource: string): Promise<boolean> {
		const result = await this.prisma.userRole.findFirst({
			where: {
				userId,
				isDeleted: false,
				role: {
					isActive: true,
					isDeleted: false,
					rolePermissions: {
						some: {
							isDeleted: false,
							permission: {
								action: action as never,
								resource: resource as never,
								isDeleted: false,
							},
						},
					},
				},
			},
		});

		// Check for MANAGE wildcard
		if (result === null) {
			const manageResult = await this.prisma.userRole.findFirst({
				where: {
					userId,
					isDeleted: false,
					role: {
						isActive: true,
						isDeleted: false,
						rolePermissions: {
							some: {
								isDeleted: false,
								permission: {
									action: "MANAGE",
									resource: resource as never,
									isDeleted: false,
								},
							},
						},
					},
				},
			});

			return manageResult !== null;
		}

		return true;
	}

	/**
	 * Check if user owns the resource.
	 */
	private async checkOwnership(request: AuthorizationRequest): Promise<{ owned: boolean; reason: string }> {
		if (request.resourceId === undefined) {
			return { owned: false, reason: "Resource ID not provided" };
		}

		// Generic ownership check - can be extended per resource type
		const resourceTable = this.getResourceTable(request.resource);

		if (resourceTable === null) {
			return { owned: false, reason: `Resource type ${request.resource} does not support ownership` };
		}

		try {
			// @ts-expect-error -- Dynamic table access
			const record = await this.prisma[resourceTable].findUnique({
				where: { id: request.resourceId },
				select: { userId: true },
			});

			if (record === null) {
				return { owned: false, reason: "Resource not found" };
			}

			if (record.userId === request.subject.userId) {
				return { owned: true, reason: "User is the resource owner" };
			}

			return { owned: false, reason: "User is not the resource owner" };
		} catch {
			return { owned: false, reason: `Failed to check ownership for ${request.resource}` };
		}
	}

	/**
	 * Check relationship-based access via organization/location membership.
	 */
	private async checkRelationships(request: AuthorizationRequest): Promise<{ allowed: boolean; reason: string }> {
		// Check organization membership
		if (request.subject.organizationId !== undefined) {
			const membership = await this.prisma.organizationMembership.findFirst({
				where: {
					userId: request.subject.userId,
					organizationId: request.subject.organizationId,
					status: "ACTIVE",
					isDeleted: false,
				},
			});

			if (membership !== null) {
				return { allowed: true, reason: "User is an active organization member" };
			}
		}

		// Check location membership via organization membership + location scopes
		if (request.subject.locationId !== undefined && request.subject.organizationId !== undefined) {
			const locationScope = await this.prisma.organizationMembershipLocationScope.findFirst({
				where: {
					organizationId: request.subject.organizationId,
					locationId: request.subject.locationId,
					membership: {
						userId: request.subject.userId,
						status: "ACTIVE",
						isDeleted: false,
					},
				},
			});

			if (locationScope !== null) {
				return { allowed: true, reason: "User has access to this location via membership scope" };
			}
		}

		return { allowed: false, reason: "No relationship found granting access" };
	}

	/**
	 * Map resource type to Prisma table name.
	 */
	private getResourceTable(resource: string): string | null {
		const mapping: Record<string, string> = {
			URL: "url",
			TAG: "tag",
			ORDER: "reward",
			USER: "user",
			API_KEY: "apiKey",
		};

		return mapping[resource] ?? null;
	}
}
