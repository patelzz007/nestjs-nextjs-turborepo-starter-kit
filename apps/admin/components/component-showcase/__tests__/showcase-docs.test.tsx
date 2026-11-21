// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "@/components/docs/markdown";
import type { ApiEntry } from "@/components/component-showcase/showcase-api";
import { apiAnchorOf, ShowcaseApiReference } from "@/components/component-showcase/showcase-api-reference";
import { showcaseItemBySlug, type ShowcaseCatalogItem } from "@/components/component-showcase/showcase-catalog";
import type { ShowcaseDocs } from "@/components/component-showcase/showcase-content";
import { loadShowcaseApi, loadShowcaseContent } from "@/components/component-showcase/showcase-docs-data";
import { docsOutlineOf, ShowcaseDocsPage } from "@/components/component-showcase/showcase-docs-page";
import { SHOWCASE_ROUTES } from "@/components/component-showcase/showcase-routes";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const KBD: ApiEntry = {
	name: "Kbd",
	kind: "component",
	module: "@workspace/ui/components/kbd",
	description: "A key cap, such as `⌘`.",
	props: [
		{ name: "size", type: '"sm" | "default"', defaultValue: '"default"', description: "How large the key is.", required: false },
		{ name: "children", type: "ReactNode", defaultValue: null, description: "", required: true },
	],
	inherits: ["HTML attributes"],
	signature: null,
};
const KBD_GROUP: ApiEntry = { ...KBD, name: "KbdGroup", description: "", props: [], inherits: [] };
const USE_SHORTCUT: ApiEntry = { ...KBD, name: "useShortcut", kind: "hook", description: "", props: [], inherits: [], signature: "(key: string) => void" };

const DOCS: ShowcaseDocs = {
	body: "## Usage\n\nPress a key.\n\n```showcase-example\nc-kbd-1\n```\n\n## API Reference\n\n```showcase-api\n```\n\n## Accessibility\n\n- Read aloud as text.\n",
	examples: [{ id: "c-kbd-1", label: "Basic", anchor: "basic", part: null, file: "kbd-1", source: "export function Kbd1Example() {}\n" }],
};

function kbdItem(): ShowcaseCatalogItem {
	const item = showcaseItemBySlug("kbd");
	if (item === undefined) {
		throw new Error("kbd is in the catalog");
	}
	return item;
}

describe("ShowcaseApiReference", () => {
	it("lists each component's own props with their type, default and description, and what else it accepts", () => {
		render(<ShowcaseApiReference entries={[KBD, KBD_GROUP, USE_SHORTCUT]} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("heading", { level: 3, name: "Kbd" }).id).toBe(apiAnchorOf("Kbd"));
		const rows = within(screen.getByRole("table", { name: "Kbd props" })).getAllByRole("row");
		expect(rows.map((row) => row.textContent)).toEqual(["PropTypeDefaultDescription", 'size?"sm" | "default""default"How large the key is.', "childrenReactNode—"]);
		expect(screen.getByText("Also accepts: HTML attributes.")).toBeTruthy();
		expect(screen.getByText("⌘").tagName).toBe("CODE");
		expect(screen.getByText("No props of its own.")).toBeTruthy();
		expect(screen.getByText("(key: string) => void")).toBeTruthy();
	});

	it("says so when a component exports nothing to document", () => {
		render(<ShowcaseApiReference entries={[]} />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("This component exports nothing beyond what its examples show.")).toBeTruthy();
	});

	it("anchors each entry by its name", () => {
		expect(apiAnchorOf("CodeBlockCopyButton")).toBe("api-code-block-copy-button");
		expect(apiAnchorOf("useCodeBlockConfig")).toBe("api-use-code-block-config");
	});
});

describe("ShowcaseDocsPage", () => {
	installJsdomUiShims();

	it("renders the docs with the API reference and the examples in place, and an outline that lists the API entries", () => {
		render(<ShowcaseDocsPage item={kbdItem()} docs={DOCS} apiEntries={[KBD, KBD_GROUP]} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("heading", { level: 1, name: "Kbd" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Kbd examples" }).getAttribute("href")).toBe(SHOWCASE_ROUTES.component("kbd"));
		expect(screen.getByRole("table", { name: "Kbd props" })).toBeTruthy();
		expect(screen.getByRole("link", { name: /View it live/u }).getAttribute("href")).toBe(SHOWCASE_ROUTES.feature("kbd", "basic"));
		expect(screen.getByRole("heading", { level: 2, name: "Accessibility" })).toBeTruthy();
	});

	it("puts the API entries in the outline where the API block sits", () => {
		expect(docsOutlineOf(DOCS.body, [KBD, KBD_GROUP]).map(({ text }) => text)).toEqual(["Usage", "API Reference", "Kbd", "KbdGroup", "Accessibility"]);
		expect(docsOutlineOf("## Usage\n", [KBD]).map(({ text }) => text)).toEqual(["Usage", "Kbd"]);
	});

	it("leaves out an example fence that names nothing it knows", () => {
		const { container } = render(<ShowcaseDocsPage item={kbdItem()} docs={{ ...DOCS, examples: [] }} apiEntries={[]} />, { wrapper: UiKitTestProviders });
		expect(container.querySelector("[data-showcase-docs-example]")).toBeNull();
	});
});

describe("showcase docs route", () => {
	it("sits under the component's page, its slug encoded", () => {
		expect(SHOWCASE_ROUTES.docs("code-block")).toBe("/components/code-block/docs");
		expect(SHOWCASE_ROUTES.docs("a b")).toBe("/components/a%20b/docs");
	});
});

describe("showcase docs data", () => {
	it("loads a component's generated API and content, and nothing for an unknown one", async (): Promise<void> => {
		expect((await loadShowcaseApi("code-block")).at(0)?.name).toBe("CodeBlock");
		expect((await loadShowcaseContent("code-block"))?.docs.body).toContain("```showcase-api");
		expect(await loadShowcaseApi("not-a-component")).toEqual([]);
		expect(await loadShowcaseContent("not-a-component")).toBeNull();
	});
});

describe("Markdown fences", () => {
	it("renders a page-owned fence with its renderer and any other fence as code", () => {
		render(<Markdown source={"```note\nhello\n```\n\n```ts\nconst a = 1;\n```"} fences={{ note: (body: string) => <aside>{`note: ${body}`}</aside> }} />, {
			wrapper: UiKitTestProviders,
		});
		expect(screen.getByText("note: hello").tagName).toBe("ASIDE");
		expect(screen.queryByText("note: const a = 1;")).toBeNull();
	});
});
