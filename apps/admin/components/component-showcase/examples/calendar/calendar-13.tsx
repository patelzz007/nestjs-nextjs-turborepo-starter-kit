"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { addYears, eachMonthOfInterval, eachYearOfInterval, endOfYear, format, isAfter, isBefore, isSameMonth, startOfToday, startOfYear } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** How many years before and after this one the year view lists. */
const YEAR_SPAN = 10;

/** The state the caption label and the month grid share: react-day-picker renders them, so they read it from context. */
interface YearViewState {
	readonly isYearView: boolean;
	readonly toggleYearView: () => void;
	readonly years: readonly number[];
	/** The month the calendar shows. */
	readonly shownMonth: Date;
	readonly startDate: Date;
	readonly endDate: Date;
	/** The year whose months are listed, or `null` while the years are. */
	readonly selectedYear: number | null;
	readonly selectYear: (year: number | null) => void;
	readonly pickMonth: (month: Date) => void;
}

const YearViewContext = React.createContext<YearViewState | null>(null);

function useYearView(): YearViewState {
	const state = React.useContext(YearViewContext);
	if (state === null) {
		throw new Error("useYearView must be used inside the year-view calendar");
	}
	return state;
}

/** The caption: the month and year as a button that opens and closes the year view. */
function YearViewCaptionLabel({ children }: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
	const { isYearView, toggleYearView } = useYearView();

	return (
		<Button
			aria-expanded={isYearView}
			className="-ms-2 flex items-center gap-2 text-sm font-medium hover:bg-transparent data-[state=open]:text-muted-foreground/80 [&[data-state=open]>svg]:rotate-180"
			data-state={isYearView ? "open" : "closed"}
			onClick={toggleYearView}
			size="sm"
			variant="ghost">
			{children}
			<ChevronDownIcon aria-hidden="true" className="shrink-0 text-muted-foreground/80 transition-transform duration-200" />
		</Button>
	);
}

interface YearButtonProps {
	readonly year: number;
	readonly isCurrent: boolean;
	readonly onPick: (year: number) => void;
}

function YearButton({ year, isCurrent, onPick }: YearButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPick(year);
	}, [onPick, year]);

	return (
		<Button className="h-8" data-active={isCurrent} onClick={handleClick} size="sm" variant={isCurrent ? "default" : "outline"}>
			{year}
		</Button>
	);
}

interface MonthButtonProps {
	readonly month: Date;
	readonly isCurrent: boolean;
	readonly isDisabled: boolean;
	readonly onPick: (month: Date) => void;
}

function MonthButton({ month, isCurrent, isDisabled, onPick }: MonthButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPick(month);
	}, [month, onPick]);

	return (
		<Button className="h-8" data-active={isCurrent} disabled={isDisabled} onClick={handleClick} size="sm" variant={isCurrent ? "default" : "outline"}>
			{format(month, "MMM")}
		</Button>
	);
}

/** The months of `year`, each disabled when it falls outside the calendar's range. */
function MonthsOfYear({ year }: { readonly year: number }): React.JSX.Element {
	const { shownMonth, startDate, endDate, selectYear, pickMonth } = useYearView();
	const months = useMemo((): Date[] => {
		const firstDay = new Date(year, 0);
		return eachMonthOfInterval({ start: startOfYear(firstDay), end: endOfYear(firstDay) });
	}, [year]);

	const backToYears = useCallback((): void => {
		selectYear(null);
	}, [selectYear]);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<Button className="px-2" onClick={backToYears} size="sm" variant="ghost">
					<ChevronDownIcon aria-hidden="true" className="mr-1 size-4 rotate-90" />
					{year}
				</Button>
			</div>
			<div className="grid grid-cols-3 gap-2">
				{months.map((month: Date): React.JSX.Element => (
					<MonthButton
						isCurrent={isSameMonth(month, shownMonth)}
						isDisabled={isBefore(month, startOfYear(startDate)) || isAfter(month, endOfYear(endDate))}
						key={month.getTime()}
						month={month}
						onPick={pickMonth}
					/>
				))}
			</div>
		</div>
	);
}

