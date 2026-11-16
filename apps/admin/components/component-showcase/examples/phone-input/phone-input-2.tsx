import * as React from "react";
import { PhoneInput } from "@workspace/ui/components/phone-input";

export function PhoneInput2Example(): React.JSX.Element {
	return <PhoneInput variant="sm" placeholder="Enter phone number" defaultCountry="NL" value="+31612345678" />;
}
