import type { Node, Root } from "fumadocs-core/page-tree";
import { BookOpen, Mail, Newspaper, Radar, Timer, type LucideIcon } from "lucide-react";
import { createElement, type ReactNode } from "react";

import { blogSource } from "@/lib/blog";

const DEFAULT_BLOG_PAGE_ICON: LucideIcon = Newspaper;

const BLOG_PAGE_ICONS: Readonly<Record<string, LucideIcon>> = {
	"fastify-migration": Timer,
	"email-webhooks": Mail,
	telescope: Radar,
	"epoch-timestamps": BookOpen,
};

function resolveBlogPageIcon(slug: string): LucideIcon {
	return BLOG_PAGE_ICONS[slug] ?? DEFAULT_BLOG_PAGE_ICON;
}

function withBlogIcons(nodes: readonly Node[]): Node[] {
	return nodes.map((node) => {
		if (node.type === "page") {
			const slug = node.url.replace(/^\/blog\//, "");
			const Icon = resolveBlogPageIcon(slug);
			const icon: ReactNode = createElement(Icon, { className: "size-4" });
			return { ...node, icon };
		}
		if (node.type === "separator") {
			return node;
		}
		return { ...node, children: withBlogIcons(node.children) };
	});
}

/** Sidebar tree for `/blog/*` article pages. */
export function getBlogTree(): Root {
	const tree = blogSource.getPageTree();
	return { ...tree, children: withBlogIcons(tree.children) };
}
