import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp";

export function InputOtp1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Field>
				<FieldLabel htmlFor="simple-otp">Simple OTP</FieldLabel>
				<InputOTP id="simple-otp" maxLength={6}>
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
