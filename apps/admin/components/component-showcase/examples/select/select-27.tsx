import type * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Plan {
	readonly value: string;
	readonly label: string;
	readonly description: string;
}

const plans: readonly Plan[] = [
	{ value: "startup", label: "Startup", description: "For small teams up to 10" },
	{ value: "business", label: "Business", description: "For growing companies" },
	{ value: "enterprise", label: "Enterprise", description: "Unlimited everything" },
];

const DEFAULT_PLAN = "startup";

export function Select27Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_PLAN} items={plans}>
				<SelectTrigger className="w-[240px] [&_span.text-muted-foreground]:hidden">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{plans.map((plan) => (
							<SelectItem key={plan.value} value={plan.value} className="[&_svg]:text-primary">
								<div className="flex flex-col items-start gap-px">
									<span className="font-medium">{plan.label}</span>
									<span className="text-xs text-muted-foreground">{plan.description}</span>
								</div>
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
