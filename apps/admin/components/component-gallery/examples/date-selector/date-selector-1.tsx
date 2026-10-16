"use client";

import * as React from "react";
import { useState } from "react";
import { DateSelector, type DateSelectorValue } from "@workspace/ui/components/date-selector";
import { format } from "date-fns";

import { Card, CardContent } from "@workspace/ui/components/card";

const JSON_INDENT = 2;
const DEBUG_DATE_FORMAT = "MM/dd/yyyy";

/** The value as plain JSON, with its dates printed in the debug format rather than as ISO timestamps. */
function debugView(value: DateSelectorValue): Readonly<Record<string, string | number | DateSelectorValue["rangeStart"]>> {
	const { startDate, endDate, ...rest } = value;
	return {
		...rest,
		...(startDate === undefined ? {} : { startDate: format(startDate, DEBUG_DATE_FORMAT) }),
		...(endDate === undefined ? {} : { endDate: format(endDate, DEBUG_DATE_FORMAT) }),
	};
}

export function DateSelector1Example(): React.JSX.Element {
	const [value, setValue] = useState<DateSelectorValue | undefined>();

	return (
		<div className="flex w-full flex-col items-center gap-5">
			<Card className="p-0">
				<CardContent className="p-3">
					<DateSelector value={value} onChange={setValue} label="Due date" inputHint="Try: 2025, Q4, 05/10/2025" />
				</CardContent>
			</Card>

			{value ? (
				<pre className="w-full overflow-auto rounded-md bg-muted p-3 font-mono text-xs md:w-[500px]">{JSON.stringify(debugView(value), null, JSON_INDENT)}</pre>
			) : (
				<div className="text-sm text-muted-foreground">No value selected. Select a date to see the debug information.</div>
			)}
		</div>
	);
}
