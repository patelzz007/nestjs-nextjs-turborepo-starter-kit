"use client";

import { isBooleanPrimitive, isNumberPrimitive } from "@workspace/shared";
import { CircleDotIcon, FolderGit2Icon, HashIcon, SignalIcon, TagsIcon, TypeIcon, UserRoundCheckIcon } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarGroup } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Filters } from "@workspace/ui/components/filters/filters";
import { countFilterRules, createFilterGroup, createFilterQuery, createFilterRule, isFilterRule } from "@workspace/ui/components/filters/filters-query";
import {
	filterValueItems,
	isFilterDateValue,
	type FilterField,
	type FilterNode,
	type FilterOption,
	type FilterQuery,
	type FilterValueDisplayContext,
	type FilterValueItem,
} from "@workspace/ui/components/filters/filters-types";
import { cn } from "@workspace/ui/lib/core/utils";

/* -------------------------------------------------------------------------- */
/*                              Value rendering                               */
/* -------------------------------------------------------------------------- */

interface DotProps {
	readonly className: string;
}

/**
 * The builder draws the SAME value output the chip row does.
 *
 * A condition in the advanced builder is the same sentence as a chip, so its
 * value cell gets the same treatment: a coloured dot for a state, a ranked
 * glyph for a priority, faces for people. Left as plain labels it read as a
 * form, and the one thing the builder is for - taking in a whole query at a
 * glance - is exactly what a column of identical grey words defeats.
 */
function Dot({ className }: DotProps): React.JSX.Element {
	return <span className={cn("size-2 shrink-0 rounded-full", className)} />;
}

/** The first letter of each name part. */
function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

interface PersonFaceProps {
	readonly name: string;
}

/** A face as initials: the gallery ships sample data only and fetches no portraits. */
function PersonFace({ name }: PersonFaceProps): React.JSX.Element {
	return (
		<Avatar size="sm" className="size-5">
			<AvatarFallback className="text-[length:var(--text-badge-xs)]">{initialsOf(name)}</AvatarFallback>
		</Avatar>
	);
}

/** An option with its swatch, drawn from a tone token. */
interface ToneEntry {
	readonly value: string;
	readonly label: string;
	readonly dot: string;
}

const STATUSES: readonly ToneEntry[] = [
	{ value: "todo", label: "To do", dot: "bg-muted-foreground" },
	{ value: "in-progress", label: "In progress", dot: "bg-tone-yellow" },
	{ value: "blocked", label: "Blocked", dot: "bg-destructive" },
	{ value: "done", label: "Done", dot: "bg-tone-green" },
];

// A ramp rather than a set of labels, so the tones run one way: cool to hot,
// which is what puts the four in an order the eye can take without reading
// the words.
const PRIORITIES: readonly ToneEntry[] = [
	{ value: "low", label: "Low", dot: "bg-tone-teal" },
	{ value: "medium", label: "Medium", dot: "bg-tone-yellow" },
	{ value: "high", label: "High", dot: "bg-tone-orange" },
	{ value: "urgent", label: "Urgent", dot: "bg-tone-red" },
];

const TEAM: readonly FilterOption[] = [
	{ value: "ada", label: "Ada Lovelace" },
	{ value: "grace", label: "Grace Hopper" },
	{ value: "alan", label: "Alan Turing" },
	{ value: "katherine", label: "Katherine Johnson" },
	{ value: "edsger", label: "Edsger Dijkstra" },
	{ value: "barbara", label: "Barbara Liskov" },
];

const LABELS: readonly FilterOption[] = [
	{ value: "bug", label: "Bug" },
	{ value: "feature", label: "Feature" },
	{ value: "chore", label: "Chore" },
	{ value: "regression", label: "Regression" },
];

/** Swatches drawn before the count carries the rest. */
const STACK_SWATCH_LIMIT = 4;
/** Faces drawn before the count carries the rest. */
const STACK_FACE_LIMIT = 3;
const FALLBACK_SWATCH = "bg-muted-foreground";

function toToneOptions(entries: readonly ToneEntry[]): readonly FilterOption[] {
	return entries.map((entry: ToneEntry): FilterOption => ({ value: entry.value, label: entry.label, icon: <Dot className={entry.dot} /> }));
}

function toPersonOption(person: FilterOption): FilterOption {
	return { ...person, icon: <PersonFace name={person.label} /> };
}

function toSwatches(entries: readonly ToneEntry[]): ReadonlyMap<string, string> {
	return new Map(entries.map((entry: ToneEntry): [string, string] => [entry.value, entry.dot]));
}

const STATUS_SWATCHES = toSwatches(STATUSES);
const PRIORITY_SWATCHES = toSwatches(PRIORITIES);

