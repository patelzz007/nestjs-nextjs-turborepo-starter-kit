import { IconTile } from "@workspace/ui-native/components/icon-tile";
import Settings2Icon from "lucide-react-native/icons/settings-2";
import * as React from "react";

import { ignorePress } from "../example-support";

// A pressable tile named after its glyph: a screen reader hears “Icon”, not what it opens.
export function IconTileDont2Example(): React.JSX.Element {
	return <IconTile icon={Settings2Icon} variant="elevated" onPress={ignorePress} accessibilityLabel="Icon" className="self-center" />;
}
