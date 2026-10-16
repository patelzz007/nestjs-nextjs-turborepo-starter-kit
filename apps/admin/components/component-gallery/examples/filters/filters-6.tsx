"use client";

import { isArrayValue, isNumberPrimitive } from "@workspace/shared";
import { ActivityIcon, BanknoteIcon, Building2Icon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import {
	isFilterValueList,
	type FilterEditor,
	type FilterEditorProps,
	type FilterField,
	type FilterQuery,
	type FilterValue,
	type FilterValueDisplayContext,
} from "@workspace/ui/components/filters/filters-types";
import { Slider } from "@workspace/ui/components/slider";

/**
 * A field's bounds and its formatter, declared once.
 *
 * Three things measure against them - the thumb, the miniature rail the closed
 * chip draws, and the sentence the chip announces - so a scale that lived
 * inside the editor would let the other two be drawn against bounds the thumb
 * never moved in.
 */
interface Scale {
	readonly min: number;
	readonly max: number;
	readonly step: number;
	readonly format: (value: number) => string;
}

/** Health score bounds. */
const SCORE_MAX = 100;
/** Monthly spend ceiling and step, in dollars. */
const PRICE_MAX = 5000;
const PRICE_STEP = 50;
/** A fraction of the rail expressed as a CSS percentage. */
const PERCENT = 100;

const SCORE: Scale = {
	min: 0,
	max: SCORE_MAX,
	step: 1,
	format: (value: number): string => String(value),
};

const PRICE: Scale = {
	min: 0,
	max: PRICE_MAX,
	step: PRICE_STEP,
	format: (value: number): string => `$${value.toLocaleString()}`,
};

/** Two bounds of a range operator. */
type Band = readonly [from: number, to: number];

/** The stored value as a band, when it is a list of two numbers. */
function bandOf(value: FilterValue | undefined): Band | undefined {
	if (!isFilterValueList(value)) return undefined;
	const [from, to] = value;
	return isNumberPrimitive(from) && isNumberPrimitive(to) ? [from, to] : undefined;
}

/** The stored value as one number, when it is one. */
function numberOf(value: FilterValue | undefined): number | undefined {
	return isNumberPrimitive(value) ? value : undefined;
}

/**
 * A control with its own pointer model, as the value editor.
 *
 * The editor renders into a plain panel, never into a combobox, so a slider
 * keeps its own drag, its own arrow keys and its own focus ring. It decides for
 * itself what commit means: here the draft moves with the thumb and only Apply
 * writes it into the query, so a controlled parent is not asked to re-render
 * once per pixel.
 */
function makeSliderEditor({ min, max, step, format }: Scale): FilterEditor {
	const fullBand: Band = [min, max];

	function SliderEditor({ value, onValueChange, commit, cancel, labels, field, operator, autoFocusProps }: FilterEditorProps): React.JSX.Element {
		// Arity decides the shape: a range operator carries two bounds, everything
		// else carries one. The same editor answers both, so a field does not need
		// a second component to be filtered "between 30 and 70".
		const dual = operator.arity === "range";
		const band = bandOf(value) ?? fullBand;
		const single = numberOf(value) ?? min;
		const current: FilterValue = dual ? band : single;
		const [bandFrom, bandTo] = band;
		const reading = dual ? labels.valueRange(format(bandFrom), format(bandTo)) : format(single);

		// On the slider rather than on the panel: the arrows are the thumb's, so
		// Enter is free to mean Apply for the keyboard user standing on it. Escape
		// stops here too, so a dialog around the bar does not close with the popover.
		const handleKeyDown = React.useCallback(
			(event: React.KeyboardEvent<HTMLDivElement>): void => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit(current);
					return;
				}
				if (event.key !== "Escape") return;
				event.preventDefault();
				event.stopPropagation();
				cancel();
			},
			[cancel, commit, current],
		);

		// A scalar value renders one thumb, a list renders one per item. The
		// slider hands back the same shape it was given.
		const handleValueChange = React.useCallback(
			(next: number | readonly number[]): void => {
				if (isArrayValue(next)) {
					const [from, to] = next;
					if (from !== undefined && to !== undefined) {
						const nextBand: Band = [from, to];
						onValueChange(nextBand);
					}
					return;
				}
				onValueChange(next);
			},
			[onValueChange],
		);

		const handleApply = React.useCallback((): void => {
			commit(current);
		}, [commit, current]);

		return (
			// `gap-2 p-2` is the primitive's own editor panel, and the width sits in
			// the band its built-ins use, so the popover does not resize between a
			// shipped editor and this one.
			<div className="flex w-64 flex-col gap-2 p-2">
				<div className="flex items-baseline justify-between gap-2">
					<span className="min-w-0 truncate text-xs font-medium text-muted-foreground">{field.label}</span>
					{/* The one dark thing in the panel: the number being edited. */}
					<span className="shrink-0 text-sm font-medium tabular-nums">{reading}</span>
				</div>

				{/* The bounds FLANK the track: they belong at the ends they name. */}
				<div className="flex items-center gap-2">
					<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{format(min)}</span>
					<Slider
						{...autoFocusProps}
						className="min-w-0 flex-1"
						value={dual ? band : single}
						min={min}
						max={max}
						step={step}
						onValueChange={handleValueChange}
						onKeyDown={handleKeyDown}
					/>
					<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{format(max)}</span>
				</div>

				<div className="flex items-center justify-end gap-1.5 pt-1">
					<Button variant="ghost" size="sm" onClick={cancel}>
						{labels.discard}
					</Button>
					<Button size="sm" onClick={handleApply}>
						{labels.apply}
					</Button>
				</div>
			</div>
		);
	}

	return SliderEditor;
}

