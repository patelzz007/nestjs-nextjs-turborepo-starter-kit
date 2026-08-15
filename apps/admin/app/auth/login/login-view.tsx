"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { LoginForm } from "@workspace/client/lib/auth/login-form";
import Link from "next/link";

export interface LoginViewProps {
	/** Safe in-app path to land on after a successful login (from `?redirect=`). */
	readonly redirectPath: string;
	/** Web app URL for the "returning to main website" footer link. */
	readonly webBaseUrl: string;
}

export function LoginView({ redirectPath, webBaseUrl }: LoginViewProps): React.JSX.Element {
	const { isInitializing } = useAuth();

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			{/* ── Left: Login Form ──────────────────────────────────────── */}
			<div className="flex flex-col p-8">
				{/* On SSR + the first client render, auth state isn't established
				    yet. Rendering the form during that window would flash it on every
				    reload (and for admins, the proxy is about to bounce them into the
				    panel). The static brand panel below still renders in the initial
				    HTML — only the form column waits for the mount tick. */}
				{isInitializing ? (
					<div className="flex flex-1 items-center justify-center">
						<div className="flex flex-col items-center gap-4">
							<svg className="size-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							<p className="text-sm text-muted-foreground">Loading…</p>
						</div>
					</div>
				) : (
					<LoginForm
						logo={
							<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
								/>
							</svg>
						}
						title="Admin Panel"
						heading="Admin Login"
						subtitle="Sign in with your administrator credentials"
						mode="admin"
						redirectPath={redirectPath}
						footer={
							<p className="text-center text-xs text-balance text-muted-foreground">
								Returning to{" "}
								<Link href={webBaseUrl} className="font-medium text-primary underline-offset-4 hover:underline">
									main website
								</Link>
							</p>
						}
					/>
				)}
			</div>

			{/* ── Right: Brand / Testimonial (static — SSR'd) ──────────── */}
			<div className="relative hidden flex-col items-center justify-center bg-linear-to-br from-muted to-muted/80 p-10 text-muted-foreground lg:flex">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,hsl(var(--primary)/0.06),transparent_60%)]" />
				<div className="relative z-10 flex max-w-md flex-col gap-6">
					<div className="flex items-center gap-3 rounded-lg border bg-background/50 px-4 py-2 text-xs font-medium text-foreground/80">
						<svg className="size-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
							/>
						</svg>
						Admin access is restricted to authorized personnel only.
					</div>

					<blockquote className="space-y-3">
						<p className="text-lg leading-relaxed text-foreground/90">
							&ldquo;The admin panel gives me complete visibility into our operations. I can manage users, monitor activity, and control permissions — all from one
							place.&rdquo;
						</p>
						<footer className="flex items-center gap-3">
							<div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">AM</div>
							<div>
								<p className="text-sm font-medium text-foreground">Alex Morgan</p>
								<p className="text-xs">Head of Operations, TechCorp</p>
							</div>
						</footer>
					</blockquote>

					<div className="flex items-center gap-1.5">
						{[0, 1, 2, 3].map((i) => (
							<svg key={`star-${String(i)}`} className="size-4 fill-primary/20 text-primary/20" viewBox="0 0 20 20">
								<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
							</svg>
						))}
					</div>

					<p className="text-xs text-muted-foreground">Enterprise-grade security. Used by leading companies worldwide.</p>
				</div>
			</div>
		</div>
	);
}
