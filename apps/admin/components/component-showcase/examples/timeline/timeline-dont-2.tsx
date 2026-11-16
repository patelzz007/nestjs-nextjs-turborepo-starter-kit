import * as React from "react";
import { Timeline, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@workspace/ui/components/timeline";

export function TimelineDont2Example(): React.JSX.Element {
	return (
		<Timeline defaultValue={3} orientation="horizontal" className="w-80">
			<TimelineItem step={1}>
				<TimelineHeader>
					<TimelineTitle>Discovery</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={2}>
				<TimelineHeader>
					<TimelineTitle>Planning</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={3}>
				<TimelineHeader>
					<TimelineTitle>Design</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={4}>
				<TimelineHeader>
					<TimelineTitle>Prototype</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={5}>
				<TimelineHeader>
					<TimelineTitle>Build</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={6}>
				<TimelineHeader>
					<TimelineTitle>Testing</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={7}>
				<TimelineHeader>
					<TimelineTitle>Launch</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
			<TimelineItem step={8}>
				<TimelineHeader>
					<TimelineTitle>Review</TimelineTitle>
				</TimelineHeader>
				<TimelineIndicator />
				<TimelineSeparator />
			</TimelineItem>
		</Timeline>
	);
}
