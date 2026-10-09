import { describe, expect, it } from "vitest";

import { buildSessionDeviceLabel, UNKNOWN_DEVICE_LABEL, type SessionDeviceLabelFields } from "./session-device-label";

const BROWSER: SessionDeviceLabelFields = { clientType: "web", browserName: "Chrome", browserVersion: "141.0.7390.54", osName: "macOS", deviceModel: null, deviceName: null };
const PHONE: SessionDeviceLabelFields = {
	clientType: "mobile",
	browserName: "CFNetwork",
	browserVersion: null,
	osName: "iOS",
	deviceModel: "iPhone 15 Pro",
	deviceName: "Alex’s iPhone",
};

describe("buildSessionDeviceLabel", () => {
	it("names a browser session by browser, major version and OS", () => {
		expect(buildSessionDeviceLabel(BROWSER)).toBe("Chrome 141 on macOS");
	});

	it("uses whichever half of a browser is known", () => {
		expect(buildSessionDeviceLabel({ ...BROWSER, browserVersion: null })).toBe("Chrome on macOS");
		expect(buildSessionDeviceLabel({ ...BROWSER, osName: null })).toBe("Chrome 141");
		expect(buildSessionDeviceLabel({ ...BROWSER, browserName: null })).toBe("macOS");
	});

	it("falls back to the model, then to an unknown device", () => {
		expect(buildSessionDeviceLabel({ ...BROWSER, browserName: null, osName: null, deviceModel: "Pixel 8" })).toBe("Pixel 8");
		expect(buildSessionDeviceLabel({ ...BROWSER, browserName: null, osName: null })).toBe(UNKNOWN_DEVICE_LABEL);
	});

	it("names a mobile app session by the device's own name, then its model, then its OS", () => {
		expect(buildSessionDeviceLabel(PHONE)).toBe("Alex’s iPhone");
		expect(buildSessionDeviceLabel({ ...PHONE, deviceName: null })).toBe("iPhone 15 Pro");
		expect(buildSessionDeviceLabel({ ...PHONE, deviceName: null, deviceModel: null })).toBe("iOS app");
		expect(buildSessionDeviceLabel({ ...PHONE, deviceName: null, deviceModel: null, osName: null })).toBe("Mobile app");
	});

	it("labels a session stored before device details existed", () => {
		expect(buildSessionDeviceLabel({ clientType: null, browserName: null, browserVersion: null, osName: null, deviceModel: null, deviceName: null })).toBe(
			UNKNOWN_DEVICE_LABEL,
		);
	});
});
