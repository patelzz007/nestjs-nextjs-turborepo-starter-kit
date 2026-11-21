"use client";

import * as React from "react";
import { z } from "zod";

import {
	DataTable,
	type DataTableColumns,
	type DataTableHeading,
	type DataTableLayout,
	type DataTableSelection,
	type DataTableTree,
} from "@workspace/ui/components/data-table";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

/** One unit of the organisation: a department, a team in it, or a person in a team. */
interface OrgUnit {
	readonly id: string;
	readonly name: string;
	readonly kind: "Department" | "Team" | "Person";
	readonly headcount: number;
	readonly children?: OrgUnit[];
}

function person(id: string, name: string): OrgUnit {
	return { id, name, kind: "Person", headcount: 1 };
}

function team(id: string, name: string, people: OrgUnit[]): OrgUnit {
	return { id, name, kind: "Team", headcount: people.length, children: people };
}

function department(id: string, name: string, teams: OrgUnit[]): OrgUnit {
	return { id, name, kind: "Department", headcount: teams.reduce((sum, unit) => sum + unit.headcount, 0), children: teams };
}

export const ORGANISATION: readonly OrgUnit[] = [
	department("eng", "Engineering", [
		team("eng-platform", "Platform", [person("p-1", "Aisha Rahman"), person("p-2", "Divya Nair"), person("p-3", "Grace Lim")]),
		team("eng-mobile", "Mobile", [person("p-4", "Hiro Tanaka"), person("p-5", "Leila Ahmadi")]),
	]),
	department("sales", "Sales", [team("sales-apac", "APAC", [person("p-6", "Ben Ortega"), person("p-7", "Farid Hassan")])]),
	department("support", "Support", [team("support-tier1", "Tier 1", [person("p-8", "Elena Petrova")])]),
];

function getUnitId(unit: OrgUnit): string {
	return unit.id;
}

function getUnitChildren(unit: OrgUnit): OrgUnit[] | undefined {
	return unit.children;
}

const COLUMNS: DataTableColumns<OrgUnit> = [
	{ accessorKey: "name", header: "Name", size: 300 },
	{ accessorKey: "kind", header: "Kind", size: 130 },
	{ accessorKey: "headcount", header: "Headcount", size: 120, meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" } },
];

const variantSchema = z.enum(["outline", "compact", "selectable"]);
type TreeVariant = z.output<typeof variantSchema>;

/** Indents in pixels per level: the outline's roomy step and the compact one. */
const OUTLINE_INDENT_PX = 24;
const COMPACT_INDENT_PX = 12;

/** What each variant switches on: the tree's shape, the density, and whether rows can be ticked. */
interface VariantSetup {
	readonly label: string;
	readonly tree: DataTableTree<OrgUnit>;
	readonly layout: DataTableLayout;
	readonly selection: DataTableSelection<OrgUnit> | undefined;
}

const NOOP = (): void => undefined;

export const TREE_VARIANTS: Readonly<Record<TreeVariant, VariantSetup>> = {
	outline: {
		label: "Outline",
		tree: { getSubRows: getUnitChildren, defaultExpanded: true, indent: OUTLINE_INDENT_PX },
		layout: { density: "comfortable" },
		selection: undefined,
	},
	compact: {
		label: "Compact",
		tree: { getSubRows: getUnitChildren, defaultExpanded: false, indent: COMPACT_INDENT_PX },
		layout: { density: "compact" },
		selection: undefined,
	},
	// `cascade`: ticking a department ticks every team and person under it; a part-ticked parent shows a dash.
	selectable: {
		label: "Selectable",
		tree: { getSubRows: getUnitChildren, defaultExpanded: true, indent: OUTLINE_INDENT_PX },
		layout: { density: "comfortable" },
		selection: { cascade: true, bulkActions: [{ key: "message", label: "Message", onSelect: NOOP }] },
	},
};

/**
 * Recipe: three looks for one tree. Outline opens every branch with a roomy indent, Compact starts closed with a
 * tight indent, and Selectable adds cascading checkboxes. Each variant is only a different `tree`, `layout` and
 * `selection`; the `key` gives each its own table, so expansion starts fresh when switching.
 */
export function DataTableRecipeTreeVariants(): React.JSX.Element {
	const [variant, setVariant] = React.useState<TreeVariant>("outline");
	const handleVariantChange = React.useCallback((values: string[]): void => {
		const next = variantSchema.safeParse(values.at(0));
		if (next.success) {
			setVariant(next.data);
		}
	}, []);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Organisation",
			actions: (
				<ToggleGroup variant="outline" size="sm" value={[variant]} onValueChange={handleVariantChange} aria-label="Tree variant">
					{variantSchema.options.map((option) => (
						<ToggleGroupItem key={option} value={option}>
							{TREE_VARIANTS[option].label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			),
		}),
		[variant, handleVariantChange],
	);

	const setup = TREE_VARIANTS[variant];
	return (
		<DataTable
			key={variant}
			data={ORGANISATION}
			columns={COLUMNS}
			getRowId={getUnitId}
			heading={heading}
			tree={setup.tree}
			layout={setup.layout}
			selection={setup.selection}
		/>
	);
}
