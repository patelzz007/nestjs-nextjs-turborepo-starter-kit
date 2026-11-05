import * as Application from "expo-application";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { readBuildIdentity } from "../build-identity-device";

const CREATED_AT = new Date("2026-11-05T10:12:00Z");
const LAST_UPDATED_AT = new Date("2026-11-04T09:00:00Z");
const INSTALLED_AT = new Date("2026-10-01T09:00:00Z");

jest.mock("expo-updates", () => ({ channel: "preview", createdAt: new Date("2026-11-05T10:12:00Z"), isEmbeddedLaunch: true }));
jest.mock("expo-application", () => ({
	getLastUpdateTimeAsync: jest.fn(() => Promise.resolve(new Date("2026-11-04T09:00:00Z"))),
	getInstallationTimeAsync: jest.fn(() => Promise.resolve(new Date("2026-10-01T09:00:00Z"))),
}));
jest.mock("expo-constants", () => ({
	__esModule: true,
	ExecutionEnvironment: { Bare: "bare", Standalone: "standalone", StoreClient: "storeClient" },
	default: { executionEnvironment: "standalone" },
}));

const constants = jest.mocked(Constants);

describe("readBuildIdentity", () => {
	const platform = Platform.OS;

	afterEach(() => {
		Platform.OS = platform;
		constants.executionEnvironment = ExecutionEnvironment.Standalone;
	});

	it("reads the running update from expo-updates (Jest runs as a development build)", () => {
		expect(readBuildIdentity()).toMatchObject({ kind: "development", runningUpdateCreatedAt: CREATED_AT, isEmbeddedLaunch: true });
	});

	it("reads when the APK was last installed over on Android, and the first install on iOS", async () => {
		Platform.OS = "android";
		await expect(readBuildIdentity().readInstalledAt()).resolves.toEqual(LAST_UPDATED_AT);
		Platform.OS = "ios";
		await expect(readBuildIdentity().readInstalledAt()).resolves.toEqual(INSTALLED_AT);
	});

	it("knows no install time inside Expo Go, whose own install it would be", async () => {
		jest.mocked(Application.getLastUpdateTimeAsync).mockClear();
		constants.executionEnvironment = ExecutionEnvironment.StoreClient;
		await expect(readBuildIdentity().readInstalledAt()).resolves.toBeNull();
		expect(Application.getLastUpdateTimeAsync).not.toHaveBeenCalled();
	});
});
