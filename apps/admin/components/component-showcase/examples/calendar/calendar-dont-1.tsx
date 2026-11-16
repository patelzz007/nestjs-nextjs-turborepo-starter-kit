import * as React from "react";
import { Calendar } from "@workspace/ui/components/calendar";
import { Label } from "@workspace/ui/components/label";

export function CalendarDont1Example(): React.JSX.Element {
	const [date, setDate] = React.useState<Date | undefined>();
	return (
		<div className="flex flex-col gap-2">
			<Label>Start date</Label>
			<Calendar mode="single" selected={date} onSelect={setDate} />
		</div>
	);
}
