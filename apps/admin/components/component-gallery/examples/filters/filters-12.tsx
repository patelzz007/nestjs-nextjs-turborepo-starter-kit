"use client";

import { CircleDotIcon, FlagIcon, HashIcon, TypeIcon, UserRoundCheckIcon } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarGroup } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Filters } from "@workspace/ui/components/filters/filters";
import type { FilterOperatorLabels } from "@workspace/ui/components/filters/filters-operators";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import type {
	FilterChangeDetails,
	FilterChangeReason,
	FilterField,
	FilterLabels,
	FilterOption,
	FilterQuery,
	FilterValueDisplayContext,
} from "@workspace/ui/components/filters/filters-types";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/core/utils";

type Locale = "en" | "de" | "ja";

type StatusValue = "todo" | "in-progress" | "review" | "done" | "cancelled";
type PriorityValue = "low" | "medium" | "high" | "urgent" | "critical";
type OptionValue = StatusValue | PriorityValue;

/** The field ids of this schema, which is what the per-locale field labels are keyed by. */
interface FieldLabels {
	readonly title: string;
	readonly status: string;
	readonly priority: string;
	readonly assignee: string;
	readonly score: string;
}

/** The empty word each stacked display falls back to. */
interface AnyLabels {
	readonly status: string;
	readonly priority: string;
	readonly assignee: string;
}

/* -------------------------------------------------------------------------- */
/*                                    Copy                                    */
/* -------------------------------------------------------------------------- */

// Every operator the four field types below can offer, and no more. The
// primitive's own English list carries 25; the four it holds beyond these,
// is_before through is_on_or_after, belong to no entry in the operator catalog
// at all, so no field of any type can put one on screen. A dictionary padded
// with keys nothing renders is the fossil the shipped English copy was pruned
// of.
const OPERATORS: Readonly<Record<Locale, Partial<FilterOperatorLabels>>> = {
	en: {},
	de: {
		contains: "enthält",
		not_contains: "enthält nicht",
		starts_with: "beginnt mit",
		ends_with: "endet mit",
		is: "ist",
		is_not: "ist nicht",
		is_any_of: "ist eines von",
		is_none_of: "ist keines von",
		has_any_of: "enthält eines von",
		has_all_of: "enthält alle von",
		has_none_of: "enthält keines von",
		eq: "ist gleich",
		neq: "ist ungleich",
		gt: "ist größer als",
		gte: "ist mindestens",
		lt: "ist kleiner als",
		lte: "ist höchstens",
		between: "liegt zwischen",
		not_between: "liegt nicht zwischen",
		empty: "ist leer",
		not_empty: "ist nicht leer",
	},
	ja: {
		contains: "を含む",
		not_contains: "を含まない",
		starts_with: "で始まる",
		ends_with: "で終わる",
		is: "と等しい",
		is_not: "と等しくない",
		is_any_of: "のいずれか",
		is_none_of: "のいずれでもない",
		has_any_of: "のいずれかを含む",
		has_all_of: "のすべてを含む",
		has_none_of: "のいずれも含まない",
		eq: "と等しい",
		neq: "と等しくない",
		gt: "より大きい",
		gte: "以上",
		lt: "より小さい",
		lte: "以下",
		between: "の範囲内",
		not_between: "の範囲外",
		empty: "が空",
		not_empty: "が空でない",
	},
};

/**
 * Why `labels.negated` is a FUNCTION, demonstrated rather than asserted.
 *
 * Negate flips to the catalog's `inverse` where one exists, so `negated` is
 * only ever asked about the three operators here that have none: starts with,
 * ends with, and has all of. A prefix composes them in English ("not starts
 * with" is at worst clumsy) and composes in NEITHER of these languages: German
 * puts nicht after the verb, and Japanese conjugates the verb itself. Keyed by
 * the localised label because that is all the primitive hands the function, and
 * the labels it is keyed on are the ones declared directly above.
 */
const NEGATED_DE: ReadonlyMap<string, string> = new Map([
	["beginnt mit", "beginnt nicht mit"],
	["endet mit", "endet nicht mit"],
	["enthält alle von", "enthält nicht alle von"],
]);

const NEGATED_JA: ReadonlyMap<string, string> = new Map([
	["で始まる", "で始まらない"],
	["で終わる", "で終わらない"],
	["のすべてを含む", "のすべては含まない"],
]);

