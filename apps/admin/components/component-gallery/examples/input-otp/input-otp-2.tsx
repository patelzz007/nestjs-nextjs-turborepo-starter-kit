import * as React from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { OTP_DIGITS_ONLY_PATTERN } from "@/components/component-gallery/examples/input-otp/input-otp-patterns";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@workspace/ui/components/input-otp";

export function InputOtp2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Field>
				<FieldLabel htmlFor="digits-only">Digits Only</FieldLabel>
				<InputOTP id="digits-only" maxLength={6} pattern={OTP_DIGITS_ONLY_PATTERN}>
					<InputOTPGroup>
						<InputOTPSlot index={0} />
						<InputOTPSlot index={1} />
						<InputOTPSlot index={2} />
						<InputOTPSlot index={3} />
						<InputOTPSlot index={4} />
						<InputOTPSlot index={5} />
					</InputOTPGroup>
				</InputOTP>
			</Field>
		</div>
	);
}
