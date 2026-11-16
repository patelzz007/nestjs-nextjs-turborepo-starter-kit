import { Button } from "@workspace/ui-native/components/button";
import { DateField } from "@workspace/ui-native/components/date-field";
import { TimePickerPanel } from "@workspace/ui-native/components/time-picker";
import * as React from "react";
import { Text, View } from "react-native";
import type { LocalDate } from "@workspace/shared";

import { ignorePress, SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_TODAY } from "../example-support";

export function TimePicker13Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	const [time, setTime] = React.useState<string | null>(null);
	return (
		<View className="gap-3">
			<DateField
				label="Day"
				value={day}
				onChange={setDay}
				minDate={SAMPLE_TODAY}
				maxDate={SAMPLE_MAX_DATE}
				today={SAMPLE_TODAY}
				locale={SAMPLE_LOCALE}
				placeholder="Pick a day"
			/>
			<TimePickerPanel value={time} onChange={setTime} minuteStep={15} />
			<Text className="text-body font-sans text-muted-foreground">{day === null || time === null ? "Pick a day and a time." : `Scheduled for ${day} at ${time}.`}</Text>
			<Button label="Schedule" disabled={day === null || time === null} onPress={ignorePress} />
		</View>
	);
}
