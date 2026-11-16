import type { LocalDate } from "@workspace/shared";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

type Language = "en-GB" | "zh-CN";

const LANGUAGES: readonly ToggleGroupOption<Language>[] = [
	{ value: "en-GB", label: "English" },
	{ value: "zh-CN", label: "中文" },
];

const HEADINGS: Readonly<Record<Language, string>> = { "en-GB": "Pick a day", "zh-CN": "选择日期" };

export function Calendar23Example(): React.JSX.Element {
	const [language, setLanguage] = React.useState<Language | null>("en-GB");
	const [day, setDay] = React.useState<LocalDate | null>(SAMPLE_TODAY);
	const locale = language ?? "en-GB";
	return (
		<View className="gap-3">
			<View className="flex-row items-center justify-between">
				<Text accessibilityRole="header" className="font-sans-semibold text-body-lg text-foreground">
					{HEADINGS[locale]}
				</Text>
				<ToggleGroup type="single" label="Language" options={LANGUAGES} value={language} onChange={setLanguage} size="sm" spacing="attached" variant="outline" />
			</View>
			<Calendar today={SAMPLE_TODAY} minDate={SAMPLE_MIN_DATE} maxDate={SAMPLE_MAX_DATE} locale={locale} value={day} onChange={setDay} />
		</View>
	);
}
