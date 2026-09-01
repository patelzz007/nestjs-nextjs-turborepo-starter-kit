// ============================================
// components/form-shell.tsx
// Low-level form shell — no business logic.
// Handles error banner display, form wrapper, and loading submit button.
// ============================================
"use client";

import { forwardRef, type JSX, type ReactNode } from "react";

import { cn } from "@workspace/ui/lib/utils";

import { Button } from "./button";

export interface FormShellProps {
	/** Error message to display (null = hidden) */
	readonly error: string | null;
	/** Whether the form is currently submitting */
	readonly isLoading: boolean;
	/** Label for the submit button */
	readonly submitLabel: string;
	/** Label shown while loading */
	readonly loadingLabel: string;
	/** Extra classes for the submit button (e.g. `h-11` for auth forms). */
	readonly submitClassName?: string;
	/** Form submit handler */
	readonly onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
	/** Form fields rendered inside the shell */
	readonly children: ReactNode;
}

/**
 * Low-level form shell that provides:
 * - Error banner with warning icon
 * - `<form>` wrapper with `onSubmit`
 * - Submit button with loading spinner
 *
 * Intended for use by app-level login/signup/reset-password forms.
 * Contains no authentication or business logic.
 */
export const FormShell = forwardRef<HTMLFormElement, FormShellProps>(function FormShell(
	{ error, isLoading, submitLabel, loadingLabel, submitClassName, onSubmit, children },
	ref,
): JSX.Element {
	return (
		<>
			{error ? (
				<div role="alert" aria-live="polite" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
					<div className="flex items-start gap-3">
						<svg className="mt-0.5 size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
						<span>{error}</span>
					</div>
				</div>
			) : null}

			<form ref={ref} onSubmit={onSubmit} className="space-y-4">
				{children}

				<Button type="submit" className={cn("w-full", submitClassName)} loading={isLoading} disabled={isLoading}>
					{isLoading ? loadingLabel : submitLabel}
				</Button>
			</form>
		</>
	);
});
