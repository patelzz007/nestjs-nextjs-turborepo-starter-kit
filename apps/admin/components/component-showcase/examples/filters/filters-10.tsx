"use client";

import { isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { BanknoteIcon, Building2Icon, SignpostIcon, UserIcon } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarGroup } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataGrid, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableFootRow, DataGridTableFootRowCell } from "@workspace/ui/components/data-grid/data-grid-table";
import { Filters } from "@workspace/ui/components/filters/filters";
import type { FilterOperatorLabels } from "@workspace/ui/components/filters/filters-operators";
import { createFilterGroup, createFilterQuery, createFilterRule, isFilterRule } from "@workspace/ui/components/filters/filters-query";
import {
	filterValueItems,
	isFilterValueList,
	type FilterField,
	type FilterNode,
	type FilterOption,
	type FilterQuery,
	type FilterValue,
	type FilterValueDisplayContext,
	type FilterValueItem,
} from "@workspace/ui/components/filters/filters-types";
import { cn } from "@workspace/ui/lib/core/utils";

/* -------------------------------------------------------------------------- */
/*                                  Fixtures                                  */
/* -------------------------------------------------------------------------- */

interface DotProps {
	readonly className: string;
}

function Dot({ className }: DotProps): React.JSX.Element {
	return <span className={cn("size-2 shrink-0 rounded-full", className)} />;
}

function initials(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

interface PersonProps {
	readonly name: string;
}

/**
 * A teammate's face, drawn the same way in the option row and in the cell,
 * sized for the dense row. Initials only: the gallery ships sample data and
 * fetches no photographs.
 *
 * `aria-hidden`, because every place this appears already prints the name
 * beside it, and the initials would otherwise be read out as well.
 */
function Person({ name }: PersonProps): React.JSX.Element {
	return (
		<Avatar aria-hidden="true" size="sm" className="size-4.5 shrink-0">
			<AvatarFallback className="text-[length:var(--text-badge-xs)]">{initials(name)}</AvatarFallback>
		</Avatar>
	);
}

interface Stage {
	readonly value: string;
	readonly label: string;
	/** A tone token fill for the stage's swatch. */
	readonly tone: string;
}

const NEUTRAL_DOT = "bg-muted-foreground";

const STAGES: readonly Stage[] = [
	{ value: "discovery", label: "Discovery", tone: NEUTRAL_DOT },
	{ value: "evaluation", label: "Evaluation", tone: "bg-tone-blue" },
	{ value: "negotiation", label: "Negotiation", tone: "bg-tone-yellow" },
	{ value: "closed-won", label: "Closed won", tone: "bg-tone-green" },
	{ value: "closed-lost", label: "Closed lost", tone: "bg-destructive" },
];

const OWNERS: readonly FilterOption[] = [
	{ value: "ada", label: "Ada Lovelace" },
	{ value: "grace", label: "Grace Hopper" },
	{ value: "alan", label: "Alan Turing" },
	{ value: "barbara", label: "Barbara Liskov" },
];

const REGIONS: readonly FilterOption[] = [
	{ value: "emea", label: "EMEA" },
	{ value: "amer", label: "AMER" },
	{ value: "apac", label: "APAC" },
];

/** Marks drawn in a collapsed stack before the count carries the rest. */
const STACK_TONE_LIMIT = 4;
const STACK_FACE_LIMIT = 3;
/** Region labels a chip spells out before it collapses to "+n". */
const REGION_LABEL_LIMIT = 2;

const STAGE_TONES: ReadonlyMap<string, string> = new Map(STAGES.map((entry: Stage): [string, string] => [entry.value, entry.tone]));
const OWNER_LABELS: ReadonlyMap<string, string> = new Map(OWNERS.map((entry: FilterOption): [string, string] => [entry.value, entry.label]));
const REGION_LABELS: ReadonlyMap<string, string> = new Map(REGIONS.map((entry: FilterOption): [string, string] => [entry.value, entry.label]));

interface StackedTonesProps {
	readonly options: readonly FilterOption[];
	readonly empty: string;
}

/**
 * The value cell draws what the TABLE draws. Several picks collapse to
 * overlapped marks plus a count, so a five-row query still reads at a glance.
 */
function StackedTones({ options, empty }: StackedTonesProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>{empty}</>;
	if (options.length === 1) {
		return (
			<span className="flex min-w-0 items-center gap-1.5">
				<Dot className={STAGE_TONES.get(only.value) ?? NEUTRAL_DOT} />
				<span className="truncate">{only.label}</span>
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center">
				{options.slice(0, STACK_TONE_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<span key={option.value} className={cn("-ml-1 size-2.5 rounded-full ring-2 ring-background first:ml-0", STAGE_TONES.get(option.value) ?? NEUTRAL_DOT)} />
				))}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
		</span>
	);
}

interface StackedOwnersProps {
	readonly options: readonly FilterOption[];
}

function StackedOwners({ options }: StackedOwnersProps): React.JSX.Element {
	const [only] = options;
	if (only === undefined) return <>anyone</>;
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<AvatarGroup>
				{options.slice(0, STACK_FACE_LIMIT).map((option: FilterOption): React.JSX.Element => (
					<Person key={option.value} name={option.label} />
				))}
			</AvatarGroup>
			{options.length === 1 ? <span className="truncate">{only.label}</span> : <span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>}
		</span>
	);
}

