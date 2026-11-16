import SearchIcon from "lucide-react-native/icons/search";
import { Button } from "@workspace/ui-native/components/button";
import { KbdGroup } from "@workspace/ui-native/components/kbd";
import * as React from "react";

import { ignorePress } from "../example-support";

/** The command palette's shortcut on a hardware keyboard. */
const SHORTCUT: readonly string[] = ["⌘", "K"];

export function Button40Example(): React.JSX.Element {
	return <Button label="Search" variant="outline" icon={SearchIcon} accessibilityHint="Shortcut: Command K" trailing={<KbdGroup keys={SHORTCUT} />} onPress={ignorePress} />;
}
