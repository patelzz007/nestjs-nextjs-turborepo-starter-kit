import * as React from "react";
import { Calendar } from "@workspace/ui/components/calendar";

export function CalendarDont2Example(): React.JSX.Element {
	const [date, setDate] = React.useState<Date | undefined>();
	return (
		<div className="flex flex-col gap-2">
			<Calendar mode="single" selected={date} onSelect={setDate} />
			<p className="text-sm text-destructive">That day has passed. Pick another.</p>
		</div>
	);
}
