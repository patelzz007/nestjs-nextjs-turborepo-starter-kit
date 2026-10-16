"use client";

// Ported from ReUI (https://reui.io/r/base-vega/gantt-nav.json). Part names,
// props (`tooltip`, `scales`, `format`, `render`) and `data-slot` attributes
// match ReUI, with these deliberate deviations:
// - Copy comes from the `gantt` labels family; the Today tooltip reads the
//   gantt clock (no tooltip until the client has read it).
// - Every part forwards its ref; GanttNav / GanttToolbar take CVA
//   `variant` / `size` axes.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

import { useGanttNavigation, useGanttNow, useGanttScale, useGanttSettings, useGanttViewConfig, type GanttNavButtonSize, type GanttNavButtonVariant } from "./gantt";
import { localeOptions } from "./gantt-i18n";
import { toZoned } from "./gantt-lib";
import type { GanttScale } from "./gantt-types";

export const GANTT_SCALES: readonly GanttScale[] = ["day", "week", "month", "quarter", "year"];

/** Shared nav tooltip timing: the first tooltip waits, moving between buttons is instant. */
const NAV_TOOLTIP_DELAY_MS = 600;
const NAV_TOOLTIP_TIMEOUT_MS = 300;

type NavIconSize = "icon-sm" | "icon";

interface NavButtonLook {
	readonly variant: GanttNavButtonVariant;
	readonly size: GanttNavButtonSize;
	readonly iconSize: NavIconSize;
}

/** Configured nav button variant/size (viewConfig.navButtonVariant/Size). */
function useNavButtonLook(): NavButtonLook {
	const viewConfig = useGanttViewConfig();
	return { variant: viewConfig.navButtonVariant, size: viewConfig.navButtonSize, iconSize: viewConfig.navButtonSize === "sm" ? "icon-sm" : "icon" };
}

export interface GanttNavButtonProps extends Omit<React.ComponentProps<typeof Button>, "children" | "variant" | "size"> {
	readonly children?: React.ReactNode;
	/**
	 * Hover / keyboard-focus tooltip. Icon-only buttons default to their
	 * accessible label; Today defaults to the current date. Pass null to disable.
	 */
	readonly tooltip?: React.ReactNode;
}

interface NavTooltipProps {
	readonly content: React.ReactNode;
	readonly children: React.ReactElement;
}

/** Hover/focus-visible tooltip wrapper; renders the bare button when there is no content. */
function NavTooltip({ content, children }: NavTooltipProps): React.ReactElement {
	if (content === null || content === undefined) {
		return children;
	}
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent side="bottom">{content}</TooltipContent>
		</Tooltip>
	);
}

export const GanttNavToday = React.forwardRef<HTMLElement, GanttNavButtonProps>(function GanttNavToday({ className, children, tooltip, ...props }, ref): React.ReactElement {
	const { today, isToday } = useGanttNavigation();
	const settings = useGanttSettings();
	const look = useNavButtonLook();
	const nowMs = useGanttNow();
	// zoned: a system-zone date can name a different day than Today opens
	const defaultTooltip = nowMs === null ? null : format(toZoned(new Date(nowMs), settings.timeZone), settings.i18n.formats.dayTitle, localeOptions(settings.locale));
	return (
		<NavTooltip content={tooltip === undefined ? defaultTooltip : tooltip}>
			<Button
				ref={ref}
				variant={look.variant}
				size={look.size}
				data-slot="gantt-nav-today"
				data-active={isToday ? "" : undefined}
				className={cn(className)}
				onClick={today}
				{...props}>
				{children ?? settings.i18n.labels.today}
			</Button>
		</NavTooltip>
	);
});

export const GanttNavPrev = React.forwardRef<HTMLElement, GanttNavButtonProps>(function GanttNavPrev({ className, children, tooltip, ...props }, ref): React.ReactElement {
	const { prev } = useGanttNavigation();
	const settings = useGanttSettings();
	const look = useNavButtonLook();
	const label = settings.i18n.labels.previous;
	return (
		<NavTooltip content={tooltip === undefined ? label : tooltip}>
			<Button ref={ref} variant={look.variant} size={look.iconSize} data-slot="gantt-nav-prev" aria-label={label} className={cn(className)} onClick={prev} {...props}>
				{children ?? <ChevronLeftIcon aria-hidden className="size-4 rtl:rotate-180" />}
			</Button>
		</NavTooltip>
	);
});

