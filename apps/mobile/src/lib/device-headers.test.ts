import { buildDeviceHeaders, readDeviceDetails } from "./device-headers";

jest.mock("expo-device", () => ({ modelName: "Pixel 8", deviceName: "Sam’s Pixel" }));

describe("buildDeviceHeaders", () => {
	it("percent-encodes the model and the device name (UTF-8)", () => {
		expect(buildDeviceHeaders({ modelName: "iPhone 15 Pro", deviceName: "Alex’s iPhone" })).toEqual({
			"X-Device-Model": "iPhone%2015%20Pro",
			"X-Device-Name": "Alex%E2%80%99s%20iPhone",
		});
	});

	it("leaves out unknown details", () => {
		expect(buildDeviceHeaders({ modelName: null, deviceName: null })).toEqual({});
	});

	it("leaves out details the API would refuse anyway (control characters, too long, blank)", () => {
		expect(buildDeviceHeaders({ modelName: "Bad\u0000Model", deviceName: "x".repeat(65) })).toEqual({});
		expect(buildDeviceHeaders({ modelName: "   ", deviceName: "Alex" })).toEqual({ "X-Device-Name": "Alex" });
	});
});

describe("readDeviceDetails", () => {
	it("reads expo-device", () => {
		expect(readDeviceDetails()).toEqual({ modelName: "Pixel 8", deviceName: "Sam’s Pixel" });
	});
});
