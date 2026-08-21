"use client";

import { useAuth } from "@workspace/client/lib/auth";

import { Button, buttonVariants } from "@workspace/ui/components/form/button";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/navigation/collapsible";
import { cn } from "@workspace/ui/lib/utils";
import {
	ArrowUpRight,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock,
	Copy,
	ExternalLink,
	Fingerprint,
	Globe,
	Monitor,
	Server,
	ShieldAlert,
	Star,
	TerminalSquare,
	TriangleAlert,
	UserRound,
	X,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import * as React from "react";

import type { RequestLogEntry, TelescopeJsonValue, TelescopeRequestDetailResponse } from "@workspace/shared";

import { Timeline } from "@/components/telescope/timeline";
import { fetchSnippetAccessToken } from "@/lib/telescope-snippet-auth";
import { buildRequestSnippet, durationLabel, durationTone, formatTime, statusTone, timeAgo } from "@/lib/telescope";
import { API_BASE_URL } from "@workspace/client/lib/api/config";

export interface RequestDetailSlideOverProps {
	readonly requestId: string;
	readonly onClose: () => void;
	readonly onFilterUser: (userId: string | null) => void;
	readonly onNavigateRequest?: (id: string) => void;
}

interface StatCardProps {
	readonly icon: React.ReactNode;
	readonly label: string;
	readonly value: string;
	readonly valueClassName?: string;
}

function StatCard({ icon, label, value, valueClassName }: StatCardProps): React.JSX.Element {
	return (
		<div className="rounded-lg border bg-card/60 p-3 shadow-xs">
			<div className="mb-1.5 flex items-center gap-1.5 text-[length:var(--text-sidebar-caption)] font-medium tracking-wide text-muted-foreground uppercase">
				{icon}
				<span>{label}</span>
			</div>
			<p className={cn("truncate font-medium text-foreground tabular-nums", valueClassName)}>{value}</p>
		</div>
	);
}

interface DetailSectionProps {
	readonly title: string;
	readonly count?: number;
	readonly defaultOpen?: boolean;
	readonly children: React.ReactNode;
}

function DetailSection({ title, count, defaultOpen = false, children }: DetailSectionProps): React.JSX.Element {
	return (
		<Collapsible defaultOpen={defaultOpen} className="overflow-hidden rounded-lg border bg-card/40">
			<CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted/40">
				<span className="flex items-center gap-2">
					{title}
					{count !== undefined && count > 0 ? (
						<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">{String(count)}</span>
					) : null}
				</span>
				<ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-open:rotate-180" />
			</CollapsibleTrigger>
			<CollapsibleContent className="border-t px-3 py-3">{children}</CollapsibleContent>
		</Collapsible>
	);
}

interface MetaRowProps {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
}

function MetaRow({ label, value, mono = false }: MetaRowProps): React.JSX.Element {
	return (
		<div className="flex items-start justify-between gap-3 py-1.5 text-xs">
			<span className="shrink-0 text-muted-foreground">{label}</span>
			<span className={cn("min-w-0 text-right break-all text-foreground", mono ? "font-mono" : "font-medium")}>{value}</span>
		</div>
	);
}

function formatJsonBody(value: TelescopeJsonValue | null): string | null {
	if (value === null) {
		return null;
	}
	return JSON.stringify(value, null, 2);
}

function headerEntries(request: RequestLogEntry): readonly { readonly key: string; readonly value: string }[] {
	if (request.requestHeaders === null) {
		return [];
	}
	return Object.entries(request.requestHeaders).map(([key, value]) => ({ key, value }));
}

function RequestDetailSkeleton(): React.JSX.Element {
	return (
		<div className="space-y-4 p-4">
			<div className="flex gap-2">
				<Skeleton className="h-6 w-14 rounded-md" />
				<Skeleton className="h-6 w-20 rounded-full" />
			</div>
			<Skeleton className="h-5 w-full" />
			<div className="grid grid-cols-2 gap-2">
				<Skeleton className="h-16 rounded-lg" />
				<Skeleton className="h-16 rounded-lg" />
				<Skeleton className="h-16 rounded-lg" />
				<Skeleton className="h-16 rounded-lg" />
			</div>
			<Skeleton className="h-28 w-full rounded-lg" />
			<Skeleton className="h-24 w-full rounded-lg" />
		</div>
	);
}

function RequestDetailContent({
	detail,
	onClose,
	onFilterUser,
	onNavigateRequest,
}: {
	readonly detail: TelescopeRequestDetailResponse;
	readonly onClose: () => void;
	readonly onFilterUser: (userId: string | null) => void;
	readonly onNavigateRequest?: (id: string) => void;
}): React.JSX.Element {
	const { request, annotation, adjacent } = detail;
	const tone = statusTone(request.statusCode);
	const dur = durationTone(request.durationMs);
	const headers = headerEntries(request);
	const requestBody = formatJsonBody(request.requestBody);
	const responseBody = formatJsonBody(request.responseBody);
	const visibleSpans = request.spans.filter((span) => span.durationMs >= 1);
	const starred = annotation?.starred === true || request.starred;

	const handleFilterAndClose = React.useCallback((): void => {
		if (request.userId !== null) {
			onFilterUser(request.userId);
			onClose();
		}
	}, [onClose, onFilterUser, request.userId]);

	const handleCopyPath = React.useCallback((): void => {
		const url = request.queryString !== null ? `${request.path}?${request.queryString}` : request.path;
		void navigator.clipboard.writeText(url).then((): void => {
			toastMessage.success({ title: "Path copied." });
		});
	}, [request.path, request.queryString]);

	const handleCopyCorrelation = React.useCallback((): void => {
		void navigator.clipboard.writeText(request.correlationId).then((): void => {
			toastMessage.success({ title: "Correlation ID copied." });
		});
	}, [request.correlationId]);

	const handleCopyCurl = React.useCallback((): void => {
		void (async (): Promise<void> => {
			const accessToken = await fetchSnippetAccessToken();
			const curl = buildRequestSnippet(request, "curl", { apiBaseUrl: API_BASE_URL, accessToken });
			await navigator.clipboard.writeText(curl);
			toastMessage.success({ title: accessToken !== null ? "cURL command copied." : "cURL copied (sign in to include your access token)." });
		})();
	}, [request]);

	const handlePrev = React.useCallback((): void => {
		if (adjacent.prevId !== null && onNavigateRequest !== undefined) {
			onNavigateRequest(adjacent.prevId);
		}
	}, [adjacent.prevId, onNavigateRequest]);

	const handleNext = React.useCallback((): void => {
		if (adjacent.nextId !== null && onNavigateRequest !== undefined) {
			onNavigateRequest(adjacent.nextId);
		}
	}, [adjacent.nextId, onNavigateRequest]);

	return (
		<>
			<div className="border-b bg-linear-to-b from-muted/50 to-background px-4 py-4">
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<span className="rounded-md bg-background px-2 py-0.5 font-mono text-xs font-bold text-foreground shadow-xs ring-1 ring-border/60">{request.method}</span>
					<span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums", tone.pillClass)}>
						<span className={cn("size-1.5 rounded-full", tone.dotClass)} />
						{tone.label}
					</span>
					<span className={cn("font-mono text-xs font-semibold tabular-nums", dur.textClass)}>{durationLabel(request.durationMs)}</span>
					{starred ? (
						<span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
							<Star className="size-3 fill-current" />
							Starred
						</span>
					) : null}
					{request.n1WarningCount > 0 ? (
						<span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
							<TriangleAlert className="size-3" />
							{String(request.n1WarningCount)} N+1
						</span>
					) : null}
				</div>

				<div className="flex items-start gap-2">
					<code className="min-w-0 flex-1 font-mono text-sm leading-snug break-all text-foreground">{request.path}</code>
					<Button variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={handleCopyPath} title="Copy path">
						<Copy className="size-3.5" />
					</Button>
				</div>

				{request.queryString !== null && request.queryString.length > 0 ? (
					<p className="mt-1.5 font-mono text-[11px] break-all text-muted-foreground">?{request.queryString}</p>
				) : null}

				<p className="mt-2 text-xs text-muted-foreground">
					{formatTime(request.createdAt)}
					<span className="mx-1.5 text-muted-foreground/40">·</span>
					{timeAgo(request.createdAt)}
				</p>
			</div>

			<div className="flex-1 space-y-4 overflow-y-auto p-4">
				<div className="grid grid-cols-2 gap-2">
					<StatCard icon={<Clock className="size-3" />} label="Duration" value={durationLabel(request.durationMs)} valueClassName={dur.textClass} />
					<StatCard icon={<Server className="size-3" />} label="Status" value={tone.label} valueClassName="font-mono" />
					<StatCard icon={<UserRound className="size-3" />} label="User" value={request.userEmail ?? request.userId ?? "Anonymous"} />
					<StatCard icon={<Globe className="size-3" />} label="IP" value={request.ip ?? "—"} valueClassName="font-mono text-xs" />
				</div>

				<div className="rounded-lg border bg-card/40 px-3 py-1">
					<MetaRow label="Request ID" value={request.id} mono />
					<MetaRow label="Correlation" value={request.correlationId} mono />
					{request.environment !== null ? <MetaRow label="Environment" value={`${request.environment.nodeEnv} @ ${request.environment.host}`} /> : null}
					{request.userAgent !== null ? <MetaRow label="User agent" value={request.userAgent} /> : null}
					{request.handlerParams !== null && Object.keys(request.handlerParams).length > 0 ? (
						<MetaRow label="Route params" value={JSON.stringify(request.handlerParams)} mono />
					) : null}
				</div>

				{request.piiFlags.length > 0 ? (
					<div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
						<ShieldAlert className="mt-0.5 size-4 shrink-0" />
						<div>
							<p className="font-semibold">PII detected & redacted</p>
							<p className="mt-0.5 text-amber-700/80 dark:text-amber-400/80">{request.piiFlags.map((flag) => `${flag.category} (${String(flag.count)})`).join(", ")}</p>
						</div>
					</div>
				) : null}

				{annotation !== null && annotation.comment.length > 0 ? (
					<div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
						<p className="mb-1 font-semibold text-foreground">Team note</p>
						<p className="text-muted-foreground">{annotation.comment}</p>
					</div>
				) : null}

				<DetailSection title="Timeline" count={visibleSpans.length} defaultOpen>
					{visibleSpans.length > 0 ? (
						<Timeline spans={visibleSpans} totalMs={request.durationMs} />
					) : (
						<p className="text-center text-xs text-muted-foreground">No spans recorded.</p>
					)}
				</DetailSection>

				{headers.length > 0 ? (
					<DetailSection title="Request headers" count={headers.length}>
						<div className="overflow-hidden rounded-md border">
							{headers.map((entry) => (
								<div key={entry.key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2 border-b px-2.5 py-1.5 text-[11px] last:border-b-0">
									<span className="truncate font-mono font-medium text-muted-foreground">{entry.key}</span>
									<span className="font-mono break-all text-foreground">{entry.value}</span>
								</div>
							))}
						</div>
					</DetailSection>
				) : null}

				{requestBody !== null ? (
					<DetailSection title="Request body">
						<pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2.5 font-mono text-[11px] leading-relaxed text-foreground">{requestBody}</pre>
					</DetailSection>
				) : null}

				{responseBody !== null ? (
					<DetailSection title="Response body">
						<pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2.5 font-mono text-[11px] leading-relaxed text-foreground">{responseBody}</pre>
					</DetailSection>
				) : null}

				{request.logs.length > 0 ? (
					<DetailSection title="Console output" count={request.logs.length}>
						<div className="space-y-1">
							{request.logs.slice(0, 8).map((log, index) => (
								<div key={`${String(log.timestamp)}-${String(index)}`} className="rounded-md bg-muted/50 px-2 py-1 font-mono text-[11px]">
									<span className="mr-2 text-muted-foreground">{log.level}</span>
									<span className="text-foreground">{log.message}</span>
								</div>
							))}
							{request.logs.length > 8 ? <p className="pt-1 text-center text-[10px] text-muted-foreground">+{String(request.logs.length - 8)} more in full detail</p> : null}
						</div>
					</DetailSection>
				) : null}

				{request.cacheOps.length > 0 ? (
					<DetailSection title="Cache operations" count={request.cacheOps.length}>
						<div className="space-y-1.5">
							{request.cacheOps.map((op, index) => (
								<div key={`${op.key}-${String(index)}`} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px]">
									<span className="rounded bg-muted px-1.5 py-0.5 font-mono font-medium uppercase">{op.operation}</span>
									<span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{op.key}</span>
									<span className="font-mono text-foreground tabular-nums">{durationLabel(op.durationMs)}</span>
									{op.hit !== null ? (
										<span
											className={cn(
												"rounded-full px-1.5 py-0.5 text-[10px] font-medium",
												op.hit ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
											)}>
											{op.hit ? "hit" : "miss"}
										</span>
									) : null}
								</div>
							))}
						</div>
					</DetailSection>
				) : null}
			</div>

			<div className="border-t bg-background/95 p-4 backdrop-blur-sm">
				<div className="mb-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2"
							disabled={adjacent.prevId === null || onNavigateRequest === undefined}
							onClick={handlePrev}
							title="Previous request">
							<ChevronLeft className="size-3.5" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2"
							disabled={adjacent.nextId === null || onNavigateRequest === undefined}
							onClick={handleNext}
							title="Next request">
							<ChevronRight className="size-3.5" />
						</Button>
					</div>
					<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopyCorrelation}>
						<Fingerprint className="size-3" />
						Copy trace
					</Button>
				</div>

				<div className="flex flex-wrap gap-2">
					<Link href={`/telescope/requests/${request.id}`} className={buttonVariants({ variant: "default", size: "sm", className: "h-8 flex-1 gap-1.5 text-xs" })}>
						<ExternalLink className="size-3.5" />
						Full detail
					</Link>
					<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCopyCurl}>
						<TerminalSquare className="size-3.5" />
						cURL
					</Button>
					{request.userId !== null ? (
						<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleFilterAndClose}>
							<ArrowUpRight className="size-3.5" />
							Filter user
						</Button>
					) : null}
				</div>
			</div>
		</>
	);
}

