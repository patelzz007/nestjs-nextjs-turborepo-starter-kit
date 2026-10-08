import { isStringPrimitive } from "@workspace/shared";

import { loadAdminDemoAccounts } from "@/lib/auth/demo-accounts";
import { resolveAdminRedirectTarget } from "@/lib/auth-routes";
import { clientEnv } from "@/lib/env/env.client";
import { LOGIN_REDIRECT_PARAM } from "@/lib/routes";

import { LoginView } from "./login-view";

export interface AdminLoginPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/auth/login` — admin login. Server component: resolves `?redirect=` (set by
 * the proxy when bouncing an unauthenticated request) to a safe, normalized
 * in-app path, and hands it, the web base URL and — only in development —
 * the seeded demo logins to the client
 * `LoginView` as props. The demo credentials are decided here, on the server, so they never ship in the
 * client bundle, and `useSearchParams`/`Suspense` stay out of it too.
 */
export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps): Promise<React.JSX.Element> {
	const params = await searchParams;
	const rawRedirect = params[LOGIN_REDIRECT_PARAM];
	const redirectPath: string = resolveAdminRedirectTarget(isStringPrimitive(rawRedirect) ? rawRedirect : undefined, clientEnv.NEXT_PUBLIC_ADMIN_URL);

	return <LoginView redirectPath={redirectPath} webBaseUrl={clientEnv.NEXT_PUBLIC_WEB_URL} demoAccounts={await loadAdminDemoAccounts()} />;
}
