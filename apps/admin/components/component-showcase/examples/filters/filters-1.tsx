"use client";

import { ArchiveIcon, BookUserIcon, Building2Icon, CircleDotIcon, GlobeIcon, HashIcon, StarIcon, TypeIcon, UserMinusIcon, UserRoundCheckIcon } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarGroup } from "@workspace/ui/components/avatar";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import type { FilterField, FilterLoadContext, FilterLoadResult, FilterOption, FilterQuery, FilterValueDisplayContext } from "@workspace/ui/components/filters/filters-types";
import { cn } from "@workspace/ui/lib/core/utils";

/* -------------------------------------------------------------------------- */
/*                                  Fixtures                                  */
/* -------------------------------------------------------------------------- */

interface GlyphProps {
	readonly className: string;
}

function Dot({ className }: GlyphProps): React.JSX.Element {
	return <span className={cn("size-2 shrink-0 rounded-full", className)} />;
}

/**
 * Priority's swatch, and the reason it is a star rather than a second `Dot`:
 * Status and Priority are both "pick some of a short list", so drawing both
 * with a coloured circle made one chip read as the other. A rank is not a
 * state.
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

/**
 * Nobody, as a real `Avatar` rather than a lookalike span.
 *
 * `AvatarGroup` rings and overlaps its `[data-slot=avatar]` children only, so a
 * hand-rolled circle would sit in the stack without the ring the others get.
 */
function Unassigned(): React.JSX.Element {
	return (
		<Avatar size="sm" className="size-5">
			<AvatarFallback className="text-muted-foreground [&_svg]:size-3">
				<UserMinusIcon />
			</AvatarFallback>
		</Avatar>
	);
}

interface StatusEntry {
	readonly value: string;
	readonly label: string;
	/** Swatch fill: a semantic or tone token. */
	readonly dot: string;
}

interface PriorityEntry {
	readonly value: string;
	readonly label: string;
	/** Star colour: a tone token carrying its own `!`. */
	readonly star: string;
}

interface TeamEntry {
	readonly value: string;
	readonly label: string;
}

// The colour class each entry wears is named for the glyph that wears it, so a
// swatch and a rank can never be read off the same key by accident.
const STATUSES: readonly StatusEntry[] = [
	{ value: "todo", label: "To Do", dot: "bg-muted-foreground" },
	{ value: "in-progress", label: "In Progress", dot: "bg-tone-yellow" },
	{ value: "review", label: "In Review", dot: "bg-tone-blue" },
	{ value: "done", label: "Done", dot: "bg-tone-green" },
	{ value: "cancelled", label: "Cancelled", dot: "bg-destructive" },
];

// Priority is a ramp rather than a set of labels, so its tones run one way,
// cool to hot, and the star wears them as `text-*` carrying its own `!`. The
// categorical tone tokens hold their contrast in both themes, so the ladder
// reads the same way in light and dark.
const PRIORITIES: readonly PriorityEntry[] = [
	{ value: "low", label: "Low", star: "text-tone-teal!" },
	{ value: "medium", label: "Medium", star: "text-tone-yellow!" },
	{ value: "high", label: "High", star: "text-tone-orange!" },
	{ value: "urgent", label: "Urgent", star: "text-tone-red!" },
];

// Long enough that the menu scrolls, which is the point: this is the field
// that opts into both the pinned stack and a taller panel, and neither is
// legible on a list that fits whole.
const TEAM: readonly TeamEntry[] = [
	{ value: "ada", label: "Ada Lovelace" },
	{ value: "grace", label: "Grace Hopper" },
	{ value: "alan", label: "Alan Turing" },
	{ value: "katherine", label: "Katherine Johnson" },
	{ value: "edsger", label: "Edsger Dijkstra" },
	{ value: "barbara", label: "Barbara Liskov" },
	{ value: "tim", label: "Tim Berners-Lee" },
	{ value: "margaret", label: "Margaret Hamilton" },
	{ value: "donald", label: "Donald Knuth" },
	{ value: "radia", label: "Radia Perlman" },
	{ value: "linus", label: "Linus Torvalds" },
	{ value: "anita", label: "Anita Borg" },
	{ value: "ken", label: "Ken Thompson" },
	{ value: "frances", label: "Frances Allen" },
	{ value: "dennis", label: "Dennis Ritchie" },
	{ value: "shafi", label: "Shafi Goldwasser" },
	{ value: "vint", label: "Vint Cerf" },
	{ value: "carol", label: "Carol Shaw" },
	{ value: "guido", label: "Guido van Rossum" },
	{ value: "jean", label: "Jean Bartik" },
];

