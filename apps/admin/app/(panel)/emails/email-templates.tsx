"use client";

import { useAuth } from "@workspace/client/lib/auth";

import type { EmailPreview, EmailTemplateMeta } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Check, Copy, FileCode2, Loader2, Mail, Send } from "lucide-react";
import * as React from "react";

/** Active preview mode — HTML iframe or raw source. */
type PreviewMode = "preview" | "html" | "text";

const MODE_TABS: readonly { readonly key: PreviewMode; readonly label: string }[] = [
	{ key: "preview", label: "Preview" },
	{ key: "html", label: "HTML" },
	{ key: "text", label: "Text" },
];

/** One template row in the index — dumb component, fully controlled via props. */
function TemplateIndexRow({
	template,
	active,
	onSelect,
}: {
	readonly template: EmailTemplateMeta;
	readonly active: boolean;
	readonly onSelect: (key: string) => void;
}): React.JSX.Element {
	const handleSelect = React.useCallback((): void => {
		onSelect(template.key);
	}, [template.key, onSelect]);

	return (
		<button
			type="button"
			onClick={handleSelect}
			className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
				active ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground"
			}`}>
			<p className={`text-sm font-medium ${active ? "text-primary-foreground" : "text-foreground"}`}>{template.label}</p>
			<p className={`mt-0.5 line-clamp-2 text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{template.description}</p>
		</button>
	);
}

/** One mode tab — dumb component with a memoized handler. */
function ModeTabButton({
	tab,
	active,
	onSelect,
}: {
	readonly tab: (typeof MODE_TABS)[number];
	readonly active: boolean;
	readonly onSelect: (mode: PreviewMode) => void;
}): React.JSX.Element {
	const handleSelect = React.useCallback((): void => {
		onSelect(tab.key);
	}, [tab.key, onSelect]);

	return (
		<button
			type="button"
			onClick={handleSelect}
			className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
			{tab.label}
		</button>
	);
}

/**
 * Email template preview — the smart component (rules 9–10).
 *
 * The page fetches the template list + the selected template's rendered
 * preview from the API (sample props only), then hands the raw HTML/text to
 * dumb presentational pieces. A "Send test email" button fires the selected
 * template's sample props through the real sender — in dev it lands in
 * `EMAIL_TEST_TO` (so it never spams the sample recipient).
 */
