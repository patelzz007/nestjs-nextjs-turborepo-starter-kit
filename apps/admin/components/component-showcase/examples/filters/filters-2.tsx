"use client";

import * as React from "react";
import { HashIcon, LayersIcon, ListIcon, MapPinIcon, SquareCheckIcon, TagsIcon, TypeIcon, UserIcon, UsersIcon } from "lucide-react";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import type { FilterField, FilterOption, FilterQuery, FilterValueType } from "@workspace/ui/components/filters/filters-types";

/* -------------------------------------------------------------------------- */
/*                                 Type icons                                 */
/* -------------------------------------------------------------------------- */

/**
 * One icon per value type, created once and shared by reference.
 *
 * A branch earns a bespoke icon, because the top level is scanned by meaning. A
 * leaf carries its TYPE instead: three rows into a level of 250 the useful
 * question stops being "which noun is this" and becomes "will this ask me for a
 * number, a word or a choice", and that is the only thing telling one generated
 * row from the next.
 *
 * Icon names are written out per set rather than built by a helper: the shadcn
 * CLI rewrites these attributes to a real import at install time and only
 * accepts string literals, so a computed name breaks `shadcn add` for everyone
 * installing this example.
 */
const TYPE_ICON: Partial<Record<FilterValueType, FilterField["icon"]>> = {
	text: <TypeIcon />,
	number: <HashIcon />,
	select: <ListIcon />,
	multiselect: <TagsIcon />,
	boolean: <SquareCheckIcon />,
};

/** The compact form a generated attribute is written in. */
type Attribute = readonly [label: string, type: FilterValueType, options?: readonly string[]];

const slugify = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Option labels, slugged into the values a query is stored with. */
const toOptions = (labels: readonly string[]): FilterOption[] => labels.map((label: string): FilterOption => ({ value: slugify(label), label }));

/** One leaf from its compact form. `copy` numbers the repeats past the first. */
function toField([label, type, options]: Attribute, copy = 1): FilterField {
	const name = copy > 1 ? `${label} ${String(copy)}` : label;
	return {
		id: slugify(name),
		label: name,
		type,
		icon: TYPE_ICON[type],
		options: options === undefined ? undefined : toOptions(options),
	};
}

/* -------------------------------------------------------------------------- */
/*                             A hand written level                           */
/* -------------------------------------------------------------------------- */

// A field holding `fields` renders as a branch, and a branch always DRILLS IN.
// It never commits a filter on itself: the row carries a chevron and a child
// count, so a press has one meaning, and "filter on the branch as a whole" is
// declared as an ordinary leaf beside its siblings (Name > Full) rather than as
// a second meaning for the same click.
//
// `keywords` are matched by search alongside the label and are never drawn, so
// they are where a schema absorbs the words users actually type: half a team
// says postcode and the other half says zip, and the person searching for the
// second one should not have to learn the first.
//
// No branch here sets `count`. The picker falls back to the number of children
// it holds, which is the truth for a level declared in full; an explicit count
// is for the level that knows its total before it has fetched it, which is the
// generated branch below.
const CORE: readonly FilterField[] = [
	{
		id: "record-id",
		label: "Record ID",
		type: "text",
		keywords: ["uuid", "primary key", "identifier"],
		placeholder: "8f14e45f",
		icon: <HashIcon />,
	},
	{
		id: "name",
		label: "Name",
		icon: <UserIcon />,
		fields: [
			{ id: "first", label: "First", type: "text", icon: TYPE_ICON.text },
			{ id: "last", label: "Last", type: "text", icon: TYPE_ICON.text },
			{
				id: "full",
				label: "Full",
				type: "text",
				icon: TYPE_ICON.text,
				keywords: ["display name", "whole name"],
			},
		],
	},
	{
		id: "team",
		label: "Team",
		icon: <UsersIcon />,
		fields: [
			{
				id: "lead",
				label: "Lead",
				type: "text",
				icon: TYPE_ICON.text,
				keywords: ["manager", "owner", "reports to"],
			},
			{
				id: "size",
				label: "Size",
				type: "number",
				icon: TYPE_ICON.number,
				keywords: ["headcount", "seats"],
			},
			{
				id: "department",
				label: "Department",
				type: "select",
				icon: TYPE_ICON.select,
				keywords: ["function", "discipline"],
				options: toOptions(["Engineering", "Design", "Sales", "Marketing", "Support", "Finance"]),
			},
			{
				id: "region",
				label: "Region",
				type: "select",
				icon: TYPE_ICON.select,
				keywords: ["territory", "market"],
				options: toOptions(["North America", "EMEA", "APAC", "LATAM"]),
			},
		],
	},
	{
		id: "location",
		label: "Primary location",
		icon: <MapPinIcon />,
		fields: [
			{
				id: "city",
				label: "City",
				type: "text",
				icon: TYPE_ICON.text,
				keywords: ["town"],
			},
			{
				id: "country",
				label: "Country",
				type: "text",
				icon: TYPE_ICON.text,
				keywords: ["market"],
			},
			{
				id: "postcode",
				label: "Postcode",
				type: "text",
				icon: TYPE_ICON.text,
				placeholder: "SW1A",
				keywords: ["zip", "postal code", "zip code"],
			},
		],
	},
];

/* -------------------------------------------------------------------------- */
/*                            A workspace sized level                         */
/* -------------------------------------------------------------------------- */

