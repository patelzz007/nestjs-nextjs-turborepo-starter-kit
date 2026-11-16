import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button47Example(): React.JSX.Element {
	return <Button label="Updates" accessibilityLabel="Updates, new" trailing={<Badge label="New" tone="success" variant="solid" size="sm" />} onPress={ignorePress} />;
}
