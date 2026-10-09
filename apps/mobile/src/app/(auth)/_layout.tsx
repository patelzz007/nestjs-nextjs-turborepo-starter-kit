// The (auth) group: a stack. A signed-out device sees the sign-in screens; a
// RESTRICTED session (§10.5, forced enrollment) sees only the step it must finish.

import { Stack } from "expo-router";
import * as React from "react";

import { useEnrollmentReason } from "../../features/session/facade";

const SCREEN_OPTIONS = { headerShown: false } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

export default function AuthLayout(): React.JSX.Element {
	const enrollmentReason = useEnrollmentReason();
	return (
		<Stack screenOptions={SCREEN_OPTIONS}>
			<Stack.Protected guard={enrollmentReason === null}>
				<Stack.Screen name="sign-in" />
				<Stack.Screen name="sign-up" />
				<Stack.Screen name="forgot-password" />
				<Stack.Screen name="two-factor" />
				<Stack.Screen name="verify-device" />
			</Stack.Protected>
			<Stack.Protected guard={enrollmentReason === "mfa_enrollment"}>
				<Stack.Screen name="enroll-two-factor" />
			</Stack.Protected>
			<Stack.Protected guard={enrollmentReason === "email_verification"}>
				<Stack.Screen name="verify-email" />
			</Stack.Protected>
		</Stack>
	);
}
