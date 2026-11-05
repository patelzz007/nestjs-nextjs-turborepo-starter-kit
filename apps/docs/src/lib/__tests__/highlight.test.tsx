import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { highlightTerms } from "../highlight";

function html(text: string, terms: readonly string[]): string {
	return renderToStaticMarkup(createElement(Fragment, null, ...highlightTerms(text, terms)));
}

describe("highlightTerms", () => {
	it("escapes HTML and marks every term", () => {
		expect(html("Use <RLS> and rls", ["rls"])).toBe("Use &lt;<mark>RLS</mark>&gt; and <mark>rls</mark>");
		expect(html("a.b", ["."])).toBe("a<mark>.</mark>b");
		expect(html("<x>", [])).toBe("&lt;x&gt;");
		// A term typed into the search box is HTML too: it is escaped inside the <mark>, never injected (audit hardening note).
		expect(html('a <img src=x onerror="alert(1)"> b', ['<img src=x onerror="alert(1)">'])).toBe("a <mark>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</mark> b");
	});
});
