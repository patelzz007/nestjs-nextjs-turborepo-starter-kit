"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/display/avatar";
import { Button } from "@workspace/ui/components/form/button";
import * as React from "react";

export interface ProfileAvatarFieldProps {
	/** Public URL of the live avatar, or `null` when there is none. */
	readonly avatarUrl: string | null;
	/** Shown when there is no avatar image. */
	readonly initials: string;
	/** The `accept` attribute — from the shared avatar policy, never hand-written. */
	readonly accept: string;
	/** Human-readable limits shown under the controls. */
	readonly hint: string;
	readonly isBusy: boolean;
	readonly isReadOnly: boolean;
	readonly onPick: (file: File) => void;
	readonly onRemove: () => void;
}

/**
 * Avatar preview + upload/replace/remove controls. Data-agnostic and
 * controlled: the caller owns the upload, the delete and the refreshed URL.
 */
export function ProfileAvatarField({ avatarUrl, initials, accept, hint, isBusy, isReadOnly, onPick, onRemove }: ProfileAvatarFieldProps): React.JSX.Element {
	const inputId = React.useId();
	const hintId = React.useId();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const isDisabled = isBusy || isReadOnly;

	const handleChoose = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const file: File | undefined = event.target.files?.[0];
			// Reset so picking the same file again still fires a change.
			event.target.value = "";
			if (file !== undefined) {
				onPick(file);
			}
		},
		[onPick],
	);

	return (
		<div className="flex items-center gap-4">
			<Avatar className="size-16">
				{avatarUrl === null ? null : <AvatarImage src={avatarUrl} alt="Your avatar" />}
				<AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
			</Avatar>
			<div className="space-y-2">
				<label htmlFor={inputId} className="sr-only">
					Avatar image
				</label>
				<input ref={inputRef} id={inputId} type="file" accept={accept} className="sr-only" aria-describedby={hintId} disabled={isDisabled} onChange={handleChange} />
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" disabled={isDisabled} onClick={handleChoose}>
						{isBusy ? "Working…" : avatarUrl === null ? "Upload avatar" : "Replace avatar"}
					</Button>
					{avatarUrl === null ? null : (
						<Button type="button" variant="ghost" size="sm" disabled={isDisabled} onClick={onRemove}>
							Remove
						</Button>
					)}
				</div>
				<p id={hintId} className="text-xs text-muted-foreground">
					{hint}
				</p>
			</div>
		</div>
	);
}
