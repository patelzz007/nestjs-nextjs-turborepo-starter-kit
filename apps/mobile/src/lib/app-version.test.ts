import { ExecutionEnvironment } from "expo-constants";

import { InvalidAppVersionError, readAppVersion, readBuildNumber, resolveAppVersion } from "./app-version";

jest.mock("expo-application", () => ({ nativeApplicationVersion: "57.0.1", nativeBuildVersion: "417" }));
jest.mock("expo-constants", () => ({
	__esModule: true,
	ExecutionEnvironment: { Bare: "bare", Standalone: "standalone", StoreClient: "storeClient" },
	default: { executionEnvironment: "storeClient", expoConfig: { version: "1.0.0" } },
}));

describe("resolveAppVersion", () => {
	it("uses the native version in a real build", () => {
		expect(resolveAppVersion({ executionEnvironment: ExecutionEnvironment.Standalone, nativeApplicationVersion: "1.4.2", configVersion: "9.9.9" })).toBe("1.4.2");
		expect(resolveAppVersion({ executionEnvironment: ExecutionEnvironment.Bare, nativeApplicationVersion: "2.0.0-rc.1", configVersion: undefined })).toBe("2.0.0-rc.1");
	});

	it("uses app.config.ts's version inside Expo Go (whose own native version is Expo Go's)", () => {
		expect(resolveAppVersion({ executionEnvironment: ExecutionEnvironment.StoreClient, nativeApplicationVersion: "57.0.1", configVersion: "1.0.0" })).toBe("1.0.0");
	});

	it.each([
		[ExecutionEnvironment.Standalone, null, "1.0.0"],
		[ExecutionEnvironment.Standalone, "1.0", "1.0.0"],
		[ExecutionEnvironment.StoreClient, "1.0.0", undefined],
		[ExecutionEnvironment.StoreClient, "1.0.0", "v1.0.0"],
	])("refuses a missing or non-semver version (%s, native %s, config %s)", (executionEnvironment, nativeApplicationVersion, configVersion) => {
		expect(() => resolveAppVersion({ executionEnvironment, nativeApplicationVersion, configVersion })).toThrow(InvalidAppVersionError);
	});
});

describe("readAppVersion / readBuildNumber", () => {
	it("reads the running app's version and hides Expo Go's build number", () => {
		expect(readAppVersion()).toBe("1.0.0");
		expect(readBuildNumber()).toBeNull();
	});
});