export function RequestDetailSlideOver({ requestId, onClose, onFilterUser, onNavigateRequest }: RequestDetailSlideOverProps): React.JSX.Element {
	const { api } = useAuth();
	const detailQuery = api.telescope.requestDetail.useQuery({ id: requestId });
	const detail = detailQuery.data?.data;

	return (
		<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-50 flex justify-end">
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
				onClick={onClose}
			/>
			<motion.aside
				initial={{ x: "100%" }}
				animate={{ x: 0 }}
				exit={{ x: "100%" }}
				transition={{ type: "spring", damping: 32, stiffness: 340 }}
				className="relative z-10 ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l bg-background shadow-2xl">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<div className="flex items-center gap-2">
						<Monitor className="size-4 text-muted-foreground" />
						<h2 className="text-sm font-semibold text-foreground">Request detail</h2>
					</div>
					<Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close panel">
						<X className="size-4" />
					</Button>
				</div>

				{detailQuery.isLoading ? (
					<RequestDetailSkeleton />
				) : detail === undefined ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
						<p className="text-sm font-medium text-foreground">Request not found</p>
						<p className="text-xs text-muted-foreground">It may have been evicted from the in-memory buffer.</p>
					</div>
				) : (
					<RequestDetailContent detail={detail} onClose={onClose} onFilterUser={onFilterUser} onNavigateRequest={onNavigateRequest} />
				)}
			</motion.aside>
		</motion.div>
	);
}
