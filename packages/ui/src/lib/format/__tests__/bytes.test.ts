import { describe, expect, it } from "vitest";

import { formatBytes } from "./bytes";

const KIB = 1024;

describe("formatBytes", () => {
	it("spells out bytes below one kilobyte, with the plural the locale wants", () => {
		expect(formatBytes(0)).toBe("0 bytes");
		expect(formatBytes(1)).toBe("1 byte");
		expect(formatBytes(512)).toBe("512 bytes");
	});

	it("steps units by 1024 and keeps at most two decimals by default", () => {
		expect(formatBytes(KIB)).toBe("1 kB");
		expect(formatBytes(1536)).toBe("1.5 kB");
		expect(formatBytes(2 * KIB * KIB)).toBe("2 MB");
		expect(formatBytes(1.234 * KIB ** 3)).toBe("1.23 GB");
	});

	it("caps at petabytes", () => {
		expect(formatBytes(KIB ** 6)).toBe("1,024 PB");
	});

	it("honours the locale and the fraction digits", () => {
		expect(formatBytes(1536, { locale: "de-DE" })).toBe("1,5 kB");
		expect(formatBytes(1.234 * KIB * KIB, { maximumFractionDigits: 0 })).toBe("1 MB");
	});
});