/** 120 rows, so the list genuinely searches and scrolls. */
const COUNTRY_NAMES: readonly string[] = [
	"Afghanistan",
	"Albania",
	"Algeria",
	"Andorra",
	"Angola",
	"Argentina",
	"Armenia",
	"Australia",
	"Austria",
	"Azerbaijan",
	"Bahamas",
	"Bahrain",
	"Bangladesh",
	"Barbados",
	"Belarus",
	"Belgium",
	"Belize",
	"Benin",
	"Bhutan",
	"Bolivia",
	"Botswana",
	"Brazil",
	"Brunei",
	"Bulgaria",
	"Burkina Faso",
	"Burundi",
	"Cambodia",
	"Cameroon",
	"Canada",
	"Chad",
	"Chile",
	"China",
	"Colombia",
	"Comoros",
	"Congo",
	"Costa Rica",
	"Croatia",
	"Cuba",
	"Cyprus",
	"Czechia",
	"Denmark",
	"Djibouti",
	"Dominica",
	"Ecuador",
	"Egypt",
	"Estonia",
	"Eswatini",
	"Ethiopia",
	"Fiji",
	"Finland",
	"France",
	"Gabon",
	"Gambia",
	"Georgia",
	"Germany",
	"Ghana",
	"Greece",
	"Grenada",
	"Guatemala",
	"Guinea",
	"Guyana",
	"Haiti",
	"Honduras",
	"Hungary",
	"Iceland",
	"India",
	"Indonesia",
	"Iran",
	"Iraq",
	"Ireland",
	"Israel",
	"Italy",
	"Jamaica",
	"Japan",
	"Jordan",
	"Kazakhstan",
	"Kenya",
	"Kuwait",
	"Kyrgyzstan",
	"Laos",
	"Latvia",
	"Lebanon",
	"Lesotho",
	"Liberia",
	"Libya",
	"Lithuania",
	"Luxembourg",
	"Madagascar",
	"Malawi",
	"Malaysia",
	"Maldives",
	"Mali",
	"Malta",
	"Mexico",
	"Moldova",
	"Monaco",
	"Mongolia",
	"Morocco",
	"Mozambique",
	"Namibia",
	"Nepal",
	"Netherlands",
	"New Zealand",
	"Nicaragua",
	"Nigeria",
	"Norway",
	"Oman",
	"Pakistan",
	"Panama",
	"Paraguay",
	"Peru",
	"Philippines",
	"Poland",
	"Portugal",
	"Qatar",
	"Romania",
	"Rwanda",
	"Senegal",
	"Serbia",
	"Singapore",
];

const WHITESPACE_RUN = /\s+/g;

const COUNTRIES: readonly FilterOption[] = COUNTRY_NAMES.map((name: string): FilterOption => ({ value: name.toLowerCase().replace(WHITESPACE_RUN, "-"), label: name }));

/** How many contacts the fake directory holds. */
const DIRECTORY_SIZE = 4000;
/** Rows per page of the directory. */
const DIRECTORY_PAGE_SIZE = 25;
/** The fake wire's latency, in milliseconds. */
const SEARCH_LATENCY_MS = 260;
/** Swatches or stars drawn in a stack before the count carries the rest. */
const STACK_GLYPH_LIMIT = 4;
/** Faces drawn in a stack before the rest collapse into a "+n". */
const STACK_FACE_LIMIT = 3;
/** The stated attribute totals of two nested branches, known before they are read. */
const TEAM_ATTRIBUTE_COUNT = 26;
const LOCATION_ATTRIBUTE_COUNT = 3;
/** Indentation of the JSON readout. */
const JSON_INDENT = 2;

/** A directory too large to ship to the client, so it pages over a (fake) wire. */
const DIRECTORY: readonly FilterOption[] = Array.from({ length: DIRECTORY_SIZE }, (_: undefined, index: number): FilterOption => ({
	value: `u-${String(index)}`,
	label: `Contact ${String(index + 1)}`,
}));

