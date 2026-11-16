import * as React from "react";
import { ChartNoAxesColumnDecreasingIcon, CircleDollarSignIcon, CreditCardIcon, FileTextIcon } from "lucide-react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";

const items = [
	{
		title: "Payments",
		description: "Receive payments from your customers",
		icon: <CircleDollarSignIcon aria-hidden="true" className="size-4" />,
		checked: true,
	},
	{
		title: "Invoices",
		description: "Create and send invoices to your customers",
		icon: <FileTextIcon aria-hidden="true" className="size-4" />,
		checked: false,
	},
	{
		title: "Billing",
		description: "Manage your billing and subscriptions",
		icon: <CreditCardIcon aria-hidden="true" className="size-4" />,
		checked: false,
	},
	{
		title: "Reports",
		description: "View your reports and analytics",
		icon: <ChartNoAxesColumnDecreasingIcon aria-hidden="true" className="size-4" />,
		checked: false,
	},
];

export function Checkbox14Example(): React.JSX.Element {
	return (
		<FieldGroup className="grid w-full max-w-xs grid-cols-2 gap-4">
			{items.map((item) => (
				<FieldLabel key={item.title} className="relative p-0">
					<Field orientation="horizontal">
						<Checkbox defaultChecked={item.checked} className="absolute top-3 right-3 size-5 rounded-full" />
						<FieldTitle className="flex flex-col items-start">
							<div className="flex shrink-0 items-center justify-center rounded-2xl border border-border bg-background p-2 shadow-xs shadow-scrim/5">{item.icon}</div>
							<div className="flex flex-col items-start gap-0.5">
								<span className="text-sm font-semibold"> {item.title} </span>
								<span className="text-xs text-muted-foreground"> {item.description} </span>
							</div>
						</FieldTitle>
					</Field>
				</FieldLabel>
			))}
		</FieldGroup>
	);
}
