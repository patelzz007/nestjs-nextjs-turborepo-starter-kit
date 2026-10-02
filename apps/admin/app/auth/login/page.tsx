import { isSafeAdminRedirect } from "@/lib/auth-routes";
import { clientEnv } from "@/lib/env/env.client";
import { ROUTES } from "@/lib/routes";

import { LoginView } from "./login-view";

/**
 * `/auth/login` — admin login. Server component: reads `?redirect=` from the
 * URL (set by the proxy when bouncing an unauthenticated request) and the web
 * base URL from the validated public env, then hands both to the client
 * `LoginView` as props — so `useSearchParams`/`Suspense` stay out of the
 * client bundle.
 * The static brand/testimonial shell renders in the initial SSR HTML.
 */
export default async function AdminLoginPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const rawRedirect: string | undefined = typeof sp.redirect === "string" ? sp.redirect : undefined;
	const redirectPath: string = rawRedirect !== undefined && isSafeAdminRedirect(rawRedirect) ? rawRedirect : ROUTES.home;

	// Web app URL for the "Returning to main website" link.
	const webBaseUrl: string = clientEnv.NEXT_PUBLIC_WEB_URL;

	// One-click demo account — only when explicitly enabled (local/dev
	// convenience). Resolved server-side so the demo credential is only passed
	// to the client view when the flag is on.
	const showDemoAccounts: boolean = clientEnv.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS;

	return <LoginView redirectPath={redirectPath} webBaseUrl={webBaseUrl} showDemoAccounts={showDemoAccounts} />;
}
