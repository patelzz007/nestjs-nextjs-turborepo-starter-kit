import * as React from "react";
import { TimePicker } from "@workspace/ui/components/time-picker";

import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

export function TimePicker6Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<Field>
				<FieldLabel id="pickup-time-label" htmlFor="pickup-time">
					Pickup time
				</FieldLabel>
				{/* Hours outside the window are disabled. With no value the columns
            open on 08:30, the first time that can be chosen, and picking 08
            lands on 08:30 because 08:00 and 08:15 are before opening. */}
				<TimePicker id="pickup-time" minuteStep={15} min="08:30" max="17:30" aria-labelledby="pickup-time-label" aria-describedby="pickup-time-description" />
				<FieldDescription id="pickup-time-description">Open 08:30 to 17:30.</FieldDescription>
			</Field>
		</div>
	);
}
