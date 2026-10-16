"use client";

import { Button } from "@workspace/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { createCookieSidebarStorage } from "@workspace/ui/lib/sidebar/storage";
import { cn } from "@workspace/ui/lib/core/utils";
import { SIDEBAR_OPEN_COOKIE_MAX_AGE_SECONDS, sidebarOpenCookieName } from "@workspace/client/lib/features/sidebar/open-cookie";
import { ListTree, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import * as React from "react";

import { GalleryNav } from "@/components/component-gallery/gallery-nav";
import { COMPONENTS_NAV_STORAGE_KEY } from "@/components/component-gallery/gallery-nav-cookie";

/*
 * The open / close motion: the grid column slides between the full list and
 * the rail while the list fades, with the kit's reveal easing. Reduce Motion
 * turns both off.
 */
const NAV_MOTION = "duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

export interface GalleryShellProps {
	/** The open state the server rendered, read from the cookie (`true` when none is set). */
	readonly initialNavOpen: boolean;
	readonly children: React.ReactNode;
}

/** Below `lg`: a button that opens the components list in a sheet, closed again when a component is picked. */
function MobileGalleryNav(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const handleNavigate = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger
				render={
					<Button type="button" variant="outline" size="sm" className="gap-2 self-start lg:hidden">
						<ListTree aria-hidden="true" />
						Browse components
					</Button>
				}
			/>
			<SheetContent side="left" closeLabel="Close the components list" className="w-80 max-w-[85vw] gap-0">
				<SheetHeader className="border-b">
					<SheetTitle>Components</SheetTitle>
					<SheetDescription>Every component of the kit, by family.</SheetDescription>
				</SheetHeader>
				<div className="min-h-0 flex-1 overflow-y-auto p-3">
					<GalleryNav onNavigate={handleNavigate} />
				</div>
			</SheetContent>
		</Sheet>
	);
}

/**
 * `/components/*`: the gallery's own navigation beside the page. Like the app
 * sidebar it collapses — sliding down to a slim rail with a button to reopen
 * it — and remembers that in its own cookie, so the next page load renders it
 * as it was left. The list stays mounted while collapsed (inert and hidden
 * from assistive tech), so it can animate and keeps its filter and expanded
 * families. Below `lg` the list opens in a sheet instead.
 */
export function GalleryShell({ initialNavOpen, children }: GalleryShellProps): React.JSX.Element {
	const [navOpen, setNavOpen] = React.useState(initialNavOpen);
	const cookie = React.useMemo(
		() => createCookieSidebarStorage({ cookieName: sidebarOpenCookieName(COMPONENTS_NAV_STORAGE_KEY), maxAgeSeconds: SIDEBAR_OPEN_COOKIE_MAX_AGE_SECONDS }),
		[],
	);
	const handleToggle = React.useCallback((): void => {
		setNavOpen((previous: boolean): boolean => {
			cookie.write(!previous);
			return !previous;
		});
	}, [cookie]);
	const label = navOpen ? "Hide the components list" : "Show the components list";
	const ToggleIcon = navOpen ? PanelLeftClose : PanelLeftOpen;

	return (
		<div
			data-nav-open={navOpen ? "" : undefined}
			className={cn(
				"grid w-full items-start gap-6 lg:gap-8 lg:transition-[grid-template-columns]",
				NAV_MOTION,
				navOpen ? "lg:grid-cols-[15rem_minmax(0,1fr)]" : "lg:grid-cols-[2.25rem_minmax(0,1fr)]",
			)}>
			<aside className="hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100vh-8rem)] lg:flex-col lg:gap-2">
				<div className="flex justify-end">
					<Tooltip>
						<TooltipTrigger
							render={
								<Button type="button" variant="ghost" size="icon-sm" aria-label={label} aria-expanded={navOpen} onClick={handleToggle}>
									<ToggleIcon aria-hidden="true" />
								</Button>
							}
						/>
						<TooltipContent side="right">{label}</TooltipContent>
					</Tooltip>
				</div>
				<div
					inert={!navOpen}
					aria-hidden={navOpen ? undefined : true}
					className={cn("min-h-0 w-60 shrink-0 overflow-y-auto p-1 transition-opacity", NAV_MOTION, navOpen ? "opacity-100" : "opacity-0")}>
					<GalleryNav />
				</div>
			</aside>
			<div className="flex min-w-0 flex-col gap-6">
				<MobileGalleryNav />
				{children}
			</div>
		</div>
	);
}
