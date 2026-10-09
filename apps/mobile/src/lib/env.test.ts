import { DEFAULT_DEV_API_PORT, MOBILE_ENV_EXAMPLES, readDevHost, readRawMobileEnv, resolveMobileEnv, type RawMobileEnv } from "./env";

jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { hostUri: "10.0.0.7:8081" } } }));

const DEV: RawMobileEnv = { isDevelopment: true, hostUri: "192.168.1.5:8081", apiUrl: undefined, apiPort: undefined, iosStoreUrl: undefined, androidStoreUrl: undefined };
const RELEASE: RawMobileEnv = { ...DEV, isDevelopment: false, hostUri: undefined };

describe("readDevHost", () => {
	it.each([
		["192.168.1.5:8081", "192.168.1.5"],
		["my-mac.local:8081", "my-mac.local"],
		["[fe80::1]:8081", "[fe80::1]"],
		["10.0.0.2", "10.0.0.2"],
	])("reads the host of %s", (hostUri, host) => {
		expect(readDevHost(hostUri)).toBe(host);
	});

	it("is null when Expo reported nothing", () => {
		expect(readDevHost(undefined)).toBeNull();
		expect(readDevHost(":8081")).toBeNull();
	});
});

describe("resolveMobileEnv", () => {
	it("uses the dev machine's host and the API's default port in development (never localhost)", () => {
		expect(resolveMobileEnv(DEV)).toEqual({
			ok: true,
			env: { isDevelopment: true, apiBaseUrl: `http://192.168.1.5:${String(DEFAULT_DEV_API_PORT)}`, iosStoreUrl: null, androidStoreUrl: null },
		});
	});

	it("honours EXPO_PUBLIC_API_PORT in development", () => {
		expect(resolveMobileEnv({ ...DEV, apiPort: " 3333 " })).toMatchObject({ ok: true, env: { apiBaseUrl: "http://192.168.1.5:3333" } });
	});

	it.each(["0", "70000", "abc", "80.5"])("rejects the port %s", (apiPort) => {
		expect(resolveMobileEnv({ ...DEV, apiPort })).toEqual({
			ok: false,
			issue: { variable: "EXPO_PUBLIC_API_PORT", message: "must be a whole number between 1 and 65535", example: MOBILE_ENV_EXAMPLES.EXPO_PUBLIC_API_PORT },
		});
	});

	it("lets an explicit http URL win in development (an API on another machine)", () => {
		expect(resolveMobileEnv({ ...DEV, apiUrl: "http://10.0.0.9:8080/" })).toMatchObject({ ok: true, env: { apiBaseUrl: "http://10.0.0.9:8080" } });
	});

	it("asks for EXPO_PUBLIC_API_URL in development when Expo reports no host", () => {
		expect(resolveMobileEnv({ ...DEV, hostUri: undefined })).toMatchObject({ ok: false, issue: { variable: "EXPO_PUBLIC_API_URL" } });
	});

	it("requires EXPO_PUBLIC_API_URL outside development", () => {
		expect(resolveMobileEnv(RELEASE)).toEqual({
			ok: false,
			issue: { variable: "EXPO_PUBLIC_API_URL", message: "is required outside development", example: "https://api.example.com" },
		});
	});

	it("requires https outside development", () => {
		expect(resolveMobileEnv({ ...RELEASE, apiUrl: "http://api.example.com" })).toMatchObject({
			ok: false,
			issue: { variable: "EXPO_PUBLIC_API_URL", message: "must be an https:// URL" },
		});
	});

	it("rejects a value that is not a URL", () => {
		expect(resolveMobileEnv({ ...RELEASE, apiUrl: "api.example.com" })).toMatchObject({ ok: false, issue: { variable: "EXPO_PUBLIC_API_URL" } });
	});

	it("accepts an https URL outside development and strips trailing slashes", () => {
		expect(resolveMobileEnv({ ...RELEASE, apiUrl: "https://api.example.com//" })).toMatchObject({
			ok: true,
			env: { isDevelopment: false, apiBaseUrl: "https://api.example.com" },
		});
	});

	it("reads the optional store URLs (https only)", () => {
		const env = resolveMobileEnv({ ...RELEASE, apiUrl: "https://api.example.com", iosStoreUrl: "https://apps.apple.com/app/id1", androidStoreUrl: " " });
		expect(env).toMatchObject({ ok: true, env: { iosStoreUrl: "https://apps.apple.com/app/id1", androidStoreUrl: null } });
		expect(resolveMobileEnv({ ...RELEASE, apiUrl: "https://api.example.com", iosStoreUrl: "http://apps.apple.com" })).toMatchObject({
			ok: false,
			issue: { variable: "EXPO_PUBLIC_IOS_STORE_URL" },
		});
		expect(resolveMobileEnv({ ...RELEASE, apiUrl: "https://api.example.com", androidStoreUrl: "nope" })).toMatchObject({
			ok: false,
			issue: { variable: "EXPO_PUBLIC_ANDROID_STORE_URL" },
		});
	});

	it("never puts the configured value in the issue", () => {
		const result = resolveMobileEnv({ ...RELEASE, apiUrl: "http://secret-host.internal" });
		expect(JSON.stringify(result)).not.toContain("secret-host");
	});
});

describe("readRawMobileEnv", () => {
	it("reads __DEV__, Expo's host and the EXPO_PUBLIC_* variables", () => {
		expect(readRawMobileEnv()).toMatchObject({ isDevelopment: true, hostUri: "10.0.0.7:8081" });
	});
});
