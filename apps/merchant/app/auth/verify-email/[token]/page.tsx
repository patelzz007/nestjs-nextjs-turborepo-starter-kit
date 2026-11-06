import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

interface LegacyVerifyEmailPageProps {
	readonly params: Promise<{ readonly token: string }>;
}

/** Legacy path-style links (`/auth/verify-email/:token`) → query-param form. */
export default async function LegacyMerchantVerifyEmailPage({ params }: LegacyVerifyEmailPageProps): Promise<React.ReactNode> {
	const { token } = await params;
	redirect(appRoute(`${ROUTES.auth.verifyEmail}?${new URLSearchParams({ token }).toString()}`));
}
