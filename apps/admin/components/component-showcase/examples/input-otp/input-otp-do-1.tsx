import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@workspace/ui/components/input-otp";

export function InputOtpDo1Example(): React.JSX.Element {
	return (
		<Field>
			<FieldLabel htmlFor="input-otp-do-1">Verification code</FieldLabel>
			<InputOTP id="input-otp-do-1" maxLength={6} inputMode="numeric" autoComplete="one-time-code">
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
