import { installCrashReporter } from "./crash-reporter";
import { loadFirebaseCrashReporter, type CrashlyticsLoader, DEVICE_CRASHLYTICS_LOADER } from "./firebase-crash-reporter";

/**
 * Installs the crash reporter at start-up (enhancement 6.2). A reporter that can't start is a warning, never a
 * crash: the app runs without crash reports rather than not at all.
 */
export async function startCrashReporting(
	collect: boolean,
	warn: (message: string, error: Error) => void,
	loader: CrashlyticsLoader = DEVICE_CRASHLYTICS_LOADER,
): Promise<void> {
	try {
		const reporter = await loadFirebaseCrashReporter(collect, loader);
		if (reporter !== null) {
			installCrashReporter(reporter);
		}
	} catch (error: unknown) {
		warn("Crash reporting could not start", error instanceof Error ? error : new Error(String(error)));
	}
}
