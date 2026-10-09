import { encodeSessionDeviceHeaderValue, SESSION_DEVICE_NAME_MAX_LENGTH } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { testRequest } from "../../../../test/support/http-execution-context";
import { describeSessionDevice, readSessionDeviceContext, type SessionDeviceClaims } from "./session-device";

/** Real User-Agent strings, as the clients send them. */
const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.54 Safari/537.36";
const PIXEL_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36";
const EXPO_IOS = "RewardHub/42 CFNetwork/1568.100.1 Darwin/24.0.0";

function claims(overrides: Partial<SessionDeviceClaims>): SessionDeviceClaims {
	return { clientType: "web", userAgent: CHROME_MAC, deviceModelHeader: undefined, deviceNameHeader: undefined, appVersionHeader: undefined, ...overrides };
}

describe("describeSessionDevice", () => {
	it("describes a browser from its User-Agent", () => {
		expect(describeSessionDevice(claims({}))).toEqual({
			clientType: "web",
			browserName: "Chrome",
			browserVersion: "141.0.7390.54",
			osName: "macOS",
			osVersion: "10.15.7",
			deviceType: "DESKTOP",
			deviceModel: null,
			deviceName: null,
			appVersion: null,
		});
	});

	it("keeps the model a browser User-Agent names", () => {
		expect(describeSessionDevice(claims({ clientType: "merchant", userAgent: PIXEL_CHROME }))).toMatchObject({
			clientType: "merchant",
			deviceType: "MOBILE",
			deviceModel: "Pixel 8",
		});
	});

	it("takes the model, name and app version a mobile app reports in its headers", () => {
		const device = describeSessionDevice(
			claims({
				clientType: "mobile",
				userAgent: EXPO_IOS,
				deviceModelHeader: encodeSessionDeviceHeaderValue("iPhone 15 Pro"),
				deviceNameHeader: encodeSessionDeviceHeaderValue("Alex’s iPhone"),
				appVersionHeader: "1.4.0",
			}),
		);

		expect(device).toEqual({
			clientType: "mobile",
			browserName: "CFNetwork",
			browserVersion: null,
			osName: "iOS",
			osVersion: null,
			deviceType: "MOBILE",
			deviceModel: "iPhone 15 Pro",
			deviceName: "Alex’s iPhone",
			appVersion: "1.4.0",
		});
	});

	it("ignores the mobile-only headers on a browser client type (display data is never taken from a page)", () => {
		const device = describeSessionDevice(claims({ deviceModelHeader: "Spoofed", deviceNameHeader: "Spoofed", appVersionHeader: "9.9.9" }));

		expect(device).toMatchObject({ deviceModel: null, deviceName: null, appVersion: null });
	});

	it.each([
		["a broken percent-encoding", "%E0%A4%A"],
		["a control character", encodeSessionDeviceHeaderValue("Alex\u0007")],
		["a name over the column budget", encodeSessionDeviceHeaderValue("n".repeat(SESSION_DEVICE_NAME_MAX_LENGTH + 1))],
	])("drops a device name with %s instead of refusing the sign-in", (_case: string, header: string) => {
		const device = describeSessionDevice(claims({ clientType: "mobile", userAgent: EXPO_IOS, deviceNameHeader: header, appVersionHeader: "1.4.0" }));

		expect(device.deviceName).toBeNull();
		expect(device.appVersion).toBe("1.4.0");
	});

	it("drops a malformed app version", () => {
		expect(describeSessionDevice(claims({ clientType: "mobile", appVersionHeader: "v1" })).appVersion).toBeNull();
	});

	it("falls back to the User-Agent's model when the mobile model header is invalid", () => {
		expect(describeSessionDevice(claims({ clientType: "mobile", userAgent: PIXEL_CHROME, deviceModelHeader: "%" })).deviceModel).toBe("Pixel 8");
	});

	it("describes a request without a User-Agent as an unknown device", () => {
		expect(describeSessionDevice(claims({ userAgent: undefined }))).toMatchObject({ browserName: null, osName: null, deviceType: "UNKNOWN", deviceModel: null });
	});
});

describe("readSessionDeviceContext", () => {
	it("reads the client type, the device headers, the User-Agent and the IP of a request", () => {
		const context = readSessionDeviceContext(
			testRequest({
				headers: {
					"x-client-type": "mobile",
					"user-agent": EXPO_IOS,
					"x-device-model": encodeSessionDeviceHeaderValue("iPhone 15 Pro"),
					"x-device-name": encodeSessionDeviceHeaderValue("Alex’s iPhone"),
					"x-app-version": "1.4.0",
				},
				ip: "203.0.113.24",
			}),
		);

		expect(context).toMatchObject({
			device: { clientType: "mobile", deviceModel: "iPhone 15 Pro", deviceName: "Alex’s iPhone", appVersion: "1.4.0" },
			ipAddress: "203.0.113.24",
			userAgent: EXPO_IOS,
		});
	});

	it("is a web device when the request declares no client type", () => {
		const context = readSessionDeviceContext(testRequest({ headers: { "user-agent": CHROME_MAC }, ip: "198.51.100.7" }));

		expect(context.device.clientType).toBe("web");
	});
});
