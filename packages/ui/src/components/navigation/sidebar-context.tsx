"use client";

import { isMobileViewport, MOBILE_MEDIA_QUERY, useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { type SidebarLabels } from "@workspace/ui/lib/sidebar/labels";
import { createCookieSidebarStorage, type SidebarStorageAdapter } from "@workspace/ui/lib/sidebar/storage";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

const SIDEBAR_KEYBOARD_SHORTCUT = "b";

export interface SidebarContextProps {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
	labels: SidebarLabels;
	/** Notification counts keyed by menu item id — consumed by `SidebarMenuBadge`. */
	badges: Readonly<Record<string, string | number>>;
}

export const SidebarContext = React.createContext<SidebarContextProps | null>(null);

export function useSidebar(): SidebarContextProps {
	const context = React.useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}

	return context;
}

export const SidebarProvider = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		defaultOpen?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		labels: SidebarLabels;
		storage?: SidebarStorageAdapter;
		keyboardShortcut?: string;
		badges?: Readonly<Record<string, string | number>>;
	}
>(function SidebarProvider(
	{
		defaultOpen = true,
		open: openProp,
		onOpenChange: setOpenProp,
		className,
		style,
		children,
		labels,
		storage,
		keyboardShortcut = SIDEBAR_KEYBOARD_SHORTCUT,
		badges = {},
		...props
	},
	ref,
): React.JSX.Element {
	const isMobile = useIsMobile();
	const [openMobile, setOpenMobile] = React.useState(false);
	const resolvedStorage = React.useMemo(() => storage ?? createCookieSidebarStorage(), [storage]);
	const isStorageBacked = openProp === undefined && setOpenProp === undefined;

	const [openState, setOpenState] = React.useState((): boolean => {
		if (!isStorageBacked) {
			return defaultOpen;
		}
		return resolvedStorage.read() ?? defaultOpen;
	});
	const open = openProp ?? openState;

	const setOpen = React.useCallback(
		(nextOpen: boolean): void => {
			if (setOpenProp) {
				setOpenProp(nextOpen);
			} else {
				setOpenState(nextOpen);
			}
			if (isStorageBacked) {
				resolvedStorage.write(nextOpen);
			}
		},
		[setOpenProp, resolvedStorage, isStorageBacked],
	);

	const toggleSidebar = React.useCallback((): void => {
		if (isMobileViewport()) {
			setOpenMobile((current) => !current);
		} else {
			setOpen(!open);
		}
	}, [open, setOpen]);

	React.useEffect((): (() => void) => {
		const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
		const handleViewportChange = (): void => {
			if (!mediaQueryList.matches) {
				setOpenMobile(false);
			}
		};
		handleViewportChange();
		mediaQueryList.addEventListener("change", handleViewportChange);
		return (): void => {
			mediaQueryList.removeEventListener("change", handleViewportChange);
		};
	}, []);

	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === keyboardShortcut && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				toggleSidebar();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return (): void => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [toggleSidebar, keyboardShortcut]);

	const state = open ? "expanded" : "collapsed";

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({
			state,
			open,
			setOpen,
			isMobile,
			openMobile,
			setOpenMobile,
			toggleSidebar,
			labels,
			badges,
		}),
		[state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar, labels, badges],
	);

	return (
		<SidebarContext.Provider value={contextValue}>
			<div
				ref={ref}
				data-slot="sidebar-wrapper"
				style={style}
				className={cn("group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar", className)}
				{...props}>
				{children}
			</div>
		</SidebarContext.Provider>
	);
});
