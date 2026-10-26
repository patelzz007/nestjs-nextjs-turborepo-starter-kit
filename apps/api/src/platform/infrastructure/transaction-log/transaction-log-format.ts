// ============================================
// platform/infrastructure/transaction-log/transaction-log-format.ts — what ONE transaction looks like in the .txt log
// ============================================
// Pure functions: an audit row (already redacted and size-capped by
// http-audit-entry.ts) → a block of text a person can read top to bottom, and
// an instant → its day file.
//
//   ================================================================================
//   2026-10-26 12:06:44.442 UTC  FAILED 403 FORBIDDEN  PATCH /api/v1/tenants/brew-bean-kl/rewards/r-1
//   --------------------------------------------------------------------------------
//     Result       FAILED: answered 403 FORBIDDEN after 12 ms
//     Reason       ForbiddenException: Missing permission merchant:manage_rewards
//     Endpoint     PATCH /api/v1/tenants/:tenantSlug/rewards/:rewardId
//     Who          Jane Doe <jane@brew.example>
//                  user 019b…, session 0193…, signed in with SESSION_COOKIE
//     Tenant       019b… (brew-bean-kl), verified by the API
//                  X-Tenant-Id 019b… (matches), X-Location-Id not sent
//     Client       merchant app, Chrome 140 on macOS 15 (DESKTOP)
//                  IP 203.0.113.7 (PUBLIC), Kuala Lumpur, MY
//     Trace        correlation hzGg…
//
//     Request headers
//       accept: application/json
//       …
//     Request body
//       {
//         "name": "Coffee"
//       }
//
// Every entry opens with a `=` rule at the start of a line; everything inside
// an entry is indented (the title's `-` underline aside), so the `=` rule only
// ever starts an entry, and the line under it always starts with the time. Each fact is on a labelled line and is
// always there: an absent fact says so ("not sent", "none") rather than
// disappearing, so a reader never wonders whether it was forgotten.

import { z } from "zod";

import type { AuditErrorDetail, AuditErrorLink, JsonValue } from "@workspace/shared";

import type { HttpAuditEntry } from "../audit/http-audit-entry";
import { systemCommandRowOrigin, type SystemCommandRowOrigin } from "../audit/system-command-audit";

/** Indent of the pretty-printed payloads — `jq`'s default. */
const JSON_INDENT = 2;

/** Width of the rule that opens every entry. */
const RULE_WIDTH = 80;
/** Opens every entry, at the start of a line (nothing else in the file is). */
export const TRANSACTION_LOG_ENTRY_RULE: string = "=".repeat(RULE_WIDTH);
/** Underlines the title. */
export const TRANSACTION_LOG_TITLE_RULE: string = "-".repeat(RULE_WIDTH);

/** Indent of the labelled facts. */
const FACT_INDENT = "  ";
/** Labels are padded to this width, so the values line up in one column. */
const LABEL_WIDTH = 13;
/** Indent of a value's continuation lines: under the value column. */
const CONTINUATION_INDENT: string = " ".repeat(FACT_INDENT.length + LABEL_WIDTH);
/** Indent of a section's body (headers, payloads). */
const SECTION_BODY_INDENT = "    ";

/** Day files are `transactions-YYYY-MM-DD.txt`, by the UTC day the request arrived. */
export const TRANSACTION_LOG_FILE_PREFIX = "transactions-";
export const TRANSACTION_LOG_FILE_EXTENSION = ".txt";

/** A day file's name, with the day as a named group (rules/27). */
const DAY_FILE_PATTERN = /^transactions-(?<day>\d{4}-\d{2}-\d{2})\.txt$/;

/** Length of `YYYY-MM-DD` at the start of an ISO timestamp. */
const ISO_DAY_LENGTH = 10;

/** `2026-10-26T12:06:44.442Z` → `2026-10-26 12:06:44.442` (+ ` UTC`). */
const ISO_TIME_PATTERN = /^(?<day>\d{4}-\d{2}-\d{2})T(?<time>[\d:.]+)Z$/;

/** A system command's input names the system actor and why it ran (`actor.reason`). */
const SystemReasonSchema = z.looseObject({ actor: z.looseObject({ reason: z.string().min(1) }) });

/** A tenant route's slug, from the recorded route params. */
const TenantSlugParamsSchema = z.looseObject({ params: z.looseObject({ tenantSlug: z.string().min(1) }) });

/** One labelled fact: its first line, then any continuation lines. */
type Fact = readonly [label: string, lines: readonly string[]];

/** `2026-10-26 12:06:44.442 UTC`. */
function readableTime(epochMs: number): string {
	const iso: string = new Date(epochMs).toISOString();
	const groups = ISO_TIME_PATTERN.exec(iso)?.groups;
	return groups?.day === undefined || groups.time === undefined ? iso : `${groups.day} ${groups.time} UTC`;
}

/** The set parts joined by `separator`, or `null` when none is set. */
function joined(parts: readonly (string | null)[], separator: string): string | null {
	const set: string[] = parts.filter((part: string | null): part is string => part !== null && part !== "");
	return set.length === 0 ? null : set.join(separator);
}

