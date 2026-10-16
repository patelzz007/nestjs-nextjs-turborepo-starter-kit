import * as React from "react";

import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { OTP_DIGITS_AND_LETTERS_PATTERN } from "@/components/component-gallery/examples/input-otp/input-otp-patterns";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp";

export function InputOtp4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Field>
				<FieldLabel htmlFor="alphanumeric">Alphanumeric OTP</FieldLabel>
				<FieldDescription>Accepts both letters and numbers.</FieldDescription>
				<InputOTP id="alphanumeric" maxLength={6} pattern={OTP_DIGITS_AND_LETTERS_PATTERN}>
					<InputOTPGroup>
						<InputOTPSlot index={0} />
						<InputOTPSlot index={1} />
						<InputOTPSlot index={2} />
					</InputOTPGroup>
					<InputOTPSeparator />
					<InputOTPGroup>
						<InputOTPSlot index={3} />
						<InputOTPSlot index={4} />
						<InputOTPSlot index={5} />
					</InputOTPGroup>
				</InputOTP>
			</Field>
		</div>
	);
}
