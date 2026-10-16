"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Combobox, ComboboxContent, ComboboxItem, ComboboxList, ComboboxSeparator, ComboboxTrigger } from "@workspace/ui/components/combobox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field } from "@workspace/ui/components/field";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, startOfDay, type Day } from "date-fns";
import { CalendarIcon, CalendarSearchIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

interface PresetDateOption {
	readonly type: "preset";
	readonly id: string;
	readonly label: string;
	readonly date: Date;
	readonly searchText: string;
}

interface CustomDateAction {
	readonly type: "custom";
	readonly id: "custom-date";
	readonly label: string;
	readonly searchText: string;
}

interface EmptyDateOption {
	readonly type: "none";
	readonly id: "no-date";
	readonly label: string;
	readonly searchText: string;
}

type DateOption = EmptyDateOption | PresetDateOption | CustomDateAction;

type DateSelectionValue =
	| { readonly type: "preset"; readonly id: string; readonly label: string; readonly date: Date }
	| { readonly type: "custom"; readonly label: string; readonly date: Date }
	| null;

const NO_DATE_OPTION: EmptyDateOption = {
	type: "none",
	id: "no-date",
	label: "No date",
	searchText: "No date clear date remove date empty",
};

const CUSTOM_DATE_OPTION: CustomDateAction = {
	type: "custom",
	id: "custom-date",
	label: "Custom date...",
	searchText: "Custom date custom day calendar picker choose a date manual date",
};

/** Weeks end on Sunday, so they start on Monday. */
const WEEK_STARTS_ON_MONDAY: Day = 1;
/** One day / week / month ahead of today, for the presets. */
const ONE_PERIOD_AHEAD = 1;
/** The custom-date dialog shows two months side by side. */
const CUSTOM_DATE_MONTHS = 2;
const SHORT_DATE_FORMAT = "MMM d";
const FULL_DATE_FORMAT = "dd/MM/yyyy";

const TRIGGER_BUTTON = <Button type="button" variant="outline" className="w-full justify-between font-normal" />;
const DISMISS_BUTTON = <Button variant="outline" size="sm" />;

function dateOptionSearchText(option: DateOption): string {
	return option.searchText;
}

function isDateOptionEqual(option: DateOption, value: DateOption): boolean {
	return option.id === value.id;
}

function getUpcomingWeekEnd(today: Date): Date {
	const weekEnd = endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON_MONDAY });
	return isSameDay(today, weekEnd) ? addWeeks(weekEnd, ONE_PERIOD_AHEAD) : weekEnd;
}

function getUpcomingMonthEnd(today: Date): Date {
	const monthEnd = endOfMonth(today);
	return isSameDay(today, monthEnd) ? endOfMonth(addMonths(today, ONE_PERIOD_AHEAD)) : monthEnd;
}

function presetOptionsFor(today: Date): readonly PresetDateOption[] {
	return [
		{ type: "preset", id: "tomorrow", label: "Tomorrow", date: addDays(today, ONE_PERIOD_AHEAD), searchText: "Tomorrow next day due date" },
		{ type: "preset", id: "end-of-week", label: "End of week", date: getUpcomingWeekEnd(today), searchText: "End of week Sunday week close target" },
		{ type: "preset", id: "in-one-week", label: "In one week", date: addWeeks(today, ONE_PERIOD_AHEAD), searchText: "In one week next week seven days target" },
		{ type: "preset", id: "end-of-month", label: "End of month", date: getUpcomingMonthEnd(today), searchText: "End of month month close month end target" },
		{ type: "preset", id: "in-one-month", label: "In one month", date: addMonths(today, ONE_PERIOD_AHEAD), searchText: "In one month next month thirty days target" },
	];
}

function CalendarGlyph(): React.JSX.Element {
	return <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />;
}

interface DateTriggerLabelProps {
	readonly value: DateSelectionValue;
	readonly placeholder: string;
}

function DateTriggerLabel({ value, placeholder }: DateTriggerLabelProps): React.JSX.Element {
	if (value === null) {
		return (
			<span className="flex min-w-0 items-center gap-2">
				<CalendarGlyph />
				<span className="truncate text-muted-foreground">{placeholder}</span>
			</span>
		);
	}

	return (
		<span className="flex min-w-0 items-center gap-2">
			<CalendarGlyph />
			<span className="truncate">{value.type === "custom" ? format(value.date, SHORT_DATE_FORMAT) : value.label}</span>
		</span>
	);
}

