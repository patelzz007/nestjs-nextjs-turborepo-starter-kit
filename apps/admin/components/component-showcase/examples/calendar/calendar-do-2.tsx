import * as React from "react";
import { Calendar } from "@workspace/ui/components/calendar";
import { useSampleNow } from "@/components/component-showcase/examples/sample-clock";

export function CalendarDo2Example(): React.JSX.Element {
	const today = new Date(useSampleNow());
	const [date, setDate] = React.useState<Date | undefined>();
	return <Calendar mode="single" selected={date} onSelect={setDate} disabled={{ before: today }} />;
}
