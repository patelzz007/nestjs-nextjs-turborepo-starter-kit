import * as React from "react";
import { GuidelineCalendar } from "@/components/component-showcase/examples/event-calendar/event-calendar-guideline-sample";

export function EventCalendarDont1Example(): React.JSX.Element {
	return <GuidelineCalendar initialView="month" legend />;
}
