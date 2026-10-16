import * as React from "react";
import { PhoneInput } from "@workspace/ui/components/phone-input";

export function PhoneInput3Example(): React.JSX.Element {
	return <PhoneInput variant="lg" placeholder="Enter phone number" defaultCountry="US" value="+12125551234" />;
}
