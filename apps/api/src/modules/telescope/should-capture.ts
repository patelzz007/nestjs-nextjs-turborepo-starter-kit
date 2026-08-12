/**
 * Decides whether a request is worth capturing at all (docs/telescope.md
 * §10.5): preflight OPTIONS are noise, and anything under an `ignorePath`
 * (health checks, swagger, telescope itself — infinite loop) is skipped.
 */
export function shouldCaptureRequest(method: string, pathname: string, ignorePaths: readonly string[]): boolean {
	if (method.toUpperCase() === "OPTIONS") {
		return false;
	}
	for (const ignorePath of ignorePaths) {
		if (pathname === ignorePath || pathname.startsWith(`${ignorePath}/`)) {
			return false;
		}
	}
	return true;
}
