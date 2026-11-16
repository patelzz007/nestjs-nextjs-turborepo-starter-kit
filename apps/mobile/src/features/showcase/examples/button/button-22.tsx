import Trash2Icon from "lucide-react-native/icons/trash-2";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button22Example(): React.JSX.Element {
	return <Button label="Delete account" variant="destructive" icon={Trash2Icon} onPress={ignorePress} />;
}
