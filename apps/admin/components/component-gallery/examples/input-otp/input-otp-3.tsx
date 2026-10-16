"use client";

import * as React from "react";
import { useState } from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp";

export function InputOtp3Example(): React.JSX.Element {
	const [value, setValue] = useState("123456");

	return (
		<div className="flex items-center justify-center">
			<Field>
				<FieldLabel htmlFor="multi-separator">Multi-Separator</FieldLabel>
				<InputOTP id="multi-separator" maxLength={6} value={value} onChange={setValue}>
					<InputOTPGroup>
						<InputOTPSlot index={0} />
						<InputOTPSlot index={1} />
					</InputOTPGroup>
					<InputOTPSeparator />
					<InputOTPGroup>
						<InputOTPSlot index={2} />
						<InputOTPSlot index={3} />
					</InputOTPGroup>
					<InputOTPSeparator />
					<InputOTPGroup>
						<InputOTPSlot index={4} />
						<InputOTPSlot index={5} />
					</InputOTPGroup>
				</InputOTP>
			</Field>
		</div>
	);
}
