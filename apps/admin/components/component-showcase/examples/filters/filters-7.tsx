"use client";

import { isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { BriefcaseBusinessIcon, CircleDotIcon, GlobeIcon, StarIcon, UserRoundIcon, WifiIcon } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Card } from "@workspace/ui/components/card";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule, isFilterRule } from "@workspace/ui/components/filters/filters-query";
import {
	isFilterValueList,
	type FilterField,
	type FilterNode,
	type FilterOption,
	type FilterQuery,
	type FilterRule,
	type FilterValue,
	type FilterValueDisplayContext,
	type FilterValueItem,
} from "@workspace/ui/components/filters/filters-types";
import { cn } from "@workspace/ui/lib/core/utils";

/* -------------------------------------------------------------------------- */
/*                                    Tones                                   */
/* -------------------------------------------------------------------------- */

interface GlyphProps {
	readonly className: string;
}

/** A filled swatch, at c-filters-1's size. */
function Dot({ className }: GlyphProps): React.JSX.Element {
	return <span className={cn("size-2 shrink-0 rounded-full", className)} />;
}

/**
 * Priority's glyph, and the reason it is a star rather than a third `Dot`:
 * Status, Priority and Availability are all "pick some of a short list", so a
 * third coloured circle would have made one chip read as another. A rank is not
 * a state.
 *
 * OUTLINE in all five icon sets, deliberately. lucide, tabler and hugeicons
 * draw their star with a stroke and would take a `fill-current`, but phosphor
 * and remixicon draw theirs as an already filled RING, which no class can
 * solidify. Filling would therefore give three libraries a solid star and two a
 * hollow one, so all five stay hollow.
 *
 * The colour arrives with its own `!`, and the paths are pinned to inherit it,
 * because every style sheet repaints a highlighted row's descendants with
 * `color: var(--accent-foreground)` at a specificity no plain utility beats.
 * Unpinned, the star greys out under the cursor, and each path's `currentColor`
 * resolves against the repaint rather than against the star. Dots never met
 * this: a `bg-*` swatch has no `color` to repaint.
 */
function Star({ className }: GlyphProps): React.JSX.Element {
	return <StarIcon className={cn("shrink-0 **:text-inherit!", className)} />;
}

interface FlagProps {
	readonly code: string;
}

/**
 * The country, drawn the same way in the option row and in the cell. The
 * gallery ships sample data only and fetches nothing, so the country is its
 * ISO code in a small tile rather than a flag image from a CDN.
 */
function Flag({ code }: FlagProps): React.JSX.Element {
	return (
		<span
			aria-hidden="true"
			className="inline-flex h-4 min-w-5 shrink-0 items-center justify-center rounded-sm bg-muted px-0.5 text-[length:var(--text-badge-xs)] font-medium text-muted-foreground uppercase">
			{code}
		</span>
	);
}

interface Tone {
	readonly value: string;
	readonly label: string;
	/** A tone token class: `bg-tone-*` for a swatch, `text-tone-*!` for the star. */
	readonly tone: string;
}

/**
 * Three palettes, each settled inside itself, all from the categorical tone
 * tokens so the contrast holds in both themes. Hues repeat ACROSS the sets
 * (active and online are both green, and in a staff table they should be) but
 * never inside one of the two LABEL sets.
 */
const STATUSES: readonly Tone[] = [
	{ value: "active", label: "Active", tone: "bg-tone-green" },
	{ value: "invited", label: "Invited", tone: "bg-tone-blue" },
	{ value: "suspended", label: "Suspended", tone: "bg-tone-red" },
];

const AVAILABILITIES: readonly Tone[] = [
	{ value: "online", label: "Online", tone: "bg-tone-green" },
	{ value: "away", label: "Away", tone: "bg-tone-yellow" },
	{ value: "busy", label: "Busy", tone: "bg-tone-red" },
	{ value: "offline", label: "Offline", tone: "bg-muted-foreground" },
];

// Priority is a ramp rather than a set of labels, so its tones run one way,
// cool to hot, and the star wears them as `text-*` carrying its own `!`.
const PRIORITIES: readonly Tone[] = [
	{ value: "low", label: "Low", tone: "text-tone-teal!" },
	{ value: "medium", label: "Medium", tone: "text-tone-yellow!" },
	{ value: "high", label: "High", tone: "text-tone-orange!" },
	{ value: "urgent", label: "Urgent", tone: "text-tone-red!" },
];