/** `admin app, Chrome 140 on macOS 15 (DESKTOP)`. */
function clientLine(entry: HttpAuditEntry): string {
	const software: string | null = joined([joined([entry.browserName, entry.browserVersion], " "), joined([entry.osName, entry.osVersion], " ")], " on ");
	const device: string | null = entry.deviceType === null ? null : `(${entry.deviceType})`;
	const app: string = entry.clientType === null ? "app not named (no X-Client-Type)" : `${entry.clientType} app`;
	return joined([app, joined([software ?? (entry.userAgent === null ? "no User-Agent" : null), device], " ")], ", ") ?? app;
}

/** `IP 203.0.113.7 (PUBLIC), Kuala Lumpur, Selangor, MY`. */
function networkLine(entry: HttpAuditEntry): string {
	const ip: string = entry.ipAddress === null ? "IP not recorded" : `IP ${entry.ipAddress}${entry.ipScope === null ? "" : ` (${entry.ipScope})`}`;
	return joined([ip, entry.geoCity, entry.geoRegion, entry.geoCountry], ", ") ?? ip;
}

/** `PrismaClientKnownRequestError [P2025]: Record to update not found.` — the message's own line breaks become continuation lines. */
function linkLines(link: AuditErrorLink, prefix: string): string[] {
	const [first = "", ...rest] = link.message.split("\n");
	const code: string = link.code === null ? "" : ` [${link.code}]`;
	return [`${prefix}${link.type}${code}: ${first}`, ...rest.map((line: string): string => `  ${line}`)];
}

function reasonLines(detail: AuditErrorDetail | null): string[] {
	if (detail === null) {
		return ["not recorded (a row written before error details were kept)"];
	}
	return [...linkLines(detail, ""), ...detail.causes.flatMap((cause: AuditErrorLink): string[] => linkLines(cause, "caused by ")), ...detail.stack];
}

function resultLine(entry: HttpAuditEntry): string {
	const code: string = entry.errorCode === null ? "" : ` ${entry.errorCode}`;
	return `${entry.outcome}: answered ${String(entry.responseStatus)}${code} after ${String(entry.completedAt - entry.occurredAt)} ms`;
}

/** Who acted on an HTTP request: the person, their credential, and anyone behind them. */
function httpWhoLines(entry: HttpAuditEntry): string[] {
	const lines: string[] = [];
	if (entry.actorUserId !== null) {
		const identity = entry.actorIdentity;
		lines.push(identity === null ? "a signed-in user (name not recorded)" : identity.fullName === null ? `<${identity.email}>` : `${identity.fullName} <${identity.email}>`);
		lines.push(
			joined(
				[
					`user ${entry.actorUserId}`,
					entry.sessionId === null ? "no device session" : `session ${entry.sessionId}`,
					entry.authMethod === null ? null : `signed in with ${entry.authMethod}`,
				],
				", ",
			) ?? `user ${entry.actorUserId}`,
		);
	} else if (entry.apiKeyId !== null) {
		lines.push(`API key ${entry.apiKeyId}${entry.terminalId === null ? "" : `, POS terminal ${entry.terminalId}`}`);
	} else {
		lines.push("anonymous: no credential was presented or accepted");
	}
	if (entry.impersonatorUserId !== null) {
		lines.push(`impersonated by user ${entry.impersonatorUserId}${entry.impersonationSessionId === null ? "" : `, impersonation session ${entry.impersonationSessionId}`}`);
	}
	if (entry.supportAccessGrantId !== null) {
		lines.push(`acting through support access grant ${entry.supportAccessGrantId}`);
	}
	return lines;
}

/** Who ran a system command: the system itself, and the user it ran for, if any. */
function systemWhoLines(entry: HttpAuditEntry): string[] {
	const reason = SystemReasonSchema.safeParse(entry.requestBody);
	const [operation = null] = entry.systemOperations;
	return [
		entry.actorUserId === null ? "the system, no user (background work)" : `the system, on behalf of user ${entry.actorUserId}`,
		...(operation === null ? [] : [`system operation ${operation}`]),
		...(reason.success ? [`why: ${reason.data.actor.reason}`] : []),
	];
}

/** `X-Tenant-Id 019b… (matches)`, `(differs from the verified tenant)` or `not sent`. */
function claimLine(header: string, claimed: string | null, verified: string | null): string {
	if (claimed === null) {
		return `${header} not sent`;
	}
	if (verified === null) {
		return `${header} ${claimed} (not verified)`;
	}
	return `${header} ${claimed} (${claimed === verified ? "matches" : "DIFFERS from the verified one"})`;
}

function tenantLines(entry: HttpAuditEntry, origin: SystemCommandRowOrigin | null): string[] {
	const slug = TenantSlugParamsSchema.safeParse(entry.requestParams);
	const location: string = entry.locationId === null ? "" : `, location ${entry.locationId}`;
	const verified: string =
		entry.tenantId === null
			? origin === null
				? "none: not a tenant request"
				: "none: platform-wide"
			: `${entry.tenantId}${slug.success ? ` (${slug.data.params.tenantSlug})` : ""}${location}${origin === null ? ", verified by the API" : ""}`;
	if (origin !== null) {
		return [verified];
	}
	return [verified, `${claimLine("X-Tenant-Id", entry.claimedTenantId, entry.tenantId)}, ${claimLine("X-Location-Id", entry.claimedLocationId, entry.locationId)}`];
}

