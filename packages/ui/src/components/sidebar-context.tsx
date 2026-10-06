"use client";

import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { isMobileViewport, MOBILE_MEDIA_QUERY, useIsMobile } from "@workspace/ui/hooks/use-mobile";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import type { SidebarLabels } from "@workspace/ui/lib/sidebar/labels";
import { createCookieSidebarStorage, type SidebarStorageAdapter } from "@workspace/ui/lib/sidebar/storage";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

const SIDEBAR_KEYBOARD_SHORTCUT = "b";

/** Stable empty badge map — a fresh `{}` default per render would change the context value every render. */
const NO_BADGES: Readonly<Record<string, string | number>> = {};

export interface SidebarContextProps {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
	/** The resolved `sidebar` family copy (provider pack with the `SidebarProvider`'s `labels` override laid over it). */
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
		defaultOpen?: boolean | undefined;
		open?: boolean | undefined;
		onOpenChange?: ((open: boolean) => void) | undefined;
		/** Controlled open state of the mobile sheet; omit to let the provider own it. */
		openMobile?: boolean | undefined;
		onOpenMobileChange?: ((open: boolean) => void) | undefined;
		/** Per-usage overrides of the `sidebar` family's copy (toggle, mobile sheet title/description) from `UiKitLabelsProvider`. */
		labels?: UiKitLabelsOverride<"sidebar"> | undefined;
		storage?: SidebarStorageAdapter | undefined;
		keyboardShortcut?: string | undefined;
		badges?: Readonly<Record<string, string | number>> | undefined;
	}
>(function SidebarProvider(
	{
		defaultOpen = true,
		open: openProp,
		onOpenChange: setOpenProp,
		openMobile: openMobileProp,
		onOpenMobileChange,
		className,
		style,
		children,
		labels: labelsOverride,
		storage,
		keyboardShortcut = SIDEBAR_KEYBOARD_SHORTCUT,
		badges = NO_BADGES,
		...props
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("sidebar", labelsOverride);
	const isMobile = useIsMobile();
	const [openMobileState, setOpenMobileState] = React.useState(false);
	const openMobile = openMobileProp ?? openMobileState;

	const setOpenMobile = React.useCallback(
		(nextOpen: boolean): void => {
			onOpenMobileChange?.(nextOpen);
			if (openMobileProp === undefined) {
				setOpenMobileState(nextOpen);
			}
		},
		[onOpenMobileChange, openMobileProp],
	);
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
			setOpenMobile(!openMobile);
		} else {
			setOpen(!open);
		}
	}, [open, setOpen, openMobile, setOpenMobile]);

	// Latest "close the mobile sheet" command, read by the viewport listener
	// without re-subscribing it whenever the controlled props change.
	const closeMobileRef = React.useRef<() => void>((): void => undefined);
	React.useEffect(() => {
		closeMobileRef.current = (): void => {
			if (openMobile) {
				setOpenMobile(false);
			}
		};
	}, [openMobile, setOpenMobile]);

	React.useEffect((): (() => void) => {
		const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
		const handleViewportChange = (): void => {
			if (!mediaQueryList.matches) {
				closeMobileRef.current();
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
