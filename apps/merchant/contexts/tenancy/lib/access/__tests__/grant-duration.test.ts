import { describe, expect, it } from "vitest";

import { ACCESS_DURATION_OPTIONS, AccessDurationSchema, resolveExpiresAt, tenantDisplayRegion } from "@/contexts/tenancy/lib/access/grant-duration";

const NOW = Date.UTC(2026, 9, 28, 4, 0);
const HOUR_MS = 3_600_000;
const KL = "Asia/Kuala_Lumpur";

describe("resolveExpiresAt", () => {
	it("counts the presets in hours from now", () => {
		expect(resolveExpiresAt("24h", NOW, "", KL)).toEqual({ ok: true, expiresAt: NOW + 24 * HOUR_MS });
		expect(resolveExpiresAt("48h", NOW, "", KL)).toEqual({ ok: true, expiresAt: NOW + 48 * HOUR_MS });
		expect(resolveExpiresAt("7d", NOW, "", KL)).toEqual({ ok: true, expiresAt: NOW + 168 * HOUR_MS });
	});

	it("has no end for a permanent grant", () => {
		expect(resolveExpiresAt("permanent", NOW, "", KL)).toEqual({ ok: true, expiresAt: undefined });
	});

	it("runs a custom date to the end of that day in the tenant's zone", () => {
		// 31 Oct ends at 1 Nov 00:00 in Kuala Lumpur (UTC+8) = 31 Oct 16:00 UTC.
		expect(resolveExpiresAt("custom", NOW, "2026-10-31", KL)).toEqual({ ok: true, expiresAt: Date.UTC(2026, 9, 31, 16, 0) });
	});

	it("asks for a day, and refuses a day already over", () => {
		expect(resolveExpiresAt("custom", NOW, "", KL)).toEqual({ ok: false, message: "Choose the last day it should last." });
		expect(resolveExpiresAt("custom", NOW, "2026-10-27", KL)).toEqual({ ok: false, message: "Choose a day that has not passed." });
	});

	it("offers every duration once", () => {
		expect(ACCESS_DURATION_OPTIONS.map((option) => option.value)).toEqual(AccessDurationSchema.options);
	});
});

describe("tenantDisplayRegion", () => {
	it("keeps the platform locale and uses the tenant's zone", () => {
		expect(tenantDisplayRegion(KL).timeZone).toBe(KL);
	});
});
