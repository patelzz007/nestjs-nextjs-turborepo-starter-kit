import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const BILLING: readonly ToggleGroupOption<string>[] = [
	{ value: "monthly", label: "Monthly" },
	{ value: "yearly", label: "Yearly", badge: "Save 20%", accessibilityLabel: "Yearly, save 20%" },
];

export function ToggleGroup16Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("yearly");
	return <ToggleGroup type="single" label="Billing" options={BILLING} value={value} onChange={setValue} variant="outline" size="lg" spacing="attached" />;
}
