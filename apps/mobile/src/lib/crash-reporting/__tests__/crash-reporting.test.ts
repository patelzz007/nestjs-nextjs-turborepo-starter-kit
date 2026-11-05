import { installCrashReporter, NO_CRASH_REPORTER, reportError, type CrashReporter } from "../crash-reporter";
import { loadFirebaseCrashReporter, type CrashlyticsLoader, type CrashlyticsSdk } from "../firebase-crash-reporter";
import { startCrashReporting } from "../start-crash-reporting";

function fakeSdk(): CrashlyticsSdk & { readonly collection: boolean[]; readonly recorded: [Error, string][] } {
	const collection: boolean[] = [];
	const recorded: [Error, string][] = [];
	return {
		collection,
		recorded,
		setCollectionEnabled: (enabled: boolean): Promise<void> => {
			collection.push(enabled);
			return Promise.resolve();
		},
		recordError: (error: Error, where: string): void => {
			recorded.push([error, where]);
		},
	};
}

function loaderWith(sdk: CrashlyticsSdk | null): CrashlyticsLoader & { loads: number } {
	const loader = {
		loads: 0,
		hasNativeModule: (): boolean => sdk !== null,
		load: (): Promise<CrashlyticsSdk> => {
			loader.loads += 1;
			return sdk === null ? Promise.reject(new Error("no SDK")) : Promise.resolve(sdk);
		},
	};
	return loader;
}

afterEach((): void => {
	installCrashReporter(NO_CRASH_REPORTER);
});

describe("reportError", () => {
	it("records nothing before a reporter is installed, then sends every error to it", () => {
		expect((): void => {
			reportError(new Error("early"), "start-up");
		}).not.toThrow();
		const recorded: string[] = [];
		const reporter: CrashReporter = {
			recordError: (error: Error, where: string): void => {
				recorded.push(`${where}: ${error.message}`);
			},
		};
		installCrashReporter(reporter);
		reportError(new Error("boom"), "screen");
		expect(recorded).toEqual(["screen: boom"]);
	});
});

describe("loadFirebaseCrashReporter", () => {
	it("never loads the SDK where its native module is missing (Expo Go)", async () => {
		const loader = loaderWith(null);
		await expect(loadFirebaseCrashReporter(true, loader)).resolves.toBeNull();
		expect(loader.loads).toBe(0);
	});

	it("sets collection as asked and records through Crashlytics", async () => {
		const sdk = fakeSdk();
		const reporter = await loadFirebaseCrashReporter(false, loaderWith(sdk));
		const error = new Error("caught");
		reporter?.recordError(error, "settings");
		expect(sdk.collection).toEqual([false]);
		expect(sdk.recorded).toEqual([[error, "settings"]]);
	});
});

describe("startCrashReporting", () => {
	it("installs Crashlytics as the reporter", async () => {
		const sdk = fakeSdk();
		await startCrashReporting(true, jest.fn(), loaderWith(sdk));
		reportError(new Error("after start"), "screen");
		expect(sdk.collection).toEqual([true]);
		expect(sdk.recorded.map(([error]) => error.message)).toEqual(["after start"]);
	});

	it("warns, never throws, when the reporter can't start", async () => {
		const warn = jest.fn();
		const broken: CrashlyticsLoader = { hasNativeModule: (): boolean => true, load: (): Promise<CrashlyticsSdk> => Promise.reject(new Error("init failed")) };
		await expect(startCrashReporting(true, warn, broken)).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith("Crash reporting could not start", new Error("init failed"));
	});
});
