import CircleHelpIcon from "lucide-react-native/icons/circle-help";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button28Example(): React.JSX.Element {
	return <Button label="Help center" variant="link" icon={CircleHelpIcon} onPress={ignorePress} />;
}
