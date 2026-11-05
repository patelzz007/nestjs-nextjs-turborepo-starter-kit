// ============================================
// Crash reporting (enhancement 6.2)
// ============================================
// One place the app reports an error it caught (a screen that failed to render, a warning
// the runtime raised). Native crashes and uncaught JavaScript errors are caught by the
// reporter's own SDK; this is for the errors the app handles itself. Until a reporter is
// installed (Expo Go, tests, a build without Firebase's config) nothing is recorded.

/** Where caught errors go. */
export interface CrashReporter {
	/** Records a non-fatal error; `where` names the part of the app that caught it. */
	recordError(error: Error, where: string): void;
}

/** Records nothing: Expo Go, tests, and a build without a crash reporter. */
export const NO_CRASH_REPORTER: CrashReporter = {
	recordError: (): void => {
		// Nowhere to send it.
	},
};

const installed: { reporter: CrashReporter } = { reporter: NO_CRASH_REPORTER };

/** Makes `reporter` the one every caught error goes to (once, at start-up). */
export function installCrashReporter(reporter: CrashReporter): void {
	installed.reporter = reporter;
}

/** Records a caught error with the installed reporter (nothing, before one is installed). */
export function reportError(error: Error, where: string): void {
	installed.reporter.recordError(error, where);
}
