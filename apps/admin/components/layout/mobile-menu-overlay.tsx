"use client";

import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

import { BACKDROP_TRANSITION, DRAWER_TRANSITION } from "@/components/layout/layout-motion";

export interface MobileMenuOverlayProps {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly children: React.ReactNode;
}

/**
 * Mobile-only slide-in drawer (with backdrop) that hosts the sidebar on small
 * screens. Desktop layouts render the sidebar directly instead.
 *
 * Enter/exit via framer-motion `AnimatePresence`: the drawer slides in from
 * the left edge with the same buttery curve as the desktop sidebar while the
 * backdrop cross-fades — and on close BOTH animate back out instead of the
 * old instant snap. The second `Sidebar` instance only mounts while the
 * drawer is open. `MotionConfig reducedMotion="user"` (from `DashboardLayout`,
 * which renders this overlay) makes the whole thing an instant snap for
 * reduced-motion users.
 *
 * A11y (rule 19): the panel is a labelled `role="dialog"` with `aria-modal`;
 * focus moves into the drawer on open and returns to the opener (the topbar
 * hamburger) on close; Escape closes it (window listener, cleaned up while
 * closed — SSR-safe: effects never run on the server).
 *
 * SSR: `open` is always `false` on the server, so nothing renders — there is
 * no hydration concern, and the entrance animation plays on the user's first
 * tap of the mobile menu button.
 */
export function MobileMenuOverlay({ open, onClose, children }: MobileMenuOverlayProps): React.JSX.Element {
	const drawerRef = React.useRef<HTMLDivElement>(null);
	// The element that had focus before the drawer opened — restored on close.
	const openerRef = React.useRef<HTMLElement | null>(null);

	// Focus management: save the opener, move focus into the drawer on open;
	// return focus to the opener on close (once `open` flips, the drawer is
	// animating out but still mounted, so restoring here avoids a lost tab stop).
	React.useEffect(() => {
		if (open) {
			openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			drawerRef.current?.focus();
			return;
		}
		openerRef.current?.focus();
		openerRef.current = null;
	}, [open]);

	// Escape-to-close: a window listener that lives while the drawer is open.
	// Both the desktop sidebar and this drawer use Escape-free nav — the only
	// role here is closing, so no conflict with inner focusable elements.
	React.useEffect(() => {
		if (!open) return;

		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return (): void => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [open, onClose]);

	return (
		<AnimatePresence>
			{open ? (
				<motion.button
					key="mobile-menu-backdrop"
					type="button"
					aria-label="Close menu"
					tabIndex={-1}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={BACKDROP_TRANSITION}
					className="fixed inset-0 z-40 bg-black/50 lg:hidden"
					onClick={onClose}
				/>
			) : null}
			{open ? (
				<motion.div
					key="mobile-menu-drawer"
					ref={drawerRef}
					role="dialog"
					aria-modal="true"
					aria-label="Navigation menu"
					tabIndex={-1}
					initial={{ x: "-100%" }}
					animate={{ x: 0 }}
					exit={{ x: "-100%" }}
					transition={DRAWER_TRANSITION}
					className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground shadow-xl outline-none lg:hidden">
					{children}
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
