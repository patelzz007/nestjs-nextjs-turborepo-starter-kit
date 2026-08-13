/**
 * Decides whether a request is worth capturing at all (docs/telescope.md
 * §10.5): preflight OPTIONS are noise, and anything under an ignore/redact
 * path (health checks, swagger, telescope itself — infinite loop) is skipped.
 *
 * Improvement 11: `capturePaths` is an OPTIONAL allowlist — when set, ONLY
 * paths under those prefixes are captured. `redactPaths` layers extra denials
 * on top of the built-in `ignorePaths` (e.g. PII-heavy endpoints).
 */
export interface CaptureRuleOptions {
	readonly ignorePaths: readonly string[];
	readonly redactPaths: readonly string[];
	readonly capturePaths: readonly string[] | undefined;
}

function underPrefix(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function shouldCaptureRequest(method: string, pathname: string, options: CaptureRuleOptions): boolean {
	if (method.toUpperCase() === "OPTIONS") {
		return false;
	}
	// Allowlist wins: when `capturePaths` is configured, nothing outside it is
	// captured — ignore/redact lists become irrelevant for those paths.
	if (options.capturePaths !== undefined && options.capturePaths.length > 0) {
		return options.capturePaths.some((prefix: string): boolean => underPrefix(pathname, prefix));
	}
	for (const ignorePath of options.ignorePaths) {
		if (underPrefix(pathname, ignorePath)) {
			return false;
		}
	}
	for (const redactPath of options.redactPaths) {
		if (underPrefix(pathname, redactPath)) {
			return false;
		}
	}
	return true;
}