interface Account {
	readonly name: string;
	readonly region: string;
	readonly seats: number;
}

interface Deal {
	readonly id: string;
	readonly stage: string;
	readonly owner: string;
	readonly amount: number;
	readonly account: Account;
}

/**
 * Fourteen deals, ordered by amount so the fixture reads in the same order the
 * default sort prints it.
 *
 * Picked so that each of the seeded query's three top-level terms is the ONLY
 * thing keeping some row out. Coho Vineyard and Adatum clear the parenthesis and
 * the region but sit in a stage nobody asked for; Relecloud and Tailspin Toys
 * clear everything except the region; and Fabrikam clears the stage and the
 * region and fails BOTH sides of the parenthesis. So the group is not
 * decoration: delete it and Fabrikam appears, flip its `or` to `and` and six of
 * the seven survivors leave, with Litware the only row that clears both sides.
 *
 * Three of the survivors - Fourth Coffee, Northwind and Woodgrove - qualify on
 * seat count alone, with an amount well under the threshold. They are the rows a
 * flat AND of the same three conditions could not return, which is the whole
 * reason this example seeds a tree instead of a list.
 *
 * The account names are all short on purpose. Every column here is sized to the
 * widest line it holds, and the five sizes add up to what a 560px docs frame
 * leaves inside the card, so one long account name is not a wrapped cell - it
 * is a horizontal scrollbar under the whole table.
 */
const DEALS: readonly Deal[] = [
	{
		id: "d-1",
		stage: "discovery",
		owner: "grace",
		amount: 72000,
		account: { name: "Coho Vineyard", region: "emea", seats: 640 },
	},
	{
		id: "d-2",
		stage: "discovery",
		owner: "ada",
		amount: 64000,
		account: { name: "Adatum", region: "emea", seats: 780 },
	},
	{
		id: "d-3",
		stage: "evaluation",
		owner: "barbara",
		amount: 58000,
		account: { name: "Relecloud", region: "apac", seats: 880 },
	},
	{
		id: "d-4",
		stage: "negotiation",
		owner: "barbara",
		amount: 52000,
		account: { name: "Tailspin Toys", region: "amer", seats: 310 },
	},
	{
		id: "d-5",
		stage: "negotiation",
		owner: "grace",
		amount: 48000,
		account: { name: "Contoso Group", region: "emea", seats: 140 },
	},
	{
		id: "d-6",
		stage: "negotiation",
		owner: "ada",
		amount: 44000,
		account: { name: "Trey Research", region: "emea", seats: 350 },
	},
	{
		id: "d-7",
		stage: "closed-lost",
		owner: "barbara",
		amount: 37000,
		account: { name: "Blue Yonder", region: "emea", seats: 410 },
	},
	{
		id: "d-8",
		stage: "closed-won",
		owner: "alan",
		amount: 31000,
		account: { name: "Proseware", region: "apac", seats: 220 },
	},
	{
		id: "d-9",
		stage: "evaluation",
		owner: "barbara",
		amount: 26500,
		account: { name: "Wingtip Toys", region: "emea", seats: 60 },
	},
	{
		id: "d-10",
		stage: "negotiation",
		owner: "grace",
		amount: 25000,
		account: { name: "Litware", region: "emea", seats: 500 },
	},
	{
		id: "d-11",
		stage: "negotiation",
		owner: "alan",
		amount: 21000,
		account: { name: "Fourth Coffee", region: "emea", seats: 940 },
	},
	{
		id: "d-12",
		stage: "evaluation",
		owner: "ada",
		amount: 18000,
		account: { name: "Northwind", region: "emea", seats: 620 },
	},
	{
		id: "d-13",
		stage: "evaluation",
		owner: "grace",
		amount: 15500,
		account: { name: "Woodgrove", region: "emea", seats: 1200 },
	},
	{
		id: "d-14",
		stage: "evaluation",
		owner: "alan",
		amount: 9000,
		account: { name: "Fabrikam", region: "emea", seats: 90 },
	},
];