const ATTRIBUTES_PER_OBJECT = 250;

/** What every object carries, cycled to fill the level out. */
const GENERIC: readonly Attribute[] = [
	["Owner", "text"],
	["Source", "select", ["Organic", "Paid", "Referral", "Event", "Outbound"]],
	["Health score", "number"],
	["Tags", "multiselect", ["Beta", "Churn risk", "Expansion", "VIP"]],
	["External ID", "text"],
	["Archived", "boolean"],
];

/** What each object OPENS with: the attributes that only it has. */
const OBJECTS: Readonly<Record<string, readonly Attribute[]>> = {
	Person: [
		["Lifecycle stage", "select", ["Subscriber", "Lead", "Qualified", "Opportunity", "Customer", "Churned"]],
		["Job title", "text"],
		["Lead score", "number"],
		["Email opt in", "boolean"],
	],
	Company: [
		["Industry", "select", ["Software", "Retail", "Finance", "Healthcare", "Manufacturing"]],
		["Employees", "number"],
		["Domain", "text"],
		["Publicly listed", "boolean"],
	],
	Deal: [
		["Stage", "select", ["Discovery", "Demo", "Proposal", "Negotiation", "Won", "Lost"]],
		["Amount", "number"],
		["Close quarter", "select", ["Q1", "Q2", "Q3", "Q4"]],
		["Forecast committed", "boolean"],
	],
	Ticket: [
		["Severity", "select", ["Sev 1", "Sev 2", "Sev 3", "Sev 4"]],
		["Queue", "select", ["Billing", "Onboarding", "Bugs", "How to"]],
		["First response minutes", "number"],
		["Breached SLA", "boolean"],
	],
	Invoice: [
		["Status", "select", ["Draft", "Open", "Paid", "Overdue", "Void"]],
		["Total", "number"],
		["Currency", "select", ["USD", "EUR", "GBP", "JPY"]],
		["Auto charge", "boolean"],
	],
	Campaign: [
		["Channel", "select", ["Email", "Paid search", "Paid social", "Webinar", "Field event"]],
		["Budget", "number"],
		["Audience", "multiselect", ["Trial", "Free", "Paid", "Partner"]],
		["Running", "boolean"],
	],
	Product: [
		["Category", "select", ["Hardware", "Software", "Service", "Add on"]],
		["Price", "number"],
		["SKU", "text"],
		["In catalogue", "boolean"],
	],
	Workspace: [
		["Plan", "select", ["Free", "Pro", "Business", "Enterprise"]],
		["Seats", "number"],
		["Data region", "select", ["US east", "EU west", "AP south"]],
		["SSO enforced", "boolean"],
	],
};

/**
 * Eight objects of 250 attributes each, 2,000 in all, under one branch.
 *
 * Every object opens with the attributes that belong to it and pads out with
 * the generic ones, because scale nobody can read proves nothing: the first
 * screen has to be worth the drill, and the 246 rows under it are what the
 * windowing is for. The picker is the cascader, which windows its rows, so only
 * the visible slice is ever in the DOM however long the level runs.
 *
 * Both generated branches state their `count` rather than leaving the row to
 * count the children it was handed, which is what the prop is for: a level
 * whose total is known before it is read. And the primitive indexes the schema
 * on a content SIGNATURE rather than on the array's identity, so this tree is
 * walked into maps once and every later render reuses them.
 */
/** One object's level: its own attributes first, then the generic ones cycled with a copy number. */
function buildObjectAttributes(own: readonly Attribute[]): readonly FilterField[] {
	const fields: FilterField[] = [];
	for (let index = 0; index < ATTRIBUTES_PER_OBJECT; index += 1) {
		const ownAttribute = own.at(index);
		const position = index - own.length;
		const attribute = ownAttribute ?? GENERIC.at(position % GENERIC.length);
		if (attribute !== undefined) {
			fields.push(ownAttribute === undefined ? toField(attribute, Math.floor(position / GENERIC.length) + 1) : toField(attribute));
		}
	}
	return fields;
}

function buildCustomFields(): FilterField {
	const entries = Object.entries(OBJECTS);
	return {
		id: "custom",
		label: "Custom fields",
		count: entries.length * ATTRIBUTES_PER_OBJECT,
		icon: <LayersIcon />,
		fields: entries.map(([object, own]: [string, readonly Attribute[]]): FilterField => ({
			id: slugify(object),
			label: object,
			count: ATTRIBUTES_PER_OBJECT,
			fields: buildObjectAttributes(own),
		})),
	};
}

const FIELDS: readonly FilterField[] = [...CORE, buildCustomFields()];

export function Filters2Example(): React.JSX.Element {
	// ONE seeded rule, three segments deep into the level holding 2,000
	// attributes. A chip prints its whole chain, so the drill-down is legible
	// without opening the picker, and the value beside it resolves against that
	// leaf's own option list rather than being drawn as the raw stored string.
	const [query, setQuery] = React.useState<FilterQuery>(() =>
		createFilterQuery([
			createFilterRule({
				id: "seed-1",
				path: ["custom", "person", "lifecycle-stage"],
				operator: "is",
				value: "customer",
			}),
		]),
	);

	return <Filters fields={FIELDS} query={query} onQueryChange={setQuery} showClear />;
}
