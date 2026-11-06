import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROUTE_TYPES_PATH, generateRouteTypes } from "../mobile-route-types.ts";

const MOBILE_ROOT = path.resolve(import.meta.dirname, "../../../../../../apps/mobile");

describe("the committed mobile route types", () => {
	it("match the screens (run: pnpm tools mobile:route-types)", async () => {
		expect(readFileSync(path.join(MOBILE_ROOT, ROUTE_TYPES_PATH), "utf8")).toBe(await generateRouteTypes(MOBILE_ROOT));
	});
});
