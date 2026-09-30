import { describe, expect, it } from "vitest";

import { dataUrlToBytes, imageContentType, imageRouteParam } from "./assets";

describe("imageRouteParam", () => {
	it("strips everything up to docs/images", () => {
		expect(imageRouteParam("../../../../../docs/images/email/welcome.png")).toBe("email/welcome.png");
		expect(imageRouteParam("/src/other.png")).toBeNull();
	});
});

describe("dataUrlToBytes", () => {
	it("decodes base64 payloads", () => {
		expect([...dataUrlToBytes("data:image/png;base64,AAEC/w==")]).toEqual([0, 1, 2, 255]);
	});

	it("decodes percent-encoded payloads", () => {
		expect(new TextDecoder().decode(dataUrlToBytes("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"))).toBe("<svg></svg>");
	});

	it("rejects non data URLs", () => {
		expect(() => dataUrlToBytes("/images/a.png")).toThrow("Expected a data: URL");
	});
});

describe("imageContentType", () => {
	it("maps known extensions case-insensitively", () => {
		expect(imageContentType("a/b.PNG")).toBe("image/png");
		expect(imageContentType("x.svg")).toBe("image/svg+xml");
		expect(imageContentType("x.bin")).toBe("application/octet-stream");
	});
});
