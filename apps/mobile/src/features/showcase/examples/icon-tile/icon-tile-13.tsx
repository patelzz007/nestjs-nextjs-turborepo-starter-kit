import { IconTile } from "@workspace/ui-native/components/icon-tile";
import Settings2Icon from "lucide-react-native/icons/settings-2";
import * as React from "react";

import { ignorePress } from "../example-support";

// A tile that is a control of its own: a link with its own name.
export function IconTile13Example(): React.JSX.Element {
	return <IconTile icon={Settings2Icon} variant="elevated" tone="brand" onPress={ignorePress} accessibilityLabel="Open settings" className="self-center" />;
}
