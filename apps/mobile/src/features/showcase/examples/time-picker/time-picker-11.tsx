import { SegmentedControl, type SegmentedOption } from "@workspace/ui-native/components/segmented-control";
import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";
import { View } from "react-native";
import type { TimePickerLabels } from "@workspace/ui-native/components/time-picker";

type Language = "en" | "ms" | "zh";

const LANGUAGES: readonly SegmentedOption<Language>[] = [
	{ value: "en", label: "EN" },
	{ value: "ms", label: "MS" },
	{ value: "zh", label: "中文" },
];

interface LocalizedLabels {
	readonly field: string;
	readonly picker: Partial<TimePickerLabels>;
}

const LABELS: Readonly<Record<Language, LocalizedLabels>> = {
	en: { field: "Time", picker: { periods: { am: "AM", pm: "PM" }, done: "Done" } },
	ms: { field: "Masa", picker: { periods: { am: "PG", pm: "PTG" }, hours: "Jam", minutes: "Minit", done: "Selesai" } },
	zh: { field: "时间", picker: { periods: { am: "上午", pm: "下午" }, hours: "时", minutes: "分", done: "完成" } },
};

export function TimePicker11Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>("15:30");
	const [language, setLanguage] = React.useState<"en" | "ms" | "zh">("en");
	return (
		<View className="gap-3">
			<SegmentedControl label="Language" options={LANGUAGES} value={language} onChange={setLanguage} size="sm" />
			<TimePicker label={LABELS[language].field} value={time} onChange={setTime} hourCycle={12} labels={LABELS[language].picker} />
		</View>
	);
}
