import * as React from "react";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";

const PLAN_SELECTION_OPTIONS: readonly SelectOption<string>[] = [
	{ value: "free", label: "Free - Basic features" },
	{ value: "pro", label: "Pro - Advanced tools" },
	{ value: "enterprise", label: "Enterprise - Custom solutions" },
];

const BILLING_CYCLE_OPTIONS: readonly SelectOption<string>[] = [
	{ value: "monthly", label: "Monthly billing" },
	{ value: "yearly", label: "Yearly billing (Save 20%)" },
];

export function Field3Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="plan-selection">Subscription Plan</FieldLabel>
					<Select items={PLAN_SELECTION_OPTIONS} defaultValue="pro">
						<SelectTrigger id="plan-selection">
							<SelectValue placeholder="Select a plan" />
						</SelectTrigger>
						<SelectContent>
							{PLAN_SELECTION_OPTIONS.map((option: SelectOption<string>): React.JSX.Element => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>Choose the plan that best fits your needs.</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor="billing-cycle">Billing Cycle</FieldLabel>
					<Select items={BILLING_CYCLE_OPTIONS} defaultValue="yearly">
						<SelectTrigger id="billing-cycle">
							<SelectValue placeholder="Select billing cycle" />
						</SelectTrigger>
						<SelectContent>
							{BILLING_CYCLE_OPTIONS.map((option: SelectOption<string>): React.JSX.Element => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>Billing cycles can be changed at any time.</FieldDescription>
				</Field>
			</FieldGroup>
		</div>
	);
}
