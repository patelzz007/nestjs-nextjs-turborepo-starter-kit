"use client";

import { isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import { BanknoteIcon, GlobeIcon, KeyRoundIcon, TagsIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import {
	filterValueItems,
	isFilterValueList,
	type FilterEditorProps,
	type FilterField,
	type FilterOperator,
	type FilterQuery,
	type FilterValue,
	type FilterValueDisplayContext,
	type FilterValueItem,
} from "@workspace/ui/components/filters/filters-types";
import { Input } from "@workspace/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp";
import { Textarea } from "@workspace/ui/components/textarea";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";

const THOUSANDS_SEPARATOR = /,/g;

/** The picks of a "many" value, as strings. */
function pickedStrings(value: FilterValue | undefined): readonly string[] {
	return filterValueItems(value).filter(isStringPrimitive);
}

/** A typed amount as a number, or undefined while the box is blank or not a number. */
function toNumber(raw: string): number | undefined {
	const parsed = Number(raw.replace(THOUSANDS_SEPARATOR, ""));
	return raw.trim() === "" || Number.isNaN(parsed) ? undefined : parsed;
}

/** A stored bound as the text its box starts with. */
function boundText(item: FilterValueItem | undefined): string {
	return isNumberPrimitive(item) ? String(item) : "";
}

/** Whole dollars with grouping, the way the chip reads an amount. */
function formatMoney(amount: number): string {
	return `$${amount.toLocaleString()}`;
}

/**
 * One panel width for the whole example, and it is the shipped text editor's.
 *
 * These four editors replace built-in ones, so they are measured against them
 * rather than against each other: `w-64` is what `FilterTextEditor` sizes its
 * panel to, and a bar whose custom editors each picked their own width would
 * resize its popover every time a different chip was opened. The access code
 * editor below is the one exception, and it says why.
 */
const PANEL = "flex w-64 flex-col gap-2 p-2";

/** The footer the shipped editors draw, to the pixel. */
const FOOTER = "flex items-center justify-end gap-1.5 pt-1";

/** A helper line under a control. Carries the error wording too. */
const HELPER = "text-muted-foreground text-xs";

/* -------------------------------------------------------------------------- */
/*                              Money, one or two                             */
/* -------------------------------------------------------------------------- */

interface MoneyGroupProps {
	readonly children: React.ReactNode;
}

/** The currency and the period as ADDONS, so the input holds a bare number. */
function MoneyGroup({ children }: MoneyGroupProps): React.JSX.Element {
	return (
		<InputGroup>
			<InputGroupAddon>
				<InputGroupText>$</InputGroupText>
			</InputGroupAddon>
			{children}
			<InputGroupAddon align="inline-end">
				<InputGroupText>/mo</InputGroupText>
			</InputGroupAddon>
		</InputGroup>
	);
}

/**
 * An input group carrying the unit, so the value never has to.
 *
 * Storing "$1,200/mo" would make every consumer parse the display back out
 * again. The currency and the period are ADDONS instead: the input holds a bare
 * number, the group says what the number means, and the chip's `renderValue`
 * puts the symbol back for reading.
 *
 * One editor answers both arities. `range` renders two groups joined by
 * `rangeSeparator`, which is the word `valueRange` puts between the bounds on
 * the chip, so the editor and the chip read as one sentence. It used to say
 * `and`, and the chip has never said that.
 */
function AmountEditor({ value, onValueChange, commit, cancel, labels, field, operator, autoFocusProps }: FilterEditorProps): React.JSX.Element {
	const dual = operator.arity === "range";
	const [low, high] = isFilterValueList(value) ? value : [];

	const [from, setFrom] = React.useState<string>((): string => (dual ? boundText(low) : boundText(isNumberPrimitive(value) ? value : undefined)));
	const [to, setTo] = React.useState<string>((): string => (dual ? boundText(high) : ""));

	// Takes both halves rather than reading state, because a change handler runs
	// BEFORE its own setState lands: deriving the draft from `from` inside the
	// `from` handler would publish the previous keystroke every time.
	const draft = React.useCallback(
		(lowText: string, highText: string): FilterValue | undefined => {
			if (!dual) return toNumber(lowText);
			const start = toNumber(lowText);
			const end = toNumber(highText);
			return start === undefined || end === undefined ? undefined : [start, end];
		},
		[dual],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			if (event.key === "Enter") {
				event.preventDefault();
				commit(draft(from, to));
			}
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				cancel();
			}
		},
		[cancel, commit, draft, from, to],
	);
	const handleFromChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setFrom(event.target.value);
			onValueChange(draft(event.target.value, to));
		},
		[draft, onValueChange, to],
	);
	const handleToChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setTo(event.target.value);
			onValueChange(draft(from, event.target.value));
		},
		[draft, from, onValueChange],
	);
	const handleApply = React.useCallback((): void => {
		commit(draft(from, to));
	}, [commit, draft, from, to]);

	return (
		<div className={PANEL}>
			<MoneyGroup>
				<InputGroupInput
					{...autoFocusProps}
					inputMode="decimal"
					value={from}
					// `rangeFrom` and `rangeTo`: the two bounds' names are `FilterLabels`
					// keys precisely so a translator can reach them.
					aria-label={dual ? labels.rangeFrom(field.label) : field.label}
					placeholder={field.placeholder}
					onChange={handleFromChange}
					onKeyDown={handleKeyDown}
				/>
			</MoneyGroup>

			{dual ? (
				<>
					<span className={cn(HELPER, "ps-1")}>{labels.rangeSeparator}</span>
					<MoneyGroup>
						<InputGroupInput inputMode="decimal" value={to} aria-label={labels.rangeTo(field.label)} onChange={handleToChange} onKeyDown={handleKeyDown} />
					</MoneyGroup>
				</>
			) : null}

			<div className={FOOTER}>
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

/* -------------------------------------------------------------------------- */
/*                              A pasted term list                            */
/* -------------------------------------------------------------------------- */

/** One term per non-blank line. */
function parseTerms(raw: string): readonly string[] {
	return raw
		.split("\n")
		.map((line: string): string => line.trim())
		.filter((line: string): boolean => line !== "");
}

/** A textarea, so a list of terms is pasted rather than typed one at a time. */
function KeywordList({ value, onValueChange, commit, cancel, autoFocusProps, labels, field }: FilterEditorProps): React.JSX.Element {
	const [text, setText] = React.useState<string>((): string => pickedStrings(value).join("\n"));
	const hintId = React.useId();

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>): void => {
			setText(event.target.value);
			onValueChange(parseTerms(event.target.value));
		},
		[onValueChange],
	);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
			// Enter is a newline here, so the commit key has to be the modified
			// one. Escape still discards, as it does in every other editor.
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				commit(parseTerms(text));
			}
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				cancel();
			}
		},
		[cancel, commit, text],
	);
	const handleApply = React.useCallback((): void => {
		commit(parseTerms(text));
	}, [commit, text]);

	return (
		<div className={PANEL}>
			<Textarea
				{...autoFocusProps}
				rows={KEYWORD_ROWS}
				value={text}
				aria-label={field.label}
				aria-describedby={hintId}
				placeholder={field.placeholder}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
			/>
			{/* On its own line rather than squeezed in beside the buttons. */}
			<span id={hintId} className={HELPER}>
				One per line
			</span>
			<div className={FOOTER}>
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

/** Visible lines of the keyword box. */
const KEYWORD_ROWS = 4;

/* -------------------------------------------------------------------------- */
/*                             A fixed width code                             */
/* -------------------------------------------------------------------------- */

/** An access code is six characters, drawn as two groups of three slots. */
const ACCESS_CODE_LENGTH = 6;
const FIRST_GROUP_SLOTS: readonly number[] = [0, 1, 2];
const SECOND_GROUP_SLOTS: readonly number[] = [3, 4, 5];
/** Letters and digits; the control defaults to digits only. */
const ACCESS_CODE_PATTERN = "^[a-zA-Z0-9]*$";

/**
 * A value with a known LENGTH, so completion is the commit.
 *
 * There is no Apply here and no Escape handler either: the control knows when
 * the value is whole, so `onComplete` closes the popover, and an incomplete code
 * is never written into the query at all. Dismissing by clicking away discards
 * the draft the same way `cancel` would.
 *
 * The one panel here that is NOT `PANEL`. Six slots are a measured object whose
 * width is the style's own control size, from mira's 28px to sera's 40px, so
 * the panel takes its width from the control rather than the other way round.
 * At `w-64` the slots would sit in a pool of empty space in mira and overflow
 * it in sera.
 */
function AccessCodeEditor({ value, onValueChange, commit, field, autoFocusProps }: FilterEditorProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(next: string): void => {
			onValueChange(next.toUpperCase());
		},
		[onValueChange],
	);
	const handleComplete = React.useCallback(
		(next: string): void => {
			commit(next.toUpperCase());
		},
		[commit],
	);

	return (
		<div className="p-2">
			<InputOTP
				{...autoFocusProps}
				maxLength={ACCESS_CODE_LENGTH}
				value={isStringPrimitive(value) ? value : ""}
				aria-label={field.label}
				// The control defaults to a numeric keypad, which would be wrong for a
				// code that carries letters, so both the mode and the accepted set are
				// stated rather than inherited.
				inputMode="text"
				pattern={ACCESS_CODE_PATTERN}
				onChange={handleChange}
				onComplete={handleComplete}>
				<InputOTPGroup>
					{FIRST_GROUP_SLOTS.map((slot: number): React.JSX.Element => (
						<InputOTPSlot key={slot} index={slot} />
					))}
				</InputOTPGroup>
				<InputOTPSeparator />
				<InputOTPGroup>
					{SECOND_GROUP_SLOTS.map((slot: number): React.JSX.Element => (
						<InputOTPSlot key={slot} index={slot} />
					))}
				</InputOTPGroup>
			</InputOTP>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                            A validated free text                           */
/* -------------------------------------------------------------------------- */

const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

/**
 * Free text that refuses to commit while it is wrong.
 *
 * Validation belongs to the editor, not to the primitive: what counts as a
 * legal value is a field's own business, and a core that tried to own it would
 * need a schema language nobody asked for. The editor simply declines to call
 * `commit`, so an invalid draft can never reach the query and the chip never
 * shows a value the backend will reject.
 */
function DomainEditor({ value, onValueChange, commit, cancel, labels, field, autoFocusProps }: FilterEditorProps): React.JSX.Element {
	const [text, setText] = React.useState<string>((): string => (isStringPrimitive(value) ? value : ""));
	const hintId = React.useId();
	const trimmed = text.trim();
	const invalid = trimmed !== "" && !DOMAIN.test(trimmed);

	const submit = React.useCallback((): void => {
		if (invalid || trimmed === "") return;
		commit(trimmed.toLowerCase());
	}, [commit, invalid, trimmed]);
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setText(event.target.value);
			onValueChange(event.target.value);
		},
		[onValueChange],
	);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			if (event.key === "Enter") {
				event.preventDefault();
				submit();
			}
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				cancel();
			}
		},
		[cancel, submit],
	);

	return (
		<div className={PANEL}>
			<Input
				{...autoFocusProps}
				value={text}
				aria-label={field.label}
				aria-invalid={invalid}
				aria-describedby={hintId}
				placeholder={field.placeholder}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
			/>
			{/* Under the field it judges, and `aria-describedby` so the rejection is
				spoken rather than only coloured. An always-mounted live region
				announces the CHANGE from the example to the complaint. */}
			<span id={hintId} aria-live="polite" className={cn(HELPER, invalid && "text-destructive")}>
				{invalid ? "Needs a dot, as in acme.com" : "example.com"}
			</span>
			<div className={FOOTER}>
				<Button variant="ghost" size="sm" onClick={cancel}>
					{labels.discard}
				</Button>
				<Button size="sm" disabled={invalid} onClick={submit}>
					{labels.apply}
				</Button>
			</div>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

function renderSpend({ value, labels }: FilterValueDisplayContext): React.ReactNode {
	if (isFilterValueList(value)) {
		const [low, high] = value;
		return isNumberPrimitive(low) && isNumberPrimitive(high) ? labels.valueRange(formatMoney(low), formatMoney(high)) : "any amount";
	}
	return isNumberPrimitive(value) ? formatMoney(value) : "any amount";
}

/**
 * The first term, plus what it stands in for. A pasted list collapses to
 * "5 selected" by default, which names none of them.
 */
function renderKeywords({ value }: FilterValueDisplayContext): React.ReactNode {
	const terms = pickedStrings(value);
	const [first] = terms;
	if (first === undefined) return "none";
	return (
		<span className="flex items-center gap-1.5">
			{first}
			{terms.length > 1 ? <span className="text-xs text-muted-foreground tabular-nums">+{terms.length - 1}</span> : null}
		</span>
	);
}

function renderAccessCode({ value }: FilterValueDisplayContext): React.ReactNode {
	return isStringPrimitive(value) && value !== "" ? <span className="font-mono tracking-wider">{value}</span> : "any code";
}

/**
 * Builds the schema. The access code takes only the two operators a fixed width
 * code can answer, worded by the `filterOperators` label family.
 */
function buildFields(isOperator: FilterOperator, isNotOperator: FilterOperator): readonly FilterField[] {
	return [
		{
			id: "spend",
			label: "Monthly spend",
			type: "number",
			// Ships with a range operator selected, so the editor opens as two groups.
			defaultOperator: "between",
			placeholder: "0",
			editor: AmountEditor,
			renderValue: renderSpend,
			icon: <BanknoteIcon />,
		},
		{
			id: "keywords",
			label: "Keywords",
			type: "multiselect",
			defaultOperator: "has_any_of",
			placeholder: "onboarding\nchurn\nrenewal",
			editor: KeywordList,
			renderValue: renderKeywords,
			icon: <TagsIcon />,
		},
		{
			id: "accessCode",
			label: "Access code",
			type: "text",
			operators: [isOperator, isNotOperator],
			defaultOperator: "is",
			editor: AccessCodeEditor,
			renderValue: renderAccessCode,
			icon: <KeyRoundIcon />,
		},
		{
			id: "domain",
			label: "Domain",
			type: "text",
			defaultOperator: "is",
			placeholder: "acme.com",
			editor: DomainEditor,
			icon: <GlobeIcon />,
		},
	];
}

/** The seeded spend band, in dollars. */
const SEED_SPEND: readonly [low: number, high: number] = [500, 2500];

const INITIAL_QUERY: FilterQuery = createFilterQuery([
	createFilterRule({
		id: "seed-1",
		path: ["spend"],
		operator: "between",
		value: SEED_SPEND,
	}),
	createFilterRule({
		id: "seed-2",
		path: ["accessCode"],
		operator: "is",
		value: "R7K2QX",
	}),
	/*
        THREE chips, not four, and the arithmetic decides which three.

        The bar is a wrapping row whose chips sit in an inner toolbar, and a
        flex child that wraps internally claims its whole line, so a fourth chip
        that spills does not simply take a second row: it hands the toolbar both
        rows and strands Add filter and Clear alone on a third. At the width a
        catalog card gives this bar (1128px) the four chips run 1164 to 1314
        across the styles, against a budget of 977 to 1036.

        Keywords is the one that goes, and the arithmetic picks it rather than
        taste. Spend is the widest chip in every style, but it is the input
        group this example leads with, so it stays and one of the other three
        goes. Only dropping Keywords clears the budget in all eight: spend, code
        and domain run 839 to 943. Keeping Keywords instead wraps in four styles
        (with domain) or six (with code). Its editor and its overflow display
        are one press of Add filter away.
      */
	createFilterRule({
		id: "seed-3",
		path: ["domain"],
		operator: "is",
		value: "acme.com",
	}),
]);

export function Filters9Example(): React.JSX.Element {
	const operatorLabels = useUiKitLabels("filterOperators");
	const fields = React.useMemo(
		(): readonly FilterField[] => buildFields({ value: "is", label: operatorLabels.is, inverse: "is_not" }, { value: "is_not", label: operatorLabels.is_not, inverse: "is" }),
		[operatorLabels],
	);
	const [query, setQuery] = React.useState<FilterQuery>(INITIAL_QUERY);

	return <Filters fields={fields} query={query} onQueryChange={setQuery} showClear />;
}
