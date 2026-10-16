import { describe, expect, it } from "vitest";

import { ThemeNameSchema, ThemeRoleSchema } from "./schema";
import { SHARED_COLORS, THEMES } from "./semantic";

describe("theme parity", () => {
	it.each(ThemeNameSchema.options)("the %s theme defines exactly the role list", (theme) => {
		expect(new Set(Object.keys(THEMES[theme]))).toStrictEqual(new Set(ThemeRoleSchema.options));
		expect(Object.keys(THEMES[theme])).toHaveLength(ThemeRoleSchema.options.length);
	});

	it("no shared colour is also a themed role (each name has one owner)", () => {
		const roles = new Set<string>(ThemeRoleSchema.options);

		expect(Object.keys(SHARED_COLORS).filter((name) => roles.has(name))).toStrictEqual([]);
	});
});