const ROLES: readonly FilterOption[] = [
	{ value: "Product Manager", label: "Product Manager" },
	{ value: "Data Scientist", label: "Data Scientist" },
	{ value: "Designer", label: "Designer" },
	{ value: "Developer", label: "Developer" },
];

const NEUTRAL_DOT = "bg-muted-foreground";
const NEUTRAL_STAR = "text-muted-foreground";
/** Glyphs drawn in a collapsed stack before the count carries the rest. */
const STACK_LIMIT = 4;

const DOTS: ReadonlyMap<string, string> = new Map([...STATUSES, ...AVAILABILITIES].map((tone: Tone): [string, string] => [tone.value, tone.tone]));
const STARS: ReadonlyMap<string, string> = new Map(PRIORITIES.map((tone: Tone): [string, string] => [tone.value, tone.tone]));

/* -------------------------------------------------------------------------- */
/*                                  The rows                                  */
/* -------------------------------------------------------------------------- */

interface Staff {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly role: string;
	readonly priority: string;
	readonly status: string;
	readonly availability: string;
	readonly location: string;
	readonly flag: string;
}

const STAFF: readonly Staff[] = [
	{
		id: "1",
		name: "Alex Johnson",
		email: "alex@example.com",
		role: "Product Manager",
		priority: "urgent",
		status: "active",
		availability: "online",
		location: "United States",
		flag: "us",
	},
	{
		id: "2",
		name: "Sarah Chen",
		email: "sarah@example.com",
		role: "Data Scientist",
		priority: "high",
		status: "active",
		availability: "away",
		location: "United Kingdom",
		flag: "gb",
	},
	{
		id: "3",
		name: "Michael Rodriguez",
		email: "michael@example.com",
		role: "Designer",
		priority: "medium",
		status: "invited",
		availability: "busy",
		location: "Canada",
		flag: "ca",
	},
	{
		id: "4",
		name: "Emma Wilson",
		email: "emma@example.com",
		role: "Developer",
		priority: "low",
		status: "suspended",
		availability: "offline",
		location: "Australia",
		flag: "au",
	},
	{ id: "5", name: "David Kim", email: "david@example.com", role: "Developer", priority: "high", status: "active", availability: "online", location: "Germany", flag: "de" },
	{
		id: "6",
		name: "Aron Thompson",
		email: "aron@example.com",
		role: "Designer",
		priority: "medium",
		status: "active",
		availability: "away",
		location: "Malaysia",
		flag: "my",
	},
	{
		id: "7",
		name: "James Brown",
		email: "james@example.com",
		role: "Product Manager",
		priority: "low",
		status: "invited",
		availability: "busy",
		location: "Spain",
		flag: "es",
	},
	{
		id: "8",
		name: "Maria Garcia",
		email: "maria@example.com",
		role: "Data Scientist",
		priority: "urgent",
		status: "active",
		availability: "offline",
		location: "Japan",
		flag: "jp",
	},
	{
		id: "9",
		name: "Nick Johnson",
		email: "nick@example.com",
		role: "Developer",
		priority: "medium",
		status: "active",
		availability: "online",
		location: "France",
		flag: "fr",
	},
	{ id: "10", name: "Liam Thompson", email: "liam@example.com", role: "Designer", priority: "low", status: "suspended", availability: "away", location: "Italy", flag: "it" },
	{
		id: "11",
		name: "Olivia Martinez",
		email: "olivia@example.com",
		role: "Data Scientist",
		priority: "high",
		status: "active",
		availability: "busy",
		location: "Brazil",
		flag: "br",
	},
	{
		id: "12",
		name: "Ethan Park",
		email: "ethan@example.com",
		role: "Product Manager",
		priority: "medium",
		status: "invited",
		availability: "online",
		location: "India",
		flag: "in",
	},
];

/**
 * Every country the rows mention, once each, in the order they introduce them.
 * Derived rather than declared, so a country cannot be offered that no row
 * carries: an option that matches nothing is a filter that looks broken.
 */
const LOCATIONS: readonly FilterOption[] = Array.from(
	new Map(
		STAFF.map((person: Staff): [string, FilterOption] => [person.location, { value: person.location, label: person.location, icon: <Flag code={person.flag} /> }]),
	).values(),
);

/* -------------------------------------------------------------------------- */
/*                        Stacked value display renderers                     */
/* -------------------------------------------------------------------------- */

interface StackedDotsProps {
	readonly options: readonly FilterOption[];
	readonly empty: string;
}