interface StackedDotsProps {
	readonly options: readonly FilterOption[];
	readonly swatches: ReadonlyMap<string, string>;
	readonly empty: string;
}

/** Swatches then a count, so several picks stay one glance rather than a list. */
function StackedDots({ options, swatches, empty }: StackedDotsProps): React.JSX.Element {
	const [first] = options;
	if (first === undefined) return <>{empty}</>;
	if (options.length === 1) {
		return (
			<span className="flex min-w-0 items-center gap-1.5">
				<Dot className={swatches.get(first.value) ?? FALLBACK_SWATCH} />
				<span className="truncate">{first.label}</span>
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center">
				{options.slice(0, STACK_SWATCH_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<span key={option.value} className={cn("-ml-1 size-2.5 rounded-full ring-2 ring-background first:ml-0", swatches.get(option.value) ?? FALLBACK_SWATCH)} />
				))}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
		</span>
	);
}

interface StackedPeopleProps {
	readonly options: readonly FilterOption[];
}

/** Faces, overlapped, which is what an assignee filter looks like everywhere. */
function StackedPeople({ options }: StackedPeopleProps): React.JSX.Element {
	const [first] = options;
	if (first === undefined) return <>anyone</>;
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<AvatarGroup>
				{options.slice(0, STACK_FACE_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<PersonFace key={option.value} name={option.label} />
				))}
			</AvatarGroup>
			{options.length === 1 ? <span className="truncate">{first.label}</span> : <span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>}
		</span>
	);
}

