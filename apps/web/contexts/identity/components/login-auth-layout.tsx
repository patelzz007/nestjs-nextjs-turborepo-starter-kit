import { AuthLayout } from "@workspace/ui/components/auth-layout";
import * as React from "react";
import { BRAND_NAME } from "@workspace/tokens";

export interface WebLoginAuthLayoutProps {
	readonly children: React.ReactNode;
}

/** The sign-in page's chrome — shared by the page and its `loading.tsx`, so the copy never moves while the form loads. */
export function WebLoginAuthLayout({ children }: WebLoginAuthLayoutProps): React.JSX.Element {
	return (
		<AuthLayout
			brandName={BRAND_NAME}
			tagline="Discover and claim local rewards in KL and Melaka."
			features={["Browse rewards by city and category", "Claim offers with OTP verification", "Redeem in-store with QR codes"]}
			title="Sign in"
			subtitle="Access your claimed rewards and account"
			copyright={BRAND_NAME}>
			{children}
		</AuthLayout>
	);
}