// Pinned locales, because the same number has to format identically on the
// server and on the client or hydration reports a mismatch.
const money = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});
const count = new Intl.NumberFormat("en-US");

/* -------------------------------------------------------------------------- */
/*                          The tree as a row predicate                       */
/* -------------------------------------------------------------------------- */

/** What a rule compares against: one printed value of one deal. */
type DealValue = string | number;

/**
 * A rule's `path` resolved against the record. `["account", "seats"]` is one
 * key deeper than anything a flat table needs, so the resolver names every
 * path the schema below can produce.
 */
function read(deal: Deal, path: readonly string[]): DealValue | undefined {
	switch (path.join(".")) {
		case "stage":
			return deal.stage;
		case "owner":
			return deal.owner;
		case "amount":
			return deal.amount;
		case "account.name":
			return deal.account.name;
		case "account.region":
			return deal.account.region;
		case "account.seats":
			return deal.account.seats;
		default:
			return undefined;
	}
}

/** One stored item as text. A date or an unfilled bound has none. */
function itemText(item: FilterValueItem | undefined): string {
	if (isStringPrimitive(item)) return item;
	if (isNumberPrimitive(item)) return String(item);
	return "";
}

function list(value: FilterValue | undefined): readonly string[] {
	return isFilterValueList(value) ? value.map(itemText) : [];
}

function scalar(value: FilterValue | undefined): string {
	return isFilterValueList(value) ? "" : itemText(value);
}

function text(value: DealValue | undefined): string {
	return value === undefined ? "" : String(value).toLowerCase();
}

type RuleTest = (actual: DealValue | undefined, value: FilterValue | undefined) => boolean;

function inRange(actual: DealValue | undefined, value: FilterValue | undefined): boolean {
	const [from, to] = list(value);
	return Number(actual) >= Number(from) && Number(actual) <= Number(to);
}

function isBlank(actual: DealValue | undefined): boolean {
	return actual === undefined || actual === "";
}

/**
 * One test per operator the schema above can produce, and no more.
 *
 * The primitive ships no compilers on purpose: every backend wants a different
 * shape, and a half-right emitter is worse than none. What it guarantees is a
 * plain serialisable tree, so a compiler is this table plus the walk under it.
 * Anything absent here is an operator no field in this schema offers, which is
 * why the walk treats a miss as "matches" rather than inventing an answer.
 */
const TESTS: ReadonlyMap<string, RuleTest> = new Map<string, RuleTest>([
	["is", (actual, value): boolean => text(actual) === scalar(value).toLowerCase()],
	["is_not", (actual, value): boolean => text(actual) !== scalar(value).toLowerCase()],
	["is_any_of", (actual, value): boolean => list(value).includes(String(actual))],
	["is_none_of", (actual, value): boolean => !list(value).includes(String(actual))],
	["contains", (actual, value): boolean => text(actual).includes(scalar(value).toLowerCase())],
	["not_contains", (actual, value): boolean => !text(actual).includes(scalar(value).toLowerCase())],
	["starts_with", (actual, value): boolean => text(actual).startsWith(scalar(value).toLowerCase())],
	["ends_with", (actual, value): boolean => text(actual).endsWith(scalar(value).toLowerCase())],
	["eq", (actual, value): boolean => Number(actual) === Number(scalar(value))],
	["neq", (actual, value): boolean => Number(actual) !== Number(scalar(value))],
	["gt", (actual, value): boolean => Number(actual) > Number(scalar(value))],
	["gte", (actual, value): boolean => Number(actual) >= Number(scalar(value))],
	["lt", (actual, value): boolean => Number(actual) < Number(scalar(value))],
	["lte", (actual, value): boolean => Number(actual) <= Number(scalar(value))],
	["between", inRange],
	["not_between", (actual, value): boolean => !inRange(actual, value)],
	["empty", (actual): boolean => isBlank(actual)],
	["not_empty", (actual): boolean => !isBlank(actual)],
]);

