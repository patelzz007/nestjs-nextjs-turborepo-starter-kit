import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { InputOTP } from "@workspace/ui-native/components/input-otp";
import * as React from "react";

import { ignorePress } from "../example-support";

const CODE_LENGTH = 6;
const TITLE = "Check your email";
const DESCRIPTION = "We sent a code to avery@acme.com.";

export function InputOtp6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent>
				<InputOTP value={value} onChange={setValue} length={6} keyboardType="number-pad" size="lg" accessibilityLabel="Code" />
			</CardContent>
			<CardFooter>
				<Button label="Resend code" variant="ghost" size="sm" onPress={ignorePress} />
				<Button label="Verify" size="sm" disabled={value.length < CODE_LENGTH} onPress={ignorePress} />
			</CardFooter>
		</Card>
	);
}
