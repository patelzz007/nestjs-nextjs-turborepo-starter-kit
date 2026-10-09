import { createDeviceAppRuntime } from "./device-runtime";

jest.mock("expo-constants", () => ({
	__esModule: true,
	ExecutionEnvironment: { Bare: "bare", Standalone: "standalone", StoreClient: "storeClient" },
	default: { executionEnvironment: "storeClient", expoConfig: { name: "Starter", version: "1.0.0", hostUri: "192.168.1.5:8081" } },
}));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "57.0.0", nativeBuildVersion: "1" }));
jest.mock("expo-device", () => ({ modelName: "iPhone 15 Pro", deviceName: "Alex’s iPhone" }));
jest.mock("uniwind", () => ({ Uniwind: { setTheme: jest.fn() } }));

describe("createDeviceAppRuntime", () => {
	it("wires the real device: Expo's dev host, the app.config version, the app name", () => {
		const runtime = createDeviceAppRuntime();
		expect(runtime).toMatchObject({
			kind: "ready",
			appName: "Starter",
			appVersion: "1.0.0",
			buildNumber: null,
			env: { apiBaseUrl: "http://192.168.1.5:8080", isDevelopment: true },
		});
	});
});