/**
 * A rule with nothing to test yet, which matches everything so the grid does
 * not empty out while a value is still being chosen.
 *
 * `undefined` is the obvious case. The EMPTY LIST is the reachable one:
 * unchecking the last stage commits `[]`, not `undefined`, so `Stage is any of`
 * with no value would have sent `list([]).includes(...)` to false and emptied
 * the table under a rule the builder still draws as unfinished. An empty list is
 * the absence of a constraint, and the rows have to agree with the row above
 * them.
 *
 * A HALF-FILLED RANGE is the third, and it is why the check reads every entry
 * rather than counting them. `Amount is between` commits `[25000, undefined]`
 * the moment the first bound is typed, which has length two and is not
 * finished: counted alone it went to `between`, which read `Number(undefined)`,
 * compared against NaN and returned false for all fourteen rows. A missing
 * entry is a missing value whichever slot it sits in.
 *
 * `empty` and `not_empty` are excluded because they carry no value: for those
 * two, having none is the whole test.
 *
 * THE OPERATOR AND THE VALUE rather than the rule holding them, because the
 * value renderers below ask this same question of a
 * `FilterValueDisplayContext`, which carries those two and no rule at all. One
 * definition of "nothing to test yet" for the grid and for the cells that
 * report on it: two would drift, and the drift would show up as a cell claiming
 * a count for a rule the rows underneath it ignored.
 */
function isIncomplete(operator: string, value: FilterValue | undefined): boolean {
	if (operator === "empty" || operator === "not_empty") return false;
	if (value === undefined) return true;
	if (!isFilterValueList(value)) return false;
	return value.length === 0 || value.some((entry: FilterValueItem): boolean => entry === null || entry === "");
}

/** Rules AND groups, so nesting is answered by recursion rather than ignored. */
function matches(deal: Deal, node: FilterNode): boolean {
	if (!isFilterRule(node)) {
		if (node.rules.length === 0) return true;
		const matchesChild = (child: FilterNode): boolean => matches(deal, child);
		return node.combinator === "and" ? node.rules.every(matchesChild) : node.rules.some(matchesChild);
	}

	const test = TESTS.get(node.operator);
	if (test === undefined || isIncomplete(node.operator, node.value)) return true;

	const result = test(read(deal, node.path), node.value);
	return node.negated === true ? !result : result;
}

/* -------------------------------------------------------------------------- */
/*                               Value renderers                              */
/* -------------------------------------------------------------------------- */

/**
 * HOW MANY OF THE FOURTEEN this one term keeps, on its own.
 *
 * A readout only an example with data of its own can write, and this one
 * already carries both halves: the fixture, and a compiler for the tree over
 * it. So a rule here can be MEASURED rather than only read - and measured, the
 * seeded query stops being an assertion. Its amount term keeps ten of the
 * fourteen deals on its own and its region term eleven, against the seven the
 * card header prints, and the difference between those numbers is the group
 * that sits between them.
 *
 * It walks the SAME `TESTS` table through the same `read` the grid walks, which
 * is what makes this a second reading of one predicate rather than a second
 * predicate. A cell that counted with a comparison of its own would drift from
 * the rows underneath it eventually, and the drift would read as a fault in the
 * query rather than as a fault here.
 *
 * THE PATH IS PASSED IN rather than taken from the context, because there is no
 * path in the context to take: `FilterValueDisplayContext` carries the field,
 * and a field knows its own `id` and nothing about where it hangs. That is not
 * a gap to work around - a display callback is declared ON the field, so where
 * the field sits is the one thing it never has to be told.
 *
 * WHAT IT CANNOT SEE is `negated`. The context carries the value, the operator
 * and the resolved options, and nothing about the rule holding them, so an
 * inverted rule would be counted as written. That is sound HERE and only here:
 * the advanced builder offers no negate action, the chip menu is what offers
 * one, which is why this belongs to an advanced-only example rather than to a
 * display helper shared with a chip row.
 */
function reach(path: readonly string[], { operator, value }: FilterValueDisplayContext): number | null {
	const test = TESTS.get(operator.value);
	if (test === undefined || isIncomplete(operator.value, value)) return null;
	return DEALS.filter((deal: Deal): boolean => test(read(deal, path), value)).length;
}