export const GanttNavNext = React.forwardRef<HTMLElement, GanttNavButtonProps>(function GanttNavNext({ className, children, tooltip, ...props }, ref): React.ReactElement {
	const { next } = useGanttNavigation();
	const settings = useGanttSettings();
	const look = useNavButtonLook();
	const label = settings.i18n.labels.next;
	return (
		<NavTooltip content={tooltip === undefined ? label : tooltip}>
			<Button ref={ref} variant={look.variant} size={look.iconSize} data-slot="gantt-nav-next" aria-label={label} className={cn(className)} onClick={next} {...props}>
				{children ?? <ChevronRightIcon aria-hidden className="size-4 rtl:rotate-180" />}
			</Button>
		</NavTooltip>
	);
});

export interface GanttTitleProps extends useRender.ComponentProps<"div"> {
	readonly format?: ((context: { readonly title: string }) => React.ReactNode) | undefined;
}

export const GanttTitle = React.forwardRef<HTMLDivElement, GanttTitleProps>(function GanttTitle(
	{ className, render, format: formatTitle, ...props },
	ref,
): React.ReactElement {
	const { title } = useGanttNavigation();
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{ "aria-live": "polite", className: cn("min-w-0 truncate text-sm font-semibold", className), children: formatTitle?.({ title }) ?? title },
			props,
		),
		state: { slot: "gantt-title" },
	});
});

export interface GanttScaleSwitcherProps extends Omit<React.ComponentProps<typeof Button>, "children" | "variant" | "size"> {
	readonly children?: React.ReactNode;
	/** Hover hint; defaults to the "Select view" label. Pass null to disable. */
	readonly tooltip?: React.ReactNode;
	/** The offered scales, in menu order. Default: all five. */
	readonly scales?: readonly GanttScale[] | undefined;
}

interface ScaleItemProps {
	readonly scale: GanttScale;
	readonly isActive: boolean;
	readonly label: string;
	readonly onSelect: (scale: GanttScale) => void;
}

function GanttScaleItem({ scale, isActive, label, onSelect }: ScaleItemProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(scale);
	}, [onSelect, scale]);
	return (
		<DropdownMenuItem data-active={isActive ? "" : undefined} aria-checked={isActive} onClick={handleClick}>
			{label}
		</DropdownMenuItem>
	);
}