// Chrome copy and operator wording are two separate surfaces. A team routinely
// rewords "contains" for their domain without translating anything else, and a
// translator localises the chrome without touching the operator catalog.
//
// The keys below are exactly the ones the chip row can reach with the schema in
// this file. `FilterLabels` carries 76. Thirty three of them are drawn only by
// the advanced builder, which this example does not offer. Fourteen more want a
// nested field, an async option list or an exclusive option, none of which this
// schema declares, or name a slot the primitive no longer renders anywhere.
// `filterLabel` is the last one out: it wraps a chip's accessible name and
// defaults to the identity, so what it returns is already assembled from the
// words below. That leaves these 28, every one of which this file's own bar can
// put on screen or into an accessible name. A dictionary padded past that is
// the fossil the shipped English copy was pruned of: work a translator is paid
// for and nobody ever sees.
const CHROME: Readonly<Record<Locale, Partial<FilterLabels>>> = {
	en: {},
	de: {
		addFilter: "Filter hinzufügen",
		searchFields: "Attribute suchen...",
		searchOperators: "Bedingungen suchen...",
		searchOptions: "Optionen suchen...",
		fieldsLabel: "Attribute",
		filtersLabel: "Filter",
		chipMenu: (fieldLabel: string): string => `Optionen für ${fieldLabel}`,
		clear: "Zurücksetzen",
		apply: "Übernehmen",
		discard: "Verwerfen",
		remove: "Entfernen",
		duplicate: "Duplizieren",
		negate: "Umkehren",
		negated: (operatorLabel: string): string => NEGATED_DE.get(operatorLabel) ?? operatorLabel,
		empty: "Keine Ergebnisse",
		valuePlaceholder: "Text eingeben...",
		noValue: "kein Wert",
		incomplete: "unvollständiger Filter",
		selectCondition: "Bedingung wählen",
		readOnly: "Schreibgeschützt. Diese Filter können nicht geändert werden.",
		valueCount: (count: number): string => `${String(count)} ausgewählt`,
		valueDetail: (summary: string, values: readonly string[]): string => `${summary}: ${values.join(", ")}`,
		valueRange: (from: string, to: string): string => `${from} bis ${to}`,
		rangeFrom: (fieldLabel: string): string => `${fieldLabel} von`,
		rangeTo: (fieldLabel: string): string => `${fieldLabel} bis`,
		rangeSeparator: "bis",
		countAnnouncement: (count: number): string => (count === 1 ? "1 Filter aktiv" : `${String(count)} Filter aktiv`),
		resultsAnnouncement: (count: number): string => (count === 1 ? "1 Ergebnis" : `${String(count)} Ergebnisse`),
	},
	ja: {
		addFilter: "フィルターを追加",
		searchFields: "属性を検索...",
		searchOperators: "条件を検索...",
		searchOptions: "オプションを検索...",
		fieldsLabel: "属性",
		filtersLabel: "フィルター",
		chipMenu: (fieldLabel: string): string => `${fieldLabel}のフィルターオプション`,
		clear: "クリア",
		apply: "適用",
		discard: "破棄",
		remove: "削除",
		duplicate: "複製",
		negate: "反転",
		negated: (operatorLabel: string): string => NEGATED_JA.get(operatorLabel) ?? operatorLabel,
		empty: "結果がありません",
		valuePlaceholder: "テキストを入力...",
		noValue: "値なし",
		incomplete: "不完全なフィルター",
		selectCondition: "条件を選択",
		readOnly: "読み取り専用です。これらのフィルターは変更できません。",
		valueCount: (count: number): string => `${String(count)}件選択`,
		valueDetail: (summary: string, values: readonly string[]): string => `${summary}: ${values.join("、")}`,
		valueRange: (from: string, to: string): string => `${from}から${to}`,
		rangeFrom: (fieldLabel: string): string => `${fieldLabel}（開始）`,
		rangeTo: (fieldLabel: string): string => `${fieldLabel}（終了）`,
		rangeSeparator: "から",
		countAnnouncement: (count: number): string => `フィルター${String(count)}件を適用中`,
		resultsAnnouncement: (count: number): string => `${String(count)}件の結果`,
	},
};

const FIELD_LABELS: Readonly<Record<Locale, FieldLabels>> = {
	en: { title: "Title", status: "Status", priority: "Priority", assignee: "Assignee", score: "Score" },
	de: { title: "Titel", status: "Status", priority: "Priorität", assignee: "Bearbeiter", score: "Punktzahl" },
	ja: { title: "タイトル", status: "ステータス", priority: "優先度", assignee: "担当者", score: "スコア" },
};

