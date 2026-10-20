"use client";

import type { EmailPreview } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/core/utils";
import { Mail, Monitor, RotateCw, Smartphone } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { z } from "zod";

/** The width the email is shown at — a desktop mail client, or a phone. */
export const EmailPreviewDeviceSchema = z.enum(["desktop", "mobile"]);
export type EmailPreviewDevice = z.output<typeof EmailPreviewDeviceSchema>;

/** Where the preview is: first render, re-rendering after an edit, current, or failed. */
export type EmailPreviewStatus = "loading" | "updating" | "live" | "error";

export interface EmailInboxPreviewProps {
	/** The last rendered email; kept on screen while the next one renders. */
	readonly preview: EmailPreview | undefined;
	/** Shown on the To line as typed — the rendered email never contains it, so it updates instantly. */
	readonly recipient: string;
	readonly status: EmailPreviewStatus;
	readonly device: EmailPreviewDevice;
	readonly onDeviceChange: (device: EmailPreviewDevice) => void;
	readonly onRetry: () => void;
	/** Link to the template browser — omitted when the viewer cannot open it (EMAIL READ). */
	readonly templatesHref?: string | undefined;
}

const STATUS_LABEL: Record<EmailPreviewStatus, string> = {
	loading: "Rendering preview…",
	updating: "Updating…",
	live: "Live preview",
	error: "Preview unavailable",
};

const STATUS_DOT: Record<EmailPreviewStatus, string> = {
	loading: "bg-muted-foreground motion-safe:animate-pulse",
	updating: "bg-warning motion-safe:animate-pulse",
	live: "bg-success",
	error: "bg-destructive",
};

/**
 * An inbox-style view of an email: the envelope (subject, recipient, preview text) over
 * the rendered message, at desktop or phone width. Dumb and controlled — the page owns
 * the data, the device and the retry.
 */
export function EmailInboxPreview({ preview, recipient, status, device, onDeviceChange, onRetry, templatesHref }: EmailInboxPreviewProps): React.JSX.Element {
	const handleDeviceChange = React.useCallback(
		(values: readonly string[]): void => {
			const parsed = EmailPreviewDeviceSchema.safeParse(values.find((value) => value !== device) ?? device);
			if (parsed.success) {
				onDeviceChange(parsed.data);
			}
		},
		[device, onDeviceChange],
	);

	return (
		<section aria-label="Email preview" className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
			<div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
				<p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
					<span className={cn("size-2 rounded-full", STATUS_DOT[status])} aria-hidden="true" />
					{STATUS_LABEL[status]}
				</p>
				<div className="ms-auto flex items-center gap-3">
					{templatesHref !== undefined ? (
						<Link href={templatesHref} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
							Open template
						</Link>
					) : null}
					<ToggleGroup multiple={false} value={[device]} onValueChange={handleDeviceChange} variant="outline" size="sm" spacing={0} aria-label="Preview width">
						<ToggleGroupItem value="desktop" aria-label="Desktop width">
							<Monitor className="size-4" aria-hidden="true" />
						</ToggleGroupItem>
						<ToggleGroupItem value="mobile" aria-label="Phone width">
							<Smartphone className="size-4" aria-hidden="true" />
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</div>

			<header className="space-y-3 border-b px-5 py-4">
				{preview === undefined ? <Skeleton className="h-6 w-3/4" /> : <h2 className="font-heading text-lg leading-snug font-semibold text-balance">{preview.subject}</h2>}
				<div className="flex items-start gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
						<Mail className="size-4" />
					</span>
					<div className="min-w-0 space-y-0.5 text-sm">
						<p className="truncate">
							<span className="text-muted-foreground">To </span>
							{recipient.length > 0 ? <span className="font-medium">{recipient}</span> : <span className="text-muted-foreground italic">the merchant&apos;s email</span>}
						</p>
						{preview === undefined ? <Skeleton className="h-4 w-56" /> : <p className="truncate text-muted-foreground">{preview.previewText}</p>}
					</div>
				</div>
			</header>

			<div className="flex min-h-0 flex-1 justify-center bg-muted/50 p-4 sm:p-6">
				{status === "error" && preview === undefined ? (
					<div className="flex max-w-sm flex-col items-center justify-center gap-3 py-24 text-center">
						<p className="text-sm text-muted-foreground">The preview could not be rendered. Your details are kept; try again.</p>
						<Button type="button" variant="outline" size="sm" onClick={onRetry}>
							<RotateCw className="size-4" aria-hidden="true" />
							Try again
						</Button>
					</div>
				) : preview === undefined ? (
					<Skeleton className={cn("h-[640px] w-full rounded-lg", device === "mobile" ? "max-w-[390px]" : "max-w-[720px]")} />
				) : (
					<div
						className={cn(
							"w-full overflow-hidden bg-background transition-[max-width] duration-300 ease-out motion-reduce:transition-none",
							device === "mobile" ? "max-w-[390px] rounded-[2rem] border-[6px] border-foreground/85 shadow-lg" : "max-w-[720px] rounded-lg border shadow-sm",
						)}>
						<iframe title={`${preview.label} preview`} srcDoc={preview.html} sandbox="" className="block h-[640px] w-full" />
					</div>
				)}
			</div>
		</section>
	);
}
