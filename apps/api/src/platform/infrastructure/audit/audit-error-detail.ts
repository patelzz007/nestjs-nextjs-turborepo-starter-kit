// ============================================
// platform/infrastructure/audit/audit-error-detail.ts — WHY a request or command failed
// ============================================
// The error code an audit row carries is what the caller was told
// (`INTERNAL_ERROR`). This is what the server knew: the exception's class, its
// own message, the code it carried, the `cause` chain and — for a 5xx — where
// it was thrown. Bounded to the shared contract (audit-request-facts.ts), with
// URL credentials redacted and e-mail addresses masked, like every stored payload.

import {
	AUDIT_ERROR_CAUSES_MAX_COUNT,
	AUDIT_ERROR_DETAIL_CODE_MAX_LENGTH,
	AUDIT_ERROR_MESSAGE_MAX_LENGTH,
	AUDIT_ERROR_STACK_FRAME_MAX_LENGTH,
	AUDIT_ERROR_STACK_MAX_FRAMES,
	AUDIT_ERROR_TYPE_MAX_LENGTH,
	AUDIT_TRUNCATION_MARK,
	AuditErrorDetailSchema,
	type AuditErrorDetail,
	type AuditErrorLink,
	type CaughtValue,
} from "@workspace/shared";
import { z } from "zod";

import { REDACTED } from "../nest-logging/redaction";
import { readCaughtErrorMessage } from "../utils/caught-error";

/** The type recorded for a thrown value that is not an `Error`. */
export const NON_ERROR_THROWN = "NonErrorThrown";

/** A machine code an error carries: Prisma `P2025`, Node `ECONNREFUSED`, a domain code. */
const ErrorCodeSchema = z.looseObject({ code: z.union([z.string().min(1), z.number()]) });

/** An e-mail address inside free text (a message is not a field, so the field-name masking cannot see it). */
const EMAIL_IN_TEXT = /(?<first>[A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(?<domain>@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Credentials inside a URL (`postgres://user:secret@db/app`): the user-info part before `@`. */
const URL_CREDENTIALS_IN_TEXT = /(?<scheme>[A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/g;

/** A stack line that is a frame (`    at fn (file:1:2)`), not the message. */
const STACK_FRAME = /^\s*at\s+/;

/** Frames inside Node itself (`(node:internal/…)`, `async node:internal/…`) say nothing about the code path. */
const NODE_INTERNAL_FRAME = /[\s(]node:/;

/** `value` cut to `maxLength`, ending with the truncation mark when it was cut. */
function bounded(value: string, maxLength: number): string {
	return value.length <= maxLength ? value : `${value.slice(0, maxLength - AUDIT_TRUNCATION_MARK.length)}${AUDIT_TRUNCATION_MARK}`;
}

/**
 * Free text made safe to store: credentials inside a URL → `[REDACTED]`, and
 * e-mail addresses masked the way the audit policy masks them (ADR 025:
 * `jane.doe@example.com` → `j***@example.com`).
 */
export function redactErrorText(text: string): string {
	return text.replace(URL_CREDENTIALS_IN_TEXT, `$<scheme>${REDACTED}@`).replace(EMAIL_IN_TEXT, "$<first>***$<domain>");
}

function typeOf(error: Error): string {
	const name: string = error.name === "Error" ? error.constructor.name : error.name;
	return bounded(name.length === 0 ? "Error" : name, AUDIT_ERROR_TYPE_MAX_LENGTH);
}

function codeOf(error: Error): string | null {
	const parsed = ErrorCodeSchema.safeParse(error);
	return parsed.success ? bounded(String(parsed.data.code), AUDIT_ERROR_DETAIL_CODE_MAX_LENGTH) : null;
}

function linkOf(error: Error): AuditErrorLink {
	return { type: typeOf(error), message: bounded(redactErrorText(error.message), AUDIT_ERROR_MESSAGE_MAX_LENGTH), code: codeOf(error) };
}

/** The `cause` chain below `error`, outermost first, bounded (a cycle ends it). */
function causesOf(error: Error): AuditErrorLink[] {
	const causes: AuditErrorLink[] = [];
	const seen = new Set<Error>([error]);
	let cause = error.cause;
	while (cause instanceof Error && !seen.has(cause) && causes.length < AUDIT_ERROR_CAUSES_MAX_COUNT) {
		seen.add(cause);
		causes.push(linkOf(cause));
		cause = cause.cause;
	}
	return causes;
}

/** The first application frames of the stack, paths relative to the working directory. */
function stackOf(error: Error, workingDirectory: string): string[] {
	const lines: string[] = (error.stack ?? "").split("\n");
	return lines
		.filter((line: string): boolean => STACK_FRAME.test(line) && !NODE_INTERNAL_FRAME.test(line))
		.slice(0, AUDIT_ERROR_STACK_MAX_FRAMES)
		.map((line: string): string => bounded(line.trim().replaceAll(`${workingDirectory}/`, "").replaceAll("file://", ""), AUDIT_ERROR_STACK_FRAME_MAX_LENGTH));
}

export interface AuditErrorDetailOptions {
	/** Keep where it was thrown: a server fault (5xx). A 4xx is the caller's mistake, not a code path. */
	readonly withStack: boolean;
	/** Stripped from stack paths (`process.cwd()`), so a frame reads `src/…/handler.ts:42:13`. */
	readonly workingDirectory: string;
}

/** What the server knew about a failure, for the audit row and the transaction log. Never sent to the caller. */
export function auditErrorDetail(caught: CaughtValue, options: AuditErrorDetailOptions): AuditErrorDetail {
	if (!(caught instanceof Error)) {
		return AuditErrorDetailSchema.parse({
			type: NON_ERROR_THROWN,
			message: bounded(redactErrorText(readCaughtErrorMessage(caught)), AUDIT_ERROR_MESSAGE_MAX_LENGTH),
			code: null,
			causes: [],
			stack: [],
		});
	}
	return AuditErrorDetailSchema.parse({
		...linkOf(caught),
		causes: causesOf(caught),
		stack: options.withStack ? stackOf(caught, options.workingDirectory) : [],
	});
}
