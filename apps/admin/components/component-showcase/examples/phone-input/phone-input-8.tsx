import * as React from "react";
import { PhoneInput } from "@workspace/ui/components/phone-input";

export function PhoneInput8Example(): React.JSX.Element {
	return <PhoneInput readOnly value="+12125551234" placeholder="Enter phone number" />;
}
