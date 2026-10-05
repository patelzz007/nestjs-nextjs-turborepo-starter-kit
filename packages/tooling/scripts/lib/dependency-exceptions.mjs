/**
 * The time-boxed dependency decisions recorded in pnpm-workspace.yaml:
 *
 * - `auditConfig.ignoreGhsas` — an accepted advisory (no patched release
 *   exists and it cannot be reached with untrusted input), with a
 *   `# review-by: YYYY-MM-DD` comment.
 * - `minimumReleaseAgeExclude` — a fresh release taken before the supply-chain
 *   cooldown (e.g. a security fix), with a `Delete this entry on or after
 *   YYYY-MM-DD` comment.
 *
 * Two checks use this module, deliberately split:
 * - every push (tests/dependency-exceptions.test.mjs) checks the STRUCTURE
 *   only — each entry has a written reason and a valid date — so CI never
 *   turns red just because a calendar day passed;
 * - the scheduled `dependency-review` workflow (scripts/check-dependency-exceptions.mjs)
 *   reports entries whose date has passed, so they get re-checked or removed.
 */

const GHSA_ENTRY_PATTERN = /^\s+-\s+(GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4})\s*$/;
const COOLDOWN_ENTRY_PATTERN = /^\s+-\s+(\S+@\d\S*)\s*$/;
const REVIEW_BY_PATTERN = /review-by:\s*(\d{4}-\d{2}-\d{2})/;
const DELETE_ON_PATTERN = /on or after (\d{4}-\d{2}-\d{2})/;
const ISO_DATE_LENGTH = 10;

/** @typedef {"accepted-advisory" | "cooldown-exception"} ExceptionKind */
/** @typedef {{ kind: ExceptionKind, id: string, reason: string[], date: string | null }} DependencyException */

const KINDS = [
	{ kind: "accepted-advisory", block: "auditConfig", entryPattern: GHSA_ENTRY_PATTERN, datePattern: REVIEW_BY_PATTERN },
	{ kind: "cooldown-exception", block: "minimumReleaseAgeExclude", entryPattern: COOLDOWN_ENTRY_PATTERN, datePattern: DELETE_ON_PATTERN },
];

/** The YAML block under the top-level `key:` (until the next top-level key), as lines. */
function blockLines(lines, key) {
	const start = lines.findIndex((line) => line.trim() === `${key}:`);
	if (start === -1) {
		return [];
	}
	const block = [];
	for (const line of lines.slice(start + 1)) {
		if (/^\S/.test(line)) {
			break;
		}
		block.push(line);
	}
	return block;
}

/**
 * Every exception in the workspace file, each with the comment lines directly
 * above it split into its written reason and its date (null when missing).
 *
 * @param {string} workspaceYaml
 * @returns {DependencyException[]}
 */
export function parseDependencyExceptions(workspaceYaml) {
	const lines = workspaceYaml.split("\n");
	const exceptions = [];
	for (const { kind, block, entryPattern, datePattern } of KINDS) {
		let comments = [];
		for (const line of blockLines(lines, block)) {
			const trimmed = line.trim();
			if (trimmed.startsWith("#")) {
				comments.push(trimmed.replace(/^#\s?/, ""));
				continue;
			}
			const match = entryPattern.exec(line);
			if (match !== null) {
				const date = comments.map((comment) => datePattern.exec(comment)?.[1]).find((value) => value !== undefined) ?? null;
				const reason = comments.filter((comment) => !REVIEW_BY_PATTERN.test(comment));
				exceptions.push({ kind, id: match[1], reason, date });
			}
			comments = [];
		}
	}
	return exceptions;
}

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoCalendarDate(value) {
	if (value === null || value.length !== ISO_DATE_LENGTH) {
		return false;
	}
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, ISO_DATE_LENGTH) === value;
}

/**
 * Structural problems only — never depends on today's date.
 *
 * @param {DependencyException[]} exceptions
 * @returns {string[]}
 */
export function structuralProblems(exceptions) {
	const problems = [];
	for (const exception of exceptions) {
		if (exception.reason.length === 0) {
			problems.push(`${exception.id}: add a comment above the entry explaining why it is needed`);
		}
		if (!isIsoCalendarDate(exception.date)) {
			const hint = exception.kind === "accepted-advisory" ? "`# review-by: YYYY-MM-DD`" : "`Delete this entry on or after YYYY-MM-DD`";
			problems.push(`${exception.id}: add a valid date (${hint})`);
		}
	}
	return problems;
}

/**
 * Exceptions that need attention on `today` (`YYYY-MM-DD`) — for the scheduled review, not for push CI.
 * An accepted advisory is due once its review-by date has passed; a cooldown exception is due
 * from its "on or after" date (the version is mature by then, so the entry only adds noise).
 *
 * @param {DependencyException[]} exceptions
 * @param {string} today
 * @returns {DependencyException[]}
 */
export function dueExceptions(exceptions, today) {
	return exceptions.filter((exception) => {
		if (exception.date === null) {
			return false;
		}
		return exception.kind === "accepted-advisory" ? exception.date < today : exception.date <= today;
	});
}
