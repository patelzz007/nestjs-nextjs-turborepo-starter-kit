"use client";

import { ChevronUp } from "lucide-react";
import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

export interface ScrollToTopProps {
	/** Scroll threshold in pixels before the button appears (default: 300). */
	readonly threshold?: number;
	/** Smooth scroll behavior (default: "smooth"). */
	readonly behavior?: ScrollBehavior;
}

export function ScrollToTop({ threshold = 300, behavior = "smooth" }: ScrollToTopProps): React.JSX.Element {
	const [visible, setVisible] = React.useState<boolean>(() => typeof window !== "undefined" && window.scrollY > threshold);

	React.useEffect(() => {
		const handleScroll = (): void => {
			setVisible(window.scrollY > threshold);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return (): void => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, [threshold]);

	const handleClick = React.useCallback((): void => {
		window.scrollTo({ top: 0, behavior });
	}, [behavior]);

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-label="Scroll to top"
			className={cn(
				"fixed right-6 bottom-6 z-50 flex h-10 w-10 items-center justify-center rounded-full shadow-lg",
				"bg-foreground text-background hover:opacity-90 active:scale-95",
				"transition-all duration-300 ease-out",
				"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
				visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
			)}>
			<ChevronUp className="h-5 w-5" />
		</button>
	);
}
