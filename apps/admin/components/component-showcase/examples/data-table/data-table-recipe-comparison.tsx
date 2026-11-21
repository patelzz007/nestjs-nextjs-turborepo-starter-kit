"use client";

import { Check, Minus } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { DataTable, type DataTableColumns, type DataTableHeading, type DataTableLayout } from "@workspace/ui/components/data-table";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/core/utils";

const planSchema = z.enum(["starter", "team", "business", "enterprise"]);
export type Plan = z.output<typeof planSchema>;

const PLAN_NAMES: Readonly<Record<Plan, string>> = { starter: "Starter", team: "Team", business: "Business", enterprise: "Enterprise" };

/** One feature row: what each plan offers. `true`/`false` draw a tick or a dash; text is shown as it is. */
interface FeatureRow {
	readonly id: string;
	readonly feature: string;
	readonly plans: Readonly<Record<Plan, boolean | string>>;
}

export const FEATURE_ROWS: readonly FeatureRow[] = [
	{ id: "seats", feature: "Seats", plans: { starter: "3", team: "20", business: "100", enterprise: "Unlimited" } },
	{ id: "storage", feature: "Storage", plans: { starter: "5 GB", team: "100 GB", business: "1 TB", enterprise: "Custom" } },
	{ id: "sso", feature: "Single sign-on", plans: { starter: false, team: false, business: true, enterprise: true } },
	{ id: "audit", feature: "Audit log", plans: { starter: false, team: true, business: true, enterprise: true } },
	{ id: "api", feature: "API access", plans: { starter: true, team: true, business: true, enterprise: true } },
	{ id: "support", feature: "Support", plans: { starter: "Email", team: "Email", business: "Priority", enterprise: "Dedicated manager" } },
];

const offeredSchema = z.boolean();

function OfferCell({ offer }: { readonly offer: boolean | string }): React.JSX.Element {
	const flag = offeredSchema.safeParse(offer);
	if (!flag.success) {
		return <span>{offer}</span>;
	}
	return flag.data ? (
		<Check className="mx-auto size-4 text-success-foreground" aria-label="Included" />
	) : (
		<Minus className="mx-auto size-4 text-muted-foreground" aria-label="Not included" />
	);
}

/** The columns for the plans being compared, the highlighted one tinted top to bottom. Built from the choice, so the column list is dynamic. */
export function comparisonColumns(plans: readonly Plan[], highlighted: Plan): DataTableColumns<FeatureRow> {
	return [
		{ accessorKey: "feature", header: "Feature", size: 180, enableSorting: false },
		...plans.map((plan): DataTableColumns<FeatureRow>[number] => ({
			id: plan,
			header: PLAN_NAMES[plan],
			size: 130,
			enableSorting: false,
			cell: ({ row }): React.JSX.Element => <OfferCell offer={row.original.plans[plan]} />,
			meta: {
				cellClassName: cn("text-center", plan === highlighted && "bg-primary/8 font-medium"),
				headerClassName: cn("text-center [&>div]:justify-center", plan === highlighted && "bg-primary/8 text-primary"),
			},
		})),
	];
}

function getFeatureId(row: FeatureRow): string {
	return row.id;
}

/**
 * Recipe: a comparison table. The plan columns are built from the reader's choice (dynamic columns), and the
 * recommended plan is highlighted down its whole column through `meta.cellClassName`.
 */
export function DataTableRecipeComparison(): React.JSX.Element {
	const [plans, setPlans] = React.useState<readonly Plan[]>(planSchema.options);
	const handlePlansChange = React.useCallback((values: string[]): void => {
		const chosen = planSchema.array().safeParse(values);
		// Comparing needs at least one plan; an empty pick keeps the last one.
		if (chosen.success && chosen.data.length > 0) {
			setPlans(planSchema.options.filter((plan) => chosen.data.includes(plan)));
		}
	}, []);

	const columns = React.useMemo((): DataTableColumns<FeatureRow> => comparisonColumns(plans, "business"), [plans]);
	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Compare plans",
			description: "Business is the recommended plan.",
			actions: (
				<ToggleGroup multiple variant="outline" size="sm" value={[...plans]} onValueChange={handlePlansChange} aria-label="Plans to compare">
					{planSchema.options.map((plan) => (
						<ToggleGroupItem key={plan} value={plan}>
							{PLAN_NAMES[plan]}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			),
		}),
		[plans, handlePlansChange],
	);

	return <DataTable data={FEATURE_ROWS} columns={columns} getRowId={getFeatureId} heading={heading} layout={LAYOUT} />;
}

const LAYOUT: DataTableLayout = { cellBorders: true };
