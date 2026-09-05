"use client";

import { SignupForm } from "@workspace/client/lib/auth/signup-form";
import { AuthLayout } from "@workspace/ui/components/layout/auth-layout";

export default function WebSignupPage(): React.JSX.Element {
	return (
		<AuthLayout
			logo={
				<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
					/>
				</svg>
			}
			brandName="Reward Hub"
			tagline="Join Reward Hub and start claiming local rewards."
			features={["Browse rewards by city and category", "Claim offers with OTP verification", "Redeem in-store with QR codes"]}
			title="Create account"
			subtitle="Sign up to start claiming rewards"
			copyright="Reward Hub"
			labels={{ mobileBack: "Back", toggleThemeAria: "Toggle theme", rightsReserved: "All rights reserved." }}>
			<SignupForm />
		</AuthLayout>
	);
}
