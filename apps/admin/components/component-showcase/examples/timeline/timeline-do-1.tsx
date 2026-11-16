import * as React from "react";
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@workspace/ui/components/timeline";

export function TimelineDo1Example(): React.JSX.Element {
	return (
		<Timeline defaultValue={2} className="w-full max-w-md">
			<TimelineItem step={1}>
				<TimelineHeader>
					<TimelineDate>09:12</TimelineDate>
					<TimelineTitle>Build started</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
				<TimelineContent>Commit 4f2a1c on main.</TimelineContent>
			</TimelineItem>
			<TimelineItem step={2}>
				<TimelineHeader>
					<TimelineDate>09:15</TimelineDate>
					<TimelineTitle>Tests passed</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
				<TimelineContent>1,401 tests in 3 minutes.</TimelineContent>
			</TimelineItem>
			<TimelineItem step={3}>
				<TimelineHeader>
					<TimelineDate>09:18</TimelineDate>
					<TimelineTitle>Deploying</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
				<TimelineContent>Rolling out to 3 regions.</TimelineContent>
			</TimelineItem>
		</Timeline>
	);
}
