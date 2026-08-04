"use client";

import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

export interface MobileMenuOverlayProps {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly children: React.ReactNode;
}

/**
 * Mobile-only slide-in drawer (with backdrop) that hosts the sidebar on
 * small screens. Desktop layouts render the sidebar directly instead.
 */
export function MobileMenuOverlay({ open, onClose, children }: MobileMenuOverlayProps): React.JSX.Element {
	return (
		<AnimatePresence>
			{open ? (
				<motion.button
					key="sidebar-backdrop"
					type="button"
					aria-label="Close menu"
					className="fixed inset-0 z-40 bg-black/50 lg:hidden"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
				/>
			) : null}
			{open ? (
				<motion.div
					key="sidebar-drawer"
					className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground shadow-xl lg:hidden"
					initial={{ x: "-100%" }}
					animate={{ x: 0 }}
					exit={{ x: "-100%" }}
					transition={{ type: "tween", duration: 0.25, ease: "easeInOut" }}>
					{children}
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
