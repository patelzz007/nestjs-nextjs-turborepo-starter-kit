import { describe, expect, it } from "vitest";

import { createMarkdownRenderer } from "../pipeline";

const ROOTS = { repoRoot: "/repo", githubBlobBase: "https://github.com/acme/kit/blob/main" };
const render = await createMarkdownRenderer(ROOTS);

describe("createMarkdownRenderer", () => {
	it("should drop the leading h1, slug headings like GitHub and return them", async () => {
		const { html, headings } = await render("# Title\n\n## Getting started\n\n### Step one\n", "/repo/docs/guide.md");
		expect(html).not.toContain("<h1");
		expect(html).toContain('id="getting-started"');
		expect(headings.map((heading) => heading.slug)).toEqual(["getting-started", "step-one"]);
	});

	it("should apply GitHub-flavoured Markdown and SmartyPants, as the Astro site did", async () => {
		const { html } = await render("It's done -- see below.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- [x] shipped\n", "/repo/docs/guide.md");
		expect(html).toContain("It’s done — see below.");
		expect(html).toContain("<table");
		expect(html).toContain("table-wrapper");
	});

	it("should resolve relative links to guides, posts and repository files", async () => {
		const { html } = await render("[db](./database.md#seed) [post](../blog/epoch.md) [code](../apps/api/main.ts)", "/repo/docs/guide.md");
		expect(html).toContain('href="/docs/database#seed"');
		expect(html).toContain('href="/blog/epoch"');
		expect(html).toContain('href="https://github.com/acme/kit/blob/main/apps/api/main.ts"');
	});

	it("should render callouts with the shared Alert and fences with the shared CodeBlock", async () => {
		const { html } = await render('> [!WARNING]\n> Keep **this** in mind.\n\n```ts title="main.ts"\nconst a = 1;\n```\n', "/repo/docs/guide.md");
		expect(html).toContain('data-slot="alert"');
		expect(html).toContain('data-variant="warning"');
		expect(html).toContain("<strong>this</strong>");
		expect(html).toContain("data-code-block-root");
		expect(html).toContain("main.ts");
	});
});