/** A field label by the id a change readout stored, falling back to the id itself. */
function fieldLabelOf(locale: Locale, id: string): string {
	return new Map<string, string>(Object.entries(FIELD_LABELS[locale])).get(id) ?? id;
}

// Status and priority share one dictionary, keyed by option value, because
// their values are disjoint and because the colour map below is keyed the same
// way. Two maps over one key space, one holding what translates and one holding
// what does not.
const OPTION_LABELS: Readonly<Record<Locale, Readonly<Record<OptionValue, string>>>> = {
	en: {
		todo: "To Do",
		"in-progress": "In Progress",
		review: "In Review",
		done: "Done",
		cancelled: "Cancelled",
		low: "Low",
		medium: "Medium",
		high: "High",
		urgent: "Urgent",
		critical: "Critical",
	},
	de: {
		todo: "Offen",
		"in-progress": "In Bearbeitung",
		review: "In Prüfung",
		done: "Erledigt",
		cancelled: "Abgebrochen",
		low: "Niedrig",
		medium: "Mittel",
		high: "Hoch",
		urgent: "Dringend",
		critical: "Kritisch",
	},
	ja: {
		todo: "未着手",
		"in-progress": "進行中",
		review: "レビュー中",
		done: "完了",
		cancelled: "中止",
		low: "低",
		medium: "中",
		high: "高",
		urgent: "緊急",
		critical: "重大",
	},
};

// What a stacked display says when nothing is picked yet. It arrives through
// `renderValue`, so it belongs to the CONSUMER rather than to `labels`, and a
// consumer who translates the chrome and forgets this ships a German bar with
// an English chip in it.
const ANY_LABELS: Readonly<Record<Locale, AnyLabels>> = {
	en: { status: "any status", priority: "any priority", assignee: "anyone" },
	de: { status: "beliebiger Status", priority: "beliebige Priorität", assignee: "alle" },
	ja: { status: "すべてのステータス", priority: "すべての優先度", assignee: "全員" },
};

// How many times `onQueryChange` has fired, in words. Consumer copy again, for
// the same reason `ANY_LABELS` is: it is drawn over a CALLBACK's output, which
// no key in `labels` covers, so a locale switch reaches it only if the consumer
// wired it. Pluralisation is why each entry is a function rather than a string:
// German inflects the noun, and Japanese counts with a suffix and does not
// inflect at all, so the count cannot be concatenated onto a fixed word.
const CHANGE_LABELS: Readonly<Record<Locale, (count: number) => string>> = {
	en: (count: number): string => (count === 1 ? "1 change" : `${String(count)} changes`),
	de: (count: number): string => (count === 1 ? "1 Änderung" : `${String(count)} Änderungen`),
	ja: (count: number): string => `変更${String(count)}件`,
};

/* -------------------------------------------------------------------------- */
/*                                  Fixtures                                  */
/* -------------------------------------------------------------------------- */

// The colour is keyed by value and NOT by locale, which is the whole point of
// the pairing: swapping locale rewrites every label on screen and moves none of
// these.
const TONES: Readonly<Record<OptionValue, string>> = {
	todo: "bg-muted-foreground",
	"in-progress": "bg-tone-yellow",
	review: "bg-tone-blue",
	done: "bg-tone-green",
	cancelled: "bg-destructive",
	low: "bg-tone-teal",
	medium: "bg-tone-yellow",
	high: "bg-tone-violet",
	urgent: "bg-tone-orange",
	critical: "bg-destructive",
};

/** The same tones, looked up by a stored option value (a plain string). */
const TONE_BY_VALUE: ReadonlyMap<string, string> = new Map<string, string>(Object.entries(TONES));

const STATUSES: readonly StatusValue[] = ["todo", "in-progress", "review", "done", "cancelled"];
const PRIORITIES: readonly PriorityValue[] = ["low", "medium", "high", "urgent", "critical"];

interface TeamEntry {
	readonly value: string;
	readonly label: string;
}

