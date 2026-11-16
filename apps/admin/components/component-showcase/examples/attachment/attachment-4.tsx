import * as React from "react";
import { CodeIcon, FileJsonIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { Attachment, AttachmentContent, AttachmentDescription, AttachmentGroup, AttachmentMedia, AttachmentTitle } from "@workspace/ui/components/attachment";

const ICON_REPORT = <FileTextIcon aria-hidden="true" />;

const ICON_SHEET = <FileSpreadsheetIcon aria-hidden="true" />;

const ICON_JSON = <FileJsonIcon aria-hidden="true" />;

const ICON_CODE = <CodeIcon aria-hidden="true" />;

export function Attachment4Example(): React.JSX.Element {
	// Size is hierarchy here, not decoration: default is the one thing the
	// reader is meant to open, sm is the working set behind it, and xs is the
	// evidence the answer cites. Three rungs, three jobs, no controls.
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-4">
			<div className="flex flex-col gap-2">
				{/*
				 * Each band still says in text what its size is already saying. Size
				 * alone is a weak signal on screen and no signal at all in a reader.
				 */}
				<p className="text-xs font-medium text-muted-foreground">Deliverable</p>
				<Attachment className="w-full">
					<AttachmentMedia>{ICON_REPORT}</AttachmentMedia>
					<AttachmentContent>
						<AttachmentTitle>billing-incident-report.pdf</AttachmentTitle>
						<AttachmentDescription>
							PDF
							<span aria-hidden="true" className="mx-1.5 inline-block size-1 rounded-full bg-muted-foreground/40 align-middle" />
							2.3 MB
						</AttachmentDescription>
					</AttachmentContent>
				</Attachment>
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-xs font-medium text-muted-foreground">Working files</p>
				{/*
				 * The first two bands stretch. The xs chips below keep their natural
				 * width instead, so the group can scroll them rather than squeeze them.
				 */}
				<Attachment size="sm" className="w-full">
					<AttachmentMedia>{ICON_SHEET}</AttachmentMedia>
					<AttachmentContent>
						<AttachmentTitle>refund-queue.csv</AttachmentTitle>
						<AttachmentDescription>
							CSV
							<span aria-hidden="true" className="mx-1.5 inline-block size-1 rounded-full bg-muted-foreground/40 align-middle" />
							96 KB
						</AttachmentDescription>
					</AttachmentContent>
				</Attachment>
				<Attachment size="sm" className="w-full">
					<AttachmentMedia>{ICON_JSON}</AttachmentMedia>
					<AttachmentContent>
						<AttachmentTitle>webhook-replays.json</AttachmentTitle>
						<AttachmentDescription>
							JSON
							<span aria-hidden="true" className="mx-1.5 inline-block size-1 rounded-full bg-muted-foreground/40 align-middle" />
							41 KB
						</AttachmentDescription>
					</AttachmentContent>
				</Attachment>
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-xs font-medium text-muted-foreground">Cited snippets</p>
				{/*
				 * Only this band takes tabIndex: its chips carry no buttons, so the
				 * ones scrolled off the end would be unreachable by keyboard without
				 * a tab stop on the group itself.
				 */}
				<AttachmentGroup tabIndex={0} role="group" aria-label="Cited snippets">
					{/*
					 * Dropping AttachmentDescription is also what tightens the padding
					 * here: the per-style rule keys off whether a content slot exists.
					 */}
					<Attachment size="xs">
						<AttachmentMedia>{ICON_CODE}</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle>dunning.ts</AttachmentTitle>
						</AttachmentContent>
					</Attachment>
					<Attachment size="xs">
						<AttachmentMedia>{ICON_CODE}</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle>webhook-router.ts</AttachmentTitle>
						</AttachmentContent>
					</Attachment>
					<Attachment size="xs">
						<AttachmentMedia>{ICON_REPORT}</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle>retry-policy.md</AttachmentTitle>
						</AttachmentContent>
					</Attachment>
				</AttachmentGroup>
			</div>
		</div>
	);
}
