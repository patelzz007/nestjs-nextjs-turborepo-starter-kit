import { z } from "zod";

export const ParsedCookieSchema = z.object({
	name: z.string(),
	value: z.string(),
	httpOnly: z.boolean(),
	secure: z.boolean(),
	sameSite: z.enum(["lax", "strict", "none"]),
	path: z.string(),
	domain: z.string().nullable(),
	maxAge: z.number().nullable(),
	expires: z.date().nullable(),
});

export type ParsedCookie = z.output<typeof ParsedCookieSchema>;

export function parseSetCookie(header: string): ParsedCookie | null {
	const segments: readonly string[] = header.split(";").map((segment: string): string => segment.trim());
	const first: string | undefined = segments[0];
	if (first === undefined) return null;
	const eq: number = first.indexOf("=");
	if (eq <= 0) return null;
	const name: string = first.slice(0, eq);
	const value: string = first.slice(eq + 1);

	let httpOnly = false;
	let secure = false;
	let sameSite: "lax" | "strict" | "none" = "lax";
	let path = "/";
	let domain: string | null = null;
	let maxAge: number | null = null;
	let expires: Date | null = null;

	for (const segment of segments.slice(1)) {
		const lower: string = segment.toLowerCase();
		if (lower === "httponly") httpOnly = true;
		else if (lower === "secure") secure = true;
		else if (lower.startsWith("samesite=")) {
			const raw: string = segment.slice("samesite=".length).trim().toLowerCase();
			if (raw === "strict" || raw === "none") sameSite = raw;
			else sameSite = "lax";
		} else if (lower.startsWith("path=")) {
			path = segment.slice("path=".length).trim();
		} else if (lower.startsWith("domain=")) {
			domain = segment.slice("domain=".length).trim();
		} else if (lower.startsWith("max-age=")) {
			const raw = Number(segment.slice("max-age=".length).trim());
			maxAge = Number.isFinite(raw) ? raw : null;
		} else if (lower.startsWith("expires=")) {
			const parsed: Date = new Date(segment.slice("expires=".length).trim());
			expires = Number.isNaN(parsed.getTime()) ? null : parsed;
		}
	}

	return { name, value, httpOnly, secure, sameSite, path, domain, maxAge, expires };
}

interface CookieHeaders {
	get(name: string): string | null;
	getSetCookie?: () => string[];
}

export function collectSetCookies(headers: CookieHeaders): string[] {
	const setCookies: string[] | undefined = headers.getSetCookie?.();
	if (setCookies !== undefined) return setCookies;
	const combined: string | null = headers.get("set-cookie");
	return combined === null || combined === "" ? [] : combined.split(", ");
}

export function hasRotatedAuthCookies(setCookies: readonly string[], accessTokenName: string, refreshTokenName: string): boolean {
	let hasAccess = false;
	let hasRefresh = false;
	for (const header of setCookies) {
		const cookie: ParsedCookie | null = parseSetCookie(header);
		if (cookie === null) continue;
		if (cookie.name === accessTokenName) hasAccess = true;
		if (cookie.name === refreshTokenName) hasRefresh = true;
	}
	return hasAccess && hasRefresh;
}

export function extractRotatedAccessToken(setCookies: readonly string[], accessTokenName: string): string | undefined {
	for (const header of setCookies) {
		const cookie: ParsedCookie | null = parseSetCookie(header);
		if (cookie?.name === accessTokenName) {
			return cookie.value;
		}
	}
	return undefined;
}

export interface RotatedCookieWriter {
	set(
		name: string,
		value: string,
		options: {
			httpOnly?: boolean;
			secure?: boolean;
			sameSite?: "lax" | "strict" | "none";
			path?: string;
			domain?: string;
			maxAge?: number;
			expires?: Date;
		},
	): void;
}

export function applyRotatedSetCookies(writer: RotatedCookieWriter, setCookies: readonly string[]): void {
	for (const header of setCookies) {
		const cookie: ParsedCookie | null = parseSetCookie(header);
		if (cookie === null) {
			continue;
		}
		writer.set(cookie.name, cookie.value, {
			httpOnly: cookie.httpOnly,
			secure: cookie.secure,
			sameSite: cookie.sameSite,
			path: cookie.path,
			domain: cookie.domain ?? undefined,
			maxAge: cookie.maxAge ?? undefined,
			expires: cookie.expires ?? undefined,
		});
	}
}

export interface AuthCookieClearOptions {
	readonly domain?: string;
	readonly path?: string;
	readonly secure?: boolean;
	readonly sameSite?: "lax" | "strict" | "none";
}

export function clearAuthCookies(writer: RotatedCookieWriter, names: readonly string[], options: AuthCookieClearOptions): void {
	for (const name of names) {
		writer.set(name, "", {
			httpOnly: true,
			secure: options.secure ?? process.env.NODE_ENV === "production",
			sameSite: options.sameSite ?? "lax",
			path: options.path ?? "/",
			domain: options.domain,
			maxAge: 0,
		});
	}
}
