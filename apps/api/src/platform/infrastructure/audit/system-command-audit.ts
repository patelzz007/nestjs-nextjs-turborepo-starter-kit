import type { AuditOutcome, JsonValue } from "@workspace/shared";

import type { SystemCommandAuditEntry } from "../../application/ports/command-audit.port";
import { auditErrorDetail } from "./audit-error-detail";
import { toAuditPayload, type HttpAuditEntry } from "./http-audit-entry";

/** Success and failure HTTP statuses stored on the audit row a system command maps into. */
export const SYSTEM_COMMAND_SUCCESS_STATUS = 200;
export const SYSTEM_COMMAND_FAILURE_STATUS = 500;
const AUDIT_METHOD_MAX_LENGTH = 10;
const AUDIT_ENDPOINT_MAX_LENGTH = 512;
const AUDIT_PATH_MAX_LENGTH = 2_048;

/**
 * `AuditLog` is an HTTP row. A system command has no request, so the row uses:
 * method = origin kind, endpoint = command class, path = origin name, request body = redacted input.
 * The operation name is `systemOperations`. Tenant id and actor user are the command actor's.
 * The correlation id is the one the command's transactions stamped as `app.correlation_id`.
 */
export function systemCommandAuditEntry(entry: SystemCommandAuditEntry): HttpAuditEntry {
	const correlationId: string = entry.correlationId;
	const outcome: AuditOutcome = entry.outcome === "success" ? "SUCCEEDED" : "FAILED";
	const emptyDevice = { browserName: null, browserVersion: null, osName: null, osVersion: null, deviceType: null, deviceModel: null };
	return {
		correlationId,
		traceId: correlationId,
		occurredAt: entry.occurredAt,
		completedAt: entry.occurredAt,
		method: entry.originKind.toUpperCase().slice(0, AUDIT_METHOD_MAX_LENGTH),
		endpoint: entry.commandName.slice(0, AUDIT_ENDPOINT_MAX_LENGTH),
		path: `${entry.originKind}:${entry.originName}`.slice(0, AUDIT_PATH_MAX_LENGTH),
		outcome,
		responseStatus: entry.outcome === "success" ? SYSTEM_COMMAND_SUCCESS_STATUS : SYSTEM_COMMAND_FAILURE_STATUS,
		errorCode: entry.errorCode,
		actorUserId: entry.actorUserId,
		impersonatorUserId: null,
		impersonationSessionId: null,
		supportAccessGrantId: null,
		sessionId: null,
		authMethod: null,
		apiKeyId: null,
		terminalId: null,
		tenantId: entry.tenantId,
		locationId: null,
		claimedTenantId: null,
		claimedLocationId: null,
		ipAddress: null,
		userAgent: null,
		...emptyDevice,
		ipVersion: null,
		ipScope: null,
		geoCountry: null,
		geoRegion: null,
		geoCity: null,
		geoTimeZone: null,
		clientType: null,
		httpVersion: null,
		host: null,
		origin: null,
		referer: null,
		acceptLanguage: null,
		requestContentType: null,
		requestBytes: null,
		idempotencyKey: null,
		requestHeaders: null,
		requestParams: null,
		requestBody: toAuditPayload(entry.input),
		responseBody: systemCommandResponse(entry),
		// A system command has no caller to blame: every failure is a server fault, so its stack is kept.
		errorDetail: entry.error === null ? null : auditErrorDetail(entry.error, { withStack: true, workingDirectory: process.cwd() }),
		systemOperations: entry.operation === null ? [] : [entry.operation],
		actorIdentity: null,
	};
}

/** Where a system-command row came from, read back from the path it was written with (`job:claims.expire-referrer`). */
export interface SystemCommandRowOrigin {
	/** `job`, `cron`, `cli`, `bootstrap`, `consumer`. */
	readonly kind: string;
	/** The queue, schedule or script name. */
	readonly name: string;
}

/** `kind:name` — the path {@link systemCommandAuditEntry} writes. */
const SYSTEM_COMMAND_PATH = /^(?<kind>[a-z]+):(?<name>.+)$/;

/**
 * The origin of a row {@link systemCommandAuditEntry} wrote, or `null` for an
 * HTTP request's row. A system row's method is its origin kind upper-cased
 * and its path `kind:name`; an HTTP path always starts with `/`.
 */
export function systemCommandRowOrigin(entry: Pick<HttpAuditEntry, "method" | "path">): SystemCommandRowOrigin | null {
	const groups = SYSTEM_COMMAND_PATH.exec(entry.path)?.groups;
	const kind: string | undefined = groups?.kind;
	const name: string | undefined = groups?.name;
	if (kind === undefined || name === undefined || kind.toUpperCase().slice(0, AUDIT_METHOD_MAX_LENGTH) !== entry.method) {
		return null;
	}
	return { kind, name };
}

function systemCommandResponse(entry: SystemCommandAuditEntry): JsonValue {
	return {
		outcome: entry.outcome,
		errorCode: entry.errorCode,
		durationMs: entry.durationMs,
		operation: entry.operation,
	};
}