interface TermReachProps {
	readonly hits: number | null;
}

function TermReach({ hits }: TermReachProps): React.JSX.Element | null {
	if (hits === null) return null;
	return (
		<span className={cn("shrink-0 text-xs tabular-nums @max-[7rem]/cell:hidden", hits === 0 ? "text-destructive" : "text-muted-foreground")}>
			{hits}/{DEALS.length}
		</span>
	);
}

function moneyBound(entry: FilterValueItem | undefined): string {
	if (entry === undefined || entry === null || entry === "") return "";
	const amount = Number(itemText(entry));
	return Number.isFinite(amount) ? money.format(amount) : "";
}

function formatMoney({ value, labels }: FilterValueDisplayContext): string {
	const [first, second] = filterValueItems(value);
	const from = moneyBound(first);
	const to = isFilterValueList(value) ? moneyBound(second) : "";

	if (from !== "" && to !== "") return labels.valueRange(from, to);
	if (from !== "") return from;
	return to === "" ? "any amount" : to;
}

interface RegionValueProps {
	readonly options: readonly FilterOption[];
	readonly hits: number | null;
}

function RegionValue({ options, hits }: RegionValueProps): React.JSX.Element {
	if (options.length === 0) return <>any region</>;

	const shown = options.slice(0, REGION_LABEL_LIMIT);
	const overflow = options.length - shown.length;

	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<span className="truncate">{shown.map((option: FilterOption): string => option.label).join(", ")}</span>
			{overflow > 0 ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">+{overflow}</span> : null}
			<TermReach hits={hits} />
		</span>
	);
}

function PatternEllipsis(): React.JSX.Element {
	return <span className="shrink-0 text-muted-foreground">...</span>;
}

interface PatternValueProps {
	readonly value: FilterValue | undefined;
	readonly operator: string;
	readonly hits: number | null;
}

/** The typed pattern, drawn with an ellipsis on the side(s) the operator leaves open. */
function PatternValue({ value, operator, hits }: PatternValueProps): React.JSX.Element {
	const term = isStringPrimitive(value) ? value.trim() : "";
	if (term === "") return <>any name</>;

	const loose = operator === "contains" || operator === "not_contains";
	const lead = loose || operator === "ends_with";
	const trail = loose || operator === "starts_with";

	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<span className="flex min-w-0 items-center">
				{lead ? <PatternEllipsis /> : null}
				<span className="truncate">{term}</span>
				{trail ? <PatternEllipsis /> : null}
			</span>
			<TermReach hits={hits} />
		</span>
	);
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

/**
 * Shorter words for the four comparisons this report leans on.
 *
 * A builder row names its attribute already, so the operator only has to say
 * which way the test points: "Amount at least 25000" reads cleanly and stays
 * short enough for a row inside a group, which has less width to spend than a
 * top level one.
 *
 * Only these four keys change. Everything else in the catalog keeps its default
 * wording, which is the point of `operatorLabels` being a partial record rather
 * than a replacement catalog.
 */
const COMPACT_OPERATORS: Partial<FilterOperatorLabels> = {
	gt: "over",
	gte: "at least",
	lt: "under",
	lte: "at most",
};

const AMOUNT_PATH: readonly string[] = ["amount"];
const ACCOUNT_NAME_PATH: readonly string[] = ["account", "name"];
const ACCOUNT_REGION_PATH: readonly string[] = ["account", "region"];

function stageOption(entry: Stage): FilterOption {
	return { value: entry.value, label: entry.label, icon: <Dot className={entry.tone} /> };
}

function ownerOption(entry: FilterOption): FilterOption {
	return { ...entry, icon: <Person name={entry.label} /> };
}

function renderStages({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedTones options={options} empty="any stage" />;
}

function renderOwners({ options }: FilterValueDisplayContext): React.ReactNode {
	return <StackedOwners options={options} />;
}

function renderAmount(context: FilterValueDisplayContext): React.ReactNode {
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<span className="truncate tabular-nums">{formatMoney(context)}</span>
			<TermReach hits={reach(AMOUNT_PATH, context)} />
		</span>
	);
}

function renderAccountName(context: FilterValueDisplayContext): React.ReactNode {
	return <PatternValue value={context.value} operator={context.operator.value} hits={reach(ACCOUNT_NAME_PATH, context)} />;
}

