import { filterValueItems, type FilterOperator } from "@workspace/ui-kit-logic";
import { RangeSlider } from "@workspace/ui-native/components/range-slider";
import { Slider } from "@workspace/ui-native/components/slider";
import type { FilterBarEditorProps, FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";

import { FilterBar } from "./filters-sample";

const SCORE_MAX = 100;
const SPEND_MAX = 5000;
const SPEND_STEP = 50;
const RANGE: readonly FilterOperator[] = [{ value: "between", label: "is between", arity: "range" }];
const AT_MOST: readonly FilterOperator[] = [{ value: "lte", label: "is at most" }];

/** A health score span on a 0–100 track. */
function ScoreSlider({ value, onValueChange, field }: FilterBarEditorProps): React.JSX.Element {
	const [from = 0, to = SCORE_MAX] = filterValueItems(value).map(Number);
	const change = React.useCallback(
		(next: readonly number[]): void => {
			onValueChange([...next]);
		},
		[onValueChange],
	);
	return <RangeSlider thumbLabels={[`${field.label} from`, `${field.label} to`]} value={[from, to]} onChange={change} min={0} max={SCORE_MAX} />;
}

/** A spend ceiling, a thumb on a 0–5,000 track. */
function SpendSlider({ value, onValueChange, field }: FilterBarEditorProps): React.JSX.Element {
	const [current = SPEND_MAX] = filterValueItems(value).map(Number);
	const change = React.useCallback(
		(next: number): void => {
			onValueChange(next);
		},
		[onValueChange],
	);
	return <Slider accessibilityLabel={field.label} value={current} onChange={change} min={0} max={SPEND_MAX} step={SPEND_STEP} />;
}

const FIELDS: readonly FilterBarField[] = [
	{ id: "health", label: "Health score", type: "range", operators: RANGE, editor: ScoreSlider },
	{ id: "spend", label: "Monthly spend", type: "number", operators: AT_MOST, editor: SpendSlider, unit: " $/mo" },
];

// Sliders as the editors: drag a span of scores, or a ceiling on spend.
export function Filters6Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} />;
}
