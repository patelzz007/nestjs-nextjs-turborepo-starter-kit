import { initCodeBlocks } from "./code-blocks";
import { initDrawer } from "./drawer";
import { initFeedback } from "./feedback";
import { initHeader } from "./header";
import { initMermaid } from "./mermaid";
import { initSearch } from "./search";
import { initSidebar } from "./sidebar";
import { initTheme } from "./theme";
import { initToc } from "./toc";

/** Progressive enhancement for every page; each piece no-ops when its markup is absent. */
export function initSite(): void {
	initTheme();
	initHeader();
	initDrawer();
	initSidebar();
	initToc();
	initCodeBlocks();
	initFeedback();
	initSearch();
	initMermaid();
}
