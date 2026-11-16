import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";

import { FIRST } from "./avatar-sample";

// A photo at the default size, with the initials kept as its fallback.
export function Avatar1Example(): React.JSX.Element {
	return <Avatar name={FIRST.name} imageUrl={FIRST.photo} />;
}
