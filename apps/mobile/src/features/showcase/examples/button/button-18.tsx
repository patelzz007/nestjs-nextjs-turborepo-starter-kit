import PlusIcon from "lucide-react-native/icons/plus";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button18Example(): React.JSX.Element {
	return <Button label="Add item" variant="outline" icon={PlusIcon} onPress={ignorePress} />;
}
