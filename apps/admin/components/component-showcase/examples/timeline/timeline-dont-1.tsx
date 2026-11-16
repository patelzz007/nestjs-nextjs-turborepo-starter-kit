import * as React from "react";
import { Timeline, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@workspace/ui/components/timeline";

export function TimelineDont1Example(): React.JSX.Element {
	return (
		<Timeline defaultValue={0} className="w-full max-w-md">
			<TimelineItem step={1}>
				<TimelineHeader>
					<TimelineTitle>Build</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={2}>
				<TimelineHeader>
					<TimelineTitle>Tests</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={3}>
				<TimelineHeader>
					<TimelineTitle>Deploy</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
		</Timeline>
	);
}
