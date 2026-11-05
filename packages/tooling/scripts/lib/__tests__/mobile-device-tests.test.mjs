import { describe, expect, it } from "vitest";

import { appIdOf, mailpitUrlOf, maestroArgs, maestroEnv, metroLinkArgs } from "../mobile-device-tests.mjs";

describe("mobile device tests", () => {
	it("reads the app's Android id from its public config, and refuses a config without one", () => {
		expect(appIdOf(JSON.stringify({ name: "Starter", android: { package: "com.example.starter" } }))).toBe("com.example.starter");
		expect(() => appIdOf(JSON.stringify({ name: "Starter" }))).toThrow();
	});

	it("runs every flow with the app id and Mailpit, then the caller's own options", () => {
		expect(maestroArgs("com.example.starter", "http://localhost:8025", ["--include-tags", "smoke"])).toEqual([
			"test",
			".maestro",
			"-e",
			"APP_ID=com.example.starter",
			"-e",
			"MAILPIT_URL=http://localhost:8025",
			"--include-tags",
			"smoke",
		]);
	});

	it("reads the emailed device code from the local Mailpit unless MAESTRO_MAILPIT_URL names another, and refuses a non-URL", () => {
		expect(mailpitUrlOf({})).toBe("http://localhost:8025");
		expect(mailpitUrlOf({ MAESTRO_MAILPIT_URL: "http://mail.internal:8025/" })).toBe("http://mail.internal:8025");
		expect(() => mailpitUrlOf({ MAESTRO_MAILPIT_URL: "mailpit" })).toThrow();
	});

	it("keeps the caller's environment and turns Maestro's analytics off", () => {
		expect(maestroEnv({ PATH: "/bin" })).toEqual({ PATH: "/bin", MAESTRO_CLI_NO_ANALYTICS: "1", MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true" });
	});

	it("links the phone's Metro port to this machine's", () => {
		expect(metroLinkArgs()).toEqual(["reverse", "tcp:8081", "tcp:8081"]);
	});
});