// Names are proper nouns, so they are the one set of option labels that stays
// put across all three locales, exactly as the faces do. The FIELD label above
// them still translates.
const TEAM: readonly TeamEntry[] = [
	{ value: "ada", label: "Ada Lovelace" },
	{ value: "grace", label: "Grace Hopper" },
	{ value: "alan", label: "Alan Turing" },
	{ value: "katherine", label: "Katherine Johnson" },
	{ value: "edsger", label: "Edsger Dijkstra" },
	{ value: "barbara", label: "Barbara Liskov" },
	{ value: "tim", label: "Tim Berners-Lee" },
	{ value: "margaret", label: "Margaret Hamilton" },
];

/** Swatches drawn in a stack before the count carries the rest. */
const STACK_GLYPH_LIMIT = 4;
/** Faces drawn in a stack before the rest collapse into a "+n". */
const STACK_FACE_LIMIT = 3;
/** How many distinct entries the change readout keeps. */
const CHANGE_HISTORY_LIMIT = 3;
/** The seeded score threshold. */
const SEED_MIN_SCORE = 60;

interface DotProps {
	readonly className: string;
}

function Dot({ className }: DotProps): React.JSX.Element {
	return <span className={cn("size-2 shrink-0 rounded-full", className)} />;
}

/** The first letter of each name part, for a face drawn without a photo. */
function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

interface PersonProps {
	readonly name: string;
}

/**
 * A teammate as initials. The gallery ships sample data only, so no portrait
 * is fetched from a photo service; the fallback is the whole face.
 */
function Person({ name }: PersonProps): React.JSX.Element {
	return (
		<Avatar size="sm" className="size-5">
			<AvatarFallback className="text-[length:var(--text-badge-xs)]">{initialsOf(name)}</AvatarFallback>
		</Avatar>
	);
}

interface StackedProps {
	readonly options: readonly FilterOption[];
	readonly empty: string;
}

/**
 * Overlapping swatches plus a count, instead of "3 selected". The empty word is
 * a prop because the same renderer serves Status and Priority: a hardcoded noun
 * would put "any status" on the Priority chip, and a hardcoded ENGLISH noun
 * would put it there in every locale.
 */
function StackedDots({ options, empty }: StackedProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>{empty}</>;
	if (options.length === 1) {
		return (
			<span className="flex items-center gap-1.5">
				<Dot className={TONE_BY_VALUE.get(only.value) ?? "bg-muted-foreground"} />
				{only.label}
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center">
				{options.slice(0, STACK_GLYPH_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<span key={option.value} className={cn("-ml-1 size-2.5 rounded-full ring-2 ring-background first:ml-0", TONE_BY_VALUE.get(option.value) ?? "bg-muted-foreground")} />
				))}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
		</span>
	);
}

/**
 * A real `AvatarGroup`, plus an overflow count.
 *
 * The group keeps its default `ring-2`, which reads as a wider collar once the
 * faces drop to 16px, and the two overrides both follow from that size: the
 * stack tightens to `-space-x-1`, because the default `-space-x-2` hides half
 * of a 16px face, and `size-4` beats the face's own `size-5` on specificity
 * exactly as the group's own ring does. Both selectors reach DIRECT children,
 * so the faces are rendered as components rather than wrapped in a keyed span,
 * which would put a wrapper between the group and every avatar it styles. The
 * count appears only on genuine overflow, so three picks show three faces and
 * no redundant "3" beside them.
 */
function StackedPeople({ options, empty }: StackedProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>{empty}</>;
	if (options.length === 1) {
		return (
			<span className="flex items-center gap-1.5">
				<Person name={only.label} />
				{only.label}
			</span>
		);
	}

	const overflow = options.length - STACK_FACE_LIMIT;

	return (
		<span className="flex items-center gap-1.5">
			<AvatarGroup className="-space-x-1 *:data-[slot=avatar]:size-4">
				{options.slice(0, STACK_FACE_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<Person key={option.value} name={option.label} />
				))}
			</AvatarGroup>
			{overflow > 0 ? <span className="text-xs text-muted-foreground tabular-nums">+{overflow}</span> : null}
		</span>
	);
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

function toneOptions(values: readonly OptionValue[], locale: Locale): FilterOption[] {
	return values.map((value: OptionValue): FilterOption => ({
		value,
		label: OPTION_LABELS[locale][value],
		icon: <Dot className={TONES[value]} />,
	}));
}

/**
 * Rebuilt per locale, and declared inline on purpose.
 *
 * The schema index is memoized on a content SIGNATURE rather than on the array
 * identity, so a rebuild that changes nothing structural returns the identical
 * index object. Changing a label DOES change the signature, which is exactly
 * when the index should be rebuilt, and it is why the chips redraw in the new
 * language without the query being touched.
 */
