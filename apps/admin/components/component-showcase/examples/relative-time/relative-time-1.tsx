"use client";

import * as React from "react";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { useSampleNow } from "@/components/component-showcase/examples/sample-clock";
import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

interface RelativeExample {
	readonly label: string;
	/** Offset from now; negative is in the past. */
	readonly offsetMs: number;
}

const EXAMPLES: readonly RelativeExample[] = [
	{ label: "Five minutes ago", offsetMs: -5 * MINUTE_MS },
	{ label: "Three hours ago", offsetMs: -3 * HOUR_MS },
	{ label: "Two days ago", offsetMs: -2 * DAY_MS },
	{ label: "In one hour", offsetMs: HOUR_MS },
];

export function RelativeTime1Example(): React.JSX.Element {
	// One stable "now"; RelativeTime keeps each label current on its own.
	const nowEpochMs = useSampleNow();

	return (
		<dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
			{EXAMPLES.map((example: RelativeExample): React.JSX.Element => (
				<React.Fragment key={example.label}>
					<dt className="text-muted-foreground">{example.label}</dt>
					<dd>
						<RelativeTime epochMs={nowEpochMs + example.offsetMs} region={PLATFORM_DISPLAY_REGION} />
					</dd>
				</React.Fragment>
			))}
		</dl>
	);
}
