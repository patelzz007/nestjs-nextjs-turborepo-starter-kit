"use client";

import * as React from "react";
import { BookUserIcon, Building2Icon, UserRoundCheckIcon } from "lucide-react";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import type { FilterField, FilterLoadContext, FilterLoadResult, FilterOption, FilterQuery, FilterValueDisplayContext } from "@workspace/ui/components/filters/filters-types";

import { Avatar, AvatarFallback, AvatarGroup } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";

/* -------------------------------------------------------------------------- */
/*                                  Fixtures                                  */
/* -------------------------------------------------------------------------- */

interface Person {
	readonly value: string;
	readonly label: string;
	readonly role?: string;
}

/** The first letter of each name part, for a face drawn without a photo. */
function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

interface FaceProps {
	readonly name: string;
}

/**
 * A face as initials. The gallery ships sample data only, so no portrait is
 * fetched from a photo service; the fallback is the whole face.
 */
function Face({ name }: FaceProps): React.JSX.Element {
	return (
		<Avatar size="sm" className="size-5">
			<AvatarFallback className="text-[length:var(--text-badge-xs)]">{initialsOf(name)}</AvatarFallback>
		</Avatar>
	);
}

const TEAM: readonly Person[] = [
	{ value: "ada", label: "Ada Lovelace", role: "Engineering" },
	{ value: "grace", label: "Grace Hopper", role: "Engineering" },
	{ value: "alan", label: "Alan Turing", role: "Research" },
	{ value: "katherine", label: "Katherine Johnson", role: "Research" },
	{ value: "edsger", label: "Edsger Dijkstra", role: "Platform" },
	{ value: "barbara", label: "Barbara Liskov", role: "Platform" },
	{ value: "tim", label: "Tim Berners-Lee", role: "Design" },
	{ value: "margaret", label: "Margaret Hamilton", role: "Design" },
];

/** How many contacts the fake directory holds. */
const DIRECTORY_SIZE = 5000;
/** Rows per page of the directory. */
const DIRECTORY_PAGE_SIZE = 25;
/** The fake wire's latency for a search page, in milliseconds. */
const SEARCH_LATENCY_MS = 280;
/** The fake wire's latency for resolving saved ids, in milliseconds. */
const RESOLVE_LATENCY_MS = 240;
/** Faces drawn in the stack before the rest collapse into a count. */
const STACK_FACE_LIMIT = 3;

/** A directory far too large to ship to the client, so it pages over a (fake) wire. */
const DIRECTORY: readonly Person[] = Array.from({ length: DIRECTORY_SIZE }, (_: undefined, index: number): Person => ({
	value: `u-${String(index)}`,
	label: `Contact ${String(index + 1)}`,
}));

function toOption(person: Person): FilterOption {
	return {
		value: person.value,
		label: person.label,
		description: person.role,
		icon: <Face name={person.label} />,
	};
}

/**
 * One page of the directory, over a fake wire.
 *
 * `loadOptions` receives an AbortSignal and an optional cursor. Debouncing the
 * search, aborting a superseded request, appending the next page and caching a
 * loaded value's label all come from the shared option service, so a field only
 * has to fetch.
 */
function searchDirectory(query: string, { signal, cursor }: FilterLoadContext): Promise<FilterLoadResult> {
	const needle = query.trim().toLowerCase();
	const matches = DIRECTORY.filter((person: Person): boolean => person.label.toLowerCase().includes(needle));
	const start = cursor === undefined ? 0 : Number(cursor);
	const next = start + DIRECTORY_PAGE_SIZE;

	return new Promise<FilterLoadResult>((resolve: (result: FilterLoadResult) => void, reject: (reason: DOMException) => void): void => {
		const timer = setTimeout((): void => {
			resolve({
				items: matches.slice(start, next).map(toOption),
				nextCursor: next < matches.length ? String(next) : undefined,
			});
		}, SEARCH_LATENCY_MS);
		signal.addEventListener("abort", (): void => {
			clearTimeout(timer);
			reject(new DOMException("Aborted", "AbortError"));
		});
	});
}

/** Names for ids nobody has searched for. The saved-view half of the problem. */
function fetchPeople(ids: readonly string[]): Promise<readonly FilterOption[]> {
	const wanted = new Set(ids);
	return new Promise<readonly FilterOption[]>((resolve: (options: readonly FilterOption[]) => void): void => {
		setTimeout((): void => {
			resolve(DIRECTORY.filter((person: Person): boolean => wanted.has(person.value)).map(toOption));
		}, RESOLVE_LATENCY_MS);
	});
}

/* -------------------------------------------------------------------------- */
/*                             Stacked avatars                                */
/* -------------------------------------------------------------------------- */

interface StackedFacesProps {
	readonly people: readonly FilterOption[];
}