function renderRegion(context: FilterValueDisplayContext): React.ReactNode {
	return <RegionValue options={context.options} hits={reach(ACCOUNT_REGION_PATH, context)} />;
}

/**
 * One field per printed value, and no field the table does not print.
 *
 * That is what makes the grid underneath a check on the query rather than an
 * illustration beside it: Stage, Owner, Amount and Seats each own a column,
 * Account name and Region share the first one, and nothing here filters on an
 * attribute the reader cannot see. A rule that narrowed the grid for no visible
 * reason would look like a broken table.
 *
 * Icon names are written out per library rather than built by a helper: the
 * shadcn CLI rewrites these attributes to a real import at install time and
 * only accepts string literals, so a shared `icon(...)` factory would break
 * `shadcn add` for everyone installing this example.
 */
const FIELDS: readonly FilterField[] = [
	{
		id: "stage",
		label: "Stage",
		type: "select",
		defaultOperator: "is_any_of",
		options: STAGES.map(stageOption),
		renderValue: renderStages,
		icon: <SignpostIcon />,
	},
	{
		id: "owner",
		label: "Owner",
		type: "select",
		defaultOperator: "is_any_of",
		className: "w-56",
		options: OWNERS.map(ownerOption),
		pinSelected: true,
		sortSelected: "label",
		renderValue: renderOwners,
		icon: <UserIcon />,
	},
	{
		id: "amount",
		label: "Amount",
		type: "number",
		defaultOperator: "gte",
		renderValue: renderAmount,
		valueText: formatMoney,
		icon: <BanknoteIcon />,
	},
	{
		id: "account",
		label: "Account",
		icon: <Building2Icon />,
		fields: [
			{ id: "name", label: "Name", type: "text", renderValue: renderAccountName },
			{ id: "region", label: "Region", type: "select", options: REGIONS, searchable: false, renderValue: renderRegion },
			{ id: "seats", label: "Seats", type: "number" },
		],
	},
];

/** The seeded thresholds: a deal qualifies at this amount OR this many seats. */
const AMOUNT_THRESHOLD = 25000;
const SEATS_THRESHOLD = 500;

/**
 * A pipeline that already needs a parenthesis.
 *
 * `stage is any of (evaluation, negotiation) AND (amount >= 25,000 OR
 * account.seats >= 500) AND account.region is EMEA`: a deal qualifies on size
 * OR on seat count, not on both, and no flat list of chips can say that. The
 * builder keeps the group, so the structure stays visible and editable, and the
 * grid under it is what shows the parenthesis survived the round trip - seven of
 * fourteen deals, three of them on the seat side alone.
 */
const SEED: FilterQuery = createFilterQuery(
	[
		createFilterRule({
			id: "seed-1",
			path: ["stage"],
			operator: "is_any_of",
			value: ["evaluation", "negotiation"],
		}),
		createFilterGroup({
			id: "seed-group",
			combinator: "or",
			rules: [
				createFilterRule({ id: "seed-2", path: ["amount"], operator: "gte", value: AMOUNT_THRESHOLD }),
				createFilterRule({ id: "seed-3", path: ["account", "seats"], operator: "gte", value: SEATS_THRESHOLD }),
			],
		}),
		createFilterRule({
			id: "seed-4",
			path: ["account", "region"],
			operator: "is",
			value: "emea",
		}),
	],
	"and",
);

/* -------------------------------------------------------------------------- */
/*                                  The report                                */
/* -------------------------------------------------------------------------- */

const GUTTER_START = "ps-4";
const GUTTER_END = "pe-4";
const NUMERIC_ALIGN = "text-right rtl:text-left";
const AMOUNT_ALIGN = `${NUMERIC_ALIGN} ${GUTTER_END}`;

/** Column widths, each the widest line that column holds, in pixels. */
const COLUMN_WIDTH = { account: 125, stage: 110, owner: 134, seats: 79, amount: 104 } satisfies Readonly<Record<string, number>>;
/** The footer's label spans the three non-numeric columns. */
const FOOTER_LABEL_SPAN = 3;
/** The builder shows only a nested attribute's leaf, "Seats" rather than "Account > Seats". */
const MAX_PATH_SEGMENTS = 1;

const PAGE_SIZE = 5;
const PAGE_SIZES: readonly number[] = [5, 10, 25];
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "amount", desc: true }];
const TABLE_LAYOUT: DataGridTableLayout = { dense: true };