function traceLines(entry: HttpAuditEntry): string[] {
	const ids: string =
		joined(
			[
				`correlation ${entry.correlationId}`,
				entry.traceId === entry.correlationId ? null : `trace ${entry.traceId}`,
				entry.idempotencyKey === null ? null : `idempotency key ${entry.idempotencyKey}`,
			],
			", ",
		) ?? `correlation ${entry.correlationId}`;
	return entry.systemOperations.length === 0 ? [ids] : [ids, `system operations: ${entry.systemOperations.join(", ")}`];
}

function facts(entry: HttpAuditEntry, origin: SystemCommandRowOrigin | null): Fact[] {
	const http: Fact[] =
		origin === null
			? [
					["Endpoint", [`${entry.method} ${entry.endpoint}`]],
					["Who", httpWhoLines(entry)],
					["Tenant", tenantLines(entry, origin)],
					[
						"Client",
						[
							clientLine(entry),
							networkLine(entry),
							...(entry.origin === null ? [] : [`origin ${entry.origin}`]),
							...(entry.referer === null ? [] : [`referer ${entry.referer}`]),
						],
					],
				]
			: [
					["Command", [`${entry.endpoint} (${origin.kind} ${origin.name})`]],
					["Who", systemWhoLines(entry)],
					["Tenant", tenantLines(entry, origin)],
				];
	return [
		["Result", [resultLine(entry)]],
		...(entry.outcome === "FAILED" ? [["Reason", reasonLines(entry.errorDetail)] satisfies Fact] : []),
		...http,
		["Trace", traceLines(entry)],
	];
}

function factLines([label, lines]: Fact): string[] {
	const [first = "", ...rest] = lines;
	return [`${FACT_INDENT}${label.padEnd(LABEL_WIDTH)}${first}`, ...rest.map((line: string): string => `${CONTINUATION_INDENT}${line}`)];
}

/** A titled section under the facts: its body indented below the title. */
function section(title: string, body: readonly string[]): string[] {
	return ["", `${FACT_INDENT}${title}`, ...body.map((line: string): string => `${SECTION_BODY_INDENT}${line}`)];
}

/** A payload pretty-printed the way `jq` prints it. */
function jsonSection(title: string, value: JsonValue | null): string[] {
	return value === null ? [] : section(title, JSON.stringify(value, null, JSON_INDENT).split("\n"));
}

function headerSection(entry: HttpAuditEntry): string[] {
	if (entry.requestHeaders === null) {
		return [];
	}
	return section(
		"Request headers",
		Object.entries(entry.requestHeaders).map(([name, value]): string => `${name}: ${value}`),
	);
}

/** The title under the rule: when, how it ended, and what was asked. */
function title(entry: HttpAuditEntry, origin: SystemCommandRowOrigin | null): string {
	const status = `${entry.outcome} ${String(entry.responseStatus)}${entry.errorCode === null ? "" : ` ${entry.errorCode}`}`;
	const target: string = origin === null ? `${entry.method} ${entry.path}` : `${entry.method} ${origin.name}`;
	return `${readableTime(entry.occurredAt)}  ${status}  ${target}`;
}

/** One transaction as text, ending with the blank line that separates it from the next. */
export function formatTransactionLogEntry(entry: HttpAuditEntry): string {
	const origin: SystemCommandRowOrigin | null = systemCommandRowOrigin(entry);
	const lines: string[] = [
		TRANSACTION_LOG_ENTRY_RULE,
		title(entry, origin),
		TRANSACTION_LOG_TITLE_RULE,
		...facts(entry, origin).flatMap(factLines),
		...headerSection(entry),
		...jsonSection("Request params and query", entry.requestParams),
		...jsonSection(origin === null ? "Request body" : "Command input", entry.requestBody),
		...jsonSection(origin === null ? "Response body" : "Command result", entry.responseBody),
	];
	return `${lines.join("\n")}\n\n`;
}

/** The UTC day of an instant: `2026-10-26`. */
export function utcDayOf(epochMs: number): string {
	return new Date(epochMs).toISOString().slice(0, ISO_DAY_LENGTH);
}

/** `transactions-2026-10-26.txt` for any instant on 26 October 2026 (UTC). */
export function transactionLogFileName(epochMs: number): string {
	return `${TRANSACTION_LOG_FILE_PREFIX}${utcDayOf(epochMs)}${TRANSACTION_LOG_FILE_EXTENSION}`;
}

/** The UTC day (`YYYY-MM-DD`) of a day file, or `null` for any other file in the folder. */
export function transactionLogFileDay(fileName: string): string | null {
	return DAY_FILE_PATTERN.exec(fileName)?.groups?.day ?? null;
}
