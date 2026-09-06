"use client";

import { Button } from "@workspace/ui/components/form/button";
import { SidebarTrigger } from "@workspace/ui/components/navigation/sidebar";
import { cn } from "@workspace/ui/lib/utils";
import { Search } from "lucide-react";
import * as React from "react";

export interface AppShellTopbarBrandProps {
	readonly icon: React.ReactNode;
	readonly title: string;
}

export interface AppShellTopbarSearchProps {
	readonly placeholder: string;
	readonly onOpen: () => void;
	readonly mobileAriaLabel?: string;
	readonly desktopAriaLabel?: string;
}

export interface AppShellTopbarProps {
	readonly brand: AppShellTopbarBrandProps;
	readonly search: AppShellTopbarSearchProps;
	readonly children?: React.ReactNode;
	readonly className?: string;
	/** When true, shows the brand on desktop even when the sidebar is open. */
	readonly showBrandOnDesktop?: boolean;
}

/** Registers ⌘K / Ctrl+K while the palette is closed. */
export function useCommandPaletteShortcut(commandOpen: boolean, onOpen: () => void): void {
	React.useEffect((): (() => void) => {
		const handleShortcut = (event: KeyboardEvent): void => {
			if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				if (!commandOpen) {
					onOpen();
				}
			}
		};

		document.addEventListener("keydown", handleShortcut);
		return (): void => {
			document.removeEventListener("keydown", handleShortcut);
		};
	}, [commandOpen, onOpen]);
}

export function AppShellTopbarSearch({ placeholder, onOpen, mobileAriaLabel = "Search", desktopAriaLabel = "Search pages" }: AppShellTopbarSearchProps): React.JSX.Element {
	return (
		<>
			<Button type="button" variant="ghost" size="icon-xs" onClick={onOpen} className="shrink-0 rounded-full p-2 md:hidden" aria-label={mobileAriaLabel}>
				<Search className="size-5 text-muted-foreground" />
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={onOpen}
				className="hidden h-9 w-40 min-w-0 shrink gap-2 rounded-lg border-border/60 bg-muted/40 px-3 font-normal text-muted-foreground shadow-xs hover:border-border/80 hover:bg-muted/60 md:flex lg:w-44 xl:w-56 2xl:w-64"
				aria-label={desktopAriaLabel}>
				<Search className="size-4 shrink-0" />
				<span className="truncate">{placeholder}</span>
				<span className="ms-auto flex shrink-0 items-center gap-1">
					<kbd className="hidden h-5 items-center gap-1 rounded border border-border/50 bg-background/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground xl:inline-flex">
						⌘
					</kbd>
					<kbd className="hidden h-5 items-center gap-1 rounded border border-border/50 bg-background/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground xl:inline-flex">
						K
					</kbd>
				</span>
			</Button>
		</>
	);
}

/**
 * Shared frosted topbar shell: sidebar toggle, mobile brand, search trigger,
 * and a slot for app-specific actions on the right.
 */
export function AppShellTopbar({ brand, search, children, className, showBrandOnDesktop = false }: AppShellTopbarProps): React.JSX.Element {
	return (
		<div className={cn("app-shell-topbar flex h-14 w-full min-w-0 items-center gap-2 overflow-hidden px-2 sm:gap-3 sm:px-4", className)}>
			<SidebarTrigger className="shrink-0" />
			<div className={cn("topbar-brand flex min-w-0 shrink-0 items-center", showBrandOnDesktop && "lg:flex!")}>
				{brand.icon}
				<span className="truncate text-lg font-semibold text-foreground">{brand.title}</span>
			</div>

			{/* Search sits in the action cluster (beside notifications), pinned to the end. */}
			<div className="ms-auto flex min-w-0 items-center gap-1 sm:gap-2">
				<AppShellTopbarSearch {...search} />
				{children !== undefined && children !== null ? <div className="flex shrink-0 items-center">{children}</div> : null}
			</div>
		</div>
	);
}
