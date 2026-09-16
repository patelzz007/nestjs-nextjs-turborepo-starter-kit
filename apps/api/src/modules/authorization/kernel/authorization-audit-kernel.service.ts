import { Injectable, Logger } from "@nestjs/common";
import type { AuthorizationAuditLogRequest, AuthorizationResult } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Authorization Audit Service - records authorization decisions.
 * Always logs DENY, always logs WRITE operations, optionally logs sensitive READ.
 */
@Injectable()
export class AuthorizationAuditKernelService {
	private readonly logger = new Logger(AuthorizationAuditKernelService.name);

	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Record an authorization audit log.
	 * Uses app_rls_bypass() in RLS to bypass normal row-level restrictions.
	 */
	public async log(request: AuthorizationAuditLogRequest): Promise<void> {
		try {
			await this.prisma.authorizationAudit.create({
				data: {
					actorId: request.actorId ?? null,
					organizationId: request.organizationId ?? null,
					locationId: request.locationId ?? null,
					action: request.action,
					resource: request.resource,
					resourceId: request.resourceId ?? null,
					decision: request.decision,
					reason: request.reason ?? null,
					policyIds: request.policyIds ?? [],
					aclIds: request.aclIds ?? [],
					evaluation: request.evaluation ?? null,
					ipAddress: request.ipAddress ?? null,
					userAgent: request.userAgent ?? null,
					requestId: request.requestId ?? null,
					durationMs: request.durationMs ?? null,
				},
			});
		} catch (error) {
			// Never fail the request due to audit logging failure
			this.logger.error(`Failed to record authorization audit: ${(error as Error).message}`);
		}
	}

	/**
	 * Determine if an authorization result should be audited.
	 */
	public shouldAudit(result: AuthorizationResult): boolean {
		// Always audit DENY
		if (result.decision === "DENY") {
			return true;
		}

		// Always audit WRITE operations
		const writeActions = ["CREATE", "UPDATE", "DELETE", "MANAGE"];

		if (writeActions.includes(result.request.action)) {
			return true;
		}

		// Optionally audit sensitive READ operations
		const sensitiveResources = ["USER", "ROLE", "PERMISSION", "ADMIN_DASHBOARD"];

		if (result.request.action === "READ" && sensitiveResources.includes(result.request.resource)) {
			return true;
		}

		return false;
	}

	/**
	 * Log an authorization result if it should be audited.
	 */
	public async auditResult(result: AuthorizationResult, metadata?: { ipAddress?: string; userAgent?: string; requestId?: string }): Promise<void> {
		if (!this.shouldAudit(result)) {
			return;
		}

		const policyIds = result.evaluation.filter((step) => step.source === "policy" && step.details?.policyId !== undefined).map((step) => step.details?.policyId as string);

		const aclIds = result.evaluation.filter((step) => step.source === "acl" && step.details?.aclId !== undefined).map((step) => step.details?.aclId as string);

		await this.log({
			actorId: result.request.subject.userId,
			organizationId: result.request.subject.organizationId,
			locationId: result.request.subject.locationId,
			action: result.request.action,
			resource: result.request.resource,
			resourceId: result.request.resourceId,
			decision: result.decision,
			reason: result.evaluation[result.evaluation.length - 1]?.reason,
			policyIds,
			aclIds,
			evaluation: result.evaluation,
			ipAddress: metadata?.ipAddress,
			userAgent: metadata?.userAgent,
			requestId: metadata?.requestId,
			durationMs: result.durationMs,
		});
	}
}
