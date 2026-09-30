import { describe, expect, it, vi } from "vitest";

import { initSite } from "./main";

const calls = vi.hoisted((): string[] => []);

vi.mock("./theme", () => ({ initTheme: (): void => void calls.push("theme") }));
vi.mock("./header", () => ({ initHeader: (): void => void calls.push("header") }));
vi.mock("./drawer", () => ({ initDrawer: (): void => void calls.push("drawer") }));
vi.mock("./sidebar", () => ({ initSidebar: (): void => void calls.push("sidebar") }));
vi.mock("./toc", () => ({ initToc: (): void => void calls.push("toc") }));
vi.mock("./code-blocks", () => ({ initCodeBlocks: (): void => void calls.push("code-blocks") }));
vi.mock("./feedback", () => ({ initFeedback: (): void => void calls.push("feedback") }));
vi.mock("./search", () => ({ initSearch: (): void => void calls.push("search") }));
vi.mock("./mermaid", () => ({ initMermaid: (): void => void calls.push("mermaid") }));

describe("initSite", () => {
	it("initialises every enhancement once, theme first", () => {
		initSite();
		expect(calls).toEqual(["theme", "header", "drawer", "sidebar", "toc", "code-blocks", "feedback", "search", "mermaid"]);
	});
});
