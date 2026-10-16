// The Components screen's overlays and disclosure: Dialog, AlertDialog,
// BottomSheet, DropdownMenu, Tooltip, Accordion, Collapsible, Tabs and the
// presentational Toast. Each example owns its demo state here (the kit
// components stay controlled); nothing is sent to the API or stored. The Toast
// is the kit's view drawn inline — the app's toast facade is not involved.

import ArchiveIcon from "lucide-react-native/icons/archive";
import BadgeCheckIcon from "lucide-react-native/icons/badge-check";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import PencilIcon from "lucide-react-native/icons/pencil";
import TrashIcon from "lucide-react-native/icons/trash";
import * as React from "react";
import { View } from "react-native";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import { BottomSheet, SheetOptionRow } from "@workspace/ui-native/components/bottom-sheet";
import { Button } from "@workspace/ui-native/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Icon } from "@workspace/ui-native/components/icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import { BodyText, MutedText } from "@workspace/ui-native/components/text";
import { Toast, type ToastTone } from "@workspace/ui-native/components/toast";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import { DemoBlock } from "../demo-block";

const DIALOG_COPY = {
	title: "Rename project",
	description: "The new name shows everywhere the project is listed. Links to it keep working.",
};

export function OverlayDemos(): React.JSX.Element {
	return (
		<View className="gap-4">
			<DialogDemo />
			<AlertDialogDemo />
			<BottomSheetDemo />
			<DropdownMenuDemo />
			<TooltipDemo />
			<AccordionDemo />
			<CollapsibleDemo />
			<TabsDemo />
			<ToastDemo />
		</View>
	);
}

function DialogDemo(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<DemoBlock title="Dialog" description="A centred card over a scrim, for a short task that needs full attention.">
			<Button label="Open dialog" variant="secondary" onPress={show} testID="gallery-dialog-open" />
			<Dialog open={open} onOpenChange={setOpen} testID="gallery-dialog">
				<DialogHeader>
					<DialogTitle>{DIALOG_COPY.title}</DialogTitle>
					<DialogDescription>{DIALOG_COPY.description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button label="Done" onPress={hide} />
					<Button label="Cancel" variant="secondary" onPress={hide} />
				</DialogFooter>
			</Dialog>
		</DemoBlock>
	);
}

function AlertDialogDemo(): React.JSX.Element {
	const [visible, setVisible] = React.useState(false);
	const [outcome, setOutcome] = React.useState<string | null>(null);
	const show = React.useCallback((): void => {
		setVisible(true);
	}, []);
	const confirm = React.useCallback((): void => {
		setVisible(false);
		setOutcome("Device revoked (demo only).");
	}, []);
	const cancel = React.useCallback((): void => {
		setVisible(false);
		setOutcome("Kept the device.");
	}, []);
	return (
		<DemoBlock title="AlertDialog" description="Confirms a consequential action: confirm or cancel, never a tap outside.">
			<Button label="Revoke device" variant="destructive" onPress={show} testID="gallery-alert-dialog-open" />
			{outcome === null ? null : <MutedText>{outcome}</MutedText>}
			<AlertDialog
				visible={visible}
				title="Revoke this device?"
				description="It is signed out at once and must sign in again."
				confirmLabel="Revoke"
				cancelLabel="Keep"
				onConfirm={confirm}
				onCancel={cancel}
				destructive
			/>
		</DemoBlock>
	);
}

type SortOrder = "newest" | "oldest" | "updated";

const SORT_OPTIONS: readonly { readonly value: SortOrder; readonly label: string; readonly description: string }[] = [
	{ value: "newest", label: "Newest first", description: "By creation date" },
	{ value: "oldest", label: "Oldest first", description: "By creation date" },
	{ value: "updated", label: "Recently updated", description: "By last change" },
];

