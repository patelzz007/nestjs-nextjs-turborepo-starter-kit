"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { useCallback, useState } from "react";
import { DateSelector, formatDateValue, type DateSelectorValue } from "@workspace/ui/components/date-selector";

import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";

export function DateSelector3Example(): React.JSX.Element {
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
		if (internalValue) {
			setValue(internalValue);
		}
		setOpen(false);
	}, [internalValue]);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					<Button variant="outline" className="w-56 justify-start">
						<CalendarIcon />
						{displayText}
					</Button>
				}
			/>
			<DialogContent className="sm:max-w-lg" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Select Due Date</DialogTitle>
				</DialogHeader>

				<DateSelector value={internalValue} onChange={setInternalValue} showInput />

				<DialogFooter>
					<DialogClose render={<Button variant="outline">Cancel</Button>} />
					<Button onClick={handleApply}>Apply</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