/**
 * c-filters-1's treatment, reused rather than re-invented: one pick reads as
 * its swatch and its word, several collapse to overlapping swatches plus a
 * count, so the chip is one width whether two statuses are picked or all three.
 * The empty word is a prop because the same renderer serves two fields.
 */
function StackedDots({ options, empty }: StackedDotsProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>{empty}</>;
	if (options.length === 1) {
		return (
			<span className="flex items-center gap-1.5">
				<Dot className={DOTS.get(only.value) ?? NEUTRAL_DOT} />
				{only.label}
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center">
				{options.slice(0, STACK_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<span key={option.value} className={cn("-ml-1 size-2.5 rounded-full ring-2 ring-background first:ml-0", DOTS.get(option.value) ?? NEUTRAL_DOT)} />
				))}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
		</span>
	);
}

interface StackedStarsProps {
	readonly options: readonly FilterOption[];
}

/**
 * The same collapse, in priority's own glyph.
 *
 * Split from `StackedDots` rather than parameterised, because the two glyphs do
 * not stack the same way. A dot cuts itself out of its neighbour with `ring-2
 * ring-background`; a ring around a star draws a rounded RECTANGLE around the
 * icon's box, so these lean on each other far less instead and keep their
 * outlines readable.
 *
 * Priority is one field with one ladder, so this renderer, the table it reads
 * and the empty word it falls back to are kept identical here and in
 * c-filters-1. One concept, one implementation, across both examples. That is
 * also why the empty word is written in rather than taken as a prop the way
 * `StackedDots` above takes its: this renderer serves ONE field, that one
 * serves two.
 */
function StackedStars({ options }: StackedStarsProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>any priority</>;
	if (options.length === 1) {
		return (
			<span className="flex items-center gap-1.5">
				<Star className={cn("size-3.5", STARS.get(only.value) ?? NEUTRAL_STAR)} />
				{only.label}
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center">
				{options.slice(0, STACK_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<Star key={option.value} className={cn("-ml-0.5 size-3.5 first:ml-0", STARS.get(option.value) ?? NEUTRAL_STAR)} />
				))}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
		</span>
	);
}

