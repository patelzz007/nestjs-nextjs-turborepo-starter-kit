import { Platform } from "react-native";

import { buildDeviceHeaders, readDeviceDetails } from "../device-headers";

jest.mock("expo-device", () => ({ modelName: "Pixel 8", deviceName: "Sam’s Pixel" }));

describe("buildDeviceHeaders", () => {
	it("percent-encodes the model and the device name (UTF-8), and names the platform", () => {
		expect(buildDeviceHeaders({ modelName: "iPhone 15 Pro", deviceName: "Alex’s iPhone", platform: "ios" })).toEqual({
			"X-Device-Model": "iPhone%2015%20Pro",
			"X-Device-Name": "Alex%E2%80%99s%20iPhone",
			"X-Client-Platform": "ios",
		});
	});

	it("leaves out unknown details, and a platform feature flags don't know", () => {
		expect(buildDeviceHeaders({ modelName: null, deviceName: null, platform: "windows" })).toEqual({});
	});

	it("leaves out details the API would refuse anyway (control characters, too long, blank)", () => {
		expect(buildDeviceHeaders({ modelName: "Bad\u0000Model", deviceName: "x".repeat(65), platform: "macos" })).toEqual({});
		expect(buildDeviceHeaders({ modelName: "   ", deviceName: "Alex", platform: "android" })).toEqual({ "X-Device-Name": "Alex", "X-Client-Platform": "android" });
	});
});

describe("readDeviceDetails", () => {
	it("reads expo-device and the platform", () => {
		expect(readDeviceDetails()).toEqual({ modelName: "Pixel 8", deviceName: "Sam’s Pixel", platform: Platform.OS });
	});
});
