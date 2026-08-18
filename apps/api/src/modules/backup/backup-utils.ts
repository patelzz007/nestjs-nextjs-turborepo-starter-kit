/** Pure helpers for backup dump/restore (no Nest / Prisma). */

export interface DfRow {
	readonly availableKb: number;
}

/**
 * Prisma driver-adapters allow non-libpq query params in DATABASE_URL
 * (`?schema=public` is the common one); libpq (pg_dump) hard-fails on any
 * param it doesn't know. Strip everything except the params pg_dump
 * understands (SSL + timeouts).
 */
export function libpqSafeUrl(databaseUrl: string): string {
	const url: URL = new URL(databaseUrl);
	const safeKeys: ReadonlySet<string> = new Set(["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey", "connect_timeout", "options", "target_session_attrs"]);
	for (const key of [...url.searchParams.keys()]) {
		if (!safeKeys.has(key)) {
			url.searchParams.delete(key);
		}
	}
	return url.toString();
}

/** Parses `df -Pk` output — last data line's "available" column (index 3). */
export function parseDfRow(stdout: string): DfRow | undefined {
	const lines: string[] = stdout
		.split("\n")
		.map((line: string): string => line.trim())
		.filter((line: string): boolean => line.length > 0);
	if (lines.length < 2) return undefined;
	const dataLine: string | undefined = lines.at(1);
	if (dataLine === undefined) return undefined;
	const fields: string[] = dataLine.split(/\s+/);
	const available: string | undefined = fields.at(3);
	if (available === undefined) return undefined;
	const kb: number = Number.parseInt(available, 10);
	return Number.isFinite(kb) ? { availableKb: kb } : undefined;
}

/** Double-quote-escapes a validated identifier for embedding in SQL. */
export function quoteIdent(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

/** Strips credentials (connection URLs) from any surfaced error text. */
export function redact(message: string): string {
	let result: string = message;
	const databaseUrl: string | undefined = process.env.DATABASE_URL;
	if (databaseUrl !== undefined && databaseUrl.length > 0) {
		result = result.split(databaseUrl).join("[redacted]");
	}
	result = result.replace(/(postgres(?:ql)?|mysql|redis):\/\/[^@\s]+@/g, "$1://***@");
	result = result.replace(/\bpassword\s*[:=]\s*[^\s,;]+/gi, "password=***");
	return result;
}

export function timestampForFilename(date: Date): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${String(date.getFullYear())}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Next fire time for a 5-field cron (`m h DOM month DOW`).
 * `*` wildcards are supported; lists/ranges/steps are not. Day-of-week is
 * 0–6 (Sunday–Saturday), matching `Date#getDay`.
 */
export function nextCronRunMs(cron: string, fromMs: number): number {
	const parts: string[] = cron.trim().split(/\s+/);
	const minute: number = Number.parseInt(parts[0] ?? "0", 10);
	const hour: number = Number.parseInt(parts[1] ?? "0", 10);
	const dayPart: string = parts[2] ?? "*";
	const monthPart: string = parts[3] ?? "*";
	const dowPart: string = parts[4] ?? "*";
	const dayOfMonth: number | undefined = dayPart === "*" ? undefined : Number.parseInt(dayPart, 10);
	const month: number | undefined = monthPart === "*" ? undefined : Number.parseInt(monthPart, 10);
	const dow: number | undefined = dowPart === "*" ? undefined : Number.parseInt(dowPart, 10);

	const from: Date = new Date(fromMs);
	for (let offset = 0; offset < 366; offset += 1) {
		const candidate: Date = new Date(from.getTime());
		candidate.setUTCDate(from.getUTCDate() + offset);
		candidate.setUTCHours(hour, minute, 0, 0);
		if (candidate.getTime() <= fromMs) {
			continue;
		}
		if (dow !== undefined && candidate.getUTCDay() !== dow) {
			continue;
		}
		if (dayOfMonth !== undefined && candidate.getUTCDate() !== dayOfMonth) {
			continue;
		}
		if (month !== undefined && candidate.getUTCMonth() + 1 !== month) {
			continue;
		}
		return candidate.getTime();
	}
	return fromMs + 24 * 60 * 60 * 1000;
}
