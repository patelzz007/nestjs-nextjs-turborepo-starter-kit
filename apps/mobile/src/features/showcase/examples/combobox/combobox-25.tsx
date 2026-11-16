import type { LocalDate } from "@workspace/shared";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import { DateField } from "@workspace/ui-native/components/date-field";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_TODAY } from "../example-support";

/** The presets, each beside the date it stands for (from the examples' fixed "today", 15 November 2026). */
const PRESETS: readonly ComboboxOption<string>[] = [
	{ value: "today", label: "Today", trailing: <Text className="text-caption font-sans text-muted-foreground">Sun, 15 Nov</Text> },
	{ value: "tomorrow", label: "Tomorrow", trailing: <Text className="text-caption font-sans text-muted-foreground">Mon, 16 Nov</Text> },
	{ value: "next-week", label: "Next week", trailing: <Text className="text-caption font-sans text-muted-foreground">Mon, 23 Nov</Text> },
	{ value: "end-of-month", label: "End of month", trailing: <Text className="text-caption font-sans text-muted-foreground">Mon, 30 Nov</Text> },
	{ value: "custom", label: "Custom…", description: "Pick a day on a calendar" },
];

export function Combobox25Example(): React.JSX.Element {
	const [preset, setPreset] = React.useState<string | null>(null);
	const [day, setDay] = React.useState<LocalDate | null>(null);
	return (
		<View className="gap-3">
			<Combobox label="Due date" options={PRESETS} value={preset} onChange={setPreset} placeholder="Set due date" />
			{preset === "custom" ? (
				<DateField
					label="Custom date"
					value={day}
					onChange={setDay}
					minDate={SAMPLE_TODAY}
					maxDate={SAMPLE_MAX_DATE}
					today={SAMPLE_TODAY}
					locale={SAMPLE_LOCALE}
					placeholder="Pick a day"
				/>
			) : null}
		</View>
	);
}