function rankIn(ladder: readonly Stage[], value: string): number {
	return ladder.findIndex((entry: Stage): boolean => entry.value === value);
}

type DealColumn = ColumnDef<DataGridFeatures, Deal>;

const COLUMNS: readonly DealColumn[] = [
	{
		id: "account",
		accessorFn: (row: Deal): string => row.account.name,
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Account" column={column} />,
		cell: ({ row }): React.JSX.Element => (
			<div className="min-w-0">
				<div className="truncate font-medium text-foreground">{row.original.account.name}</div>
				<div className="truncate text-xs text-muted-foreground">{REGION_LABELS.get(row.original.account.region)}</div>
			</div>
		),
		size: COLUMN_WIDTH.account,
		enableSorting: true,
		meta: { headerClassName: GUTTER_START, cellClassName: GUTTER_START },
	},
	{
		id: "stage",
		accessorFn: (row: Deal): number => rankIn(STAGES, row.stage),
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Stage" column={column} />,
		cell: ({ row }): React.JSX.Element => {
			const stage = STAGES.find((entry: Stage): boolean => entry.value === row.original.stage);
			return (
				<Badge variant="outline" className="gap-1.5">
					<Dot className={stage?.tone ?? NEUTRAL_DOT} />
					{stage?.label}
				</Badge>
			);
		},
		size: COLUMN_WIDTH.stage,
		enableSorting: true,
	},
	{
		id: "owner",
		accessorFn: (row: Deal): string => OWNER_LABELS.get(row.owner) ?? row.owner,
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Owner" column={column} />,
		cell: ({ row }): React.JSX.Element => {
			const label = OWNER_LABELS.get(row.original.owner) ?? row.original.owner;
			return (
				<div className="flex items-center gap-1.5">
					<Person name={label} />
					<span className="min-w-0 truncate">{label}</span>
				</div>
			);
		},
		size: COLUMN_WIDTH.owner,
		enableSorting: true,
	},
	{
		id: "seats",
		accessorFn: (row: Deal): number => row.account.seats,
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Seats" column={column} className="ms-auto -me-2" />,
		cell: ({ row }): React.JSX.Element => <span className="tabular-nums">{count.format(row.original.account.seats)}</span>,
		size: COLUMN_WIDTH.seats,
		enableSorting: true,
		meta: { headerClassName: NUMERIC_ALIGN, cellClassName: NUMERIC_ALIGN },
	},
	{
		accessorKey: "amount",
		id: "amount",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Amount" column={column} className="ms-auto -me-2" />,
		cell: ({ row }): React.JSX.Element => <span className="font-medium tabular-nums">{money.format(row.original.amount)}</span>,
		size: COLUMN_WIDTH.amount,
		enableSorting: true,
		meta: { headerClassName: AMOUNT_ALIGN, cellClassName: AMOUNT_ALIGN },
	},
];

interface Totals {
	readonly seats: number;
	readonly amount: number;
}

const NO_TOTALS: Totals = { seats: 0, amount: 0 };

function addDeal(sum: Totals, deal: Deal): Totals {
	return { seats: sum.seats + deal.account.seats, amount: sum.amount + deal.amount };
}

function dealRowId(row: Deal): string {
	return row.id;
}

function firstPage(current: PaginationState): PaginationState {
	return { ...current, pageIndex: 0 };
}

