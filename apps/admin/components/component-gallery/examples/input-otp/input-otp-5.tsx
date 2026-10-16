import * as React from "react";

import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { OTP_DIGITS_ONLY_PATTERN } from "@/components/component-gallery/examples/input-otp/input-otp-patterns";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@workspace/ui/components/input-otp";

export function InputOtp5Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Field>
				<FieldLabel htmlFor="four-digits">4-Digit PIN</FieldLabel>
				<FieldDescription>Common pattern for PIN codes.</FieldDescription>
				<InputOTP id="four-digits" maxLength={4} pattern={OTP_DIGITS_ONLY_PATTERN}>
					<InputOTPGroup>
						<InputOTPSlot index={0} />
						<InputOTPSlot index={1} />
						<InputOTPSlot index={2} />
						<InputOTPSlot index={3} />
					</InputOTPGroup>
				</InputOTP>
			</Field>
		</div>
	);
}
