import { Button } from "@workspace/ui-native/components/button";
import { DateSelector, DEFAULT_DATE_SELECTOR_LABELS } from "@workspace/ui-native/components/date-selector";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { Input } from "@workspace/ui-native/components/input";
import { type DateSelectorPeriodType, type DateSelectorValue, formatDateSelectorValue } from "@workspace/ui-native/lib/date-selector";
import * as React from "react";
import { View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

/** The years the selector offers. */
const MIN_YEAR = 2020;
const MAX_YEAR = 2030;
const TITLE = "Select due date";
const PERIODS: readonly DateSelectorPeriodType[] = ["day", "month"];
const NOTHING: DateSelectorValue = { period: "day", operator: "is" };

function ignoreTyping(): void {
	// The field is read only: the dialog sets it.
}

export function DateSelector3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<DateSelectorValue>(NOTHING);
	const [draft, setDraft] = React.useState<DateSelectorValue>(NOTHING);
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setDraft(value);
		setOpen(true);
	}, [value]);
	const cancel = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const apply = React.useCallback((): void => {
		setValue(draft);
		setOpen(false);
	}, [draft]);
	return (
		<View className="gap-2">
			<Input
				value={formatDateSelectorValue(value, DEFAULT_DATE_SELECTOR_LABELS)}
				onChange={ignoreTyping}
				editable={false}
				placeholder="No due date"
				accessibilityLabel="Due date"
			/>
			<Button label="Set due date" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
				</DialogHeader>
				<DateSelector
					today={SAMPLE_TODAY}
					minYear={MIN_YEAR}
					maxYear={MAX_YEAR}
					locale={SAMPLE_LOCALE}
					value={draft}
					onChange={setDraft}
					showInput={false}
					periodTypes={PERIODS}
				/>
				<DialogFooter>
					<Button label="Cancel" variant="outline" onPress={cancel} />
					<Button label="Apply" onPress={apply} />
				</DialogFooter>
			</Dialog>
		</View>
	);
}