/* -------------------------------------------------------------------------- */
/*                             The closed chip                                */
/* -------------------------------------------------------------------------- */

interface MiniTrackProps {
	readonly min: number;
	readonly max: number;
	readonly from: number;
	readonly to: number;
}

/** The selected span as a rail. `bg-muted` and `bg-primary` are the Slider's own. */
function MiniTrack({ min, max, from, to }: MiniTrackProps): React.JSX.Element {
	const span = max - min;
	// Total on purpose: a restored query can hold whatever was persisted, and a
	// non-finite bound here would reach the style attribute as "left: NaN%".
	const at = (value: number): number => (span <= 0 || !Number.isFinite(value) ? 0 : Math.min(Math.max((value - min) / span, 0), 1));
	const start = at(from);
	const end = Math.max(start, at(to));
	const fillStyle = React.useMemo((): React.CSSProperties => ({ left: `${String(start * PERCENT)}%`, right: `${String((1 - end) * PERCENT)}%` }), [start, end]);

	return (
		<span aria-hidden="true" className="relative inline-block h-1 w-8 shrink-0 rounded-full bg-muted">
			<span className="absolute inset-y-0 rounded-full bg-primary" style={fillStyle} />
		</span>
	);
}

interface BandReading {
	readonly from: number;
	readonly to: number;
	readonly text: string;
}

/**
 * The one reading behind both halves of the chip. The rail is drawn from it and
 * the accessible name is spoken from it, so the two cannot drift.
 */
function readBand({ min, max, format }: Scale, { value, operator, labels }: FilterValueDisplayContext): BandReading | null {
	const band = bandOf(value);
	if (band !== undefined) {
		const [from, to] = band;
		return { from, to, text: labels.valueRange(format(from), format(to)) };
	}
	const single = numberOf(value);
	if (single === undefined) return null;

	// Which side of the value the matching range lies on: "at least $1,500"
	// fills from the value up, "at most" fills from the floor to it.
	const upward = operator.value === "gte" || operator.value === "gt";
	return {
		from: upward ? single : min,
		to: upward ? max : single,
		text: format(single),
	};
}

interface SliderDisplay {
	readonly renderValue: (context: FilterValueDisplayContext) => React.ReactNode;
	readonly valueText: (context: FilterValueDisplayContext) => string;
}

/**
 * A slider readout on the chip, not just the number the slider produced.
 *
 * "$1,500" alone says nothing about where in the field's range the rule sits,
 * which is the one thing a slider is picked for, so the closed chip carries a
 * miniature of the control behind it and the scale that miniature is measured
 * against follows the value as SECONDARY text - the muted, smaller companion
 * the first example sets beside its stacked avatars. `renderValue` returns a
 * NODE, so all of it costs the primitive nothing.
 *
 * `valueText` is the same reading as a sentence, and it is supplied for a
 * reason: the built-in name is `String(value)`, which announces "1500" where
 * the chip shows "$1,500", so a field that formats its value owns the
 * accessible name too. The scale is left out of THAT half, because it describes
 * a miniature a screen reader user is not being shown.
 */
function makeSliderDisplay(scale: Scale, empty: string): SliderDisplay {
	const { min, max, format } = scale;

	return {
		renderValue: (context: FilterValueDisplayContext): React.ReactNode => {
			const band = readBand(scale, context);
			if (band === null) return empty;

			return (
				<span className="flex items-center gap-1.5">
					<MiniTrack min={min} max={max} from={band.from} to={band.to} />
					<span className="flex items-baseline gap-1">
						<span className="tabular-nums">{band.text}</span>
						{/* Dropped when the value already names the ceiling, so no chip prints one number twice. */}
						{band.text.includes(format(max)) ? null : <span className="text-xs text-muted-foreground tabular-nums">/ {format(max)}</span>}
					</span>
				</span>
			);
		},
		valueText: (context: FilterValueDisplayContext): string => readBand(scale, context)?.text ?? empty,
	};
}

const ScoreSlider = makeSliderEditor(SCORE);
const scoreDisplay = makeSliderDisplay(SCORE, "any score");

const PriceSlider = makeSliderEditor(PRICE);
const priceDisplay = makeSliderDisplay(PRICE, "any amount");

const FIELDS: readonly FilterField[] = [
	{
		id: "score",
		label: "Health score",
		type: "range",
		defaultOperator: "between",
		// A component, so no registration is needed. A string here would look the
		// editor up in the `editors` map instead.
		editor: ScoreSlider,
		renderValue: scoreDisplay.renderValue,
		valueText: scoreDisplay.valueText,
		icon: <ActivityIcon />,
	},
	{
		id: "mrr",
		label: "Monthly spend",
		type: "number",
		// Single-value operators, so the same editor renders one thumb.
		defaultOperator: "gte",
		editor: PriceSlider,
		renderValue: priceDisplay.renderValue,
		valueText: priceDisplay.valueText,
		icon: <BanknoteIcon />,
	},
	{
		id: "account",
		label: "Account",
		type: "text",
		icon: <Building2Icon />,
	},
];

/** The seeded band, "between 30 and 70". */
const SEED_BAND: Band = [30, 70];

const INITIAL_QUERY: FilterQuery = createFilterQuery([
	createFilterRule({
		id: "seed-1",
		path: ["score"],
		operator: "between",
		value: SEED_BAND,
	}),
]);

export function Filters6Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(INITIAL_QUERY);

	return <Filters fields={FIELDS} query={query} onQueryChange={setQuery} showClear />;
}
