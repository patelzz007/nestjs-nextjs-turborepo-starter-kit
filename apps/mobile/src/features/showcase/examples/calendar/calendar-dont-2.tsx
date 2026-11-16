import type { LocalDate } from "@workspace/shared";
import { Text, View } from "react-native";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

export function CalendarDont2Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	return (
		<View className="gap-2">
			<Calendar today={SAMPLE_TODAY} minDate={SAMPLE_MIN_DATE} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={day} onChange={setDay} />
			<Text className="text-body font-sans text-destructive-foreground">{day !== null && day < SAMPLE_TODAY ? "That day has passed." : ""}</Text>
		</View>
	);
}
