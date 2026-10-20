"use client";

import { SignupForm } from "@workspace/client/lib/contexts/identity/forms/signup-form";
import { AuthLayout } from "@workspace/ui/components/auth-layout";
import { BRAND_NAME } from "@workspace/tokens";

export default function WebSignupPage(): React.JSX.Element {
	return (
		<AuthLayout
			brandName={BRAND_NAME}
			tagline={`Join ${BRAND_NAME} and start claiming local rewards.`}
			features={["Browse rewards by city and category", "Claim offers with OTP verification", "Redeem in-store with QR codes"]}
			title="Create account"
			subtitle="Sign up to start claiming rewards"
			copyright={BRAND_NAME}>
			<SignupForm />
		</AuthLayout>
	);
}
