import SparklesIcon from "lucide-react-native/icons/sparkles";
import { Icon } from "@workspace/ui-native/components/icon";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { KbdGroup } from "@workspace/ui-native/components/kbd";
import * as React from "react";

const SHORTCUT: readonly string[] = ["⌘", "⇧", "G"];

export function InputGroup23Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leading={<Icon icon={SparklesIcon} size="sm" colorClassName="accent-success" />}
			trailing={<KbdGroup keys={SHORTCUT} />}
			placeholder="Generate with AI…"
			accessibilityLabel="Generate"
		/>
	);
}