export function Filters10Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(SEED);
	const [pagination, setPagination] = React.useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = React.useState<SortingState>(INITIAL_SORTING);

	const rows = React.useMemo((): Deal[] => DEALS.filter((deal: Deal): boolean => matches(deal, query)), [query]);
	const totals = React.useMemo((): Totals => rows.reduce(addDeal, NO_TOTALS), [rows]);

	const applyQuery = React.useCallback((next: FilterQuery): void => {
		setQuery(next);
		setPagination(firstPage);
	}, []);
	const resetQuery = React.useCallback((): void => {
		applyQuery(SEED);
	}, [applyQuery]);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: rows,
		pageCount: Math.ceil(rows.length / pagination.pageSize),
		getRowId: dealRowId,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
	});

	const footer = (
		<DataGridTableFootRow>
			<DataGridTableFootRowCell colSpan={FOOTER_LABEL_SPAN} className={GUTTER_START}>
				<span className="text-muted-foreground">Filtered total</span>
			</DataGridTableFootRowCell>
			<DataGridTableFootRowCell className={cn("font-medium tabular-nums", NUMERIC_ALIGN)}>{count.format(totals.seats)}</DataGridTableFootRowCell>
			<DataGridTableFootRowCell className={cn("font-medium tabular-nums", AMOUNT_ALIGN)}>{money.format(totals.amount)}</DataGridTableFootRowCell>
		</DataGridTableFootRow>
	);

	return (
		<DataGrid table={table} recordCount={rows.length} emptyMessage="No deals match these filters" tableLayout={TABLE_LAYOUT}>
			{/*
        Card spacing is a per-style token, and this report has to hold its
        height in a fixed frame, so the card zeroes its own padding and each
        part pays for its own. That is the same composition the data-grid
        examples use for a card that is a page rather than a tile.
      */}
			<Card className="w-full gap-0 p-0">
				<CardHeader className="flex items-center justify-between gap-3 px-4 py-2">
					{/*
            Title over count rather than beside it. Side by side they need about
            180px, and a style with taller, wider controls (sera's are
            uppercase) leaves the left of this header barely 110px, at which
            point the only shrinkable item, the title, truncates to nothing and
            the card loses its name. Stacked, the group asks for the width of
            its widest line - and the count is the one thing on screen that says
            the query is doing something while the panel is shut.
          */}
					<div className="flex min-w-0 flex-col gap-0.5">
						<CardTitle className="truncate text-sm font-medium">Pipeline</CardTitle>
						<CardDescription className="truncate text-xs tabular-nums">
							{rows.length} of {DEALS.length} deals
						</CardDescription>
					</div>

					{/*
            POPOVER, not inline, and the grid is why. Inline reads more like a
            real report page, and the sibling example that walks a tree back out
            renders it that way inside its own `Card`; here the whole seeded
            query is five rows of builder, about 260px, and spending that above
            a table would leave the table to be scrolled rather than read. Hung
            off a trigger it costs one 32px control, opens over the rows it is
            about, and the count badge the primitive draws on it says how many
            conditions are in force without opening anything.

            `className` on `Filters` would land on the POPOVER panel, not on the
            trigger, so the toolbar's own layout belongs to this action group.
          */}
					<CardAction className="flex shrink-0 items-center gap-2">
						<Filters
							variant="advanced"
							advancedMode="popover"
							advancedAlign="end"
							reorderable
							fields={FIELDS}
							operatorLabels={COMPACT_OPERATORS}
							pathCollapse="start"
							maxPathSegments={MAX_PATH_SEGMENTS}
							className="[--filter-field-width:9rem] [--filter-operator-width:6.5rem] [--filter-value-width:10.5rem]"
							query={query}
							onQueryChange={applyQuery}
						/>

						{/*
              Restoring the view is the only button beside the trigger. Emptying
              the query is the panel's own footer action, and a toolbar copy of a
              control that already exists one click away is two places to keep in
              agreement for nothing.

              Identity, not deep equality, decides whether there is anything to
              restore: every edit publishes a new query object, so the seeded one
              is still the seeded one exactly while nothing has been changed.
            */}
						<Button variant="ghost" disabled={query === SEED} onClick={resetQuery}>
							Reset
						</Button>
					</CardAction>
				</CardHeader>

				<CardContent className="border-y px-0">
					<DataGridScrollArea>
						<DataGridTable footerContent={footer} />
					</DataGridScrollArea>
				</CardContent>

				{/*
          `border-t-0`, because two styles draw this line already. Six of the
          eight leave the card footer unbordered and take one from the content
          block above it, which is what `border-y` up there is for; nova and
          lyra give the footer an unconditional `border-t` of its own, and the
          two land on the same pixel row as a visible double rule. Suppressing
          the footer's own copy rather than dropping `border-y` is what keeps
          the other six bordered - and it has to be this way round, because a
          `border-t` utility added here would also match the
          `[.border-t]:pt-(--card-spacing)` rule those six ship and replace this
          bar's 10px of padding with the style's full card spacing.

          The utility wins on layer order, not specificity: the per-style card
          rules are imported into `layer(base)` and tailwind's utilities come
          after it, so the style's footer selector loses to a plain `border-t-0`
          despite being the more specific one.
        */}
				<CardFooter className="border-t-0 px-4 py-2.5">
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
				</CardFooter>
			</Card>
		</DataGrid>
	);
}
