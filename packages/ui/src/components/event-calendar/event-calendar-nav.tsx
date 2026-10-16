"use client";

// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-nav.json): the
// composable navigation — Today, prev/next, the period title, the view switcher
// dropdown, an optional go-to-date picker and a free toolbar slot. Component
// names and the `showViewSwitcher` / `format` props match ReUI. Deviations:
// - Buttons are the kit `Button` / `buttonVariants`, sized and styled by the
//   view config's `navButtonVariant` / `navButtonSize`; every icon-only button
//   carries its label as the accessible name.
// - The nav tooltips (`tooltip` props, `navTooltips`) and Base UI `render`
//   props are not ported.
// - `EventCalendarDatePicker` always picks a single date (ReUI highlighted the
//   active range for week/N-days/agenda); its `mode` prop is dropped.
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/core/utils";
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

import {
	useEventCalendar,
	useEventCalendarNavigation,
	useEventCalendarView,
	useEventCalendarViewConfig,
	type EventCalendarNavButtonSize,
	type EventCalendarNavButtonVariant,
} from "./event-calendar";
import { getViewName } from "./event-calendar-i18n";
import { toZoned } from "./event-calendar-lib";
import type { CalendarView } from "./event-calendar-types";

type ButtonSize = "sm" | "default" | "icon-sm" | "icon";

interface NavButtonStyle {
	readonly variant: EventCalendarNavButtonVariant;
	readonly size: ButtonSize;
	readonly iconSize: ButtonSize;
	readonly className: string | undefined;
}

const ICON_SIZES: Readonly<Record<EventCalendarNavButtonSize, ButtonSize>> = { sm: "icon-sm", default: "icon" };

function useNavButtonStyle(): NavButtonStyle {
	const viewConfig = useEventCalendarViewConfig();
	return { variant: viewConfig.navButtonVariant, size: viewConfig.navButtonSize, iconSize: ICON_SIZES[viewConfig.navButtonSize], className: viewConfig.classNames?.navButton };
}

export type EventCalendarNavButtonProps = Omit<React.ComponentPropsWithoutRef<typeof Button>, "variant" | "size">;

/** The click event the kit Button hands its `onClick` (a Base UI event). */
type NavButtonClickEvent = Parameters<NonNullable<EventCalendarNavButtonProps["onClick"]>>[0];

/** Jumps to the period containing today. */
export const EventCalendarNavToday = React.forwardRef<HTMLElement, EventCalendarNavButtonProps>(function EventCalendarNavToday(
	{ className, children, onClick, ...props },
	forwardedRef,
): React.JSX.Element {
	const { today, isToday } = useEventCalendarNavigation();
	const { settings } = useEventCalendar();
	const style = useNavButtonStyle();
	const handleClick = React.useCallback(
		(event: NavButtonClickEvent): void => {
			onClick?.(event);
			today();
		},
		[onClick, today],
	);
	return (
		<Button
			ref={forwardedRef}
			variant={style.variant}
			size={style.size}
			data-slot="event-calendar-nav-today"
			data-active={isToday ? "" : undefined}
			className={cn(style.className, className)}
			onClick={handleClick}
			{...props}>
			{children ?? settings.i18n.labels.today}
		</Button>
	);
});

/** Steps one period back. */
export const EventCalendarNavPrev = React.forwardRef<HTMLElement, EventCalendarNavButtonProps>(function EventCalendarNavPrev(
	{ className, children, onClick, ...props },
	forwardedRef,
): React.JSX.Element {
	const { prev } = useEventCalendarNavigation();
	const { settings } = useEventCalendar();
	const style = useNavButtonStyle();
	const handleClick = React.useCallback(
		(event: NavButtonClickEvent): void => {
			onClick?.(event);
			prev();
		},
		[onClick, prev],
	);
	return (
		<Button
			ref={forwardedRef}
			variant={style.variant}
			size={style.iconSize}
			data-slot="event-calendar-nav-prev"
			aria-label={settings.i18n.labels.previous}
			className={cn(style.className, className)}
			onClick={handleClick}
			{...props}>
			{children ?? <ChevronLeftIcon aria-hidden className="size-4 rtl:rotate-180" />}
		</Button>
	);
});

