import { z } from "zod";

import { TelescopeJsonValueSchema, type TelescopeJsonValue, type TelescopePiiCategory, type TelescopePiiFlag } from "@workspace/shared";

/**
 * Feature 17 — PII scanner.
 *
 * Two jobs, both done at capture time:
 * 1. `scanPii` counts occurrences of email / phone / JWT / SSN / credit-card
 *    patterns inside a captured JSON value (bodies) or header map, so the
 *    request detail can show a "PII detected" flag per category.
 * 2. `redactPii` masks the SAME patterns inside strings so sensitive values
 *    never persist — redaction is the DEFAULT, not an opt-in (docs §10).
 *
 * The scanner is deliberately pattern-based (fast, dependency-free). It is a
 * triage tool for a dev dashboard, not a compliance guarantee — the email
 * masking in `sanitize.ts` still runs first and always wins on keys like
 * `email`/`password`.
 */

// ── Patterns ───────────────────────────────────────────────────────────────

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** International-ish phone: +, optional area code, 7-15 digits with separators. */
const PHONE_PATTERN = /\+?[0-9][\s().-]*(?:[0-9][\s().-]*){6,14}[0-9]/g;

/** JWT: three base64url segments. */
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/** US SSN: `123-45-6789` (with or without dashes). */
const SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g;

/** Credit card: 13-19 digits, optional spaces/dashes between groups of 4. */
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;

interface CategoryRule {
	readonly category: TelescopePiiCategory;
	readonly pattern: RegExp;
}

const RULES: readonly CategoryRule[] = [
	{ category: "email", pattern: EMAIL_PATTERN },
	{ category: "phone", pattern: PHONE_PATTERN },
	{ category: "jwt", pattern: JWT_PATTERN },
	{ category: "ssn", pattern: SSN_PATTERN },
	{ category: "creditCard", pattern: CARD_PATTERN },
];

/** Masking replacements — same length-ish so JSON structure is preserved. */
const REDACTED: Readonly<Record<TelescopePiiCategory, string>> = {
	email: "***@redacted",
	phone: "[phone-redacted]",
	jwt: "[jwt-redacted]",
	ssn: "[ssn-redacted]",
	creditCard: "[card-redacted]",
};

function isString(value: TelescopeJsonValue): value is string {
	return z.string().safeParse(value).success;
}

function isObject(value: TelescopeJsonValue): value is Record<string, TelescopeJsonValue> {
	return z.record(z.string(), TelescopeJsonValueSchema).safeParse(value).success;
}

function isScalar(value: TelescopeJsonValue): boolean {
	return z.boolean().safeParse(value).success || z.number().safeParse(value).success || value === null;
}

/**
 * Counts PII categories found in a JSON value (walks strings only; keys are
 * NOT scanned — key names like `email` are already handled by the sanitizer).
 */
export function scanPii(value: TelescopeJsonValue | null): readonly TelescopePiiFlag[] {
	if (value === null) {
		return [];
	}
	const counts = new Map<TelescopePiiCategory, number>();
	const visit = (node: TelescopeJsonValue): void => {
		if (isString(node)) {
			for (const rule of RULES) {
				const matches: RegExpMatchArray | null = node.match(rule.pattern);
				if (matches !== null) {
					counts.set(rule.category, (counts.get(rule.category) ?? 0) + matches.length);
				}
			}
			return;
		}
		if (Array.isArray(node)) {
			for (const item of node) {
				visit(item);
			}
			return;
		}
		if (isObject(node)) {
			for (const item of Object.values(node)) {
				visit(item);
			}
		}
	};
	visit(value);
	return [...counts.entries()]
		.map(([category, count]) => ({ category, count }))
		.sort((a: TelescopePiiFlag, b: TelescopePiiFlag): number => a.category.localeCompare(b.category));
}

/** Masks every PII pattern inside a JSON value's strings (in place, new tree). */
export function redactPii(value: TelescopeJsonValue): TelescopeJsonValue {
	if (isScalar(value)) {
		return value;
	}
	if (isString(value)) {
		let out: string = value;
		for (const rule of RULES) {
			out = out.replace(rule.pattern, REDACTED[rule.category]);
		}
		return out;
	}
	if (Array.isArray(value)) {
		return value.map((item: TelescopeJsonValue): TelescopeJsonValue => redactPii(item));
	}
	if (isObject(value)) {
		const record: Record<string, TelescopeJsonValue> = {};
		for (const [key, item] of Object.entries(value)) {
			record[key] = redactPii(item);
		}
		return record;
	}
	return value;
}

/** Masks PII inside a header map's values (header names are never PII). */
export function redactPiiHeaders(headers: Record<string, string> | null): Record<string, string> | null {
	if (headers === null) {
		return null;
	}
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		let redacted: string = value;
		for (const rule of RULES) {
			redacted = redacted.replace(rule.pattern, REDACTED[rule.category]);
		}
		out[key] = redacted;
	}
	return out;
}

/** Scans a header map for PII (used to flag requests with PII in headers). */
export function scanPiiHeaders(headers: Record<string, string> | null): readonly TelescopePiiFlag[] {
	if (headers === null) {
		return [];
	}
	const counts = new Map<TelescopePiiCategory, number>();
	for (const value of Object.values(headers)) {
		for (const rule of RULES) {
			const matches: RegExpMatchArray | null = value.match(rule.pattern);
			if (matches !== null) {
				counts.set(rule.category, (counts.get(rule.category) ?? 0) + matches.length);
			}
		}
	}
	return [...counts.entries()]
		.map(([category, count]) => ({ category, count }))
		.sort((a: TelescopePiiFlag, b: TelescopePiiFlag): number => a.category.localeCompare(b.category));
}
