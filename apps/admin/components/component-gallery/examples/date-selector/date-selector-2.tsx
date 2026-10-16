"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { useCallback, useState } from "react";
import { DateSelector, formatDateValue, type DateSelectorValue } from "@workspace/ui/components/date-selector";

import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";

export function DateSelector2Example(): React.JSX.Element {
	const [value, setValue] = useState<DateSelectorValue | undefined>();
	const [open, setOpen] = useState(false);
	const [internalValue, setInternalValue] = useState<DateSelectorValue | undefined>(value);

	const labels = useUiKitLabels("dateSelector");

	const formattedValue = value ? formatDateValue(value, labels) : "";
	const displayText = formattedValue === "" ? "Select a date" : formattedValue;

	/** Opening starts the draft from the applied value; closing just closes. */
	const handleOpenChange = useCallback(
		(nextOpen: boolean): void => {
			if (nextOpen) {
				setInternalValue(value);
			}
			setOpen(nextOpen);
		},
		[value],
	);

	const handleApply = useCallback((): void => {
		setValue(internalValue);
		setOpen(false);
	}, [internalValue]);

	const handleCancel = useCallback((): void => {
		setInternalValue(value);
		setOpen(false);
	}, [value]);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				render={
					<Button variant="outline" className="w-56 justify-start">
						<CalendarIcon />
						{displayText}
					</Button>
				}
			/>
			<PopoverContent className="w-auto gap-3 p-0" align="start" sideOffset={4}>
				<div className="p-3">
					<DateSelector value={internalValue} onChange={setInternalValue} allowRange label="Due date" inputHint="Try: 2025, Q4, 05/10/2025" />
				</div>
				<Separator className="p-0" />
				<div className="flex justify-end gap-2 p-3 pt-0">
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button onClick={handleApply}>Apply</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
