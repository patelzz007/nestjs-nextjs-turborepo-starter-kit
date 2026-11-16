"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import type { Locale } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import type * as React from "react";
import { useCallback, useState } from "react";

/** react-day-picker's range value, read off the kit Calendar's own props. */
type DateRange = NonNullable<Extract<React.ComponentProps<typeof Calendar>, { mode: "range" }>["selected"]>;

type Language = "en" | "zh";

interface LocalizedCopy {
	readonly title: string;
	readonly description: string;
	readonly locale: Locale;
}

const LOCALIZED_COPY: Readonly<Record<Language, LocalizedCopy>> = {
	en: { title: "Schedule a meeting", description: "Choose your preferred dates", locale: enUS },
	zh: { title: "安排会议", description: "选择您偏好的日期", locale: zhCN },
};

const LANGUAGE_OPTIONS: readonly SelectOption<Language>[] = [
	{ value: "zh", label: "Chinese" },
	{ value: "en", label: "English" },
];

/** The sample range: 9–17 February 2026 (`Date` months are 0-based). */
const FEBRUARY = 1;
const SAMPLE_YEAR = 2026;
const RANGE_START_DAY = 9;
const RANGE_END_DAY = 17;
const SAMPLE_RANGE_START = new Date(SAMPLE_YEAR, FEBRUARY, RANGE_START_DAY);

function initialRange(): DateRange {
	return { from: SAMPLE_RANGE_START, to: new Date(SAMPLE_YEAR, FEBRUARY, RANGE_END_DAY) };
}

export function Calendar23Example(): React.JSX.Element {
	const [language, setLanguage] = useState<Language>("en");
	const [dateRange, setDateRange] = useState<DateRange | undefined>(initialRange);
	const copy = LOCALIZED_COPY[language];

	const handleLanguageChange = useCallback((value: Language | null): void => {
		if (value !== null) {
			setLanguage(value);
		}
	}, []);

	return (
		<Card>
			<CardHeader className="flex items-center justify-between">
				<CardTitle>{copy.title}</CardTitle>
				<CardAction>
					<Select ariaLabel="Select language" items={LANGUAGE_OPTIONS} onValueChange={handleLanguageChange} value={language}>
						<SelectTrigger className="w-[100px]" fullWidth={false}>
							<SelectValue placeholder="Language" />
						</SelectTrigger>
						<SelectContent align="start">
							{LANGUAGE_OPTIONS.map((option: SelectOption<Language>): React.JSX.Element => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>

			<CardContent className="border-t pt-3">
				<p className="mb-2 text-sm text-muted-foreground">{copy.description}</p>
				<Calendar
					buttonVariant="ghost"
					className="w-full bg-transparent p-0"
					defaultMonth={SAMPLE_RANGE_START}
					locale={copy.locale}
					mode="range"
					numerals="latn"
					onSelect={setDateRange}
					selected={dateRange}
				/>
			</CardContent>
		</Card>
	);
}