/** Steps one period forward. */
export const EventCalendarNavNext = React.forwardRef<HTMLElement, EventCalendarNavButtonProps>(function EventCalendarNavNext(
	{ className, children, onClick, ...props },
	forwardedRef,
): React.JSX.Element {
	const { next } = useEventCalendarNavigation();
	const { settings } = useEventCalendar();
	const style = useNavButtonStyle();
	const handleClick = React.useCallback(
		(event: NavButtonClickEvent): void => {
			onClick?.(event);
			next();
		},
		[onClick, next],
	);
	return (
		<Button
			ref={forwardedRef}
			variant={style.variant}
			size={style.iconSize}
			data-slot="event-calendar-nav-next"
			aria-label={settings.i18n.labels.next}
			className={cn(style.className, className)}
			onClick={handleClick}
			{...props}>
			{children ?? <ChevronRightIcon aria-hidden className="size-4 rtl:rotate-180" />}
		</Button>
	);
});

export interface EventCalendarTitleProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
	/** Wraps the formatted title (e.g. to add a badge). */
	readonly format?: (context: { readonly title: string }) => React.ReactNode;
}

/** The period title, announced politely when it changes. */
export const EventCalendarTitle = React.forwardRef<HTMLDivElement, EventCalendarTitleProps>(function EventCalendarTitle(
	{ className, format, ...props },
	forwardedRef,
): React.JSX.Element {
	const { title } = useEventCalendarNavigation();
	const viewConfig = useEventCalendarViewConfig();
	return (
		<div
			ref={forwardedRef}
			aria-live="polite"
			data-slot="event-calendar-title"
			className={cn("min-w-0 truncate text-sm font-semibold", viewConfig.classNames?.title, className)}
			{...props}>
			{format?.({ title }) ?? title}
		</div>
	);
});

function ViewShortcut({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	const viewConfig = useEventCalendarViewConfig();
	return (
		<kbd
			aria-hidden
			data-slot="event-calendar-view-shortcut"
			className={cn(
				"ms-auto inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-border font-sans text-xs text-muted-foreground",
				viewConfig.classNames?.viewShortcut,
			)}>
			{children}
		</kbd>
	);
}

interface ViewOptionProps {
	readonly view: CalendarView;
	readonly dayCount: number | undefined;
	readonly active: boolean;
	readonly label: string;
	readonly shortcut: string | undefined;
	readonly onSelect: (view: CalendarView, dayCount: number | undefined) => void;
}

function ViewOption({ view, dayCount, active, label, shortcut, onSelect }: ViewOptionProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(view, dayCount);
	}, [onSelect, view, dayCount]);
	return (
		<DropdownMenuItem data-active={active ? "" : undefined} aria-current={active ? "true" : undefined} onClick={handleClick}>
			{label}
			{shortcut === undefined ? null : <ViewShortcut>{shortcut}</ViewShortcut>}
		</DropdownMenuItem>
	);
}

export type EventCalendarViewSwitcherProps = Omit<React.ComponentPropsWithoutRef<"button">, "children"> & { readonly children?: React.ReactNode };

/** Dropdown listing the available views (and the N-day presets). */
export const EventCalendarViewSwitcher = React.forwardRef<HTMLButtonElement, EventCalendarViewSwitcherProps>(function EventCalendarViewSwitcher(
	{ className, children, ...props },
	forwardedRef,
): React.JSX.Element {
	const { view, dayCount, availableViews, viewName, setView } = useEventCalendarView();
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const style = useNavButtonStyle();
	const [open, setOpen] = React.useState(false);
	const { labels, viewNames } = settings.i18n;

	const handleSelect = React.useCallback(
		(next: CalendarView, nextDayCount: number | undefined): void => {
			setOpen(false);
			setView(next, nextDayCount === undefined ? undefined : { dayCount: nextDayCount });
		},
		[setOpen, setView],
	);
	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			setOpen(next);
		},
		[setOpen],
	);

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger
				ref={forwardedRef}
				data-slot="event-calendar-view-switcher"
				aria-label={labels.selectView}
				className={cn(buttonVariants({ variant: style.variant, size: style.size }), "gap-1", style.className, className)}
				{...props}>
				{children ?? (
					<>
						{viewName}
						<ChevronDownIcon aria-hidden className="size-4 opacity-60" />
					</>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className={cn("min-w-44", viewConfig.classNames?.viewSwitcherContent)}>
				<DropdownMenuGroup>
					<DropdownMenuLabel className={cn("font-normal text-muted-foreground", viewConfig.classNames?.viewSwitcherLabel)}>{labels.selectView}</DropdownMenuLabel>
					{availableViews.flatMap((option: CalendarView): React.JSX.Element[] =>
						option === "days"
							? viewConfig.dayCountPresets.map((count: number): React.JSX.Element => (
									<ViewOption
										key={`days-${String(count)}`}
										view="days"
										dayCount={count}
										active={view === "days" ? dayCount === count : false}
										label={viewNames.days(count)}
										shortcut={viewConfig.enableShortcuts ? labels.viewShortcuts.days : undefined}
										onSelect={handleSelect}
									/>
								))
							: [
									<ViewOption
										key={option}
										view={option}
										dayCount={undefined}
										active={view === option}
										label={getViewName(viewNames, option, dayCount)}
										shortcut={viewConfig.enableShortcuts ? labels.viewShortcuts[option] : undefined}
										onSelect={handleSelect}
									/>,
								],
					)}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
});

