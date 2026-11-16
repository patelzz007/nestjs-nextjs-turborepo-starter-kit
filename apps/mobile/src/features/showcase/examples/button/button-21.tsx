import LogOutIcon from "lucide-react-native/icons/log-out";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button21Example(): React.JSX.Element {
	return <Button label="Log out" variant="ghost" icon={LogOutIcon} iconPosition="end" onPress={ignorePress} />;
}