function searchDirectory(query: string, { signal, cursor }: FilterLoadContext): Promise<FilterLoadResult> {
	const needle = query.trim().toLowerCase();
	const matches = DIRECTORY.filter((option: FilterOption): boolean => option.label.toLowerCase().includes(needle));
	const start = cursor === undefined ? 0 : Number(cursor);
	const next = start + DIRECTORY_PAGE_SIZE;
	const page = matches.slice(start, next);
	return new Promise<FilterLoadResult>((resolve: (result: FilterLoadResult) => void, reject: (reason: DOMException) => void): void => {
		const timer = setTimeout((): void => {
			resolve({
				items: page,
				nextCursor: next < matches.length ? String(next) : undefined,
			});
		}, SEARCH_LATENCY_MS);
		signal.addEventListener("abort", (): void => {
			clearTimeout(timer);
			reject(new DOMException("Aborted", "AbortError"));
		});
	});
}

/* -------------------------------------------------------------------------- */
/*                        Stacked value display renderers                     */
/* -------------------------------------------------------------------------- */

interface StackedOptionsProps {
	readonly options: readonly FilterOption[];
}

/**
 * Overlapping swatches plus a count, instead of "3 selected".
 *
 * Status only. Priority used to share this renderer behind an `empty` prop,
 * which meant sharing the lookup too: both branches searched
 * `STATUSES.concat(PRIORITIES)` and took the first hit, so the day the two
 * tables happened to share a value one field would silently have worn the
 * other's colour. Each renderer now reads its own table, and since one table
 * keys its class as `dot` and the other as `star`, that concat no longer even
 * type-checks.
 */
