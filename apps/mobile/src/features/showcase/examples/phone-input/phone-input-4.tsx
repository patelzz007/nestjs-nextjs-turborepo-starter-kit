import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

import { ignorePress } from "../example-support";

export function PhoneInput4Example(): React.JSX.Element {
	return <PhoneInput value="" onChange={ignorePress} disabled accessibilityLabel="Phone number" />;
}
