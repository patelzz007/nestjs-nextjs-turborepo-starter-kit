// ============================================
// components/form-shell.tsx
// Low-level form shell — no business logic.
// Handles error banner display, form wrapper, and loading submit button.
// ============================================
"use client";

import type { JSX, ReactNode } from "react";

import { Button } from "./button";

export interface FormShellProps {
	/** Error message to display (null = hidden) */
	readonly error: string | null;
	/** Whether the form is currently submitting */
	readonly isLoading: boolean;
	/** Label for the submit button (default: "Submit") */
	readonly submitLabel?: string;
	/** Label shown while loading (default: "Submitting...") */
	readonly loadingLabel?: string;
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
export function FormShell({ error, isLoading, submitLabel = "Submit", loadingLabel = "Submitting...", onSubmit, children }: FormShellProps): JSX.Element {
	return (
		<>
			{/* Error banner */}
			{error ? (
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
					<div className="flex items-start gap-3">
						<svg className="mt-0.5 size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
						<span>{error}</span>
					</div>
				</div>
			) : null}

			{/* Form */}
			<form onSubmit={onSubmit} className="space-y-4">
				{children}

				<Button type="submit" className="w-full" disabled={isLoading}>
					{isLoading ? (
						<span className="flex items-center gap-2">
							<svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							{loadingLabel}
						</span>
					) : (
						submitLabel
					)}
				</Button>
			</form>
		</>
	);
}
