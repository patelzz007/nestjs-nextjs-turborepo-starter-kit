"use client";

import { buildTocTree, type TocTreeNode } from "@/lib/toc-tree";
import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { useItems, type TOCItemType } from "fumadocs-core/toc";
import { useTOCItems } from "fumadocs-ui/components/toc";
import { ChevronDown, List } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

/**
 * Custom table of contents — nested tree with vertical guide lines on the left
 * of each branch. Replaces Fumadocs' default renderer via `slots.toc` on
 * `DocsPage` while keeping `TOCProvider` for scroll-spy context.
 */

interface TocItemLinkProps {
	readonly item: TOCItemType;
	readonly active: boolean;
	readonly onNavigate?: () => void;
}

/** Fumadocs' observer tracks anchors by element id (no leading `#`) — match it. */
function anchorIdOf(url: string): string {
	return url.startsWith("#") ? url.slice(1) : url;
}

function TocItemLink({ item, active, onNavigate }: TocItemLinkProps): React.JSX.Element {
	return (
		<a href={item.url} className={cn("toc-link", active ? "is-active" : undefined)} onClick={onNavigate}>
			<span className="toc-link-label">{item.title}</span>
		</a>
	);
}

interface TocTreeBranchProps {
	readonly nodes: readonly TocTreeNode[];
	readonly activeIds: ReadonlySet<string>;
	readonly depth: number;
	readonly onNavigate?: () => void;
}

function TocTreeBranch({ nodes, activeIds, depth, onNavigate }: TocTreeBranchProps): React.JSX.Element {
	return (
		<ul className={cn("toc-tree", depth > 0 && "toc-tree-nested")} data-depth={depth}>
			{nodes.map((node) => (
				<li key={node.item.url} className="toc-tree-node">
					<TocItemLink item={node.item} active={activeIds.has(anchorIdOf(node.item.url))} onNavigate={onNavigate} />
					{node.children.length > 0 ? <TocTreeBranch nodes={node.children} activeIds={activeIds} depth={depth + 1} onNavigate={onNavigate} /> : null}
				</li>
			))}
		</ul>
	);
}

interface TocTreeProps {
	readonly items: readonly TOCItemType[];
	readonly activeIds: ReadonlySet<string>;
	readonly onNavigate?: () => void;
}

function TocTree({ items, activeIds, onNavigate }: TocTreeProps): React.JSX.Element {
	const tree = useMemo(() => buildTocTree(items), [items]);
	return <TocTreeBranch nodes={tree} activeIds={activeIds} depth={0} onNavigate={onNavigate} />;
}

/** Desktop TOC — fills the right `toc` grid column, hidden below `xl`. */
export function TableOfContentsMain(): React.JSX.Element {
	const items = useTOCItems();
	const itemsInfo = useItems();
	const activeIds = useMemo(() => new Set(itemsInfo.filter((info) => info.active).map((info) => info.id)), [itemsInfo]);

	if (items.length === 0) {
		return <aside className="toc-sticky flex flex-col [grid-area:toc] max-xl:hidden" aria-label="On this page" />;
	}

	return (
		<aside className="toc-sticky flex flex-col [grid-area:toc] max-xl:hidden" aria-label="On this page">
			<p className="toc-title">On this page</p>
			<nav className="toc-nav">
				<TocTree items={items} activeIds={activeIds} />
			</nav>
		</aside>
	);
}

/** Mobile TOC — sticky bar under the header, expands into a sheet. */
export function TableOfContentsMobile(): React.JSX.Element | null {
	const items = useTOCItems();
	const itemsInfo = useItems();
	const [open, setOpen] = useState(false);

	const toggle = useCallback((): void => {
		setOpen((prev) => !prev);
	}, []);
	const close = useCallback((): void => {
		setOpen(false);
	}, []);

	if (items.length === 0) {
		return null;
	}

	const activeIds = new Set(itemsInfo.filter((info) => info.active).map((info) => info.id));
	const activeTitle = itemsInfo.find((info) => info.active)?.original.title;

	return (
		<div className="toc-mobile">
			<Button type="button" variant="outline" className="toc-mobile-trigger h-auto w-full justify-start gap-2" aria-expanded={open} onClick={toggle}>
				<List className="size-4 shrink-0" aria-hidden />
				<span className="min-w-0 flex-1 truncate">{activeTitle ?? "On this page"}</span>
				<ChevronDown className={cn("size-4 shrink-0 transition-transform", open ? "rotate-180" : undefined)} aria-hidden />
			</Button>
			{open ? (
				<div className="toc-mobile-panel">
					<TocTree items={items} activeIds={activeIds} onNavigate={close} />
				</div>
			) : null}
		</div>
	);
}