function buildFields(locale: Locale): readonly FilterField[] {
	const fieldLabels = FIELD_LABELS[locale];
	const anyLabels = ANY_LABELS[locale];
	return [
		{
			id: "title",
			label: fieldLabels.title,
			type: "text",
			icon: <TypeIcon />,
		},
		{
			id: "status",
			label: fieldLabels.status,
			type: "select",
			defaultOperator: "is_any_of",
			icon: <CircleDotIcon />,
			options: toneOptions(STATUSES, locale),
			// Five options, so the search box is more chrome than the rows under it.
			searchable: false,
			renderValue: ({ options }: FilterValueDisplayContext): React.ReactNode => <StackedDots options={options} empty={anyLabels.status} />,
		},
		{
			id: "priority",
			label: fieldLabels.priority,
			type: "multiselect",
			icon: <FlagIcon />,
			options: toneOptions(PRIORITIES, locale),
			searchable: false,
			renderValue: ({ options }: FilterValueDisplayContext): React.ReactNode => <StackedDots options={options} empty={anyLabels.priority} />,
		},
		{
			id: "assignee",
			label: fieldLabels.assignee,
			type: "multiselect",
			// Wider than the panel's default: a face plus a full name is the widest
			// row the option menu draws, and this example runs in three locales.
			className: "w-56",
			icon: <UserRoundCheckIcon />,
			options: TEAM.map((person: TeamEntry): FilterOption => ({
				value: person.value,
				label: person.label,
				icon: <Person name={person.label} />,
			})),
			// A list of PEOPLE carries no semantic order, unlike Priority above.
			sortSelected: "label",
			renderValue: ({ options }: FilterValueDisplayContext): React.ReactNode => <StackedPeople options={options} empty={anyLabels.assignee} />,
		},
		{
			id: "score",
			label: fieldLabels.score,
			type: "number",
			icon: <HashIcon />,
		},
	];
}

/* -------------------------------------------------------------------------- */
/*                                   Query                                    */
/* -------------------------------------------------------------------------- */

// Four rules, chosen for what each one says under a locale swap. Status
// collapses to two dots and a count, which is the case `labels.valueDetail`
// spells out for a screen reader once the bar is read only. Priority holds one
// pick, so its chip shows a colour AND a translated word side by side. Assignee
// holds four people, so the faces and their names stay put while the attribute
// above them changes language. Score holds neither a colour nor a face, so it
// is the control case: every glyph in it is copy, and every glyph changes.
const SEED: FilterQuery = createFilterQuery(
	[
		createFilterRule({
			id: "seed-1",
			path: ["status"],
			operator: "is_any_of",
			value: ["in-progress", "review"],
		}),
		createFilterRule({
			id: "seed-2",
			path: ["priority"],
			operator: "has_any_of",
			value: ["urgent"],
		}),
		createFilterRule({
			id: "seed-3",
			path: ["assignee"],
			operator: "has_any_of",
			value: ["ada", "grace", "alan", "katherine"],
		}),
		createFilterRule({
			id: "seed-4",
			path: ["score"],
			operator: "gte",
			value: SEED_MIN_SCORE,
		}),
	],
	"and",
);

/* -------------------------------------------------------------------------- */
/*                                  Controls                                  */
/* -------------------------------------------------------------------------- */

type Size = "sm" | "default";

/**
 * `readOnly` and `disabled` as ONE control with three states.
 *
 * Two switches would let a reader set both at once, which the primitive answers
 * by disabling the bar and which says nothing about either prop. Three mutually
 * exclusive states cannot be combined into that, and putting them in one group
 * is what makes the pair legible: the difference between locked and off is only
 * visible when you can flip straight from one to the other.
 */
type Interaction = "editable" | "readOnly" | "disabled";

interface PropOption<T extends string> {
	readonly value: T;
	readonly label: string;
}

const LOCALE_OPTIONS: readonly PropOption<Locale>[] = [
	{ value: "en", label: "English" },
	{ value: "de", label: "Deutsch" },
	{ value: "ja", label: "日本語" },
];

const SIZE_OPTIONS: readonly PropOption<Size>[] = [
	{ value: "sm", label: "Small" },
	{ value: "default", label: "Default" },
];

