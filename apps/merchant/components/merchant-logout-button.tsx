"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { Button } from "@workspace/ui/components/form/button";
import { LogOut } from "lucide-react";
import * as React from "react";

export interface MerchantLogoutButtonProps {
	readonly className?: string;
}

export function MerchantLogoutButton({ className }: MerchantLogoutButtonProps): React.JSX.Element {
	const { logout } = useAuth();
	const [isLoading, setIsLoading] = React.useState<boolean>(false);

	const handleClick = React.useCallback((): void => {
		setIsLoading(true);
		void logout().finally((): void => {
			setIsLoading(false);
		});
	}, [logout]);

	return (
		<Button variant="outline" size="sm" className={className} disabled={isLoading} onClick={handleClick}>
			<LogOut className="size-4" aria-hidden="true" />
			{isLoading ? "Signing out…" : "Sign out"}
		</Button>
	);
}
