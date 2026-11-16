import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";

import { ignorePress } from "../example-support";

const FACE = <Avatar name="Ava Patel" imageUrl={null} size="sm" />;

export function Badge24Example(): React.JSX.Element {
	return <Badge label="Ava" variant="outline" leading={FACE} onRemove={ignorePress} />;
}
