// ============================================
// components/layout/auth-layout.tsx
// Shared split-screen authentication layout.
// Pure presentational — branding copy and form flow in via props/children.
// ============================================
"use client";

import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "../form/button";

export interface AuthLayoutLabels {
	readonly mobileBack: string;
	readonly toggleThemeAria: string;
	readonly rightsReserved: string;
}

function AuthThemeToggle({ toggleThemeAria }: { readonly toggleThemeAria: string }): React.JSX.Element {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		const frame = window.requestAnimationFrame(() => {
			setMounted(true);
		});
		return (): void => {
			window.cancelAnimationFrame(frame);
		};
	}, []);

	const handleToggle = React.useCallback((): void => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	return (
		<Button variant="ghost" size="icon" onClick={handleToggle} aria-label={toggleThemeAria} className="rounded-full">
			{mounted ? resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" /> : <Sun className="size-5 opacity-0" aria-hidden="true" />}
		</Button>
	);
}

export interface AuthLayoutProps {
	readonly logo: React.ReactNode;
	readonly brandName: string;
	readonly tagline: string;
	readonly features: readonly string[];
	readonly title: string;
	readonly subtitle: string;
	readonly children: React.ReactNode;
	readonly labels: AuthLayoutLabels;
	readonly showBackButton?: boolean;
	readonly backHref?: string;
	readonly backLabel?: string;
	readonly onBack?: () => void;
	readonly copyright?: string;
}

export const AuthLayout = React.forwardRef<HTMLDivElement, AuthLayoutProps>(function AuthLayout(
	{ logo, brandName, tagline, features, title, subtitle, children, labels, showBackButton = false, backHref = "/auth/login", backLabel, onBack, copyright = brandName },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} className="flex min-h-svh bg-background">
			<div className="relative hidden flex-col items-center justify-center overflow-hidden bg-auth-panel md:flex md:w-1/2 dark:bg-auth-panel/90">
				<div className="absolute inset-0 bg-linear-to-br from-auth-panel-foreground/3 to-transparent" />

				<div className="absolute top-0 left-0 h-full w-full">
					<div className="absolute animate-pulse rounded-full bg-auth-panel-foreground/5 blur-3xl" style={{ top: "20%", left: "15%", width: "400px", height: "400px" }} />
					<div
						className="absolute animate-pulse rounded-full bg-auth-panel-foreground/5 blur-3xl"
						style={{ bottom: "15%", right: "10%", width: "500px", height: "500px", animationDelay: "0.5s" }}
					/>
					<div
						className="absolute animate-pulse rounded-full bg-auth-panel-foreground/3 blur-2xl"
						style={{ top: "50%", left: "30%", width: "300px", height: "300px", animationDelay: "1s" }}
					/>
				</div>

				<div className="absolute top-20 right-20 size-16 rotate-45 border border-auth-panel-foreground/5" />
				<div className="absolute bottom-32 left-16 size-12 rotate-12 border border-auth-panel-foreground/5" />

				<div className="relative z-10 flex flex-col items-center px-8 text-center">
					<div className="relative mb-8">
						<div className="flex size-20 items-center justify-center rounded-2xl bg-linear-to-br from-auth-brand-from to-auth-brand-to shadow-2xl">
							<span className="[&_svg]:size-10 [&_svg]:text-auth-panel-foreground">{logo}</span>
						</div>
						<div className="absolute -top-2 -right-2 size-6 animate-pulse rounded-full bg-success" />
					</div>
					<h1 className="mb-4 text-3xl font-bold text-auth-panel-foreground">{brandName}</h1>
					<p className="mb-8 max-w-md leading-relaxed text-auth-panel-muted">{tagline}</p>
					<div className="space-y-3">
						{features.map((feature) => (
							<div key={feature} className="flex items-center gap-3">
								<span className="inline-block size-2 rounded-full bg-success" />
								<span className="text-sm text-auth-panel-muted">{feature}</span>
							</div>
						))}
					</div>
				</div>

				<div className="absolute bottom-6 text-center text-sm text-auth-panel-muted/60">
					&copy; {new Date().getFullYear()} {copyright}. {labels.rightsReserved}
				</div>
			</div>

			<div className="relative flex w-full flex-col bg-background md:w-1/2">
				<div className="absolute top-0 right-0 size-64 rounded-full bg-linear-to-bl from-info/5 to-transparent blur-3xl dark:from-info/5" />
				<div className="absolute bottom-0 left-0 size-48 rounded-full bg-linear-to-tr from-success/5 to-transparent blur-3xl dark:from-success/5" />

				<div className="relative z-10 flex items-center justify-between p-6">
					<div className="flex items-center gap-3 md:hidden">
						<div className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-auth-brand-from to-auth-brand-to">
							<span className="[&_svg]:size-4 [&_svg]:text-auth-panel-foreground">{logo}</span>
						</div>
						<span className="text-lg font-semibold text-foreground">{brandName}</span>
					</div>

					{showBackButton ? (
						<div className="md:hidden">
							{onBack ? (
								<Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={onBack}>
									<ArrowLeft className="size-4" />
									{labels.mobileBack}
								</Button>
							) : (
								<Button variant="ghost" size="sm" className="flex items-center gap-2" render={<a href={backHref} />}>
									<ArrowLeft className="size-4" />
									{labels.mobileBack}
								</Button>
							)}
						</div>
					) : null}

					<div className="ml-auto">
						<AuthThemeToggle toggleThemeAria={labels.toggleThemeAria} />
					</div>
				</div>

				<div className="relative z-10 flex flex-1 items-center justify-center p-6">
					<div className="w-full max-w-md">
						{showBackButton && backLabel ? (
							<div className="mb-6 hidden md:block">
								{onBack ? (
									<Button variant="ghost" size="sm" className="-ml-2 flex items-center gap-2" onClick={onBack}>
										<ArrowLeft className="size-4" />
										{backLabel}
									</Button>
								) : (
									<Button variant="ghost" size="sm" className="-ml-2 flex items-center gap-2" render={<a href={backHref} />}>
										<ArrowLeft className="size-4" />
										{backLabel}
									</Button>
								)}
							</div>
						) : null}

						<div className="mb-8 text-center">
							<h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
							<p className="text-muted-foreground">{subtitle}</p>
						</div>

						{children}
					</div>
				</div>

				<div className="relative z-10 px-6 py-4 text-center text-sm text-muted-foreground/60 md:hidden">
					&copy; {new Date().getFullYear()} {copyright}. {labels.rightsReserved}
				</div>
			</div>
		</div>
	);
});