function renderPriorities({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedStars options={options} />;
}

function renderStatuses({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedDots options={options} empty="any status" />;
}

function renderAvailabilities({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedDots options={options} empty="any availability" />;
}

function dotOption(tone: Tone): FilterOption {
	return { value: tone.value, label: tone.label, icon: <Dot className={tone.tone} /> };
}

function starOption(tone: Tone): FilterOption {
	return { value: tone.value, label: tone.label, icon: <Star className={cn("size-3.5", tone.tone)} /> };
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

// One field per column, and no field without a column. That is what makes the
// grid underneath a check on the query rather than an illustration beside it:
// every chip narrows something the table prints, and nothing filters on an
// attribute it does not.
//
// Printed is not the same as on screen, and this note used to claim it was. Six
// columns of real content need about 830px, so in a card narrower than that the
// tail of the row sits past the right edge, behind the scroll area's own
// horizontal scrollbar: about one column short at the ~700px catalog width, two
// in a 560px docs frame. The sizes below are each the widest line that column
// actually holds, which is what keeps the overhang to the tail rather than a
// third of the row.
//
// Icon names are written out per library rather than built by a helper: the
// shadcn CLI rewrites these attributes to a real import at install time and
// only accepts string literals, so a shared `icon(...)` factory would break
// `shadcn add` for everyone installing this example.
const FIELDS: readonly FilterField[] = [
	{
		id: "staff",
		label: "Staff",
		type: "text",
		icon: <UserRoundIcon />,
	},
	{
		id: "role",
		label: "Occupation",
		type: "select",
		// Arity, not the field's type, is what opens a multi-select editor: `is any
		// of` takes many values, so a `select` field edits as a checklist under it.
		defaultOperator: "is_any_of",
		options: ROLES,
		// Four rows are read, not searched. The input is hidden rather than
		// removed, so typing still narrows the list.
		searchable: false,
		icon: <BriefcaseBusinessIcon />,
	},
	{
		// A person has ONE priority, so this is a select whose VALUE happens to be
		// a list: `is any of` asks a question about that single rank.
		id: "priority",
		label: "Priority",
		type: "select",
		defaultOperator: "is_any_of",
		options: PRIORITIES.map(starOption),
		// A box that stays gets a word of its own: the wording belongs to the schema.
		placeholder: "Search priority...",
		renderValue: renderPriorities,
		icon: <StarIcon />,
	},
	{
		id: "status",
		label: "Status",
		type: "select",
		defaultOperator: "is_any_of",
		options: STATUSES.map(dotOption),
		searchable: false,
		renderValue: renderStatuses,
		icon: <CircleDotIcon />,
	},
	{
		id: "availability",
		label: "Availability",
		type: "select",
		defaultOperator: "is_any_of",
		options: AVAILABILITIES.map(dotOption),
		searchable: false,
		renderValue: renderAvailabilities,
		icon: <WifiIcon />,
	},
	{
		id: "location",
		label: "Location",
		type: "select",
		defaultOperator: "is_any_of",
		// Twelve countries, so this one keeps its search box.
		options: LOCATIONS,
		placeholder: "Search locations...",
		// A country list carries no order of its own, unlike the ladders above, so
		// it is the one field here that asks for alphabetical.
		sortSelected: "label",
		icon: <GlobeIcon />,
	},
];

/* -------------------------------------------------------------------------- */
/*                          Query tree to row predicate                       */
/* -------------------------------------------------------------------------- */

/**
 * The value one field reads from one row.
 *
 * A lookup rather than `row[path]` because the Staff column prints a name AND
 * an email: a filter named after that column has to search both, or it hides a
 * row whose visible cell holds exactly what was typed.
 */
function readField(row: Staff, fieldId: string | undefined): string {
	switch (fieldId) {
		case "staff":
			return `${row.name} ${row.email}`;
		case "role":
			return row.role;
		case "priority":
			return row.priority;
		case "status":
			return row.status;
		case "availability":
			return row.availability;
		case "location":
			return row.location;
		default:
			return "";
	}
}

/** One stored item as text, for comparison. A date or a null bound has none. */
function itemText(item: FilterValueItem | undefined): string {
	if (isStringPrimitive(item)) return item;
	if (isNumberPrimitive(item) || isBooleanPrimitive(item)) return String(item);
	return "";
}

/** A scalar value as text; a list or a date reads as "". */
function scalarText(value: FilterValue | undefined): string {
	return isFilterValueList(value) ? "" : itemText(value);
}

/** A list value's items as text. */
function listTexts(value: FilterValue | undefined): readonly string[] {
	return isFilterValueList(value) ? value.map(itemText) : [];
}

/** The two bounds of a range value, as numbers. */
function boundsOf(value: FilterValue | undefined): readonly [from: number, to: number] {
	const [from, to] = listTexts(value);
	return [Number(from), Number(to)];
}

/**
 * Compiling the query to a row predicate.
 *
 * The primitive ships no compilers on purpose: every backend wants a different
 * shape, and a half-right SQL emitter is worse than none. What it does
 * guarantee is that the query is a plain serialisable tree, so a compiler is a
 * short recursive function like this one. Note it handles GROUPS as well as
 * rules, so the same code keeps working when nested groups are turned on.
 *
 * The switch covers the whole OPERATOR CATALOG rather than only the operators
 * this schema's six fields offer, which is why the numeric arms are here with
 * no number field in sight: the catalog is fixed, so a compiler written against
 * it is complete, and adding a Salary column later needs no change here.
 */
function testRule(actual: string, rule: FilterRule): boolean {
	const text = scalarText(rule.value);
	const haystack = actual.toLowerCase();
	const needle = text.toLowerCase();
	switch (rule.operator) {
		case "contains":
			return haystack.includes(needle);
		case "not_contains":
			return !haystack.includes(needle);
		case "starts_with":
			return haystack.startsWith(needle);
		case "ends_with":
			return haystack.endsWith(needle);
		case "is":
		case "eq":
			return actual === text;
		case "is_not":
		case "neq":
			return actual !== text;
		case "is_any_of":
			return listTexts(rule.value).includes(actual);
		case "is_none_of":
			return !listTexts(rule.value).includes(actual);
		case "gt":
			return Number(actual) > Number(text);
		case "gte":
			return Number(actual) >= Number(text);
		case "lt":
			return Number(actual) < Number(text);
		case "lte":
			return Number(actual) <= Number(text);
		case "between": {
			const [from, to] = boundsOf(rule.value);
			return Number(actual) >= from && Number(actual) <= to;
		}
		case "not_between": {
			const [from, to] = boundsOf(rule.value);
			return !(Number(actual) >= from && Number(actual) <= to);
		}
		case "empty":
			return actual === "";
		case "not_empty":
			return actual !== "";
		default:
			return true;
	}
}

function matchesRule(row: Staff, rule: FilterRule): boolean {
	const [fieldId] = rule.path;
	const result = testRule(readField(row, fieldId), rule);
	return rule.negated === true ? !result : result;
}

/**
 * A rule with nothing to test yet, which matches everything.
 *
 * `undefined` is the obvious case: the grid must not empty out while a value is
 * still being chosen. The EMPTY LIST is the one that actually bit. Unchecking
 * the last option of a many-arity operator commits `[]`, not `undefined`, so
 * `Availability is any of` was reachable with an empty value, and there the chip
 * printed "any availability" while a literal `[].includes(...)` matched no row
 * at all: the same words as an unfinished rule, and the opposite result.
 *
 * An empty list is the absence of a constraint, exactly as the chip says. Fixing
 * it here rather than in the renderer is deliberate - the word is right, the
 * predicate was wrong.
 *
 * `empty` and `not_empty` are excluded because they carry no value: for those
 * two, having none is the whole test.
 */
function isIncomplete(rule: FilterRule): boolean {
	if (rule.operator === "empty" || rule.operator === "not_empty") return false;
	return rule.value === undefined || (isFilterValueList(rule.value) && rule.value.length === 0);
}

function matches(row: Staff, node: FilterNode): boolean {
	if (isFilterRule(node)) {
		if (isIncomplete(node)) return true;
		return matchesRule(row, node);
	}
	if (node.rules.length === 0) return true;
	const matchesChild = (child: FilterNode): boolean => matches(row, child);
	return node.combinator === "and" ? node.rules.every(matchesChild) : node.rules.some(matchesChild);
}

/* -------------------------------------------------------------------------- */
/*                                 The columns                                */
/* -------------------------------------------------------------------------- */

function initials(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

/** Where a value sits in its ladder. The sort key for the three ranked columns. */
function rankIn(ladder: readonly Tone[], value: string): number {
	return ladder.findIndex((entry: Tone): boolean => entry.value === value);
}

function toneOf(ladder: readonly Tone[], value: string): Tone | undefined {
	return ladder.find((entry: Tone): boolean => entry.value === value);
}

/** Column widths, each the widest line that column actually holds, in pixels. */
const COLUMN_WIDTH = { staff: 200, role: 155, priority: 110, status: 110, availability: 115, location: 140 } satisfies Readonly<Record<string, number>>;

type StaffColumn = ColumnDef<DataGridFeatures, Staff>;

const COLUMNS: readonly StaffColumn[] = [
	{
		accessorKey: "name",
		id: "name",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Staff" column={column} />,
		// `min-w-0` on the text block and `truncate` on both lines, because a flex
		// child's default `min-width: auto` refuses to shrink below its content.
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-2.5">
				<Avatar className="size-8 shrink-0">
					<AvatarFallback>{initials(row.original.name)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<div className="truncate font-medium text-foreground">{row.original.name}</div>
					<div className="truncate text-xs text-muted-foreground">{row.original.email}</div>
				</div>
			</div>
		),
		size: COLUMN_WIDTH.staff,
		enableSorting: true,
	},
	{
		accessorKey: "role",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Occupation" column={column} />,
		// Wide enough for the longest title on ONE line.
		cell: ({ row }): React.JSX.Element => <span className="whitespace-nowrap">{row.original.role}</span>,
		size: COLUMN_WIDTH.role,
		enableSorting: true,
	},
	{
		// Sorted by the ladder's own order, not by the word.
		id: "priority",
		accessorFn: (row: Staff): number => rankIn(PRIORITIES, row.priority),
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Priority" column={column} />,
		cell: ({ row }): React.JSX.Element => {
			const tone = toneOf(PRIORITIES, row.original.priority);
			return (
				<span className="flex items-center gap-1.5">
					<Star className={cn("size-3.5", tone?.tone ?? NEUTRAL_STAR)} />
					{tone?.label}
				</span>
			);
		},
		size: COLUMN_WIDTH.priority,
		enableSorting: true,
	},
	{
		id: "status",
		accessorFn: (row: Staff): number => rankIn(STATUSES, row.status),
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" column={column} />,
		// A badge here and a bare swatch in the menu, deliberately: the option row
		// prints the word beside the swatch already.
		cell: ({ row }): React.JSX.Element => {
			const tone = toneOf(STATUSES, row.original.status);
			return (
				<Badge variant="outline" className="gap-1.5">
					<Dot className={tone?.tone ?? NEUTRAL_DOT} />
					{tone?.label}
				</Badge>
			);
		},
		size: COLUMN_WIDTH.status,
		enableSorting: true,
	},
	{
		id: "availability",
		accessorFn: (row: Staff): number => rankIn(AVAILABILITIES, row.availability),
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Availability" column={column} />,
		cell: ({ row }): React.JSX.Element => {
			const tone = toneOf(AVAILABILITIES, row.original.availability);
			return (
				<span className="flex items-center gap-1.5">
					<Dot className={tone?.tone ?? NEUTRAL_DOT} />
					{tone?.label}
				</span>
			);
		},
		size: COLUMN_WIDTH.availability,
		enableSorting: true,
	},
	{
		accessorKey: "location",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Location" column={column} />,
		cell: ({ row }): React.JSX.Element => (
			<span className="flex items-center gap-1.5">
				<Flag code={row.original.flag} />
				{row.original.location}
			</span>
		),
		size: COLUMN_WIDTH.location,
		enableSorting: true,
	},
];

/* -------------------------------------------------------------------------- */
/*                                  The page                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 5;
const PAGE_SIZES: readonly number[] = [5, 10, 25];
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: false }];
/** Dense, because the toolbar above is the subject and the rows are the evidence. */
const TABLE_LAYOUT: DataGridTableLayout = { dense: true };

const INITIAL_QUERY: FilterQuery = createFilterQuery([
	createFilterRule({
		id: "seed-1",
		path: ["status"],
		operator: "is_any_of",
		value: ["active", "invited"],
	}),
]);

function staffRowId(row: Staff): string {
	return row.id;
}

function firstPage(current: PaginationState): PaginationState {
	return { ...current, pageIndex: 0 };
}

export function Filters7Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(INITIAL_QUERY);
	const [pagination, setPagination] = React.useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = React.useState<SortingState>(INITIAL_SORTING);

	const rows = React.useMemo((): Staff[] => STAFF.filter((row: Staff): boolean => matches(row, query)), [query]);

	const handleQueryChange = React.useCallback((next: FilterQuery): void => {
		setQuery(next);
		// Back to page one on every edit. A narrower query can leave the current
		// page past the end of the result set.
		setPagination(firstPage);
	}, []);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		// The FILTERED rows, not the full set, so sorting, paging and the record
		// count are all taken over what the query left standing.
		data: rows,
		pageCount: Math.ceil(rows.length / pagination.pageSize),
		getRowId: staffRowId,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
	});

	return (
		<DataGrid table={table} recordCount={rows.length} emptyMessage="No staff match these filters" tableLayout={TABLE_LAYOUT}>
			<Card className="w-full gap-0 py-0">
				<div className="border-b p-3">
					<Filters fields={FIELDS} query={query} onQueryChange={handleQueryChange} showClear />
				</div>

				<DataGridContainer>
					<DataGridScrollArea>
						<DataGridTable />
					</DataGridScrollArea>
				</DataGridContainer>

				<div className="border-t p-3">
					{/*
            Four overrides, and every one of them undoes the same bug.
            `DataGridPagination` goes single row at `sm`, which is a VIEWPORT
            query rather than a container one, so inside a card narrower than
            640px it stacks its three parts however wide the card itself is:
            page buttons, then the record range, then rows-per-page, reversed by
            `order-*` and about 140px tall. In a preview frame that is most of
            the height this example has to spend, and a pager nobody can see
            cannot show that the query changed the page count.
              flex-row py-0      the parent's own axis and padding. Plain
                                 utilities, because the primitive merges this
                                 className through `cn`, so tailwind-merge drops
                                 the `flex-col` and `py-2.5` it replaces.
              **:order-none!     source order at every depth. Two levels need
                                 it, the two halves of the bar and the range
                                 against the buttons inside the right half.
              *:py-0!            the two halves' own stacking padding.
              *:last:flex-row!   the right half, which stacks internally too.
            The three `!` are load-bearing: those classes live on the
            primitive's own children, out of tailwind-merge's reach, so nothing
            else can win against them.

            `flex-wrap` is left alone deliberately, so this degrades rather than
            breaks: on a genuinely narrow phone the two halves wrap to two rows
            instead of forcing a 400px row into 375px.
          */}
					<DataGridPagination sizes={PAGE_SIZES} className="flex-row py-0 *:py-0! **:order-none! *:last:flex-row!" />
				</div>
			</Card>
		</DataGrid>
	);
}