export default function EmailPreviewPage(): React.JSX.Element {
	const { api } = useAuth();

	const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
	const [mode, setMode] = React.useState<PreviewMode>("preview");
	const [copied, setCopied] = React.useState(false);

	const listQuery = api.email.previewList.useQuery(undefined);

	// `templates` is memoized on the query result so its identity is stable
	// between renders (rule 16: avoid unnecessary re-renders).
	const templates = React.useMemo(() => listQuery.data?.data.templates ?? [], [listQuery.data]);

	// Effective key: an explicit selection wins; otherwise fall back to the
	// first template. Deriving (instead of an effect that calls setState)
	// keeps the render pure and satisfies the React Compiler's rules.
	const effectiveKey: string = selectedKey ?? templates[0]?.key ?? "";

	const detailQuery = api.email.previewDetail.useQuery(
		{ key: effectiveKey },
		{
			enabled: effectiveKey.length > 0,
		},
	);

	// Send-test mutation — fires the selected template's sample props through
	// the real sender. In dev `EMAIL_TEST_TO` redirects it to the developer.
	const sendMutation = api.email.previewSend.useMutation();

	const preview: EmailPreview | undefined = detailQuery.data?.data;

	const handleSelectTemplate = React.useCallback((key: string): void => {
		setSelectedKey(key);
		setMode("preview");
	}, []);

	const handleSelectMode = React.useCallback((nextMode: PreviewMode): void => {
		setMode(nextMode);
	}, []);

	const handleCopy = React.useCallback((): void => {
		if (preview === undefined) {
			return;
		}
		const content: string = mode === "text" ? preview.text : preview.html;
		void navigator.clipboard.writeText(content).then((): void => {
			setCopied(true);
			toastMessage.success({ title: "Copied to clipboard" });
			setTimeout((): void => {
				setCopied(false);
			}, 1600);
		});
	}, [preview, mode]);

	const handleSendTest = React.useCallback((): void => {
		if (effectiveKey.length === 0) {
			return;
		}
		sendMutation
			.mutateAsync({ key: effectiveKey })
			.then((data): void => {
				const result = data.data;
				if (result.ok) {
					toastMessage.success({ title: result.mode === "send" ? `Sent! Resend id ${result.id}` : `Queued (${result.mode}) — id ${result.id}` });
				} else {
					toastMessage.error({ title: `Send failed: ${result.reason}${result.detail !== undefined ? ` — ${result.detail}` : ""}` });
				}
			})
			.catch((): void => {
				toastMessage.error({ title: "Send request failed — check that the API is running." });
			});
	}, [effectiveKey, sendMutation]);

	if (listQuery.isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading email templates…</p>
				</div>
			</div>
		);
	}

	if (listQuery.error) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
				Failed to load email templates — check that the API is running and you&apos;re signed in.
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Email Templates</h1>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Every transactional email rendered with sample props — preview the exact HTML / plain-text output, or hit{" "}
						<span className="font-medium text-foreground">Send test email</span> to fire the sample data through the real pipeline (dev: redirected to{" "}
						<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">EMAIL_TEST_TO</code>).
					</p>
				</div>
				<Badge variant="secondary" className="gap-1.5">
					<Mail className="size-3" />
					{String(templates.length)} templates
				</Badge>
			</header>

			<div className="grid gap-6 lg:grid-cols-[280px_1fr]">
				{/* ── Template index ─────────────────────────────────────── */}
				<Card className="h-fit">
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Templates</CardTitle>
						<CardDescription>Pick one to inspect</CardDescription>
					</CardHeader>
					<CardContent className="space-y-1 p-2">
						{templates.map((template) => (
							<TemplateIndexRow key={template.key} template={template} active={template.key === effectiveKey} onSelect={handleSelectTemplate} />
						))}
					</CardContent>
				</Card>

				{/* ── Preview pane ──────────────────────────────────────── */}
				<div className="space-y-4">
					{preview === undefined ? (
						<div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
							{detailQuery.isLoading ? <Loader2 className="size-5 animate-spin" /> : "Select a template to preview."}
						</div>
					) : (
						<Card>
							<CardHeader className="flex flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
								<div>
									<div className="flex items-center gap-2">
										<CardTitle className="text-lg">{preview.label}</CardTitle>
										<Badge variant="outline" className="font-mono text-[10px]">
											{preview.key}
										</Badge>
									</div>
									<CardDescription className="mt-1">
										To: {preview.to} · Subject: {preview.subject}
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									<div className="flex items-center gap-0.5 rounded-md border p-0.5">
										{MODE_TABS.map((tab) => (
											<ModeTabButton key={tab.key} tab={tab} active={mode === tab.key} onSelect={handleSelectMode} />
										))}
									</div>
									<Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
										{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
										{copied ? "Copied" : "Copy"}
									</Button>
									<Button variant="default" size="sm" onClick={handleSendTest} disabled={sendMutation.isPending} className="gap-1.5">
										{sendMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
										{sendMutation.isPending ? "Sending…" : "Send test email"}
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								{mode === "preview" ? (
									<iframe title={`${preview.label} preview`} srcDoc={preview.html} sandbox="" className="h-180 w-full rounded-lg border bg-background" />
								) : mode === "html" ? (
									<div className="flex items-center gap-2 border-b pb-2 text-xs text-muted-foreground">
										<FileCode2 className="size-3.5" />
										Rendered HTML document — open in your mail client or copy to test.
									</div>
								) : null}
								{mode === "html" || mode === "text" ? (
									<pre className="max-h-180 overflow-auto rounded-lg bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
										{mode === "text" ? preview.text : preview.html}
									</pre>
								) : null}
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