export type EventCalendarDatePickerProps = Omit<React.ComponentPropsWithoutRef<"button">, "children"> & { readonly children?: React.ReactNode };

/** Optional go-to-date picker (the kit Calendar in a popover); not part of the default nav. */
export const EventCalendarDatePicker = React.forwardRef<HTMLButtonElement, EventCalendarDatePickerProps>(function EventCalendarDatePicker(
	{ className, children, ...props },
	forwardedRef,
): React.JSX.Element {
	const { date, goTo } = useEventCalendarNavigation();
	const { settings } = useEventCalendar();
	const viewConfig = useEventCalendarViewConfig();
	const style = useNavButtonStyle();
	const [open, setOpen] = React.useState(false);
	const { timeZone, locale, weekStartsOn, i18n } = settings;
	const zoned = React.useMemo((): Date => toZoned(date, timeZone), [date, timeZone]);
	const handleSelect = React.useCallback(
		(next: Date | undefined): void => {
			if (next === undefined) {
				return;
			}
			goTo(next);
			setOpen(false);
		},
		[goTo, setOpen],
	);
	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			setOpen(next);
		},
		[setOpen],
	);
	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				ref={forwardedRef}
				data-slot="event-calendar-date-picker"
				aria-label={i18n.labels.goToDate}
				className={cn(buttonVariants({ variant: style.variant, size: style.iconSize }), style.className, className)}
				{...props}>
				{children ?? <CalendarIcon aria-hidden className="size-4" />}
			</PopoverTrigger>
			<PopoverContent align="start" className={cn("w-auto p-0", viewConfig.classNames?.datePickerContent)}>
				<Calendar mode="single" selected={zoned} defaultMonth={zoned} onSelect={handleSelect} weekStartsOn={weekStartsOn} {...(locale === undefined ? {} : { locale })} />
			</PopoverContent>
		</Popover>
	);
});

export type EventCalendarToolbarProps = React.ComponentPropsWithoutRef<"div">;

/** Free slot for consumer toolbar buttons; pure layout shell. */
export const EventCalendarToolbar = React.forwardRef<HTMLDivElement, EventCalendarToolbarProps>(function EventCalendarToolbar(
	{ className, ...props },
	forwardedRef,
): React.JSX.Element {
	const viewConfig = useEventCalendarViewConfig();
	return <div ref={forwardedRef} data-slot="event-calendar-toolbar" className={cn("flex items-center gap-2", viewConfig.classNames?.toolbar, className)} {...props} />;
});

export interface EventCalendarNavProps extends React.ComponentPropsWithoutRef<"div"> {
	/** Render the view switcher in the composed layout. @default true */
	readonly showViewSwitcher?: boolean;
}

/** Default composed nav: Today, view switcher, prev/next, title. Pass children to use it as a layout shell. */
export const EventCalendarNav = React.forwardRef<HTMLDivElement, EventCalendarNavProps>(function EventCalendarNav(
	{ className, children, showViewSwitcher = true, ...props },
	forwardedRef,
): React.JSX.Element {
	const viewConfig = useEventCalendarViewConfig();
	return (
		<div ref={forwardedRef} data-slot="event-calendar-nav" className={cn("flex min-w-0 flex-wrap items-center gap-1 p-2", viewConfig.classNames?.nav, className)} {...props}>
			{children ?? (
				<>
					<EventCalendarNavToday />
					{showViewSwitcher ? <EventCalendarViewSwitcher /> : null}
					<div className="flex items-center">
						<EventCalendarNavPrev />
						<EventCalendarNavNext />
					</div>
					<EventCalendarTitle className="ms-3" />
					<div className="grow" />
				</>
			)}
		</div>
	);
});
