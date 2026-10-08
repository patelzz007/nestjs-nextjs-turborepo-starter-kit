import { Injectable, Logger } from "@nestjs/common";
import type { AuthorizationAuditLogRequest, AuthorizationEvaluationStep, AuthorizationResult } from "@workspace/shared";
import { CaughtValueSchema, isStringPrimitive } from "@workspace/shared";

import { normalizeCaughtError } from "../../../common/utils/caught-error";
import { parsePrismaNullableJson } from "../../../common/utils/prisma-json";
import { SystemPrismaService } from "../../../prisma/system-prisma.service";

/** Request metadata recorded alongside a decision. */
export interface AuthorizationAuditMetadata {
	readonly ipAddress?: string;
	readonly userAgent?: string;
	readonly requestId?: string;
}

const WRITE_ACTIONS: ReadonlySet<string> = new Set(["CREATE", "UPDATE", "DELETE", "MANAGE"]);
const SENSITIVE_READ_RESOURCES: ReadonlySet<string> = new Set(["USER", "ROLE", "PERMISSION", "AUDIT_LOG", "SYSTEM_SETTINGS"]);

function readEvaluationDetailId(step: AuthorizationEvaluationStep, detailKey: "policyId" | "aclId"): string | undefined {
	const value = step.details?.[detailKey];
	return isStringPrimitive(value) ? value : undefined;
}

/**
 * Authorization decision audit trail (spec §63):
 * DENY → always · writes → always · sensitive reads → always · ordinary reads → never.
 *
 * `authorization_audits` is an append-only, bypass-only table under RLS, so
 * writes go through the system client. Audit failures never fail the request.
 */
@Injectable()
export class AuthorizationAuditKernelService {
	private readonly logger = new Logger(AuthorizationAuditKernelService.name);

	public constructor(private readonly systemDb: SystemPrismaService) {}

	public async log(request: AuthorizationAuditLogRequest): Promise<void> {
		try {
			await this.systemDb.authorizationAudit.create({
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
		} catch (error) {
			const caught = CaughtValueSchema.safeParse(error);
			const message = caught.success ? normalizeCaughtError(caught.data).message : "Unknown error";
			this.logger.error(`Failed to record authorization audit: ${message}`);
		}
	}

	public shouldAudit(result: AuthorizationResult): boolean {
		if (result.decision === "DENY") {
			return true;
		}
		if (WRITE_ACTIONS.has(result.request.action)) {
			return true;
		}
		return (result.request.action === "READ" || result.request.action === "LIST") && SENSITIVE_READ_RESOURCES.has(result.request.resource);
	}

	public async auditResult(result: AuthorizationResult, metadata?: AuthorizationAuditMetadata): Promise<void> {
		if (!this.shouldAudit(result)) {
			return;
		}

		const policyIds = result.evaluation.flatMap((step) => {
			const id = step.source === "policy" ? readEvaluationDetailId(step, "policyId") : undefined;
			return id === undefined ? [] : [id];
		});
		const aclIds = result.evaluation.flatMap((step) => {
			const id = step.source === "acl" ? readEvaluationDetailId(step, "aclId") : undefined;
			return id === undefined ? [] : [id];
		});

		await this.log({
			actorId: result.request.subject.userId,
			organizationId: result.request.subject.organizationId,
			locationId: result.request.subject.locationId,
			action: result.request.action,
			resource: result.request.resource,
			resourceId: result.request.resourceId,
			decision: result.decision,
			reason: result.evaluation.at(-1)?.reason,
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
