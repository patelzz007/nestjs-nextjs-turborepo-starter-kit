import { APP_LINKS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { LEGACY_REDIRECTS } from "../legacy-redirects";

describe("LEGACY_REDIRECTS", () => {
	it("permanently sends every old /rewardhub path, the area's root included, to the same page under /dashboard", () => {
		expect(LEGACY_REDIRECTS).toEqual([{ source: "/rewardhub/:path*", destination: "/dashboard/:path*", permanent: true }]);
		expect(APP_LINKS.web.dashboard).toBe("/dashboard");
	});
});
