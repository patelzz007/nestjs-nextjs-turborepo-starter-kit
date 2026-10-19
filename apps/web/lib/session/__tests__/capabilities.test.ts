import { PERMISSION } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveSessionCapabilities } from "@/lib/session/capabilities";
import { buildSessionPermissions } from "@/test-support/session";

describe("resolveSessionCapabilities", () => {
	it("returns an empty set when nothing is known (guest)", () => {
		expect(resolveSessionCapabilities(undefined, undefined)).toEqual([]);
	});

	it("uses the preloaded list before the first live answer", () => {
		const preloaded = buildSessionPermissions({ capabilities: [PERMISSION.REWARD.CREATE] });
		expect(resolveSessionCapabilities(undefined, preloaded)).toEqual([PERMISSION.REWARD.CREATE]);
	});

	it("prefers the live answer, even when it is empty", () => {
		const preloaded = buildSessionPermissions({ capabilities: [PERMISSION.REWARD.CREATE] });
		const live = buildSessionPermissions({ capabilities: [] });
		expect(resolveSessionCapabilities(live, preloaded)).toEqual([]);
	});
});
