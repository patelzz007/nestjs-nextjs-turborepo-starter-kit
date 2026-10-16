import type * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Plan {
	readonly value: string;
	readonly label: string;
	readonly description: string;
}

const plans: readonly Plan[] = [
	{ value: "starter", label: "Starter", description: "Perfect for individuals getting started." },
	{ value: "professional", label: "Professional", description: "Ideal for growing teams and businesses." },
	{ value: "enterprise", label: "Enterprise", description: "Advanced features for large organizations." },
];

const DEFAULT_PLAN = "starter";

interface SelectPlanItemProps {
	readonly plan: Plan;
}

function SelectPlanItem({ plan }: SelectPlanItemProps): React.JSX.Element {
	return (
		<Item size="xs" className="w-full p-0">
			<ItemContent className="gap-0">
				<ItemTitle>{plan.label}</ItemTitle>
				<ItemDescription className="text-xs">{plan.description}</ItemDescription>
			</ItemContent>
		</Item>
	);
}

function formatPlan(value: string): React.ReactNode {
	const plan = plans.find((item) => item.value === value);
	return plan === undefined ? value : <SelectPlanItem plan={plan} />;
}

export function Select6Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select items={plans} defaultValue={DEFAULT_PLAN}>
				<SelectTrigger className="h-auto! w-full">
					<SelectValue formatValue={formatPlan} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{plans.map((plan) => (
							<SelectItem key={plan.value} value={plan.value}>
								<SelectPlanItem plan={plan} />
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
