import withOverTheAirUpdates, { overTheAirUpdates, readEasProjectId } from "../over-the-air-updates";

const PROJECT_ID = "0190f0e0-0000-7000-8000-000000000001";

describe("readEasProjectId (enhancement 6.3)", () => {
	it("reads the project id, treating an empty one as unset", () => {
		expect(readEasProjectId({ EAS_PROJECT_ID: ` ${PROJECT_ID} ` })).toBe(PROJECT_ID);
		expect(readEasProjectId({ EAS_PROJECT_ID: "" })).toBeUndefined();
		expect(readEasProjectId({})).toBeUndefined();
	});

	it("refuses something that isn't a project id", () => {
		expect(() => readEasProjectId({ EAS_PROJECT_ID: "my-app" })).toThrow(/EAS_PROJECT_ID/u);
	});
});

describe("overTheAirUpdates", () => {
	it("checks EAS Update on launch without waiting on it, for builds of the same native code", () => {
		expect(overTheAirUpdates(PROJECT_ID, { router: {} })).toStrictEqual({
			runtimeVersion: { policy: "fingerprint" },
			updates: { enabled: true, url: `https://u.expo.dev/${PROJECT_ID}`, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 },
			extra: { router: {}, eas: { projectId: PROJECT_ID } },
		});
	});

	it("is off without a project, leaving the app on the JavaScript it was built with", () => {
		expect(overTheAirUpdates(undefined, { router: {} })).toStrictEqual({ runtimeVersion: { policy: "fingerprint" }, updates: { enabled: false }, extra: { router: {} } });
	});
});

describe("withOverTheAirUpdates", () => {
	it("turns updates on from the environment's project id, keeping the rest of the config", () => {
		expect(withOverTheAirUpdates({ name: "Starter", slug: "starter" }, { projectId: PROJECT_ID })).toMatchObject({
			name: "Starter",
			updates: { enabled: true, url: `https://u.expo.dev/${PROJECT_ID}` },
			extra: { eas: { projectId: PROJECT_ID } },
		});
	});
});
