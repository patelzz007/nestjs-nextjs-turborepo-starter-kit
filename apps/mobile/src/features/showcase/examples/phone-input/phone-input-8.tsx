import { Field } from "@workspace/ui-native/components/field";
import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

import { ignorePress } from "../example-support";

export function PhoneInput8Example(): React.JSX.Element {
	return (
		<Field label="Phone on file">
			<PhoneInput value="+60123456789" onChange={ignorePress} readOnly />
		</Field>
	);
}
