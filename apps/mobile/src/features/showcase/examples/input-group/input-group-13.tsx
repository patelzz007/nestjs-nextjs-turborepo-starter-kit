import SearchIcon from "lucide-react-native/icons/search";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { KbdGroup } from "@workspace/ui-native/components/kbd";
import * as React from "react";

const SHORTCUT: readonly string[] = ["⌘", "K"];

export function InputGroup13Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leadingIcon={SearchIcon}
			trailing={<KbdGroup keys={SHORTCUT} />}
			placeholder="Search the docs…"
			accessibilityLabel="Search the docs"
		/>
	);
}
