import { Prisma } from "@prisma/client";
import type { JsonValue } from "@workspace/shared";

import { parsePrismaNullableJson } from "../utils/prisma-json";
import type { HttpAuditEntry } from "./http-audit-entry";

/** The `audit_logs` row for an entry — shared by the repository and the seed, so seeded rows obey the same mapping. */
export function toAuditLogCreateInput(entry: HttpAuditEntry): Prisma.AuditLogCreateInput {
	const json = (value: JsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull => parsePrismaNullableJson(value);
	return {
		correlationId: entry.correlationId,
		occurredAt: BigInt(entry.occurredAt),
		completedAt: BigInt(entry.completedAt),
		method: entry.method,
		endpoint: entry.endpoint,
		path: entry.path,
		outcome: entry.outcome,
		responseStatus: entry.responseStatus,
		errorCode: entry.errorCode,
		actorUserId: entry.actorUserId,
		impersonatorUserId: entry.impersonatorUserId,
		apiKeyId: entry.apiKeyId,
		terminalId: entry.terminalId,
		organizationId: entry.organizationId,
		storeId: entry.storeId,
		locationId: entry.locationId,
		ipAddress: entry.ipAddress,
		userAgent: entry.userAgent,
		requestParams: json(entry.requestParams),
		requestBody: json(entry.requestBody),
		responseBody: json(entry.responseBody),
		systemOperations: [...entry.systemOperations],
	};
}