/** The day grid, covered by the year view (years, then the picked year's months) while it is open. */
function YearViewMonthGrid({ children, ...tableProps }: React.TableHTMLAttributes<HTMLTableElement>): React.JSX.Element {
	const { isYearView, years, shownMonth, selectedYear, selectYear } = useYearView();
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	useEffect((): void => {
		if (isYearView) {
			scrollAreaRef.current?.querySelector("[data-active='true']")?.scrollIntoView({ block: "center" });
		}
	}, [isYearView, selectedYear]);

	return (
		<div className="relative">
			<table {...tableProps}>{children}</table>
			{isYearView ? (
				<div className="absolute inset-0 z-20 -m-2 bg-background">
					<div className="h-full" ref={scrollAreaRef}>
						<ScrollArea className="h-full">
							<div className="px-3 pt-1 pb-3">
								{selectedYear === null ? (
									<div className="grid grid-cols-4 gap-2">
										{years.map((year: number): React.JSX.Element => (
											<YearButton isCurrent={year === shownMonth.getFullYear()} key={year} onPick={selectYear} year={year} />
										))}
									</div>
								) : (
									<MonthsOfYear year={selectedYear} />
								)}
							</div>
						</ScrollArea>
					</div>
				</div>
			) : null}
		</div>
	);
}

/** The caption on the left, both arrows grouped on the right. */
const YEAR_VIEW_CLASS_NAMES: NonNullable<React.ComponentProps<typeof Calendar>["classNames"]> = {
	month_caption: "ms-2.5 justify-start",
	nav: "flex items-center w-full absolute inset-x-0 justify-end pointer-events-none [&>button]:pointer-events-auto",
};

const YEAR_VIEW_COMPONENTS: NonNullable<React.ComponentProps<typeof Calendar>["components"]> = {
	CaptionLabel: YearViewCaptionLabel,
	MonthGrid: YearViewMonthGrid,
};

// The caption is a label (not the kit's month / year dropdowns) so the custom
// caption button that opens the year view is what react-day-picker renders.
export function Calendar13Example(): React.JSX.Element {
	const [today] = useState<Date>(startOfToday);
	const [month, setMonth] = useState<Date>(today);
	const [date, setDate] = useState<Date | undefined>(today);
	const [isYearView, setIsYearView] = useState<boolean>(false);
	const [selectedYear, setSelectedYear] = useState<number | null>(null);

	const startDate = useMemo((): Date => startOfYear(addYears(today, -YEAR_SPAN)), [today]);
	const endDate = useMemo((): Date => endOfYear(addYears(today, YEAR_SPAN)), [today]);
	const years = useMemo((): readonly number[] => eachYearOfInterval({ start: startDate, end: endDate }).map((year: Date): number => year.getFullYear()), [endDate, startDate]);

	const toggleYearView = useCallback((): void => {
		if (isYearView) {
			setSelectedYear(null);
		}
		setIsYearView(!isYearView);
	}, [isYearView]);

	const pickMonth = useCallback((picked: Date): void => {
		setMonth(picked);
		setIsYearView(false);
		setSelectedYear(null);
	}, []);

	const yearView = useMemo(
		(): YearViewState => ({ isYearView, toggleYearView, years, shownMonth: month, startDate, endDate, selectedYear, selectYear: setSelectedYear, pickMonth }),
		[endDate, isYearView, month, pickMonth, selectedYear, startDate, toggleYearView, years],
	);

	return (
		<YearViewContext.Provider value={yearView}>
			<Card className="p-0">
				<CardContent className="p-0">
					<Calendar
						captionLayout="label"
						classNames={YEAR_VIEW_CLASS_NAMES}
						components={YEAR_VIEW_COMPONENTS}
						endMonth={endDate}
						mode="single"
						month={month}
						onMonthChange={setMonth}
						onSelect={setDate}
						selected={date}
						startMonth={startDate}
					/>
				</CardContent>
			</Card>
		</YearViewContext.Provider>
	);
}
