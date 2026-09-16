import { Injectable, Logger } from "@nestjs/common";
import type { ResourceAcl, AclEffect, PermissionScope } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export interface AclCheckRequest {
	subjectId: string;
	action: string;
	resourceType: string;
	resourceId?: string;
	effect: AclEffect;
}

/**
 * ACL Service - manages resource-level ALLOW/DENY entries.
 * Explicit DENY takes precedence over explicit ALLOW.
 */
@Injectable()
export class AclService {
	private readonly logger = new Logger(AclService.name);

	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Check if an ACL entry exists for the given criteria.
	 */
	public async checkAcl(request: AclCheckRequest): Promise<ResourceAcl | null> {
		const now = Date.now();

		// Check for subject-specific ACL
		const userAcl = await this.prisma.resourceAcl.findFirst({
			where: {
				subjectType: "USER",
				subjectId: request.subjectId,
				action: request.action,
				resourceType: request.resourceType,
				resourceId: request.resourceId ?? null,
				effect: request.effect,
				isDeleted: false,
				OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		if (userAcl !== null) {
			return userAcl;
		}

		// Check for role-based ACL (if user has roles)
		// This requires fetching user roles first
		const userRoles = await this.prisma.userRole.findMany({
			where: {
				userId: request.subjectId,
				isDeleted: false,
			},
			select: {
				roleId: true,
			},
		});

		if (userRoles.length > 0) {
			const roleAcl = await this.prisma.resourceAcl.findFirst({
				where: {
					subjectType: "ROLE",
					subjectId: { in: userRoles.map((ur) => ur.roleId) },
					action: request.action,
					resourceType: request.resourceType,
					resourceId: request.resourceId ?? null,
					effect: request.effect,
					isDeleted: false,
					OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			if (roleAcl !== null) {
				return roleAcl;
			}
		}

		return null;
	}

	/**
	 * Create an ACL entry.
	 */
	public async createAcl(data: {
		subjectType: "USER" | "ROLE";
		subjectId: string;
		action: string;
		resourceType: string;
		resourceId?: string;
		effect: AclEffect;
		scope?: string;
		organizationId?: string;
		locationId?: string;
		reason?: string;
		assignedBy?: string;
		expiresAt?: number;
	}): Promise<ResourceAcl> {
		return this.prisma.resourceAcl.create({
			data: {
				subjectType: data.subjectType,
				subjectId: data.subjectId,
				action: data.action,
				resourceType: data.resourceType,
				resourceId: data.resourceId ?? null,
				effect: data.effect,
				scope: data.scope as PermissionScope | undefined,
				organizationId: data.organizationId ?? null,
				locationId: data.locationId ?? null,
				reason: data.reason ?? null,
				assignedBy: data.assignedBy ?? null,
				expiresAt: data.expiresAt ?? null,
			},
		});
	}

	/**
	 * Remove an ACL entry (soft delete).
	 */
	public async removeAcl(id: string): Promise<void> {
		await this.prisma.resourceAcl.update({
			where: { id },
			data: {
				isDeleted: true,
				deletedAt: Date.now(),
			},
		});
	}

	/**
	 * List ACL entries for a subject.
	 */
	public async listAcls(subjectId: string, subjectType: "USER" | "ROLE"): Promise<ResourceAcl[]> {
		return this.prisma.resourceAcl.findMany({
			where: {
				subjectType,
				subjectId,
				isDeleted: false,
			},
			orderBy: {
				createdAt: "desc",
			},
		});
	}
}
