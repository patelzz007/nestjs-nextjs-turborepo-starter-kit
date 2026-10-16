import * as React from "react";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

const plans = [
	{
		value: "free",
		title: "Free",
		price: "$0",
		description: "For personal projects and experiments.",
	},
	{
		value: "pro",
		title: "Pro",
		price: "$19",
		description: "For professionals and small teams.",
	},
	{
		value: "enterprise",
		title: "Enterprise",
		price: "$49",
		description: "For organizations with advanced needs.",
	},
];

export function RadioGroup17Example(): React.JSX.Element {
	return (
		<RadioGroup defaultValue="pro" className="w-full max-w-xs">
			{plans.map((plan) => (
				<FieldLabel key={plan.value} htmlFor={plan.value}>
					<Field orientation="horizontal">
						<RadioGroupItem value={plan.value} id={plan.value} />
						<FieldContent>
							<FieldTitle className="flex items-center justify-between">
								<span>{plan.title}</span>
								<span className="text-sm font-semibold">{plan.price}/mo</span>
							</FieldTitle>
							<FieldDescription>{plan.description}</FieldDescription>
						</FieldContent>
					</Field>
				</FieldLabel>
			))}
		</RadioGroup>
	);
}