const INTERACTION_OPTIONS: readonly PropOption<Interaction>[] = [
	{ value: "editable", label: "Editable" },
	{ value: "readOnly", label: "Read only" },
	{ value: "disabled", label: "Disabled" },
];

interface PropControlProps<T extends string> {
	readonly prop: string;
	readonly value: T;
	readonly options: readonly PropOption<T>[];
	readonly onValueChange: (value: T) => void;
}

/**
 * One control of the toolbar: the PROP, and every value it can take as one
 * segmented group beside it.
 *
 * The name is load-bearing. Three unlabelled segments reading sm and default
 * leave a reader to infer the prop from the values, which almost works for
 * `size` and fails completely for a group that reads English, Deutsch, 日本語.
 * Naming the prop costs one span and removes the inference entirely, and a
 * segmented group is what keeps every value on screen while still reading as
 * one control: a demo setting hidden behind a select is one more click between
 * a reader and the thing they came to see, and three loose radios are three
 * controls where the prop has one.
 *
 * ABOVE the group rather than beside it, which is what buys the row. Beside,
 * a control is its name plus its segments end to end, and the three of them
 * come to 921px against the 889 the catalog frame is wide - so the toolbar
 * this is meant to form wrapped on the very frame it was drawn for, and the
 * two prop pairs would have had to give up half their names to fit. Stacked,
 * each control is only as wide as the WIDER of its two lines, the three come to
 * about 590px, and every prop keeps the name it actually has in the API.
 *
 * The label is a span rather than `FieldSet` plus `FieldLegend`. The thing it
 * names is the toggle group, which is already named through `aria-labelledby`,
 * so a fieldset around it would be a second group announcing the same words
 * twice.
 *
 * It is also NOT a `ButtonGroupText` addon fused onto the group, which is the
 * obvious way to draw a labelled segmented control and the wrong one here:
 * every style paints that addon `bg-muted` and every style paints a pressed
 * segment `bg-muted` too, so the label and a selected FIRST value would merge
 * into one unreadable block in each of these three groups. A plain span keeps
 * the fill meaning exactly one thing.
 *
 * `shrink-0` on the whole control, so a toolbar too narrow to hold three of
 * them wraps between controls rather than squeezing a group until its segments
 * clip.
 */
