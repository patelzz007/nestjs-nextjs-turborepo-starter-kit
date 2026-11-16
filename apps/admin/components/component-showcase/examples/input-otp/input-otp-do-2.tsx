import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@workspace/ui/components/input-otp";

export function InputOtpDo2Example(): React.JSX.Element {
	return (
		<Field>
			<FieldLabel htmlFor="input-otp-do-2">Verification code</FieldLabel>
			<FieldDescription>We sent a 6-digit code to ada@example.com.</FieldDescription>
			<InputOTP id="input-otp-do-2" maxLength={6}>
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
	);
}