function DateOptionRow({ option }: { readonly option: DateOption }): React.JSX.Element {
	if (option.type === "none") {
		return (
			<span className="flex min-w-0 items-center gap-2">
				<CalendarGlyph />
				<span className="truncate">{option.label}</span>
			</span>
		);
	}

	if (option.type === "custom") {
		return (
			<span className="flex min-w-0 items-center gap-2">
				<CalendarSearchIcon className="size-4 shrink-0 text-muted-foreground" />
				<span className="truncate">{option.label}</span>
			</span>
		);
	}

	return (
		<span className="flex w-full min-w-0 items-center justify-between gap-3">
			<span className="flex min-w-0 items-center gap-2">
				<CalendarGlyph />
				<span className="truncate">{option.label}</span>
			</span>
			<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{format(option.date, FULL_DATE_FORMAT)}</span>
		</span>
	);
}

interface DateSelectionComboboxProps {
	readonly value: DateSelectionValue;
	readonly onValueChange: (value: DateSelectionValue) => void;
}

function DateSelectionCombobox({ value, onValueChange }: DateSelectionComboboxProps): React.JSX.Element {
	const today = useMemo((): Date => startOfDay(new Date()), []);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [draftDate, setDraftDate] = useState<Date | undefined>(undefined);

	const presetOptions = useMemo((): readonly PresetDateOption[] => presetOptionsFor(today), [today]);
	const dateOptions = useMemo((): readonly DateOption[] => [NO_DATE_OPTION, ...presetOptions, CUSTOM_DATE_OPTION], [presetOptions]);

	const activeOption = useMemo((): DateOption | null => {
		if (value === null) {
			return NO_DATE_OPTION;
		}
		return value.type === "preset" ? (presetOptions.find((option: PresetDateOption): boolean => option.id === value.id) ?? null) : null;
	}, [presetOptions, value]);

	const handleOptionChange = useCallback(
		(nextValue: DateOption | null): void => {
			if (nextValue === null) {
				return;
			}

			if (nextValue.type === "none") {
				onValueChange(null);
				return;
			}

			if (nextValue.type === "custom") {
				// Seed the picker with the current date (or tomorrow), then open it once the combobox popup has closed.
				setDraftDate(value?.date ?? addDays(today, ONE_PERIOD_AHEAD));
				window.requestAnimationFrame((): void => {
					setPickerOpen(true);
				});
				return;
			}

			onValueChange({ type: "preset", id: nextValue.id, label: nextValue.label, date: nextValue.date });
		},
		[onValueChange, today, value],
	);

	const handleConfirmCustomDate = useCallback((): void => {
		if (draftDate === undefined) {
			return;
		}

		onValueChange({ type: "custom", label: format(draftDate, SHORT_DATE_FORMAT), date: draftDate });
		setPickerOpen(false);
	}, [draftDate, onValueChange]);

	return (
		<>
			<Combobox
				items={dateOptions}
				value={activeOption}
				onValueChange={handleOptionChange}
				itemToStringValue={dateOptionSearchText}
				isItemEqualToValue={isDateOptionEqual}
				autoHighlight>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					<DateTriggerLabel value={value} placeholder="Set start" />
				</ComboboxTrigger>

				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxList>
						<ComboboxItem value={NO_DATE_OPTION}>
							<DateOptionRow option={NO_DATE_OPTION} />
						</ComboboxItem>
						<ComboboxSeparator />

						{presetOptions.map((option: PresetDateOption): React.JSX.Element => (
							<ComboboxItem key={option.id} value={option}>
								<DateOptionRow option={option} />
							</ComboboxItem>
						))}

						<ComboboxSeparator />
						<ComboboxItem value={CUSTOM_DATE_OPTION}>
							<DateOptionRow option={CUSTOM_DATE_OPTION} />
						</ComboboxItem>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>

			<Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
				<DialogContent className="flex w-auto max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden sm:max-w-none">
					<DialogHeader>
						<DialogTitle>Pick a date</DialogTitle>
					</DialogHeader>

					<div className="py-3">
						<Calendar
							mode="single"
							selected={draftDate}
							onSelect={setDraftDate}
							defaultMonth={draftDate ?? today}
							numberOfMonths={CUSTOM_DATE_MONTHS}
							pagedNavigation
							showOutsideDays={false}
						/>
					</div>

					<DialogFooter>
						<DialogClose render={DISMISS_BUTTON}>Dismiss</DialogClose>
						<Button size="sm" onClick={handleConfirmCustomDate} disabled={draftDate === undefined}>
							Confirm
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

export function Combobox25Example(): React.JSX.Element {
	const [startDate, setStartDate] = useState<DateSelectionValue>(null);

	return (
		<Field className="max-w-xs">
			<DateSelectionCombobox value={startDate} onValueChange={setStartDate} />
		</Field>
	);
}
