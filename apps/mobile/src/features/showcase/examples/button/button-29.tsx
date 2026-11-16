import ArrowUpRightIcon from "lucide-react-native/icons/arrow-up-right";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button29Example(): React.JSX.Element {
	return <Button label="View documentation" variant="link" icon={ArrowUpRightIcon} iconPosition="end" onPress={ignorePress} />;
}
