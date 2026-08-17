import type { Node, Root } from "fumadocs-core/page-tree";
import {
	BookOpen,
	Compass,
	Database,
	FileCode2,
	Gauge,
	Layers,
	Mail,
	Map,
	Package,
	Palette,
	PanelLeft,
	Radar,
	RefreshCw,
	Rocket,
	ScrollText,
	Send,
	ShieldCheck,
	Timer,
	Wrench,
	Zap,
	type LucideIcon,
} from "lucide-react";
import { createElement, type ReactNode } from "react";

import { source } from "@/lib/source";

/**
 * Per-page sidebar icons. Keyed by the doc slug (`page.url` without the
 * `/docs/` prefix) so the map is trivial to extend — add a new guide, drop its
 * slug + icon here, and the sidebar (and any tree consumer) picks it up
 * automatically. Falls back to no icon when a slug is missing, so a new doc
 * never breaks the nav.
 */
const PAGE_ICONS: Readonly<Record<string, LucideIcon>> = {
	"getting-started": Rocket,
	README: BookOpen,
	architecture: Layers,
	"token-refresh": RefreshCw,
	typescript: FileCode2,
	eslint: ShieldCheck,
	prisma: Database,
	dependencies: Package,
	logging: ScrollText,
	"performance-and-dx": Gauge,
	email: Mail,
	"email-setup": Send,
	"reactive-core": Zap,
	telescope: Radar,
	"fastify-migration": Timer,
	"ui-components": Palette,
	"sidebar-audit": PanelLeft,
	"auth-roadmap": Map,
	"boilerplate-roadmap": Compass,
};

/**
 * Icons for the landing page's section headers, keyed by the `meta.json`
 * separator labels — same tone as the sidebar icons so the home page and the
 * nav stay visually consistent.
 */
export const SECTION_ICONS: Readonly<Record<string, LucideIcon>> = {
	"Getting Started": Rocket,
	"Architecture & Auth": ShieldCheck,
	"Tooling & DX": Wrench,
	"Deep Dives": Radar,
	Roadmaps: Map,
};

/**
 * Attaches icons to pages and section separators, recursing into folders.
 * Separator names come from `--- Label ---` meta entries with surrounding
 * whitespace, so they're trimmed here (fixes the nav's stray spaces) and
 * matched against `SECTION_ICONS` to give the sidebar section headers the
 * same icons as the landing page.
 */
function withIcons(nodes: readonly Node[]): Node[] {
	return nodes.map((node) => {
		if (node.type === "page") {
			const slug = node.url.replace(/^\/docs\//, "");
			const Icon: LucideIcon | undefined = PAGE_ICONS[slug];
			if (Icon === undefined) {
				return node;
			}
			const icon: ReactNode = createElement(Icon, { className: "size-4" });
			return { ...node, icon };
		}
		if (node.type === "separator") {
			const name = typeof node.name === "string" ? node.name.trim() : node.name;
			const Icon: LucideIcon | undefined = typeof name === "string" ? SECTION_ICONS[name] : undefined;
			if (Icon === undefined) {
				return { ...node, name };
			}
			return { ...node, name, icon: createElement(Icon, { className: "size-4" }) };
		}
		// After the page/separator branches, only `Folder` remains.
		return { ...node, children: withIcons(node.children) };
	});
}

/**
 * The sidebar tree with per-page icons. Pass this to `<DocsLayout tree=…>`
 * (the raw `source.getPageTree()` is icon-less). Every page maps to one lucide
 * icon — same tone as the admin's sidebar — so the nav reads at a glance.
 */
export function getDocsTree(): Root {
	const tree = source.getPageTree();
	return { ...tree, children: withIcons(tree.children) };
}
