import { Injectable, Logger } from "@nestjs/common";
import type { AuthorizationAuditLogRequest, AuthorizationEvaluationStep, AuthorizationResult } from "@workspace/shared";
import { CaughtValueSchema } from "@workspace/shared";

import { normalizeCaughtError } from "../../../common/utils/caught-error";
import { parsePrismaNullableJson } from "../../../common/utils/prisma-json";
import { PrismaService } from "../../../prisma/prisma.service";

function readEvaluationDetailId(step: AuthorizationEvaluationStep, detailKey: "policyId" | "aclId"): string | undefined {
	const details = step.details;
	if (details === undefined) {
		return undefined;
	}
	const value = details[detailKey];
	return typeof value === "string" ? value : undefined;
}

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
					evaluation: parsePrismaNullableJson(request.evaluation ?? null),
					ipAddress: request.ipAddress ?? null,
					userAgent: request.userAgent ?? null,
					requestId: request.requestId ?? null,
					durationMs: request.durationMs ?? null,
				},
			});
		} catch (error: unknown) {
			// Never fail the request due to audit logging failure
			const caught = CaughtValueSchema.safeParse(error);
			const message = caught.success ? normalizeCaughtError(caught.data).message : "Unknown error";
			this.logger.error(`Failed to record authorization audit: ${message}`);
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

		const policyIds = result.evaluation
			.filter((step) => step.source === "policy")
			.map((step) => readEvaluationDetailId(step, "policyId"))
			.filter((id): id is string => id !== undefined);

		const aclIds = result.evaluation
			.filter((step) => step.source === "acl")
			.map((step) => readEvaluationDetailId(step, "aclId"))
			.filter((id): id is string => id !== undefined);

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
