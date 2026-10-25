import { describe, expect, it } from "vitest";

import { composeConfigs } from "../compose.js";

describe("composeConfigs", () => {
	it("unions plugins in first-seen order", () => {
		expect(composeConfigs({ plugins: ["eslint", "react"] }, { plugins: ["react", "jsx-a11y"] }).plugins).toEqual(["eslint", "react", "jsx-a11y"]);
	});

	it("unions jsPlugins by name, a later entry replacing an earlier one", () => {
		const composed = composeConfigs({ jsPlugins: ["a", { name: "b", specifier: "/old/b.js" }] }, { jsPlugins: [{ name: "b", specifier: "/new/b.js" }, "c"] });
		expect(composed.jsPlugins).toEqual(["a", { name: "b", specifier: "/new/b.js" }, "c"]);
	});

	it("merges categories, options, env, globals and rules key by key, the later config winning", () => {
		const composed = composeConfigs(
			{ categories: { style: "off" }, options: { typeAware: true }, env: { builtin: true }, globals: { a: "readonly" }, rules: { x: "error", y: "error" } },
			{ categories: { perf: "off" }, options: { typeAware: false }, env: { browser: true }, globals: { b: "writable" }, rules: { y: "off" } },
		);
		expect(composed).toEqual({
			categories: { style: "off", perf: "off" },
			options: { typeAware: false },
			env: { builtin: true, browser: true },
			globals: { a: "readonly", b: "writable" },
			rules: { x: "error", y: "off" },
		});
	});

	it("merges settings per plugin key (a later key replaces the earlier one whole)", () => {
		const composed = composeConfigs(
			{ settings: { react: { version: "18.0.0", linkComponents: [] }, next: { rootDir: "." } } },
			{ settings: { react: { version: "19.2.0" } } },
		);
		expect(composed.settings).toEqual({ react: { version: "19.2.0" }, next: { rootDir: "." } });
	});

	it("concatenates ignorePatterns and overrides in order", () => {
		const first = { files: ["**/*.ts"], rules: { x: "error" } };
		const second = { files: ["**/*.ts"], rules: { x: "off" } };
		const composed = composeConfigs({ ignorePatterns: ["dist/**"], overrides: [first] }, { ignorePatterns: ["out/**"], overrides: [second] });
		expect(composed.ignorePatterns).toEqual(["dist/**", "out/**"]);
		expect(composed.overrides).toEqual([first, second]);
	});

	it("leaves keys no config sets out of the result", () => {
		expect(composeConfigs({ rules: { x: "error" } }, {})).toEqual({ rules: { x: "error" } });
	});

	it("does not mutate its inputs", () => {
		const input = { plugins: ["eslint"], rules: { x: "error" }, overrides: [] };
		composeConfigs(input, { plugins: ["react"], rules: { y: "error" }, overrides: [{ files: ["a"], rules: {} }] });
		expect(input).toEqual({ plugins: ["eslint"], rules: { x: "error" }, overrides: [] });
	});

	it("rejects `extends` (oxlint drops env, globals, settings and ignorePatterns through it)", () => {
		expect(() => composeConfigs({ extends: ["./other.json"] })).toThrow(/pass the configs to compose directly/u);
	});
});
