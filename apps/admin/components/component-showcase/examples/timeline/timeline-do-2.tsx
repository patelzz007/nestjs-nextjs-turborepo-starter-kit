import * as React from "react";
import { Timeline, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@workspace/ui/components/timeline";

export function TimelineDo2Example(): React.JSX.Element {
	return (
		<Timeline defaultValue={2} orientation="horizontal" className="w-full max-w-md">
			<TimelineItem step={1}>
				<TimelineHeader>
					<TimelineTitle>Plan</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={2}>
				<TimelineHeader>
					<TimelineTitle>Build</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={3}>
				<TimelineHeader>
					<TimelineTitle>Launch</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
		</Timeline>
	);
}