function BottomSheetDemo(): React.JSX.Element {
	const [visible, setVisible] = React.useState(false);
	const [sort, setSort] = React.useState<SortOrder>("newest");
	const show = React.useCallback((): void => {
		setVisible(true);
	}, []);
	const hide = React.useCallback((): void => {
		setVisible(false);
	}, []);
	const choose = React.useCallback((value: SortOrder): void => {
		setSort(value);
		setVisible(false);
	}, []);
	const chosen = SORT_OPTIONS.find((option): boolean => option.value === sort);
	return (
		<DemoBlock title="BottomSheet" description="Slides up from the bottom: the phone's Sheet and Drawer. Rows pick one option.">
			<Button label="Sort projects" variant="secondary" onPress={show} testID="gallery-bottom-sheet-open" />
			<MutedText>{`Sorted: ${chosen?.label ?? sort}`}</MutedText>
			<BottomSheet visible={visible} title="Sort by" onClose={hide} testID="gallery-bottom-sheet">
				{SORT_OPTIONS.map((option): React.JSX.Element => (
					<SheetOptionRow<SortOrder>
						key={option.value}
						value={option.value}
						label={option.label}
						description={option.description}
						selected={option.value === sort}
						onSelect={choose}
					/>
				))}
			</BottomSheet>
		</DemoBlock>
	);
}

type ProjectAction = "rename" | "archive" | "delete";

const PROJECT_ACTIONS: readonly DropdownMenuItemData<ProjectAction>[] = [
	{ value: "rename", label: "Rename", icon: PencilIcon },
	{ value: "archive", label: "Archive", icon: ArchiveIcon, disabled: true },
	{ value: "delete", label: "Delete", icon: TrashIcon, variant: "destructive" },
];

function DropdownMenuDemo(): React.JSX.Element {
	const [picked, setPicked] = React.useState<ProjectAction | null>(null);
	const choose = React.useCallback((value: ProjectAction): void => {
		setPicked(value);
	}, []);
	return (
		<DemoBlock title="DropdownMenu" description="A trigger that opens an action sheet: the phone's DropdownMenu, ContextMenu and Popover.">
			<View className="flex-row items-center gap-3">
				<DropdownMenu<ProjectAction> label="Project actions" items={PROJECT_ACTIONS} onSelect={choose} testID="gallery-dropdown-menu" />
				<DropdownMenu<ProjectAction> label="More" size="icon" variant="ghost" icon={EllipsisIcon} items={PROJECT_ACTIONS} onSelect={choose} />
			</View>
			<MutedText>{picked === null ? "No action chosen yet." : `Chose: ${picked}`}</MutedText>
		</DemoBlock>
	);
}

function TooltipDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Tooltip" description="Long-press to explain an element; screen readers hear it as a hint.">
			<Tooltip content="Verified by GitHub" accessibilityLabel="Verified" className="self-start" testID="gallery-tooltip">
				<View className="flex-row items-center gap-2 p-2">
					<Icon icon={BadgeCheckIcon} size="md" colorClassName="accent-primary" />
					<BodyText>Verified</BodyText>
				</View>
			</Tooltip>
		</DemoBlock>
	);
}

const FIRST_FAQ: readonly string[] = ["billing"];

function AccordionDemo(): React.JSX.Element {
	const [open, setOpen] = React.useState<readonly string[]>(FIRST_FAQ);
	return (
		<DemoBlock title="Accordion" description="Sections that open and close; one at a time here.">
			<Accordion value={open} onChange={setOpen} testID="gallery-accordion">
				<AccordionItem value="billing">
					<AccordionTrigger label="When am I billed?" />
					<AccordionContent>
						<MutedText>On the first of each month, for the month ahead.</MutedText>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="cancel">
					<AccordionTrigger label="Can I cancel at any time?" />
					<AccordionContent>
						<MutedText>Yes. The plan runs to the end of the paid month.</MutedText>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="export">
					<AccordionTrigger label="Can I export my data?" />
					<AccordionContent>
						<MutedText>Every project exports as a zip from its settings.</MutedText>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</DemoBlock>
	);
}

