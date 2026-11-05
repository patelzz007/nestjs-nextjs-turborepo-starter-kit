import { Link, useRouterState } from "@tanstack/react-router";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Kbd } from "@workspace/ui/components/kbd";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowUpRight, Menu, Search } from "lucide-react";
import { useCallback, useState, type ReactElement } from "react";

import type { SidebarSection } from "@/lib/navigation";
import { GithubMark } from "@/lib/icons";
import { GITHUB_URL, HEADER_TABS, isExternalTab, isTabActive, SITE_NAME } from "@/lib/site";

import { HrefLink } from "./href-link";
import { NavTree } from "./nav-tree";
import { useOpenSearch } from "./search-provider";
import { ThemeToggle } from "./theme-toggle";

export interface SiteHeaderProps {
	readonly sections: readonly SidebarSection[];
	readonly activeGuideId: string | null;
}

/**
 * The sticky header on a drafting-grid band: the brand, the site's tabs (internal first, then the apps),
 * search (⌘K), the theme, GitHub, and the guide tree in a drawer on phones.
 */
export function SiteHeader({ sections, activeGuideId }: SiteHeaderProps): ReactElement {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const openSearch = useOpenSearch();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const openDrawer = useCallback((): void => {
		setDrawerOpen(true);
	}, []);
	const closeDrawer = useCallback((): void => {
		setDrawerOpen(false);
	}, []);

	return (
		<header className="docs-grid-band sticky top-0 z-40 border-b border-border">
			<div className="mx-auto flex h-(--header-height) max-w-10xl items-center gap-3 px-4 md:gap-6 md:px-6">
				<Button type="button" variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open the guide menu" onClick={openDrawer}>
					<Menu aria-hidden="true" />
				</Button>
				<Link
					to="/"
					className="flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
					<span aria-hidden="true" className="grid size-6 place-items-center rounded-[5px] border-[1.5px] border-(--docs-link) font-mono text-[0.6875rem] text-(--docs-link)">
						sk
					</span>
					<span>starter-kit/docs</span>
					<span className="sr-only">{SITE_NAME}</span>
				</Link>
				<nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
					{HEADER_TABS.map((tab) =>
						isExternalTab(tab) ? (
							<a
								key={tab.label}
								href={tab.href}
								target="_blank"
								rel="noopener noreferrer"
								className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground")}>
								{tab.label}
								<ArrowUpRight aria-hidden="true" className="size-3.5" />
								<span className="sr-only">(opens in a new tab)</span>
							</a>
						) : (
							<HrefLink
								key={tab.label}
								href={tab.href}
								aria-current={isTabActive(tab, pathname) ? "page" : undefined}
								className={cn(buttonVariants({ variant: "ghost", size: "sm" }), isTabActive(tab, pathname) ? "text-foreground" : "text-muted-foreground")}>
								{tab.label}
							</HrefLink>
						),
					)}
				</nav>
				<div className="ms-auto flex items-center gap-1.5">
					<button
						type="button"
						onClick={openSearch}
						className="flex h-9 items-center gap-2.5 rounded-md border border-border bg-background px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:w-72">
						<Search aria-hidden="true" className="size-4" />
						<span className="hidden min-w-0 truncate md:inline">Search guides and endpoints</span>
						<span className="sr-only md:hidden">Search</span>
						<Kbd className="ms-auto hidden md:inline-flex">⌘K</Kbd>
					</button>
					<ThemeToggle />
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="The repository on GitHub (opens in a new tab)"
						className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
						<GithubMark />
					</a>
				</div>
			</div>
			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetContent side="left" className="w-80 gap-0 overflow-y-auto p-0">
					<SheetHeader className="border-b border-border">
						<SheetTitle>Guides</SheetTitle>
						<SheetDescription>Every guide, by section.</SheetDescription>
					</SheetHeader>
					<nav aria-label="Sections" className="grid gap-1 border-b border-border p-3 md:hidden">
						{HEADER_TABS.filter((tab) => !isExternalTab(tab)).map((tab) => (
							<HrefLink key={tab.label} href={tab.href} onClick={closeDrawer} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "justify-start")}>
								{tab.label}
							</HrefLink>
						))}
					</nav>
					<div className="p-3">
						<NavTree sections={sections} activeId={activeGuideId} onNavigate={closeDrawer} />
					</div>
				</SheetContent>
			</Sheet>
		</header>
	);
}
