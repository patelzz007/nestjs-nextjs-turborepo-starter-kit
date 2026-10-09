import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest } from "../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { AppVersionUnsupportedError } from "../../../common/errors/app-error";
import { HTTP_STATUS_UPGRADE_REQUIRED } from "../../../common/errors/error-codes";
import { MobileAppVersionGuard } from "./mobile-app-version.guard";

const MINIMUM_VERSION = "1.4.0";

function guardWithMinimum(minimumVersion: string): MobileAppVersionGuard {
	return new MobileAppVersionGuard(createTestTypedConfig({ MOBILE_MIN_SUPPORTED_VERSION: minimumVersion }));
}

function activate(guard: MobileAppVersionGuard, headers: Record<string, string>): boolean {
	return guard.canActivate(createHttpContext(testRequest({ headers })));
}

function rejectionOf(guard: MobileAppVersionGuard, headers: Record<string, string>): AppVersionUnsupportedError {
	try {
		activate(guard, headers);
	} catch (error) {
		if (error instanceof AppVersionUnsupportedError) {
			return error;
		}
		throw error;
	}
	throw new Error("expected an AppVersionUnsupportedError");
}

describe("MobileAppVersionGuard", () => {
	const guard = guardWithMinimum(MINIMUM_VERSION);

	it.each(["1.4.0", "1.4.1", "1.5.0", "2.0.0", "1.4.0+417", "1.5.0-beta.1"])("serves a mobile app at or above the minimum: %s", (version: string) => {
		expect(activate(guard, { "x-client-type": "mobile", "x-app-version": version })).toBe(true);
	});

	it.each(["1.3.9", "1.0.0", "0.9.0", "1.4.0-rc.1", "1.4.0-beta"])("refuses a mobile app below the minimum with 426: %s", (version: string) => {
		const error = rejectionOf(guard, { "x-client-type": "mobile", "x-app-version": version });

		expect(error.httpStatus).toBe(HTTP_STATUS_UPGRADE_REQUIRED);
		expect(error.code).toBe("APP_VERSION_UNSUPPORTED");
		expect(error.details).toEqual({ reason: "below_minimum", minimumVersion: MINIMUM_VERSION });
	});

	it("refuses a mobile request without X-App-Version", () => {
		expect(rejectionOf(guard, { "x-client-type": "mobile" }).details).toEqual({ reason: "missing", minimumVersion: MINIMUM_VERSION });
		expect(rejectionOf(guard, { "x-client-type": "mobile", "x-app-version": "" }).details).toEqual({ reason: "missing", minimumVersion: MINIMUM_VERSION });
	});

	it.each(["v1.5.0", "1.5", "latest", "1.5.0.0", "01.5.0", `1.5.0-${"a".repeat(80)}`])("refuses a mobile request with the malformed version %j", (version: string) => {
		expect(rejectionOf(guard, { "x-client-type": "mobile", "x-app-version": version }).details).toEqual({ reason: "malformed", minimumVersion: MINIMUM_VERSION });
	});

	it("checks a mobile request declared through ?client_type= too", () => {
		expect(() => guard.canActivate(createHttpContext(testRequest({ headers: {}, query: { client_type: "mobile" } })))).toThrow(AppVersionUnsupportedError);
	});

	it.each(["web", "admin", "merchant"])("never checks browser client type %s, whatever version header it sends", (clientType: string) => {
		expect(activate(guard, { "x-client-type": clientType })).toBe(true);
		expect(activate(guard, { "x-client-type": clientType, "x-app-version": "0.0.1" })).toBe(true);
	});

	it("never checks a request without a client type (browsers, health probes)", () => {
		expect(activate(guard, {})).toBe(true);
	});

	it("serves every release once the minimum is the default first release", () => {
		const defaultGuard = new MobileAppVersionGuard(createTestTypedConfig());

		expect(activate(defaultGuard, { "x-client-type": "mobile", "x-app-version": "1.0.0" })).toBe(true);
		expect(() => activate(defaultGuard, { "x-client-type": "mobile", "x-app-version": "1.0.0-beta.1" })).toThrow(AppVersionUnsupportedError);
	});
});
