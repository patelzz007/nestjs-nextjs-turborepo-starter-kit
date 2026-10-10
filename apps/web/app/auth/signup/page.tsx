"use client";

import { SignupForm } from "@workspace/client/lib/auth/forms/signup-form";
import { AuthLayout } from "@workspace/ui/components/auth-layout";

export default function WebSignupPage(): React.JSX.Element {
	return (
		<AuthLayout
			brandName="Reward Hub"
			tagline="Join Reward Hub and start claiming local rewards."
			features={["Browse rewards by city and category", "Claim offers with OTP verification", "Redeem in-store with QR codes"]}
			title="Create account"
			subtitle="Sign up to start claiming rewards"
			copyright="Reward Hub">
			<SignupForm />
		</AuthLayout>
	);
}