function renderStatuses({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedDots options={options} swatches={STATUS_SWATCHES} empty="any status" />;
}

function renderPriorities({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedDots options={options} swatches={PRIORITY_SWATCHES} empty="any priority" />;
}

function renderPeople({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedPeople options={options} />;
}

// `column` is carried through untouched: the primitive never reads it, and it
// exists for exactly the moment below, where the query is walked back out. A
// picker says "Title" and a path says `title`, but the table says `subject`,
// so without the mapping every rule would come out naming a column the storage
// does not have. A schema whose ids already ARE the storage names can leave it
// off entirely and the walk falls back to the path.
const FIELDS: readonly FilterField[] = [
	{
		id: "title",
		label: "Title",
		type: "text",
		column: "subject",
		icon: <TypeIcon />,
	},
	{
		id: "status",
		label: "Status",
		type: "select",
		defaultOperator: "is_any_of",
		options: toToneOptions(STATUSES),
		column: "state",
		renderValue: renderStatuses,
		// Four options, so the built-in editor drops its search box: the input is
		// still there and still owns the keyboard, it is only visually hidden, and
		// typing narrows the list exactly as it does in a native select.
		searchable: false,
		icon: <CircleDotIcon />,
	},
	{
		id: "labels",
		label: "Labels",
		type: "multiselect",
		options: LABELS,
		column: "label_slugs",
		icon: <TagsIcon />,
	},
	{
		id: "priority",
		label: "Priority",
		// A task has ONE priority, so this is a select whose VALUE happens to be a
		// list: `is any of` asks about that single rank, where the `has any of` a
		// multiselect defaults to asks about a set the row does not have.
		type: "select",
		defaultOperator: "is_any_of",
		searchable: false,
		options: toToneOptions(PRIORITIES),
		column: "priority",
		renderValue: renderPriorities,
		icon: <SignalIcon />,
	},
	{
		id: "assignee",
		label: "Assignee",
		type: "multiselect",
		placeholder: "Search people...",
		// The option panel, widened by the field that needs it. The built-in menu
		// defaults to `w-48`, which holds a status or a tag; these rows carry a
		// face and a full name, and at the default width a two-part name
		// truncates. `className` lands last in the panel's own `cn`, so this wins.
		className: "w-56",
		options: TEAM.map(toPersonOption),
		column: "assignee_ids",
		// A list of PEOPLE carries no semantic order, unlike the two ramps above.
		pinSelected: true,
		sortSelected: "label",
		renderValue: renderPeople,
		icon: <UserRoundCheckIcon />,
	},
	{
		id: "estimate",
		label: "Estimate",
		type: "number",
		defaultOperator: "lte",
		column: "story_points",
		icon: <HashIcon />,
	},
	{
		id: "repo",
		label: "Repository",
		icon: <FolderGit2Icon />,
		// A branch carries no column of its own; its LEAVES do. The mapping is
		// collected by dotted path, so `repo.stars` resolves to `repository_stars`
		// while a leaf that omits `column` keeps its own path.
		fields: [
			{ id: "name", label: "Name", type: "text", column: "repository_name" },
			{
				id: "branch",
				label: "Branch",
				type: "text",
				column: "repository_branch",
			},
			{
				id: "stars",
				label: "Stars",
				type: "number",
				column: "repository_stars",
			},
		],
	},
];

/** The seeded estimate band, in story points. */
const SEED_ESTIMATE_BAND: readonly [low: number, high: number] = [3, 8];
/** The seeded repository popularity floor. */
const SEED_MIN_STARS = 100;
/** The nested example's estimate floor, in story points. */
const DEEP_MIN_ESTIMATE = 8;

// The query model is a boolean TREE and the builder draws it as one, so the
// example opens on a query the chip row could not express:
// `status is any of (in progress, blocked) AND (estimate between 3 and 8 OR
// title contains migration) AND repo.stars >= 100`. The middle term renders as
// an indented, bordered card carrying its own combinator.
const SEED_RULES: readonly FilterNode[] = [
	createFilterRule({
		id: "seed-1",
		path: ["status"],
		operator: "is_any_of",
		value: ["in-progress", "blocked"],
	}),
	createFilterGroup({
		id: "seed-group",
		combinator: "or",
		rules: [
			createFilterRule({
				id: "seed-2",
				path: ["estimate"],
				operator: "between",
				value: SEED_ESTIMATE_BAND,
			}),
			createFilterRule({
				id: "seed-3",
				path: ["title"],
				operator: "contains",
				value: "migration",
			}),
		],
	}),
	createFilterRule({
		id: "seed-4",
		path: ["repo", "stars"],
		operator: "gte",
		value: SEED_MIN_STARS,
	}),
];

const SEED: FilterQuery = createFilterQuery(SEED_RULES, "and");

// Two levels down, to show that depth is not capped at one: the inner AND sits
// inside the OR, so `(a OR (b AND c))` survives the round trip through the
// builder and the chip row unchanged.
const DEEP: FilterQuery = createFilterQuery(
	[
		createFilterRule({
			id: "deep-1",
			path: ["labels"],
			operator: "has_any_of",
			value: ["bug", "regression"],
		}),
		createFilterGroup({
			id: "deep-outer",
			combinator: "or",
			rules: [
				createFilterRule({
					id: "deep-2",
					path: ["status"],
					operator: "is",
					value: "blocked",
				}),
				createFilterGroup({
					id: "deep-inner",
					combinator: "and",
					rules: [
						createFilterRule({
							id: "deep-3",
							path: ["estimate"],
							operator: "gte",
							value: DEEP_MIN_ESTIMATE,
						}),
						createFilterRule({
							id: "deep-4",
							path: ["repo", "branch"],
							operator: "starts_with",
							value: "release/",
						}),
					],
				}),
			],
		}),
	],
	"and",
);

/**
 * Every field's storage name, keyed by dotted path.
 *
 * Collected once from the schema rather than looked up per rule, because a
 * nested field's path is only knowable while walking down to it.
 */
function collectColumns(list: readonly FilterField[], prefix: readonly string[] = []): readonly (readonly [string, string])[] {
	return list.flatMap((field: FilterField): readonly (readonly [string, string])[] => {
		const path = [...prefix, field.id];
		const own: readonly (readonly [string, string])[] = field.column === undefined ? [] : [[path.join("."), field.column]];
		return field.fields === undefined ? own : [...own, ...collectColumns(field.fields, path)];
	});
}

const COLUMNS: ReadonlyMap<string, string> = new Map(collectColumns(FIELDS));

/** SQL-ish wording per operator. A Map, because the keys are stored operator ids. */
const OPERATOR_TEXT: ReadonlyMap<string, string> = new Map([
	["contains", "contains"],
	["not_contains", "does not contain"],
	["starts_with", "starts with"],
	["ends_with", "ends with"],
	["is", "is"],
	["is_not", "is not"],
	["empty", "is empty"],
	["not_empty", "is not empty"],
	["eq", "="],
	["neq", "!="],
	["gt", ">"],
	["gte", ">="],
	["lt", "<"],
	["lte", "<="],
	["between", "between"],
	["not_between", "not between"],
	["is_any_of", "is any of"],
	["is_none_of", "is none of"],
	["has_any_of", "has any of"],
	["has_all_of", "has all of"],
	["has_none_of", "has none of"],
]);

function formatValue(value: FilterValueItem | undefined): string {
	if (value === undefined || value === null) return "null";
	if (isNumberPrimitive(value) || isBooleanPrimitive(value)) return String(value);
	if (isFilterDateValue(value)) return `'${value.date ?? JSON.stringify(value.relative)}'`;
	return `'${value}'`;
}

/**
 * One node as text, groups parenthesised.
 *
 * The root is NOT wrapped: a query is already an implicit group, and drawing
 * its brackets would suggest a level the tree does not have. Every nested
 * group is, because that is the whole point of one - the reader has to see
 * where the OR stops.
 */
function describeNode(node: FilterNode, depth = 0): string {
	if (isFilterRule(node)) {
		const key = node.path.join(".");
		// A field the schema no longer has still renders, under its own path.
		const column = COLUMNS.get(key) ?? key;
		// A rule exists from the moment an attribute is picked, before a condition
		// has been chosen, so an empty operator is a real state and not a bug.
		if (node.operator === "") return `${column} ...`;

		const word = OPERATOR_TEXT.get(node.operator) ?? node.operator;
		const values = filterValueItems(node.value);
		const [first, second] = values;

		let text: string;
		if (node.value === undefined) {
			text = `${column} ${word}`;
		} else if (node.operator === "between" || node.operator === "not_between") {
			text = `${column} ${word} ${formatValue(first)} and ${formatValue(second)}`;
		} else if (values.length > 1) {
			text = `${column} ${word} (${values.map(formatValue).join(", ")})`;
		} else {
			text = `${column} ${word} ${formatValue(first)}`;
		}

		// `negated` is set rather than the operator swapped whenever the operator
		// declares no inverse, which in the built-in catalog means `starts_with`,
		// `ends_with` and `has_all_of`. Reading the query without honouring it
		// would describe the exact opposite of what the chip says.
		return node.negated === true ? `NOT (${text})` : text;
	}

	if (node.rules.length === 0) return "";

	const joiner = ` ${node.combinator.toUpperCase()} `;
	const inner = node.rules
		.map((child: FilterNode): string => describeNode(child, depth + 1))
		.filter((part: string): boolean => part !== "")
		.join(joiner);

	return depth === 0 ? inner : `(${inner})`;
}

export function Filters11Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(SEED);
	const expression = React.useMemo((): string => {
		const described = describeNode(query);
		return described === "" ? "everything" : described;
	}, [query]);
	const nestTwoLevels = React.useCallback((): void => {
		setQuery(DEEP);
	}, []);
	const reset = React.useCallback((): void => {
		setQuery(SEED);
	}, []);

	return (
		<div className="flex w-full flex-col gap-4">
			{/*
        Stacked, not beside the output, and that is a measurement rather than a
        preference. A condition is five cells wide and every nesting level pays
        the leading combinator column, the card border and the indent again, so
        each depth costs roughly 88px off the row. At depth two a 34rem column
        leaves the attribute cell around 45px of text and the row reads
        "# | i. | 8". The builder takes the full width and the output goes
        underneath it, which is the only arrangement where this example's own
        "Nest two levels" button produces something legible.
      */}
			{/*
        The surface is the CONSUMER's, and it is a WRAPPER - the ordinary thing,
        written the ordinary way. The builder owns everything inside itself and
        nothing about the box it sits in, so the box is a `Card` here and could
        be a Frame, a bare section, or nothing at all.

        The primitive used to take this element as an `advancedSurface` prop and
        render itself AS it. That worked, and a wrapper buys the same result
        with no seam to explain: no rule about which way `className` merges, and
        no list of the props the panel has to keep stamping on an element it does
        not own. Inline the panel pads itself by nothing, so the Card's own
        padding is the only padding, which is what makes this read as one box.
      */}
			<Card className="w-full">
				<CardContent>
					{/* Reordering is opt-in, and this is the example it is for: a nested
						tree somebody is shaping, where the ORDER is part of reading it. */}
					<Filters variant="advanced" advancedMode="inline" reorderable fields={FIELDS} query={query} onQueryChange={setQuery} />
				</CardContent>
			</Card>

			<div className="flex min-w-0 flex-col gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" onClick={nestTwoLevels}>
						Nest two levels
					</Button>
					<Button variant="outline" size="sm" onClick={reset}>
						Reset
					</Button>
					<span className="ms-auto text-sm text-muted-foreground tabular-nums">{`${String(countFilterRules(query))} rules`}</span>
				</div>

				{/*
          ONE output, not two. A group is a parenthesised list joined by ONE
          combinator, so a walk needs no precedence rules to guess at: bracket
          each nested group and the tree reads back exactly as it was built,
          resolved through each field's `column`. That walk is what this example
          is for. The raw `JSON.stringify(query)` panel that used to sit beside
          it was debugger output, not a demonstration: it restated the same tree
          in a shape nobody reads, and it halved the width the readable half had.
        */}
				<code className="block w-full overflow-x-auto rounded-md border bg-muted p-3 text-xs dark:bg-muted/60">{expression}</code>
			</div>
		</div>
	);
}