function CollapsibleDemo(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	return (
		<DemoBlock title="Collapsible" description="One section behind a trigger that shows or hides it.">
			<Collapsible open={open} onOpenChange={setOpen} variant="card" testID="gallery-collapsible">
				<CollapsibleTrigger label="Build details" />
				<CollapsibleContent>
					<MutedText>Install 12 s · Build 48 s · Test 1 min 05 s</MutedText>
				</CollapsibleContent>
			</Collapsible>
		</DemoBlock>
	);
}

function TabsDemo(): React.JSX.Element {
	const [tab, setTab] = React.useState("overview");
	return (
		<DemoBlock title="Tabs" description="Views of one subject, one at a time; a muted track or an underline.">
			<Tabs value={tab} onChange={setTab} testID="gallery-tabs">
				<TabsList accessibilityLabel="Project sections">
					<TabsTrigger value="overview" label="Overview" />
					<TabsTrigger value="activity" label="Activity" />
					<TabsTrigger value="settings" label="Settings" />
				</TabsList>
				<TabsContent value="overview">
					<MutedText>Three services, all healthy.</MutedText>
				</TabsContent>
				<TabsContent value="activity">
					<MutedText>Deployed 2 hours ago.</MutedText>
				</TabsContent>
				<TabsContent value="settings">
					<MutedText>Owned by the platform team.</MutedText>
				</TabsContent>
			</Tabs>
			<Tabs value={tab} onChange={setTab} variant="line" size="sm">
				<TabsList accessibilityLabel="Project sections, underlined">
					<TabsTrigger value="overview" label="Overview" />
					<TabsTrigger value="activity" label="Activity" />
					<TabsTrigger value="settings" label="Settings" />
				</TabsList>
			</Tabs>
		</DemoBlock>
	);
}

const TOAST_TONES: readonly ToastTone[] = ["success", "info", "warning", "error"];

const TOAST_MESSAGES: Readonly<Record<ToastTone, string>> = {
	success: "Profile saved.",
	info: "A new version is available.",
	warning: "Your session ends in 5 minutes.",
	error: "The check didn't pass.",
};

/** The demo toast's life, in ms: its countdown bar drains over it. */
const DEMO_TOAST_DURATION_MS = 4_000;
/** Drawn inline in its card, the toast slides in from just above its place. */
const INLINE_OFFSCREEN_OFFSET = 0;

interface ToastDemoState {
	/** Which tone, as an index into TOAST_TONES; also keys the toast, so each change replays its entrance. */
	readonly toneIndex: number;
	readonly leaving: boolean;
	readonly shown: boolean;
}

const FIRST_TOAST: ToastDemoState = { toneIndex: 0, leaving: false, shown: true };

function ToastDemo(): React.JSX.Element {
	const [toast, setToast] = React.useState<ToastDemoState>(FIRST_TOAST);
	const tone = TOAST_TONES.at(toast.toneIndex % TOAST_TONES.length) ?? "success";
	const nextTone = React.useCallback((): void => {
		setToast((current: ToastDemoState): ToastDemoState => ({ toneIndex: current.toneIndex + 1, leaving: false, shown: true }));
	}, []);
	const dismiss = React.useCallback((): void => {
		setToast((current: ToastDemoState): ToastDemoState => ({ ...current, leaving: true }));
	}, []);
	const left = React.useCallback((): void => {
		setToast((current: ToastDemoState): ToastDemoState => ({ ...current, shown: false }));
	}, []);
	return (
		<DemoBlock title="Toast" description="The toast's view: tone card, countdown, swipe or close to dismiss.">
			{toast.shown ? (
				<Toast
					key={toast.toneIndex}
					tone={tone}
					message={TOAST_MESSAGES[tone]}
					durationMs={DEMO_TOAST_DURATION_MS}
					offscreenOffset={INLINE_OFFSCREEN_OFFSET}
					leaving={toast.leaving}
					onDismiss={dismiss}
					onLeft={left}
					testID="gallery-toast"
				/>
			) : (
				<MutedText>Dismissed.</MutedText>
			)}
			<Button label={toast.shown ? "Next tone" : "Show again"} size="sm" variant="secondary" onPress={nextTone} className="self-start" />
		</DemoBlock>
	);
}
