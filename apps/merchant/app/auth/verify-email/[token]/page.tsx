import { redirect } from "next/navigation";

interface LegacyVerifyEmailPageProps {
	readonly params: Promise<{ readonly token: string }>;
}

/** Legacy path-style links (`/auth/verify-email/:token`) → query-param form. */
export default async function LegacyMerchantVerifyEmailPage({ params }: LegacyVerifyEmailPageProps): Promise<never> {
	const { token } = await params;
	redirect(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}
