import * as React from "react";
import { ClockIcon } from "lucide-react";
import {
	TimePicker,
	TimePickerClear,
	TimePickerColumns,
	TimePickerConfirm,
	TimePickerContent,
	TimePickerFooter,
	TimePickerTrigger,
	TimePickerValue,
} from "@workspace/ui/components/time-picker";

import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

export function TimePicker9Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<Field>
				<FieldLabel id="doors-open-label" htmlFor="doors-open">
					Doors open
				</FieldLabel>
				{/* The zone is a fixed label, not a conversion: the value is the
            venue's wall-clock time. The label and the value name the trigger,
            so the zone joins them as its description. */}
				<TimePicker id="doors-open" defaultValue="19:30" aria-labelledby="doors-open-label" aria-describedby="doors-open-zone doors-open-description">
					<TimePickerTrigger>
						<TimePickerValue />
						<span id="doors-open-zone" className="ms-auto text-muted-foreground">
							Berlin time
						</span>
						{/* Children replace the default value and clock, so the clock is
                added back; `data-icon` keeps the button's end padding. */}
						<span data-icon="inline-end" aria-hidden="true" className="flex text-muted-foreground">
							<ClockIcon aria-hidden="true" />
						</span>
					</TimePickerTrigger>
					<TimePickerContent>
						<TimePickerColumns />
						{/* No Now: it would read the viewer's clock, not the venue's. */}
						<TimePickerFooter>
							<TimePickerClear />
							<TimePickerConfirm />
						</TimePickerFooter>
					</TimePickerContent>
				</TimePicker>
				<FieldDescription id="doors-open-description">Shown on every ticket in venue time, wherever the buyer is.</FieldDescription>
			</Field>
		</div>
	);
}
