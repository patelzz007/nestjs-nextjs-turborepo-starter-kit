import * as React from "react";
import { TimePicker } from "@workspace/ui/components/time-picker";

import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

export function TimePicker4Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<Field>
				<FieldLabel id="stream-live-label" htmlFor="stream-live">
					Stream goes live
				</FieldLabel>
				{/* Only the display is 12-hour: the trigger shows 02:45:30 PM while
            the value stays 24-hour `HH:mm:ss`, "14:45:30". The popover
            gets 4 columns, hour, minute, second and AM/PM. */}
				<TimePicker
					id="stream-live"
					hourCycle={12}
					granularity="second"
					defaultValue="14:45:30"
					aria-labelledby="stream-live-label"
					aria-describedby="stream-live-description"
				/>
				<FieldDescription id="stream-live-description">Pick the exact second the broadcast starts.</FieldDescription>
			</Field>
		</div>
	);
}
