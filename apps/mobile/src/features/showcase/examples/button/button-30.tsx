import ZapIcon from "lucide-react-native/icons/zap";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button30Example(): React.JSX.Element {
	return <Button label="Upgrade now" size="lg" icon={ZapIcon} onPress={ignorePress} />;
}