/** Scale switcher ("Select view"): Day / Week / Month / Quarter / Year, as a dropdown button. */
export const GanttScaleSwitcher = React.forwardRef<HTMLButtonElement, GanttScaleSwitcherProps>(function GanttScaleSwitcher(
	{ className, children, tooltip, scales = GANTT_SCALES, ...props },
	ref,
): React.ReactElement {
	const { scale, setScale } = useGanttScale();
	const settings = useGanttSettings();
	const look = useNavButtonLook();
	const labels = settings.i18n.labels;
	// Controlled open: selecting a scale swaps the whole track subtree in the same click.
	const [isOpen, setOpen] = React.useState(false);
	// Hover-only tooltip: the menu re-focuses its trigger on close, which must not flash it.
	const [isTipOpen, setTipOpen] = React.useState(false);
	const handleOpenChange = React.useCallback((open: boolean): void => {
		setOpen(open);
		if (open) {
			setTipOpen(false);
		}
	}, []);
	const handleTipOpenChange = React.useCallback((open: boolean, details: { readonly reason: string }): void => {
		if (open && details.reason !== "trigger-hover") {
			return;
		}
		setTipOpen(open);
	}, []);
	const selectScale = React.useCallback(
		(next: GanttScale): void => {
			setOpen(false);
			setScale(next);
		},
		[setScale],
	);
	const isTooltipVisible = isTipOpen && !isOpen && tooltip !== null;
	return (
		<DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
			<Tooltip open={isTooltipVisible} onOpenChange={handleTipOpenChange}>
				<DropdownMenuTrigger
					ref={ref}
					render={
						<TooltipTrigger
							render={
								<Button
									variant={look.variant}
									size={look.size}
									data-slot="gantt-scale-switcher"
									aria-label={labels.selectView}
									className={cn("gap-1", className)}
									{...props}
								/>
							}
						/>
					}>
					{children ?? (
						<>
							{labels.scales[scale]}
							<ChevronDownIcon aria-hidden className="size-4 opacity-60" />
						</>
					)}
				</DropdownMenuTrigger>
				{isTooltipVisible ? <TooltipContent side="bottom">{tooltip ?? labels.selectView}</TooltipContent> : null}
			</Tooltip>
			<DropdownMenuContent align="start" className="min-w-36">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="font-normal text-muted-foreground">{labels.selectView}</DropdownMenuLabel>
					{scales.map((value: GanttScale): React.JSX.Element => (
						<GanttScaleItem key={value} scale={value} isActive={scale === value} label={labels.scales[value]} onSelect={selectScale} />
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
});

export interface GanttDatePickerProps {
	readonly className?: string | undefined;
}

/** Compact go-to-date picker (kit Calendar in a popover). No tooltip by design: it opens an overlay. */
export const GanttDatePicker = React.forwardRef<HTMLButtonElement, GanttDatePickerProps>(function GanttDatePicker({ className }, ref): React.ReactElement {
	const { date, goTo } = useGanttNavigation();
	const settings = useGanttSettings();
	const look = useNavButtonLook();
	const [isOpen, setOpen] = React.useState(false);
	const zoned = toZoned(date, settings.timeZone);
	const handleSelect = React.useCallback(
		(next: Date | undefined): void => {
			if (next !== undefined) {
				goTo(next);
				setOpen(false);
			}
		},
		[goTo],
	);
	return (
		<Popover open={isOpen} onOpenChange={setOpen}>
			<PopoverTrigger
				ref={ref}
				render={<Button variant={look.variant} size={look.iconSize} data-slot="gantt-date-picker" aria-label={settings.i18n.labels.goToDate} className={cn(className)} />}>
				<CalendarIcon aria-hidden className="size-4" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar mode="single" selected={zoned} defaultMonth={zoned} weekStartsOn={settings.weekStartsOn} onSelect={handleSelect} {...localeOptions(settings.locale)} />
			</PopoverContent>
		</Popover>
	);
});

export const ganttNavVariants = cva("flex min-w-0 items-center", {
	variants: {
		variant: {
			default: "flex-wrap border-b",
			plain: "flex-wrap",
		},
		size: {
			default: "gap-2 px-3 py-2",
			sm: "gap-1.5 px-2 py-1.5",
		},
		state: {
			default: "",
			sticky: "sticky top-0 z-sticky bg-background",
		},
	},
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

export interface GanttToolbarProps extends useRender.ComponentProps<"div">, Omit<VariantProps<typeof ganttNavVariants>, "state"> {}

/** Free slot for consumer toolbar buttons; pure layout shell. */
export const GanttToolbar = React.forwardRef<HTMLDivElement, GanttToolbarProps>(function GanttToolbar(
	{ className, render, variant = "plain", size, ...props },
	ref,
): React.ReactElement {
	const viewConfig = useGanttViewConfig();
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">({ className: cn(ganttNavVariants({ variant, size }), "px-0 py-0", viewConfig.classNames?.toolbar, className) }, props),
		state: { slot: "gantt-toolbar" },
	});
});

export interface GanttNavProps extends useRender.ComponentProps<"div">, Omit<VariantProps<typeof ganttNavVariants>, "state"> {}

/**
 * Default composed nav: Today, scale switcher, prev/next, title, spacer.
 * GanttDatePicker stays available for custom compositions. Pass children to
 * use it as a pure layout shell instead.
 */
export const GanttNav = React.forwardRef<HTMLDivElement, GanttNavProps>(function GanttNav({ className, render, children, variant, size, ...props }, ref): React.ReactElement {
	const viewConfig = useGanttViewConfig();
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				className: cn(ganttNavVariants({ variant, size, state: viewConfig.stickyNav ? "sticky" : "default" }), viewConfig.classNames?.nav, className),
				children: children ?? (
					<TooltipProvider delay={NAV_TOOLTIP_DELAY_MS} closeDelay={0} timeout={NAV_TOOLTIP_TIMEOUT_MS}>
						<GanttNavToday />
						<GanttScaleSwitcher />
						<div className="flex items-center">
							<GanttNavPrev />
							<GanttNavNext />
						</div>
						<GanttTitle />
						<div className="grow" />
					</TooltipProvider>
				),
			},
			props,
		),
		state: { slot: "gantt-nav" },
	});
});
