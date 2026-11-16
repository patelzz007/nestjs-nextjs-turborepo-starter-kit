import SettingsIcon from "lucide-react-native/icons/settings";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button20Example(): React.JSX.Element {
	return <Button label="Settings" variant="ghost" icon={SettingsIcon} onPress={ignorePress} />;
}
