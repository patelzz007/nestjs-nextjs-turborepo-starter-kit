"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

export function Calendar1Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(startOfToday);

	return (
		<Card className="p-0">
			<CardContent className="p-0">
				<Calendar mode="single" onSelect={setDate} selected={date} />
			</CardContent>
		</Card>
	);
}