/**
 * Overlapping avatars plus a count, instead of "4 selected". The same treatment
 * the first example uses, on the faces this one already has.
 *
 * A real `AvatarGroup`, so the overlap and the ring come from the part rather
 * than from a wrapper span pretending to be one. The stack tightens to
 * `-space-x-1`, because the default `-space-x-2` hides half of a 16px face. The
 * count appears only on genuine overflow, so three picks show three faces and
 * no redundant "3" beside them.
 *
 * It reads the RESOLVED options `renderValue` hands it, so the chip never keeps
 * a lookup of its own.
 */
function StackedFaces({ people }: StackedFacesProps): React.JSX.Element {
	const [only] = people;
	if (only === undefined) return <>anyone</>;

	if (people.length === 1) {
		return (
			<span className="flex items-center gap-1.5">
				<Face name={only.label} />
				{only.label}
			</span>
		);
	}

	const overflow = people.length - STACK_FACE_LIMIT;

	return (
		<span className="flex items-center gap-1.5">
			<AvatarGroup className="-space-x-1 *:data-[slot=avatar]:size-4">
				{people.slice(0, STACK_FACE_LIMIT).map((person: FilterOption): React.JSX.Element => (
					<Face key={person.value} name={person.label} />
				))}
			</AvatarGroup>
			{overflow > 0 ? <span className="text-xs text-muted-foreground tabular-nums">+{overflow}</span> : null}
		</span>
	);
}

/* -------------------------------------------------------------------------- */
/*                                  Queries                                   */
/* -------------------------------------------------------------------------- */

/**
 * What a persisted view actually looks like: ids only, no labels.
 *
 * Two rules, because the ids in them resolve by two different routes. The team
 * is closed, so its labels ship with the schema; the contacts are ids out of a
 * directory nobody has searched yet, and only the field's own `resolveValues`
 * can turn those into names.
 */
const SAVED_VIEW: FilterQuery = createFilterQuery([
	createFilterRule({
		id: "saved-1",
		path: ["assignee"],
		operator: "has_any_of",
		value: ["edsger", "barbara", "tim"],
	}),
	createFilterRule({
		id: "saved-2",
		path: ["contact"],
		operator: "is_any_of",
		value: ["u-41", "u-1200", "u-3311", "u-4802"],
	}),
]);

const SEED: FilterQuery = createFilterQuery([
	createFilterRule({
		id: "seed-1",
		path: ["assignee"],
		operator: "has_any_of",
		value: ["ada", "grace", "alan", "katherine"],
	}),
]);

/** Between restore and resolution there are values but no options yet; the count keeps the chip honest. */
function renderContact({ values, options, labels }: FilterValueDisplayContext): React.ReactNode {
	if (values.length > 0 && options.length === 0) {
		return labels.valueCount(values.length);
	}
	return <StackedFaces people={options} />;
}

function renderAssignees({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedFaces people={options} />;
}

const FIELDS: readonly FilterField[] = [
	{
		id: "assignee",
		label: "Assignee",
		type: "multiselect",
		// The option panel, widened by the field that needs it. These rows carry
		// a face, a full name and a role beneath it, and at the default width
		// "Katherine Johnson" truncated. `className` lands last in the panel's
		// own `cn`, so this resolves the two widths in the schema's favour.
		className: "w-56",
		// A closed team: options ship with the schema, each row carrying a face
		// and the person's group as its description.
		options: TEAM.map(toOption),
		renderValue: renderAssignees,
		icon: <UserRoundCheckIcon />,
	},
	{
		id: "contact",
		label: "Contact",
		type: "select",
		defaultOperator: "is_any_of",
		placeholder: "Search 5,000 contacts...",
		loadOptions: searchDirectory,
		/**
		 * The saved-view half. A restored query holds ids the loader has never
		 * returned, so the primitive asks for exactly the values it is holding,
		 * caches what comes back, and every chip under this root reads the
		 * result: no app-level id cache, no effect watching the query.
		 */
		resolveValues: fetchPeople,
		renderValue: renderContact,
		icon: <BookUserIcon />,
	},
	{
		id: "company",
		label: "Company",
		type: "text",
		icon: <Building2Icon />,
	},
];

export function Filters4Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(SEED);
	const restoreSavedView = React.useCallback((): void => {
		setQuery(SAVED_VIEW);
	}, []);
	const reset = React.useCallback((): void => {
		setQuery(SEED);
	}, []);

	return (
		<div className="flex w-full flex-col gap-4">
			<Filters fields={FIELDS} query={query} onQueryChange={setQuery} showClear />

			{/*
				Below the bar, and at the default size the bar itself runs at. These two
				act ON the query the bar owns, so they read as its footer rather than as
				a second toolbar above it.
			*/}
			<div className="flex flex-wrap items-center gap-2">
				<Button variant="outline" onClick={restoreSavedView}>
					Restore saved view
				</Button>
				<Button variant="ghost" onClick={reset}>
					Reset
				</Button>
			</div>
		</div>
	);
}
