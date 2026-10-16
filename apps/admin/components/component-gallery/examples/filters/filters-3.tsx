"use client";

import * as React from "react";
import { CircleDotIcon, FlagIcon, TypeIcon } from "lucide-react";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import type { FilterField, FilterOption, FilterQuery, FilterValueDisplayContext } from "@workspace/ui/components/filters/filters-types";

import { cn } from "@workspace/ui/lib/core/utils";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

/* -------------------------------------------------------------------------- */
/*                                   Tones                                    */
/* -------------------------------------------------------------------------- */

interface Tone {
	readonly value: string;
	readonly label: string;
	/** Swatch fill, for the option row and for the collapsed stack. A tone token. */
	readonly dot: string;
	/**
	 * The badge in the chip: one of the kit Badge's categorical tone variants,
	 * so the tint, the text and their contrast come from the design tokens.
	 */
	readonly badge: BadgeVariant;
}

/**
 * Six statuses, six tones, each spent once.
 *
 * The palette is settled by the smallest place it appears rather than the
 * largest: two greys, or a yellow next to an orange, are one colour at the 10px
 * the collapsed stack draws them at, however different they look on a row.
 */
const STATUSES: readonly Tone[] = [
	{ value: "backlog", label: "Backlog", dot: "bg-muted-foreground", badge: "secondary" },
	{ value: "in-progress", label: "In progress", dot: "bg-tone-yellow", badge: "yellow" },
	{ value: "review", label: "In review", dot: "bg-tone-blue", badge: "blue" },
	{ value: "done", label: "Done", dot: "bg-tone-green", badge: "green" },
	{ value: "shipped", label: "Shipped", dot: "bg-tone-violet", badge: "violet" },
	{ value: "cancelled", label: "Cancelled", dot: "bg-tone-red", badge: "red" },
];

const PRIORITIES: readonly Tone[] = [
	{ value: "low", label: "Low", dot: "bg-tone-teal", badge: "teal" },
	{ value: "medium", label: "Medium", dot: "bg-tone-yellow", badge: "yellow" },
	{ value: "high", label: "High", dot: "bg-tone-violet", badge: "violet" },
	{ value: "urgent", label: "Urgent", dot: "bg-tone-orange", badge: "orange" },
	{ value: "critical", label: "Critical", dot: "bg-tone-red", badge: "red" },
];

const TONES: ReadonlyMap<string, Tone> = new Map([...STATUSES, ...PRIORITIES].map((tone: Tone): [string, Tone] => [tone.value, tone]));

/**
 * The option row's colour.
 *
 * A swatch rather than a full badge, because the row already prints the word
 * beside it: a badge there would say "Urgent" twice. The badge belongs in the
 * chip, where the word is the only thing carrying the colour. Round, and the
 * size the collapsed stack uses, so one status is one shape wherever it shows.
 */
interface SwatchProps {
	readonly tone: Tone;
}

function Swatch({ tone }: SwatchProps): React.JSX.Element {
	return <span className={cn("size-2.5 shrink-0 rounded-full", tone.dot)} />;
}

function toOptions(tones: readonly Tone[]): FilterOption[] {
	return tones.map((tone: Tone): FilterOption => ({
		value: tone.value,
		label: tone.label,
		icon: <Swatch tone={tone} />,
	}));
}

/* -------------------------------------------------------------------------- */
/*                              Value renderers                               */
/* -------------------------------------------------------------------------- */

/**
 * Where a chip stops being a chip.
 *
 * Two coloured words fit beside a field name and an operator. A third pushes
 * the row past the bar and wraps the chip, and the fifth would double its
 * width again, so past this the picks collapse to a stack that is one width no
 * matter how many are selected.
 */
const BADGE_LIMIT = 2;

/**
 * Colour badges while they fit, a stack once they do not.
 *
 * `renderValue` receives the RESOLVED options, not the raw values, so a display
 * never has to look a stored id up for itself.
 */
interface BadgesOrStackProps {
	readonly options: readonly FilterOption[];
	readonly fallback: string;
}

function BadgesOrStack({ options, fallback }: BadgesOrStackProps): React.JSX.Element {
	if (options.length === 0) return <>{fallback}</>;
	if (options.length > BADGE_LIMIT) return <StackedDots options={options} />;

	return (
		<span className="flex items-center gap-2">
			{options.map((option: FilterOption): React.JSX.Element => (
				<Badge key={option.value} variant={TONES.get(option.value)?.badge ?? "secondary"} className="px-2 py-0.5">
					{option.label}
				</Badge>
			))}
		</span>
	);
}

/**
 * Overlapping swatches plus a count.
 *
 * Four is the cap on the swatches, not on the picks: the count is the honest
 * number and the stack is only the palette behind it, so a fifth and a sixth
 * status cost the chip nothing. The count is muted and small because it is the
 * quieter half of the pair - the colours are what the eye lands on.
 */
/** How many swatches the collapsed stack draws before the count carries the rest. */
const STACK_SWATCH_LIMIT = 4;

interface StackedDotsProps {
	readonly options: readonly FilterOption[];
}

function StackedDots({ options }: StackedDotsProps): React.JSX.Element {
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center">
				{options.slice(0, STACK_SWATCH_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<span key={option.value} className={cn("-ml-1 size-2.5 rounded-full ring-2 ring-background first:ml-0", TONES.get(option.value)?.dot ?? "bg-muted-foreground")} />
				))}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
		</span>
	);
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

const FIELDS: readonly FilterField[] = [
	{
		id: "status",
		label: "Status",
		type: "select",
		// `is_any_of` has arity "many", so the single-valued field still opens a
		// multi-select editor. Arity decides the editor, not the field's type.
		defaultOperator: "is_any_of",
		options: toOptions(STATUSES),
		// Six rows read as colours, not as text, so a search box over them is
		// chrome. It is hidden rather than removed, so typing still narrows.
		searchable: false,
		renderValue: ({ options }: FilterValueDisplayContext): React.ReactNode => <BadgesOrStack options={options} fallback="any status" />,
		icon: <CircleDotIcon />,
	},
	{
		id: "priority",
		label: "Priority",
		type: "multiselect",
		options: toOptions(PRIORITIES),
		searchable: false,
		renderValue: ({ options }: FilterValueDisplayContext): React.ReactNode => <BadgesOrStack options={options} fallback="any priority" />,
		icon: <FlagIcon />,
	},
	{
		id: "title",
		label: "Title",
		type: "text",
		icon: <TypeIcon />,
	},
];

export function Filters3Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(() =>
		createFilterQuery([
			// Five of the six statuses: everything that was not called off. Past the
			// badge limit, so this chip opens on the stack.
			createFilterRule({
				id: "seed-1",
				path: ["status"],
				operator: "is_any_of",
				value: ["backlog", "in-progress", "review", "done", "shipped"],
			}),
			// Two, so the same renderer opens on badges. Both states are on screen
			// at once, and ticking a third priority switches this chip over.
			createFilterRule({
				id: "seed-2",
				path: ["priority"],
				operator: "has_any_of",
				value: ["urgent", "critical"],
			}),
			// "is not empty" carries arity "none", so this chip renders with no value
			// segment at all. Nothing special cases it: the operator says it takes no
			// value and the chip believes it.
			createFilterRule({
				id: "seed-3",
				path: ["title"],
				operator: "not_empty",
			}),
		]),
	);

	return <Filters fields={FIELDS} query={query} onQueryChange={setQuery} showClear />;
}
