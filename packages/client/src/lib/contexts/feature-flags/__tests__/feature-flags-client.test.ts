import { describe, expect, it } from "vitest";

import { deviceIdCookieToSet, deviceIdHeaders, readCookieValue } from "../device-id";

// Reading a bundle and batching exposures are shared with the mobile app: their tests live in @workspace/shared.

const DEVICE = "019b76da-a800-7000-8000-000000000030";

describe("device id", () => {
	it("reads one cookie out of a Cookie header", () => {
		expect(readCookieValue(`theme=dark; flagDeviceId=${DEVICE}; other=1`, "flagDeviceId")).toBe(DEVICE);
		expect(readCookieValue("theme=dark", "flagDeviceId")).toBeNull();
	});

	it("sends the header only for a real device id", () => {
		expect(deviceIdHeaders(DEVICE)).toStrictEqual({ "X-Device-Id": DEVICE });
		expect(deviceIdHeaders("not-an-id")).toStrictEqual({});
		expect(deviceIdHeaders(undefined)).toStrictEqual({});
	});

	it("sets a fresh cookie only when the request has no valid one", () => {
		expect(deviceIdCookieToSet(DEVICE, () => "unused", true)).toBeNull();
		expect(deviceIdCookieToSet("garbage", () => DEVICE, false)).toMatchObject({ name: "flagDeviceId", value: DEVICE, httpOnly: false, sameSite: "lax", secure: false });
	});
});
