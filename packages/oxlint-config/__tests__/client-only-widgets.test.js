import { describe, expect, it } from "vitest";

import { nextJsConfig } from "../next.js";
import { clientOnlyWidgetsConfig, config as reactInternalConfig } from "../react-internal.js";
import { isolatedConfig, lintAsIf } from "../testing.js";

const RULE_ID = "workspace/ssr-false-allowlist";
const WIDGETS = ["ChartContainerClientOnly", "ImageCropDialogClientOnly"];

/** The rule ids (this rule's, and any parse error) reported for `code` as `filePath` with ONLY the allowlist rule on. */
function ruleMessages(code, filePath, widgets = WIDGETS) {
	return (lintAsIf(isolatedConfig({ overrides: [clientOnlyWidgetsConfig(widgets)] }), { [filePath]: code })[filePath] ?? [])
		.map((report) => report.ruleId)
		.filter((ruleId) => ruleId === RULE_ID || !ruleId.includes("/"));
}

// ── Fixtures ───────────────────────────────────────────────────────────
const ALLOWLISTED_WRAPPER = `"use client";
import dynamic from "next/dynamic";
const LazyChart = dynamic(() => import("./chart").then((module) => module.ChartContainer), { ssr: false, loading: () => null });
export default function ChartContainerClientOnly(): React.JSX.Element {
	return <LazyChart />;
}
`;

const WRAPPER_EXPORTING_IDENTIFIER = `"use client";
import dynamic from "next/dynamic";
const ImageCropDialogClientOnly = dynamic(() => import("./image-crop-dialog"), { ssr: false });
export default ImageCropDialogClientOnly;
`;

const UNLISTED_WRAPPER = `"use client";
import dynamic from "next/dynamic";
const LazyMap = dynamic(() => import("./map"), { ssr: false });
export default function MapClientOnly(): React.JSX.Element {
	return <LazyMap />;
}
`;

const ANONYMOUS_WRAPPER = `"use client";
import dynamic from "next/dynamic";
export default dynamic(() => import("./chart"), { ssr: false });
`;

const WRAPPER_WITHOUT_DEFAULT = `"use client";
import dynamic from "next/dynamic";
export const ChartContainerClientOnly = dynamic(() => import("./chart"), { ssr: false });
`;

const SSR_FALSE_IN_PLAIN_FILE = `"use client";
import dynamic from "next/dynamic";
const Palette = dynamic(() => import("./palette"), { ssr: false });
export function Topbar(): React.JSX.Element {
	return <Palette />;
}
`;

const SSR_FALSE_UNDER_ALIAS = `import load from "next/dynamic";
export const Palette = load(() => import("./palette"), { "ssr": false });
`;

const SSR_COMPUTED = `import dynamic from "next/dynamic";
const serverRender = false;
export const Palette = dynamic(() => import("./palette"), { ssr: serverRender });
`;

const SSR_ON_DYNAMIC = `import dynamic from "next/dynamic";
export const CodeBlockLazy = dynamic(() => import("./code-block").then((module) => module.CodeBlock), { loading: () => null });
export const Explicit = dynamic(() => import("./code-block").then((module) => module.CodeBlock), { ssr: true });
`;

const UNRELATED_SSR_OPTION = `function configure(options: { ssr: boolean }): boolean {
	return options.ssr;
}
export const value = configure({ ssr: false });
`;

describe("client-only widget allowlist (decision #58)", () => {
	describe("passes", () => {
		it("an allowlisted wrapper in a *.client-only.tsx file", () => {
			expect(ruleMessages(ALLOWLISTED_WRAPPER, "src/components/chart.client-only.tsx")).toEqual([]);
		});

		it("an allowlisted wrapper that default-exports an identifier", () => {
			expect(ruleMessages(WRAPPER_EXPORTING_IDENTIFIER, "src/lib/storage/image-crop-dialog.client-only.tsx")).toEqual([]);
		});

		it("next/dynamic with the server render on, anywhere", () => {
			expect(ruleMessages(SSR_ON_DYNAMIC, "src/components/code-block.lazy.tsx")).toEqual([]);
		});

		it("an `ssr` option of something other than next/dynamic", () => {
			expect(ruleMessages(UNRELATED_SSR_OPTION, "src/lib/configure.ts")).toEqual([]);
		});
	});

	describe("fails", () => {
		it("`ssr: false` outside a *.client-only.tsx file", () => {
			expect(ruleMessages(SSR_FALSE_IN_PLAIN_FILE, "components/layout/topbar.tsx")).toEqual([RULE_ID]);
		});

		it("`ssr: false` under a renamed next/dynamic import and a quoted key", () => {
			expect(ruleMessages(SSR_FALSE_UNDER_ALIAS, "components/layout/topbar.tsx")).toEqual([RULE_ID]);
		});

		it("a computed `ssr` value", () => {
			expect(ruleMessages(SSR_COMPUTED, "components/layout/topbar.tsx")).toEqual([RULE_ID]);
		});

		it("a wrapper whose default export is not in CLIENT_ONLY_WIDGETS", () => {
			expect(ruleMessages(UNLISTED_WRAPPER, "src/components/map.client-only.tsx")).toEqual([RULE_ID]);
		});

		it("a wrapper with an anonymous default export", () => {
			expect(ruleMessages(ANONYMOUS_WRAPPER, "src/components/chart.client-only.tsx")).toEqual([RULE_ID]);
		});

		it("a wrapper with no default export", () => {
			expect(ruleMessages(WRAPPER_WITHOUT_DEFAULT, "src/components/chart.client-only.tsx")).toEqual([RULE_ID]);
		});

		it("an allowlisted name when the workspace passes no allowlist (fails closed)", () => {
			expect(ruleMessages(ALLOWLISTED_WRAPPER, "src/components/chart.client-only.tsx", [])).toEqual([RULE_ID]);
		});
	});

	it.each([
		["react-internal", reactInternalConfig],
		["next-js", nextJsConfig],
	])("%s turns the rule on with an empty allowlist", (_name, config) => {
		const blocks = config.overrides.filter((override) => override.rules?.[RULE_ID] !== undefined);
		expect(blocks.map((block) => block.rules[RULE_ID])).toEqual([["error", { widgets: [] }]]);
	});
});