function StackedDots({ options }: StackedOptionsProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>any status</>;
	if (options.length === 1) {
		const entry = STATUSES.find((candidate: StatusEntry): boolean => candidate.value === only.value);
		return (
			<span className="flex items-center gap-1.5">
				<Dot className={entry?.dot ?? "bg-muted-foreground"} />
				{only.label}
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center">
				{options.slice(0, STACK_GLYPH_LIMIT).map((option: FilterOption): React.JSX.Element => {
					const entry = STATUSES.find((candidate: StatusEntry): boolean => candidate.value === option.value);
					return <span key={option.value} className={cn("-ml-1 size-2.5 rounded-full ring-2 ring-background first:ml-0", entry?.dot ?? "bg-muted-foreground")} />;
				})}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
		</span>
	);
}

/**
 * The same three branches as `StackedDots`, in the other visual language.
 *
 * Split rather than parameterised because the two glyphs do not stack the same
 * way. A dot cuts itself out of its neighbour with `ring-2 ring-background`; a
 * ring around a star draws a rounded RECTANGLE around the icon's box, so these
 * lean on each other far less instead and keep their outlines readable. Folding
 * that into one renderer would have meant passing the swatch, the table, the
 * overlap and the empty word, which is the entire component as arguments.
 * `StackedPeople` below already settled this question the same way.
 *
 * Priority is one field with one ladder, so this renderer, the table it reads
 * and the empty word it falls back to are kept identical here and in
 * c-filters-7. One concept, one implementation, across both examples.
 */
function StackedStars({ options }: StackedOptionsProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>any priority</>;
	if (options.length === 1) {
		const entry = PRIORITIES.find((candidate: PriorityEntry): boolean => candidate.value === only.value);
		return (
			<span className="flex items-center gap-1.5">
				<Star className={cn("size-3.5", entry?.star ?? "text-muted-foreground")} />
				{only.label}
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center">
				{options.slice(0, STACK_GLYPH_LIMIT).map((option: FilterOption): React.JSX.Element => {
					const entry = PRIORITIES.find((candidate: PriorityEntry): boolean => candidate.value === option.value);
					return <Star key={option.value} className={cn("-ml-0.5 size-3.5 first:ml-0", entry?.star ?? "text-muted-foreground")} />;
				})}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
		</span>
	);
}

interface FaceProps {
	readonly option: FilterOption;
}

/** A teammate's face, or the icon that stands in for nobody. */
function Face({ option }: FaceProps): React.JSX.Element {
	const entry = TEAM.find((candidate: TeamEntry): boolean => candidate.value === option.value);
	return entry === undefined ? <Unassigned /> : <Person name={entry.label} />;
}

/**
 * A real `AvatarGroup`, plus an overflow count.
 *
 * The group keeps its default `ring-2`, which reads as a wider collar once the
 * faces drop to 16px, and the two overrides both follow from that size: the
 * stack tightens to `-space-x-1`, because the default `-space-x-2` hides half
 * of a 16px face, and `size-4` beats the face's own `size-5` on specificity
 * exactly as the group's own ring does. The count appears only on genuine
 * overflow, so three picks show three faces and no redundant "3" beside them.
 */
function StackedPeople({ options }: StackedOptionsProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>anyone</>;
	if (options.length === 1) {
		return (
			<span className="flex items-center gap-1.5">
				<Face option={only} />
				{only.label}
			</span>
		);
	}

	const overflow = options.length - STACK_FACE_LIMIT;

	return (
		<span className="flex items-center gap-1.5">
			<AvatarGroup className="-space-x-1 *:data-[slot=avatar]:size-4">
				{options.slice(0, STACK_FACE_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<Face key={option.value} option={option} />
				))}
			</AvatarGroup>
			{overflow > 0 ? <span className="text-xs text-muted-foreground tabular-nums">+{overflow}</span> : null}
		</span>
	);
}

function renderStatuses({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedDots options={options} />;
}

function renderPriorities({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedStars options={options} />;
}

function renderPeople({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedPeople options={options} />;
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

// Icon names are written out per field rather than built by a helper: the
// shadcn CLI rewrites these attributes to a real import at install time and
// only accepts string literals, so a shared `icon(...)` factory would break
// `shadcn add` for everyone installing this example.
const FIELDS: readonly FilterField[] = [
	{
		id: "description",
		label: "Description",
		type: "text",
		icon: <TypeIcon />,
	},
	{
		id: "status",
		label: "Status",
		type: "select",
		defaultOperator: "is_any_of",
		icon: <CircleDotIcon />,
		options: STATUSES.map((entry: StatusEntry): FilterOption => ({
			value: entry.value,
			label: entry.label,
			icon: <Dot className={entry.dot} />,
		})),
		// The one field here that turns its search box off, so the treatment is
		// visible next to the two that keep theirs. The input is still rendered,
		// only visually hidden: it is what owns focus and `aria-activedescendant`,
		// so removing it would take the keyboard with it, and typing still narrows
		// exactly as it does in a native select. Priority below keeps its box, and
		// Country needs one, because 120 rows are not scanned by eye.
		searchable: false,
		// Stack the picks at the top, with a rule under them. Off by default in
		// the primitive, because a list short enough to read whole should not
		// reorder itself under the reader; this example turns it on across every
		// option field so the treatment can be compared on a five row status, a
		// people list with an exclusive row, 120 countries and a paged directory.
		pinSelected: true,
		renderValue: renderStatuses,
	},
	{
		id: "priority",
		label: "Priority",
		// A task has ONE priority, so this is a select - and `is`, the SINGLE-valued
		// operator, is what says so. `is any of` is a question about a set, which
		// reads oddly against a rank a row can only hold one of; it is still in the
		// menu for anyone filtering on two of them at once. Assignee below is the
		// real multiselect, because a task can genuinely carry several people.
		type: "select",
		defaultOperator: "is",
		// The value menu's search box, named for the list under it instead of the
		// generic "Search...".
		//
		// The primitive will not compose this for you, on purpose: a built in
		// `Search ${label}...` is hardcoded English that no `labels` override can
		// reach, and lowercasing a label is locale hostile besides (Turkish dotted
		// i, German nouns). So the wording is the schema's to give, and every
		// searchable field here gives it.
		placeholder: "Search priority...",
		// A star, matching the glyph its options wear. The field icon rides in the
		// chip and in the attribute list, so a flag here would announce one thing
		// and the menu under it another.
		icon: <StarIcon />,
		options: PRIORITIES.map((entry: PriorityEntry): FilterOption => ({
			value: entry.value,
			label: entry.label,
			icon: <Star className={cn("size-3.5", entry.star)} />,
		})),
		pinSelected: true,
		renderValue: renderPriorities,
	},
	{
		id: "assignee",
		label: "Assignee",
		type: "multiselect",
		placeholder: "Search people...",
		icon: <UserRoundCheckIcon />,
		options: [
			...TEAM.map((person: TeamEntry): FilterOption => ({
				value: person.value,
				label: person.label,
				icon: <Person name={person.label} />,
			})),
			// "Nobody" is a real filter, not the absence of one, and `exclusive` is
			// what makes it behave like one: it clears the other picks, they clear
			// it, and it sits under a rule of its own below the people.
			{
				value: "unassigned",
				label: "Unassigned",
				icon: <Unassigned />,
				exclusive: true,
			},
		],
		pinSelected: true,
		// Inside each group the order is the schema's by default, because option
		// order is usually semantic - Priority reads Low to Urgent above and
		// sorting it would destroy that. A list of PEOPLE carries no such order,
		// so this one opts into alphabetical. "Unassigned" sits outside both
		// groups either way: it is grouped by role, not by whether it is ticked.
		sortSelected: "label",
		// BIGGER on both axes than the defaults, because this is the one field where
		// the stack has to be readable and the rows are the widest the primitive
		// draws: an avatar, then a full name. At the panel's own `w-48` a name like
		// "Katherine Johnson" truncates, and at the default height the rule under
		// the pinned picks lands near the bottom edge with barely a row of "the
		// rest" below it. Both land on the panel after the primitive's own, so a
		// `w-*` and the option list's taller `max-h-*` simply win.
		className: "w-64 [&_[data-slot=command-list]]:max-h-104",
		renderValue: renderPeople,
	},
	{
		id: "country",
		label: "Country",
		type: "select",
		defaultOperator: "is_any_of",
		placeholder: "Search countries...",
		// 120 options, so the editor shows its search box and the list scrolls.
		// This is the length the stack is actually for: without it a pick made an
		// hour ago is somewhere behind a scrollbar.
		options: COUNTRIES,
		pinSelected: true,
		icon: <GlobeIcon />,
	},
	{
		id: "contact",
		label: "Contact",
		type: "select",
		defaultOperator: "is_any_of",
		placeholder: "Search contacts...",
		// Paged over the wire, with abort and a Load more row.
		loadOptions: searchDirectory,
		// Load more APPENDS, so without the stack a pick made on the first page
		// sinks a little further with every page fetched after it. Pinning holds
		// it at the top of whatever has been loaded. It cannot do more than that:
		// an async list only ever shows the pages it has, so a pick that is in no
		// loaded page is not a row here at all, stacked or otherwise. The chip
		// still draws it, off the resolved-option cache.
		pinSelected: true,
		icon: <BookUserIcon />,
	},
	{
		id: "company",
		label: "Company",
		icon: <Building2Icon />,
		// Nested. A branch NAVIGATES: pressing it opens its attributes, which is
		// what its chevron and its count promise, and it never commits a filter on
		// itself. Filtering on the company as a whole is the explicit leaf below.
		fields: [
			{ id: "name", label: "Name", type: "text" },
			{ id: "domain", label: "Domain", type: "text" },
			{
				id: "team",
				label: "Team",
				count: TEAM_ATTRIBUTE_COUNT,
				fields: [
					{ id: "lead", label: "Lead", type: "text" },
					{ id: "size", label: "Size", type: "number" },
				],
			},
			{
				id: "location",
				label: "Primary location",
				count: LOCATION_ATTRIBUTE_COUNT,
				fields: [
					{ id: "city", label: "City", type: "text" },
					{ id: "country", label: "Country", type: "text" },
				],
			},
		],
	},
	{
		id: "score",
		label: "Score",
		type: "number",
		icon: <HashIcon />,
	},
	{
		id: "archived",
		label: "Archived",
		type: "boolean",
		icon: <ArchiveIcon />,
	},
];

// Two chips, because the two stacked treatments are the thing on show and
// neither survives a screenshot of an empty bar. Four assignees overflow the
// group and print the "+1"; the priority chip shows one star and its word.
const INITIAL_QUERY: FilterQuery = createFilterQuery([
	createFilterRule({
		id: "seed-1",
		path: ["assignee"],
		operator: "has_any_of",
		value: ["ada", "grace", "alan", "katherine"],
	}),
	createFilterRule({
		id: "seed-2",
		path: ["priority"],
		// `is`, matching the field's own default, and so ONE value: the operator's
		// arity decides the stored shape.
		operator: "is",
		value: "urgent",
	}),
]);

export function Filters1Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(INITIAL_QUERY);

	return (
		<div className="flex w-full flex-col gap-5">
			<Filters fields={FIELDS} query={query} onQueryChange={setQuery} showClear />

			{/*
        `max-h-80` is the largest step that still clears the frame. Measured in
        sera, the tallest style, at the narrowest card: the bar wraps to three
        rows and stops there at 136px, which puts this box at y=160 inside the
        560px `previewHeight`. 320px of readout leaves an 80px cushion. Going
        further would clip the box off the bottom SILENTLY, because the preview
        frame hides its own scrollbar, so re-measure before raising it again.
      */}
			<pre className="max-h-80 w-full overflow-auto rounded-md border bg-muted p-3 text-xs dark:bg-muted/60">{JSON.stringify(query, null, JSON_INDENT)}</pre>
		</div>
	);
}
