import { IconTile } from "@workspace/ui-native/components/icon-tile";
import Settings2Icon from "lucide-react-native/icons/settings-2";
import * as React from "react";

import { ignorePress } from "../example-support";

export function IconTileDo2Example(): React.JSX.Element {
	return <IconTile icon={Settings2Icon} variant="elevated" onPress={ignorePress} accessibilityLabel="Open settings" className="self-center" />;
}