function PropControl<T extends string>({ prop, value, options, onValueChange }: PropControlProps<T>): React.JSX.Element {
	const id = React.useId();
	const groupValue = React.useMemo((): string[] => [value], [value]);

	// Single-select, and pressing the pressed segment CLEARS the group. None of
	// these three props has a way to hold nothing, so the current value is kept
	// when that happens: this control chooses between values and cannot unset
	// one. The pressed value is matched back to its option, so the callback is
	// handed the option's own typed value rather than the group's string.
	const handleValueChange = React.useCallback(
		(next: readonly string[]): void => {
			const [pressed] = next;
			const match = options.find((option: PropOption<T>): boolean => option.value === pressed);
			if (match !== undefined) onValueChange(match.value);
		},
		[onValueChange, options],
	);

	return (
		<div className="flex shrink-0 flex-col gap-1.5">
			<span id={id} className="text-xs font-medium text-muted-foreground">
				{prop}
			</span>
			{/*
				Fused (`spacing={0}`), because the segments are the values of ONE prop
				and exactly one of them is true at a time. Base UI's group publishes
				`role="group"` over `aria-pressed` toggles; `aria-labelledby` names it.
			*/}
			<ToggleGroup aria-labelledby={id} variant="outline" size="sm" spacing={0} value={groupValue} onValueChange={handleValueChange}>
				{options.map((option: PropOption<T>): React.JSX.Element => (
					<ToggleGroupItem key={option.value} value={option.value}>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                                  Pattern                                   */
/* -------------------------------------------------------------------------- */

/**
 * One entry of the change readout.
 *
 * Holds the field's ID rather than its label, and a COUNT rather than one entry
 * per call. Four edits to one value are four calls with identical details, and
 * four identical badges read as a rendering fault rather than as four events.
 */
interface Change {
	/** The call number that opened this entry: a stable key for the badge. */
	readonly id: number;
	readonly reason: FilterChangeReason;
	readonly field: string | null;
	readonly count: number;
}

/**
 * The readout's whole state: how many times the callback fired, and the last
 * three distinct things it said.
 *
 * `fires` is counted separately rather than summed out of `entries`, because
 * entries are folded and then capped at three, so the sum stops being the
 * number of calls the moment a fourth distinct one arrives. It is also what
 * removes the empty state: a count is a real measurement at zero, where a word
 * standing in for "nothing has happened" is filler that has to be written in
 * every language this file speaks.
 */
interface Changes {
	readonly fires: number;
	readonly entries: readonly Change[];
}

const NO_CHANGES: Changes = { fires: 0, entries: [] };

/** Folds one `onQueryChange` call into the readout. */
function recordChange(current: Changes, details: FilterChangeDetails): Changes {
	const field = details.field?.id ?? null;
	const [newest, ...rest] = current.entries;
	// Repeats fold into the newest entry instead of pushing a copy of it, which
	// is what keeps a slider or a text field from filling the strip with one reason.
	const entries: readonly Change[] =
		newest?.reason === details.reason && newest.field === field
			? [{ ...newest, count: newest.count + 1 }, ...rest]
			: [{ id: current.fires, reason: details.reason, field, count: 1 }, ...current.entries].slice(0, CHANGE_HISTORY_LIMIT);
	return { fires: current.fires + 1, entries };
}

interface ChangeBadgeProps {
	readonly entry: Change;
	readonly isNewest: boolean;
	readonly locale: Locale;
}

function ChangeBadge({ entry, isNewest, locale }: ChangeBadgeProps): React.JSX.Element {
	return (
		<Badge variant={isNewest ? "default" : "secondary"} className="gap-1.5">
			<span className="font-mono">{entry.reason}</span>
			{entry.field === null ? null : <span className="opacity-75">{fieldLabelOf(locale, entry.field)}</span>}
			{entry.count > 1 ? <span className="tabular-nums opacity-75">×{entry.count}</span> : null}
		</Badge>
	);
}

export function Filters12Example(): React.JSX.Element {
	const [locale, setLocale] = React.useState<Locale>("en");
	const [size, setSize] = React.useState<Size>("default");
	const [interaction, setInteraction] = React.useState<Interaction>("editable");
	const [changes, setChanges] = React.useState<Changes>(NO_CHANGES);
	const [query, setQuery] = React.useState<FilterQuery>(SEED);
	const fields = React.useMemo((): readonly FilterField[] => buildFields(locale), [locale]);
	const [newestEntry] = changes.entries;

	// Fully controlled. The second argument says WHAT happened and WHICH field it
	// happened to, so a consumer does not have to diff two trees to find out.
	const handleQueryChange = React.useCallback((next: FilterQuery, details: FilterChangeDetails): void => {
		setQuery(next);
		setChanges((current: Changes): Changes => recordChange(current, details));
	}, []);

	return (
		// Spacing tightens below the breakpoint the toolbar already wraps at, and
		// is restored above it. The catalog frames this example at one authored
		// height, and a phone-width frame spends 244 of it on a five-row bar and
		// the rest on a toolbar that has folded into a column, so the gaps are the
		// only budget left to give back. Nothing changes at the widths where there
		// is room.
		<div className="flex w-full flex-col gap-2.5 min-[30rem]:gap-4">
			{/*
        `labels` and `operatorLabels` are two independent surfaces over one
        catalog, so a locale change redraws every chip and never touches the
        query.

        `readOnly` and `disabled` are not two words for one state. `disabled`
        turns the bar off natively. `readOnly` blocks every mutation while
        leaving the bar focusable, readable and navigable, carries
        `labels.readOnly` as the toolbar's description, and hands a collapsed
        value its full contents as an accessible name, because the editor that
        would have revealed them is locked shut.
      */}
			<Filters
				fields={fields}
				query={query}
				size={size}
				readOnly={interaction === "readOnly"}
				disabled={interaction === "disabled"}
				labels={CHROME[locale]}
				operatorLabels={OPERATORS[locale]}
				showClear
				className={cn(
					// Padding first, so the two states below differ in FILL alone and the
					// bar does not move when one is flipped on.
					"-mx-1.5 rounded-md p-1.5 transition-colors",
					// `data-readonly` is the container hook the primitive puts on the bar
					// for exactly this: a read-only control keeps full contrast, tinted,
					// with an inset ring so the state is noticeable on the flip.
					"data-readonly:bg-muted data-readonly:inset-ring data-readonly:inset-ring-border",
					// `disabled` gets no such hook, so it is painted from the flag this
					// file already holds.
					interaction === "disabled" && "opacity-60",
				)}
				onQueryChange={handleQueryChange}
			/>

			{/*
        ONE surface for the whole API, so the bar above it reads as the subject
        rather than as the first of several stacked rows. Every prop this
        example writes sits on one toolbar line, the strip under it reads the
        callback back, and the hairline between them comes from the card's own
        `divide-y` so the two are one object.

        A ROW and not the three stacked rows this replaces. Stacked, each prop
        got a full-width line and the three controls were left hanging off the
        tray's right edge with a lane of dead space between every name and the
        group it named. Set side by side each name sits against its own control,
        the toolbar costs one line instead of three, and the whole demo fits the
        frame without the bar above it scrolling out of view.

        A `Card` and not the muted panel this replaces, and the reason is a
        collision rather than a preference: every style paints a pressed segment
        with `bg-muted`, so a muted tray would have hidden the selected value in
        each of the three groups it holds. The card's surface is what makes the
        selection legible, `gap-0 py-0` undoes the stacking spacing it ships
        with, and each part carries its own padding because `--card-spacing` is
        a per-style token that reaches 32px in sera.
      */}
			{/*
        NO CARD. The controls are the page talking about the demo, not part of
        it: boxing them made a second panel above the one this example is
        actually about, and two stacked surfaces of similar weight leave a
        reader deciding which is the subject.

        They keep their own grouping - a name over each segmented group, one
        rule under the whole strip - which is all the containment a toolbar
        needs. The bar below is the thing in a box, because it is the thing.
      */}
			<div className="w-full">
				{/*
          The toolbar. `items-end`, so the three segmented groups sit on one
          baseline whatever their names do above them - a prop whose name wraps
          would otherwise push its own control down and break the line the row
          is made of.

          One row in seven of the eight styles, where the three controls come to
          about 590px against the 880 the catalog frame leaves inside this card.
          SERA IS THE EIGHTH and it does not fit: it sets every segment
          uppercase with 1.2px of tracking and 24px of padding a side, which
          takes a two-letter value like sm to 71px and the three groups to 856px
          of controls before a single gap between them. That is a style deciding
          how big its own controls are, not something for this file to override,
          so the row folds to two lines there and `flex-wrap` is what makes the
          fold tidy rather than a clipped third control.

          Gaps and NO separators, which is the same decision. A vertical rule
          reads as a divider BETWEEN two things on one line, so the moment sera
          or a phone folds the row, the rule that was dividing the second and
          third control is left hanging off the end of the first line pointing
          at nothing. The stacked names already group each control with its own
          segments, so `gap-x-6` says everything the rules were there to say and
          says it at every width.
        */}
				<div className="flex flex-wrap items-end gap-x-6 gap-y-3 pb-3">
					<PropControl prop="Language" value={locale} options={LOCALE_OPTIONS} onValueChange={setLocale} />
					<PropControl prop="Size" value={size} options={SIZE_OPTIONS} onValueChange={setSize} />
					<PropControl prop="State" value={interaction} options={INTERACTION_OPTIONS} onValueChange={setInteraction} />
				</div>

				{/*
          The tray's status line: what `onQueryChange` handed back, most recent
          first. Three props go in through the toolbar above and one callback
          comes out here, which is why the readout belongs on this surface and
          not floating between the bar and the tray.

          Its own line rather than the end of the toolbar row, because it is the
          one part of this card whose width is not knowable: three badges naming
          a reason, a field and a repeat count are wider than the three controls
          beside them on a bad day. Trailing the toolbar it would have pushed
          the controls onto a second line and then pulled them back as the
          badges folded, so the row a reader is aiming at would move under the
          pointer every time they used it.

          The count carries the strip. It names what the badges are without a
          heading over them, it is a measurement rather than a placeholder at
          zero, and it translates, because a number the consumer renders is the
          consumer's copy. Each entry keeps the field's ID and resolves its
          label at render, so the badges retranslate with everything else. The
          reason does not: it is an API value rather than copy, and a translated
          one would be a lie about what `details.reason` holds.
        */}
				<div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 py-2">
					<span className="text-xs text-muted-foreground tabular-nums">{CHANGE_LABELS[locale](changes.fires)}</span>
					{changes.entries.map((entry: Change): React.JSX.Element => (
						<ChangeBadge key={entry.id} entry={entry} isNewest={entry === newestEntry} locale={locale} />
					))}
				</div>
			</div>
		</div>
	);
}
