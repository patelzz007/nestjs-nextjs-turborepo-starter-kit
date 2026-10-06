"use client";

import { Button, buttonVariants } from "@workspace/ui/components/button";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from "lucide-react";
import * as React from "react";
import { DayPicker, getDefaultClassNames, type ChevronProps, type DayButton, type Locale } from "react-day-picker";

/** react-day-picker's static base class names — computed once, not per render. */
const DEFAULT_CLASS_NAMES = getDefaultClassNames();

const Calendar = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<typeof DayPicker> & {
		buttonVariant?: React.ComponentProps<typeof Button>["variant"];
	}
>(function Calendar(
	{ className, classNames, showOutsideDays = true, captionLayout = "label", buttonVariant = "ghost", locale, formatters, components, ...props },
	ref,
): React.JSX.Element {
	const calendarComponents = React.useMemo(
		() => ({
			Root: ({ className: rootClassName, rootRef, ...rootProps }: React.ComponentProps<"div"> & { rootRef?: React.Ref<HTMLDivElement> }): React.JSX.Element => (
				<div data-slot="calendar" ref={mergeRefs(ref, rootRef)} className={cn(rootClassName)} {...rootProps} />
			),
			Chevron: ({ className, orientation, ...chevronProps }: ChevronProps): React.JSX.Element => {
				if (orientation === "left") return <ChevronLeftIcon className={cn("size-4 rtl:rotate-180", className)} {...chevronProps} />;

				if (orientation === "right") return <ChevronRightIcon className={cn("size-4 rtl:rotate-180", className)} {...chevronProps} />;

				if (orientation === "up") return <ChevronUpIcon className={cn("size-4", className)} {...chevronProps} />;

				return <ChevronDownIcon className={cn("size-4", className)} {...chevronProps} />;
			},
			DayButton: ({ ...dayButtonProps }: React.ComponentProps<typeof DayButton>): React.JSX.Element => <CalendarDayButton locale={locale} {...dayButtonProps} />,
			WeekNumber: ({ children, ...weekProps }: React.ComponentProps<"td">): React.JSX.Element => (
				<td {...weekProps}>
					<div className="flex size-(--cell-size) items-center justify-center text-center">{children}</div>
				</td>
			),
			...components,
		}),
		[components, locale, ref],
	);

	const calendarFormatters = React.useMemo(
		() => ({
			formatMonthDropdown: (date: Date): string => date.toLocaleString(locale?.code, { month: "short" }),
			...formatters,
		}),
		[formatters, locale],
	);

	const showWeekNumber = props.showWeekNumber === true;
	const calendarClassNames = React.useMemo(
		() => ({
			root: cn("w-fit", DEFAULT_CLASS_NAMES.root),
			months: cn("relative flex flex-col gap-4 md:flex-row", DEFAULT_CLASS_NAMES.months),
			month: cn("flex w-full flex-col gap-4", DEFAULT_CLASS_NAMES.month),
			nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", DEFAULT_CLASS_NAMES.nav),
			button_previous: cn(buttonVariants({ variant: buttonVariant }), "size-(--cell-size) p-0 select-none aria-disabled:opacity-50", DEFAULT_CLASS_NAMES.button_previous),
			button_next: cn(buttonVariants({ variant: buttonVariant }), "size-(--cell-size) p-0 select-none aria-disabled:opacity-50", DEFAULT_CLASS_NAMES.button_next),
			month_caption: cn("flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)", DEFAULT_CLASS_NAMES.month_caption),
			dropdowns: cn("flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium", DEFAULT_CLASS_NAMES.dropdowns),
			dropdown_root: cn("relative rounded-(--cell-radius)", DEFAULT_CLASS_NAMES.dropdown_root),
			dropdown: cn("absolute inset-0 bg-popover opacity-0", DEFAULT_CLASS_NAMES.dropdown),
			caption_label: cn(
				"font-medium select-none",
				captionLayout === "label" ? "text-sm" : "flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
				DEFAULT_CLASS_NAMES.caption_label,
			),
			month_grid: cn("w-full border-collapse", DEFAULT_CLASS_NAMES.month_grid),
			weekdays: cn("flex", DEFAULT_CLASS_NAMES.weekdays),
			weekday: cn("flex-1 rounded-(--cell-radius) text-[length:var(--text-calendar-caption)] font-normal text-muted-foreground select-none", DEFAULT_CLASS_NAMES.weekday),
			week: cn("mt-2 flex w-full", DEFAULT_CLASS_NAMES.week),
			week_number_header: cn("w-(--cell-size) select-none", DEFAULT_CLASS_NAMES.week_number_header),
			week_number: cn("text-[length:var(--text-calendar-caption)] text-muted-foreground select-none", DEFAULT_CLASS_NAMES.week_number),
			day: cn(
				"group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-e-(--cell-radius)",
				showWeekNumber ? "[&:nth-child(2)[data-selected=true]_button]:rounded-s-(--cell-radius)" : "[&:first-child[data-selected=true]_button]:rounded-s-(--cell-radius)",
				DEFAULT_CLASS_NAMES.day,
			),
			range_start: cn(
				"relative isolate z-0 rounded-s-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:end-0 after:w-4 after:bg-muted",
				DEFAULT_CLASS_NAMES.range_start,
			),
			range_middle: cn("rounded-none", DEFAULT_CLASS_NAMES.range_middle),
			range_end: cn(
				"relative isolate z-0 rounded-e-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:start-0 after:w-4 after:bg-muted",
				DEFAULT_CLASS_NAMES.range_end,
			),
			today: cn("rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none", DEFAULT_CLASS_NAMES.today),
			outside: cn("text-muted-foreground aria-selected:text-muted-foreground", DEFAULT_CLASS_NAMES.outside),
			disabled: cn("text-muted-foreground opacity-50", DEFAULT_CLASS_NAMES.disabled),
			hidden: cn("invisible", DEFAULT_CLASS_NAMES.hidden),
			...classNames,
		}),
		[buttonVariant, captionLayout, classNames, showWeekNumber],
	);

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn(
				"group/calendar bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(8)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
				String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
				String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
				className,
			)}
			captionLayout={captionLayout}
			locale={locale}
			formatters={calendarFormatters}
			classNames={calendarClassNames}
			components={calendarComponents}
			{...props}
		/>
	);
});

type CalendarDayButtonProps = React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> | undefined };

const CalendarDayButton = React.forwardRef<HTMLButtonElement, CalendarDayButtonProps>(function CalendarDayButton(
	{ className, day, modifiers, locale, ...props },
	forwardedRef,
): React.JSX.Element {
	// Keyboard navigation moves DOM focus to the day react-day-picker marks as focused.
	const focusRef = React.useRef<HTMLButtonElement>(null);
	const ref = React.useMemo(() => mergeRefs(focusRef, forwardedRef), [forwardedRef]);
	React.useEffect(() => {
		if (modifiers.focused) focusRef.current?.focus();
	}, [modifiers.focused]);

	return (
		<Button
			ref={ref}
			variant="ghost"
			size="icon"
			data-day={day.date.toLocaleDateString(locale?.code)}
			data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end ? !modifiers.range_middle : null}
			data-range-start={modifiers.range_start}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			className={cn(
				"relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-3 group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-e-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-s-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
				DEFAULT_CLASS_NAMES.day,
				className,
			)}
			{...props}
		/>
	);
});

export { Calendar, CalendarDayButton };
