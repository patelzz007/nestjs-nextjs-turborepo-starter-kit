"use client";

import { useItems, type TOCItemType } from "fumadocs-core/toc";
import { useTOCItems } from "fumadocs-ui/components/toc";
import { ChevronDown, List } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";

/**
 * Fully custom table of contents — replaces Fumadocs' TOC renderer via the
 * `slots.toc` escape hatch on `DocsPage`. The layout keeps Fumadocs'
 * `TOCProvider` (the right rail + the scroll-spy context), but the markup and
 * visuals below are 100% ours: `useTOCItems()` reads the provider's item list
 * and `useItems()` reports which anchors are currently in view.
 *
 * Desktop (`TableOfContentsMain`): a sticky right-rail with "On this page",
 * one continuous rail drawn on the list, a horizontal stub from the rail to
 * each nested item's text, and an inverted slate pill on the active/hover row.
 * Mobile (`TableOfContentsMobile`): a sticky bar in the `toc-popover` grid row
 * showing the current heading, expanding into a scrollable sheet.
 *
 * Nesting depth is conveyed via the `data-depth` attribute (0 for the
 * shallowest heading, +1 per deeper level); the CSS keys the rail stubs, text
 * indentation and pill offset off those values — no inline custom properties.
 */

interface TocItemLinkProps {
	readonly item: TOCItemType;
	/** 0 for the shallowest heading; +1 per deeper level. */
	readonly depthOffset: number;
	readonly active: boolean;
	readonly onNavigate?: () => void;
}

/** Fumadocs' observer tracks anchors by element id (no leading `#`) — match it. */
function anchorIdOf(url: string): string {
	return url.startsWith("#") ? url.slice(1) : url;
}

function TocItemLink({ item, depthOffset, active, onNavigate }: TocItemLinkProps): React.JSX.Element {
	return (
		<li className="toc-item" data-depth={depthOffset}>
			<a href={item.url} className={cn("toc-link", active ? "is-active" : undefined)} onClick={onNavigate}>
				{item.title}
			</a>
		</li>
	);
}

/** Desktop TOC — fills the right `toc` grid column, hidden below `xl`. */
export function TableOfContentsMain(): React.JSX.Element {
	const items = useTOCItems();
	const activeIds = new Set(
		useItems()
			.filter((info) => info.active)
			.map((info) => info.id),
	);

	if (items.length === 0) {
		return <aside className="toc-sticky flex flex-col [grid-area:toc] max-xl:hidden" aria-label="On this page" />;
	}

	const minDepth: number = Math.min(...items.map((item) => item.depth));

	return (
		<aside className="toc-sticky flex flex-col [grid-area:toc] max-xl:hidden" aria-label="On this page">
			<p className="toc-title">On this page</p>
			<nav className="toc-nav">
				<ol className="toc-list">
					{items.map((item) => (
						<TocItemLink key={item.url} item={item} depthOffset={item.depth - minDepth} active={activeIds.has(anchorIdOf(item.url))} />
					))}
				</ol>
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
	const minDepth: number = Math.min(...items.map((item) => item.depth));

	return (
		<div className="toc-mobile">
			<Button type="button" variant="outline" className="toc-mobile-trigger h-auto w-full justify-start gap-2" aria-expanded={open} onClick={toggle}>
				<List className="size-4 shrink-0" aria-hidden />
				<span className="min-w-0 flex-1 truncate">{activeTitle ?? "On this page"}</span>
				<ChevronDown className={cn("size-4 shrink-0 transition-transform", open ? "rotate-180" : undefined)} aria-hidden />
			</Button>
			{open ? (
				<div className="toc-mobile-panel">
					<ol className="toc-list">
						{items.map((item) => (
							<TocItemLink key={item.url} item={item} depthOffset={item.depth - minDepth} active={activeIds.has(anchorIdOf(item.url))} onNavigate={close} />
						))}
					</ol>
				</div>
			) : null}
		</div>
	);
}
