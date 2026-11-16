import SparklesIcon from "lucide-react-native/icons/sparkles";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

interface Model {
	readonly name: string;
	readonly tier: string;
	readonly context: string;
}

const MODELS: readonly Model[] = [
	{ name: "Swift 2", tier: "Fast", context: "128K" },
	{ name: "Atlas 4", tier: "Pro", context: "1M" },
	{ name: "Nova 5", tier: "Preview", context: "256K" },
];

export function ButtonGroup41Example(): React.JSX.Element {
	const [model, setModel] = React.useState<string>("Swift 2");
	const models = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			MODELS.map(({ name, tier, context }: Model): DropdownMenuItemData<string> => ({
				value: name,
				label: name,
				description: `${tier} · ${context} context`,
				kind: "radio",
				checked: name === model,
			})),
		[model],
	);
	return (
		<ButtonGroup accessibilityLabel="Model" className="self-start">
			<DropdownMenu label={model} title="Model" icon={SparklesIcon} items={models} onSelect={setModel} />
		</ButtonGroup>
	);
}
