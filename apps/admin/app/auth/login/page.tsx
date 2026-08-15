import { LoginView } from "./login-view";

/** True when `redirect` is a safe in-app path (mirrors the proxy's check — no open redirects). */
function isSafeRedirect(redirect: string): boolean {
	return redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/auth/");
}

/**
 * `/auth/login` — admin login. Server component: reads `?redirect=` from the
 * URL (set by the proxy when bouncing an unauthenticated request) and the web
 * base URL from env, then hands both to the client `LoginView` as props — so
 * `useSearchParams`/`Suspense` and env reads stay out of the client bundle.
 * The static brand/testimonial shell renders in the initial SSR HTML.
 */
export default async function AdminLoginPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const rawRedirect: string | undefined = typeof sp.redirect === "string" ? sp.redirect : undefined;
	const redirectPath: string = rawRedirect !== undefined && isSafeRedirect(rawRedirect) ? rawRedirect : "/";

	// Web app URL — read server-side so the client never touches `process.env`.
	const webBaseUrl: string = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

	return <LoginView redirectPath={redirectPath} webBaseUrl={webBaseUrl} />;
}
