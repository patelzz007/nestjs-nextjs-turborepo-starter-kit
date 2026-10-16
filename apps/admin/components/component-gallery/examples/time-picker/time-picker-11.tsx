"use client";

import * as React from "react";
import { useState } from "react";
import { TimePicker, TimePickerPanel, type TimePickerHourCycle, type TimePickerI18nOverrides, type TimePickerPeriodPosition } from "@workspace/ui/components/time-picker";

import { Card } from "@workspace/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

interface PickerLocale {
	lang: string;
	name: string;
	dir: "ltr" | "rtl";
	hourCycle: TimePickerHourCycle;
	periodPosition?: TimePickerPeriodPosition;
	i18n?: TimePickerI18nOverrides;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/* Module scope keeps each `i18n` object stable, so the picker merges it
   with the English defaults once, not on every render. English is the
   default config, so it passes none. */
const LOCALES: PickerLocale[] = [
	{ lang: "en", name: "English", dir: "ltr", hourCycle: 12 },
	{
		lang: "de",
		name: "Deutsch",
		dir: "ltr",
		/* A 24-hour clock has no period column, so `period`, `am` and `pm` are
       left out. */
		hourCycle: 24,
		i18n: {
			labels: {
				placeholder: "Uhrzeit wählen",
				hour: "Stunde",
				minute: "Minute",
				second: "Sekunde",
				now: "Jetzt",
				clear: "Löschen",
				confirm: "OK",
				panelLabel: "Uhrzeit wählen",
				openPicker: "Zeitauswahl öffnen",
			},
		},
	},
	{
		lang: "zh",
		name: "中文",
		dir: "ltr",
		hourCycle: 12,
		/* 上午 and 下午 come before the time, so the period column leads. */
		periodPosition: "start",
		i18n: {
			labels: {
				placeholder: "选择时间",
				hour: "时",
				minute: "分",
				second: "秒",
				period: "上午/下午",
				am: "上午",
				pm: "下午",
				now: "现在",
				clear: "清除",
				confirm: "确定",
				panelLabel: "选择时间",
				openPicker: "打开时间选择器",
			},
		},
	},
	{
		lang: "ar",
		name: "العربية",
		dir: "rtl",
		hourCycle: 12,
		i18n: {
			labels: {
				placeholder: "اختر الوقت",
				hour: "الساعة",
				minute: "الدقيقة",
				second: "الثانية",
				period: "ص/م",
				am: "ص",
				pm: "م",
				now: "الآن",
				clear: "مسح",
				confirm: "تم",
				panelLabel: "اختر الوقت",
				openPicker: "فتح منتقي الوقت",
			},
			functions: {
				/* A string map rather than Intl, so the server and the browser print
           the same digits. Column typeahead accepts both digit sets. */
				formatSegment: (value) =>
					String(value)
						.padStart(2, "0")
						.replace(/\d/g, (digit: string): string => ARABIC_DIGITS.at(Number(digit)) ?? digit),
			},
		},
	},
];

export function TimePicker11Example(): React.JSX.Element {
	/* One value for every tab: the language changes the labels and the
     clock, never the stored `HH:mm`. */
	const [value, setValue] = useState<string | null>("14:30");

	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-3">
			<Tabs defaultValue="en">
				<TabsList>
					{/* Each tab names its language in that language; `lang` lets a
              screen reader pronounce it. */}
					{LOCALES.map((locale) => (
						<TabsTrigger key={locale.lang} value={locale.lang} lang={locale.lang}>
							{locale.name}
						</TabsTrigger>
					))}
				</TabsList>
				{LOCALES.map((locale) => (
					<TabsContent key={locale.lang} value={locale.lang}>
						{/* Arabic mirrors the header and footer; the columns keep hour first. */}
						<div dir={locale.dir} lang={locale.lang}>
							<Card className="w-fit py-0">
								<TimePicker value={value} onValueChange={setValue} hourCycle={locale.hourCycle} periodPosition={locale.periodPosition} i18n={locale.i18n}>
									<TimePickerPanel />
								</TimePicker>
							</Card>
						</div>
					</TabsContent>
				))}
			</Tabs>
			<p role="status" className="text-sm text-muted-foreground">
				{value ? `Stored as ${value} in every language` : "No time stored"}
			</p>
		</div>
	);
}
