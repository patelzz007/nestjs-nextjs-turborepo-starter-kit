import GitBranchIcon from "lucide-react-native/icons/git-branch";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button16Example(): React.JSX.Element {
	return <Button label="Branches" variant="secondary" icon={GitBranchIcon} onPress={ignorePress} />;
}
