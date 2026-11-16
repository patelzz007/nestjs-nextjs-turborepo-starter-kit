import BotIcon from "lucide-react-native/icons/bot";
import BrainIcon from "lucide-react-native/icons/brain";
import SparklesIcon from "lucide-react-native/icons/sparkles";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

type Model = "opus" | "gpt" | "gemini";

const NAMES: Readonly<Record<Model, string>> = { opus: "Claude Opus 5.5", gpt: "GPT", gemini: "Gemini" };

export function DropdownMenu18Example(): React.JSX.Element {
	const [model, setModel] = React.useState<Model>("opus");
	const items: readonly DropdownMenuItemData<Model>[] = [
		{
			value: "opus",
			label: NAMES.opus,
			description: "Anthropic",
			leading: <IconTile icon={SparklesIcon} tone="orange" size="sm" />,
			kind: "radio",
			checked: model === "opus",
		},
		{ value: "gpt", label: NAMES.gpt, description: "OpenAI", leading: <IconTile icon={BotIcon} tone="neutral" size="sm" />, kind: "radio", checked: model === "gpt" },
		{ value: "gemini", label: NAMES.gemini, description: "Google", leading: <IconTile icon={BrainIcon} tone="blue" size="sm" />, kind: "radio", checked: model === "gemini" },
	];
	const choose = React.useCallback((value: Model): void => {
		setModel(value);
	}, []);
	return <DropdownMenu label={NAMES[model]} title="Select model" items={items} onSelect={choose} />;
}
