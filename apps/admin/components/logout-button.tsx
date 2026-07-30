// ============================================
// components/logout-button.tsx - Admin Logout Button
// ============================================
"use client";

import { useState, type JSX } from "react";
import { Button } from "@workspace/ui/components/button";
import { useAuth } from "@workspace/ui/lib/auth";

export interface LogoutButtonProps {
	readonly variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	readonly className?: string;
	readonly children?: string;
}

export function LogoutButton({ variant = "outline", className, children = "Logout" }: LogoutButtonProps): JSX.Element {
	const [isLoading, setIsLoading] = useState(false);
	const { logout } = useAuth();

	async function handleLogout(): Promise<void> {
		setIsLoading(true);
		await logout();
	}

	return (
		<Button variant={variant} className={className} onClick={handleLogout} disabled={isLoading}>
			{isLoading ? (
				<span className="flex items-center gap-2">
					<svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
						<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					Logging out...
				</span>
			) : (
				children
			)}
		</Button>
	);
}
