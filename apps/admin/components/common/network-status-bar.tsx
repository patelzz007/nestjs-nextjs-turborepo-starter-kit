"use client";

import { Wifi, WifiOff } from "lucide-react";
import * as React from "react";

/**
 * Small online/offline indicator. Subscribes to the browser's `online` /
 * `offline` events; the initial value is read lazily so no effect-time
 * setState is needed.
 */
export function NetworkStatusIndicator(): React.JSX.Element {
	// Initial state is `true` on BOTH server and first client render (reading
	// `navigator.onLine` in `useState` would return different values and cause a
	// React hydration mismatch now that the shell is server-rendered). The real
	// status resolves in the effect right after hydration.
	const [isOnline, setIsOnline] = React.useState<boolean>(true);

	React.useEffect(() => {
		const updateOnline = (): void => {
			setIsOnline(navigator.onLine);
		};
		const handleOnline = (): void => {
			setIsOnline(true);
		};
		const handleOffline = (): void => {
			setIsOnline(false);
		};

		updateOnline();
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return (): void => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return (
		<div
			className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
				isOnline ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive"
			}`}
			title={isOnline ? "Online" : "Offline"}
			aria-label={isOnline ? "Online" : "Offline"}>
			{isOnline ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
			<span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
		</div>
	);
}
