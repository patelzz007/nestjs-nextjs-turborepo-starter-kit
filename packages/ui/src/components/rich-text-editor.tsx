"use client";

import { useEditor, useEditorState, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { Toggle } from "@workspace/ui/components/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/core/utils";
import { broadcastEditorExtensions, isAllowedBroadcastLink } from "@workspace/ui/lib/rich-text/editor-extensions";
import {
	BoldIcon,
	CodeIcon,
	Columns3Icon,
	Heading2Icon,
	Heading3Icon,
	ItalicIcon,
	LinkIcon,
	ListIcon,
	ListOrderedIcon,
	MinusIcon,
	ImageIcon,
	MousePointerClickIcon,
	QuoteIcon,
	Redo2Icon,
	Rows3Icon,
	SquareCodeIcon,
	StrikethroughIcon,
	TableIcon,
	Trash2Icon,
	UnderlineIcon,
	Undo2Icon,
	UnlinkIcon,
} from "lucide-react";
import * as React from "react";

// A shared rich-text editor modelled on editorcn (shadcn-labs, MIT): the same compound API
// (`RichTextEditor`, `.Toolbar`, `.ControlsGroup`, controls, `.Content`, `.Footer`) on Tiptap, built
// from this kit's own primitives and limited to what a broadcast may hold (ADR 073). It is
// controlled: the owner passes the JSON in and gets every change back; validation is the owner's.

/** The size of a new table: a header row plus two body rows, three columns. */
const NEW_TABLE = { rows: 3, cols: 3, withHeaderRow: true };

interface RichTextEditorContextValue {
	readonly editor: Editor | null;
	readonly disabled: boolean;
}

const RichTextEditorContext = React.createContext<RichTextEditorContextValue | null>(null);

function useRichTextEditorContext(): RichTextEditorContextValue {
	const context = React.useContext(RichTextEditorContext);
	if (context === null) {
		throw new Error("RichTextEditor parts must be used inside <RichTextEditor>");
	}
	return context;
}

export interface UseRichTextEditorOptions {
	/** The starting document (Tiptap JSON); later changes of this value are not pushed into the editor. */
	readonly initialContent: JSONContent | null;
	/** Every change, as Tiptap JSON. */
	readonly onChange: (content: JSONContent) => void;
	readonly placeholder: string;
	/** The accessible name of the writing area. */
	readonly label: string;
}

/** The editor instance for {@link RichTextEditor}: the broadcast extensions, rendered on the client only. */
export function useRichTextEditor({ initialContent, onChange, placeholder, label }: UseRichTextEditorOptions): Editor | null {
	const onChangeRef = React.useRef(onChange);
	React.useEffect((): void => {
		onChangeRef.current = onChange;
	}, [onChange]);

	return useEditor({
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		extensions: broadcastEditorExtensions({ placeholder }),
		...(initialContent === null ? {} : { content: initialContent }),
		editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox" } },
		onUpdate: ({ editor }): void => {
			onChangeRef.current(editor.getJSON());
		},
	});
}

export interface RichTextEditorProps {
	readonly editor: Editor | null;
	readonly children: React.ReactNode;
	readonly disabled?: boolean;
	/** Marks the whole editor invalid (its border turns destructive). */
	readonly invalid?: boolean;
	readonly className?: string;
}

function RichTextEditorRoot({ editor, children, disabled = false, invalid = false, className }: RichTextEditorProps): React.JSX.Element {
	React.useEffect((): void => {
		if (editor !== null && !editor.isDestroyed && editor.isEditable === disabled) {
			editor.setEditable(!disabled);
		}
	}, [editor, disabled]);
	const value = React.useMemo((): RichTextEditorContextValue => ({ editor, disabled }), [editor, disabled]);

	return (
		<RichTextEditorContext.Provider value={value}>
			<div
				data-slot="rich-text-editor"
				data-invalid={invalid ? "" : undefined}
				data-disabled={disabled ? "" : undefined}
				className={cn(
					"flex flex-col overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive data-disabled:opacity-60",
					className,
				)}>
				{/* The parts subscribe to the editor's state when they mount, so they wait for the editor itself. */}
				{editor === null ? <div aria-hidden="true" className="min-h-60" data-slot="rich-text-editor-pending" /> : children}
			</div>
		</RichTextEditorContext.Provider>
	);
}

interface RichTextEditorToolbarProps {
	readonly children: React.ReactNode;
	readonly className?: string;
}

function Toolbar({ children, className }: RichTextEditorToolbarProps): React.JSX.Element | null {
	const { disabled } = useRichTextEditorContext();
	if (disabled) {
		return null;
	}
	return (
		<div
			role="toolbar"
			aria-label="Formatting"
			data-slot="rich-text-editor-toolbar"
			className={cn("flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5", className)}>
			{children}
		</div>
	);
}

function ControlsGroup({ children }: RichTextEditorToolbarProps): React.JSX.Element {
	return (
		<>
			<div className="flex items-center gap-0.5" data-slot="rich-text-editor-controls-group">
				{children}
			</div>
			<Separator orientation="vertical" className="mx-0.5 h-6 last:hidden" />
		</>
	);
}

/** How the writing area draws each allowed node: the same look as the in-app view (`RichTextView`). */
const RTE_CONTENT_CLASS = cn(
	"min-h-48 px-3 py-2.5 text-sm leading-relaxed text-foreground",
	"[&_.ProseMirror]:min-h-44 [&_.ProseMirror]:outline-none [&_.ProseMirror>*+*]:mt-3",
	"[&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold",
	"[&_li>*+*]:mt-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5",
	"[&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground",
	"[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
	"[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]",
	"[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0",
	"[&_hr]:border-border",
	"[&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-start [&_th]:font-medium",
	"[&_.selectedCell]:bg-primary/10",
	"[&_a[data-call-to-action]]:inline-flex [&_a[data-call-to-action]]:rounded-md [&_a[data-call-to-action]]:bg-primary [&_a[data-call-to-action]]:px-4 [&_a[data-call-to-action]]:py-2 [&_a[data-call-to-action]]:font-medium [&_a[data-call-to-action]]:text-primary-foreground [&_a[data-call-to-action]]:no-underline",
	"[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-start [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
);

function Content({ className }: { readonly className?: string }): React.JSX.Element {
	const { editor } = useRichTextEditorContext();
	return <EditorContent editor={editor} data-slot="rich-text-editor-content" className={cn(RTE_CONTENT_CLASS, className)} />;
}

function Footer({ limit }: { readonly limit: number }): React.JSX.Element | null {
	const { editor } = useRichTextEditorContext();
	const characters = useEditorState({ editor, selector: ({ editor: current }): number => current?.storage.characterCount.characters() ?? 0 });
	if (editor === null) {
		return null;
	}
	return (
		<div data-slot="rich-text-editor-footer" className="flex justify-end border-t border-border px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
			{`${String(characters ?? 0)} / ${String(limit)}`}
		</div>
	);
}

interface ControlButtonProps {
	readonly label: string;
	readonly active: boolean;
	readonly disabled: boolean;
	readonly onPress: () => void;
	readonly children: React.ReactNode;
}

/** One toolbar toggle with its tooltip; pressing never steals the editor's selection. */
function ControlButton({ label, active, disabled, onPress, children }: ControlButtonProps): React.JSX.Element {
	const handleMouseDown = React.useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		event.preventDefault();
	}, []);
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Toggle size="sm" pressed={active} disabled={disabled} aria-label={label} onMouseDown={handleMouseDown} onPressedChange={onPress} className="h-8 min-w-8 px-1.5" />
				}>
				{children}
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/** What one toolbar control reads from and does to the editor. */
interface ControlDefinition {
	readonly label: string;
	readonly icon: React.ReactNode;
	readonly isActive: (editor: Editor) => boolean;
	readonly isDisabled: (editor: Editor) => boolean;
	readonly run: (editor: Editor) => void;
}

function neverApplies(): boolean {
	return false;
}

/** A toolbar control bound to the editor's state (re-renders only when its own state changes). */
function createControl(definition: ControlDefinition): () => React.JSX.Element {
	function Control(): React.JSX.Element {
		const { editor, disabled } = useRichTextEditorContext();
		const state = useEditorState({
			editor,
			selector: ({ editor: current }): { readonly active: boolean; readonly disabled: boolean } =>
				current === null || current.isDestroyed ? { active: false, disabled: true } : { active: definition.isActive(current), disabled: definition.isDisabled(current) },
		});
		const handlePress = React.useCallback((): void => {
			if (editor !== null && !editor.isDestroyed) {
				definition.run(editor);
			}
		}, [editor]);
		return (
			<ControlButton label={definition.label} active={state?.active ?? false} disabled={disabled || (state?.disabled ?? true)} onPress={handlePress}>
				{definition.icon}
			</ControlButton>
		);
	}
	Control.displayName = `RichTextEditor.${definition.label}`;
	return Control;
}

const Bold = createControl({
	label: "Bold",
	icon: <BoldIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("bold"),
	isDisabled: (editor) => !editor.can().toggleBold(),
	run: (editor) => editor.chain().focus().toggleBold().run(),
});
const Italic = createControl({
	label: "Italic",
	icon: <ItalicIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("italic"),
	isDisabled: (editor) => !editor.can().toggleItalic(),
	run: (editor) => editor.chain().focus().toggleItalic().run(),
});
const Underline = createControl({
	label: "Underline",
	icon: <UnderlineIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("underline"),
	isDisabled: (editor) => !editor.can().toggleUnderline(),
	run: (editor) => editor.chain().focus().toggleUnderline().run(),
});
const Strikethrough = createControl({
	label: "Strikethrough",
	icon: <StrikethroughIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("strike"),
	isDisabled: (editor) => !editor.can().toggleStrike(),
	run: (editor) => editor.chain().focus().toggleStrike().run(),
});
const Code = createControl({
	label: "Inline code",
	icon: <CodeIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("code"),
	isDisabled: (editor) => !editor.can().toggleCode(),
	run: (editor) => editor.chain().focus().toggleCode().run(),
});
const H2 = createControl({
	label: "Heading",
	icon: <Heading2Icon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("heading", { level: 2 }),
	isDisabled: neverApplies,
	run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
});
const H3 = createControl({
	label: "Subheading",
	icon: <Heading3Icon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("heading", { level: 3 }),
	isDisabled: neverApplies,
	run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
});
const BulletList = createControl({
	label: "Bulleted list",
	icon: <ListIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("bulletList"),
	isDisabled: neverApplies,
	run: (editor) => editor.chain().focus().toggleBulletList().run(),
});
const OrderedList = createControl({
	label: "Numbered list",
	icon: <ListOrderedIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("orderedList"),
	isDisabled: neverApplies,
	run: (editor) => editor.chain().focus().toggleOrderedList().run(),
});
const Blockquote = createControl({
	label: "Quote",
	icon: <QuoteIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("blockquote"),
	isDisabled: neverApplies,
	run: (editor) => editor.chain().focus().toggleBlockquote().run(),
});
const CodeBlock = createControl({
	label: "Code block",
	icon: <SquareCodeIcon aria-hidden="true" />,
	isActive: (editor) => editor.isActive("codeBlock"),
	isDisabled: neverApplies,
	run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
});
const Hr = createControl({
	label: "Divider",
	icon: <MinusIcon aria-hidden="true" />,
	isActive: neverApplies,
	isDisabled: (editor) => !editor.can().setHorizontalRule(),
	run: (editor) => editor.chain().focus().setHorizontalRule().run(),
});
const Table = createControl({
	label: "Insert table",
	icon: <TableIcon aria-hidden="true" />,
	isActive: neverApplies,
	isDisabled: (editor) => editor.isActive("table") || !editor.can().insertTable(NEW_TABLE),
	run: (editor) => editor.chain().focus().insertTable(NEW_TABLE).run(),
});
const AddRow = createControl({
	label: "Add row",
	icon: <Rows3Icon aria-hidden="true" />,
	isActive: neverApplies,
	isDisabled: (editor) => !editor.can().addRowAfter(),
	run: (editor) => editor.chain().focus().addRowAfter().run(),
});
const AddColumn = createControl({
	label: "Add column",
	icon: <Columns3Icon aria-hidden="true" />,
	isActive: neverApplies,
	isDisabled: (editor) => !editor.can().addColumnAfter(),
	run: (editor) => editor.chain().focus().addColumnAfter().run(),
});
const DeleteTable = createControl({
	label: "Delete table",
	icon: <Trash2Icon aria-hidden="true" />,
	isActive: neverApplies,
	isDisabled: (editor) => !editor.can().deleteTable(),
	run: (editor) => editor.chain().focus().deleteTable().run(),
});
const Unlink = createControl({
	label: "Remove link",
	icon: <UnlinkIcon aria-hidden="true" />,
	isActive: neverApplies,
	isDisabled: (editor) => !editor.isActive("link"),
	run: (editor) => editor.chain().focus().extendMarkRange("link").unsetLink().run(),
});
const Undo = createControl({
	label: "Undo",
	icon: <Undo2Icon aria-hidden="true" />,
	isActive: neverApplies,
	isDisabled: (editor) => !editor.can().undo(),
	run: (editor) => editor.chain().focus().undo().run(),
});
const Redo = createControl({
	label: "Redo",
	icon: <Redo2Icon aria-hidden="true" />,
	isActive: neverApplies,
	isDisabled: (editor) => !editor.can().redo(),
	run: (editor) => editor.chain().focus().redo().run(),
});

const LINK_ERROR = "Use a full https:// link.";

interface LinkFormProps {
	readonly title: string;
	readonly submitLabel: string;
	/** Also asks for the button's words (the call-to-action). */
	readonly withLabel: boolean;
	readonly onSubmit: (href: string, label: string) => void;
}

/** The popover form of the link and call-to-action controls: https only, checked as the merchant types. */
function LinkForm({ title, submitLabel, withLabel, onSubmit }: LinkFormProps): React.JSX.Element {
	const [href, setHref] = React.useState("https://");
	const [label, setLabel] = React.useState("");
	const id = React.useId();
	const hrefValid = isAllowedBroadcastLink(href);
	const labelValid = !withLabel || label.trim().length > 0;

	const handleHrefChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setHref(event.currentTarget.value);
	}, []);
	const handleLabelChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setLabel(event.currentTarget.value);
	}, []);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			event.stopPropagation();
			if (hrefValid && labelValid) {
				onSubmit(href.trim(), label.trim());
			}
		},
		[href, hrefValid, label, labelValid, onSubmit],
	);

	return (
		<form onSubmit={handleSubmit} className="flex w-72 flex-col gap-3">
			<p className="text-sm font-medium text-foreground">{title}</p>
			{withLabel ? (
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${id}-label`}>Button text</Label>
					<Input id={`${id}-label`} value={label} onChange={handleLabelChange} placeholder="e.g. See the menu" />
				</div>
			) : null}
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-href`}>Link</Label>
				<Input id={`${id}-href`} type="url" value={href} onChange={handleHrefChange} aria-invalid={hrefValid ? undefined : true} aria-describedby={`${id}-hint`} />
				<p id={`${id}-hint`} className={cn("text-xs", hrefValid ? "text-muted-foreground" : "text-destructive")}>
					{hrefValid ? "Customers see where it goes before they tap." : LINK_ERROR}
				</p>
			</div>
			<Button type="submit" size="sm" disabled={!hrefValid || !labelValid}>
				{submitLabel}
			</Button>
		</form>
	);
}

/** Link the selected words to an https page. */
function Link(): React.JSX.Element {
	const { editor, disabled } = useRichTextEditorContext();
	const [open, setOpen] = React.useState(false);
	const state = useEditorState({
		editor,
		selector: ({ editor: current }): { readonly active: boolean; readonly empty: boolean } =>
			current === null || current.isDestroyed ? { active: false, empty: true } : { active: current.isActive("link"), empty: current.state.selection.empty },
	});
	const handleSubmit = React.useCallback(
		(href: string): void => {
			editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
			setOpen(false);
		},
		[editor],
	);
	const unavailable = disabled || editor === null || (state?.empty ?? true);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Toggle size="sm" pressed={state?.active ?? false} disabled={unavailable} aria-label="Link" className="h-8 min-w-8 px-1.5" title="Select words, then add a link" />
				}>
				<LinkIcon aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent align="start">
				<LinkForm title="Link the selected words" submitLabel="Add link" withLabel={false} onSubmit={handleSubmit} />
			</PopoverContent>
		</Popover>
	);
}

/** Insert the one call-to-action button (disabled once the document has one). */
function CallToAction(): React.JSX.Element {
	const { editor, disabled } = useRichTextEditorContext();
	const [open, setOpen] = React.useState(false);
	const hasOne = useEditorState({
		editor,
		selector: ({ editor: current }): boolean => {
			let found = false;
			current?.state.doc.descendants((node): boolean => {
				if (node.type.name === "callToAction") {
					found = true;
				}
				return !found;
			});
			return found;
		},
	});
	const handleSubmit = React.useCallback(
		(href: string, label: string): void => {
			editor?.chain().focus().insertCallToAction({ href, label }).run();
			setOpen(false);
		},
		[editor],
	);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Toggle
						size="sm"
						pressed={false}
						disabled={disabled || editor === null || hasOne === true}
						aria-label="Add a button"
						className="h-8 min-w-8 px-1.5"
						title={hasOne === true ? "A message holds one button" : "Add a button"}
					/>
				}>
				<MousePointerClickIcon aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent align="start">
				<LinkForm title="Add a button" submitLabel="Add button" withLabel onSubmit={handleSubmit} />
			</PopoverContent>
		</Popover>
	);
}

/** A picture the app uploaded for the body: the file to name, and its address to show while editing. */
export interface UploadedPicture {
	readonly fileId: string;
	readonly src: string;
}

export interface RichTextPictureProps {
	/** Uploads the chosen file through the app's file pipeline and resolves once it is scanned and published. */
	readonly upload: (file: File) => Promise<UploadedPicture>;
	/** The picker's `accept` (the category's allowed types). */
	readonly accept: string;
}

/** Add the body's one picture (enhancement 5.4): choose it, describe it, and it uploads before it goes in. */
function Picture({ upload, accept }: RichTextPictureProps): React.JSX.Element {
	const { editor, disabled } = useRichTextEditorContext();
	const [open, setOpen] = React.useState(false);
	const [file, setFile] = React.useState<File | null>(null);
	const [alt, setAlt] = React.useState("");
	const [pending, setPending] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const fileId = React.useId();
	const altId = React.useId();
	const hasOne = useEditorState({
		editor,
		selector: ({ editor: current }): boolean => {
			let found = false;
			current?.state.doc.descendants((node): boolean => {
				if (node.type.name === "image") {
					found = true;
				}
				return !found;
			});
			return found;
		},
	});
	const handleFile = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setFile(Array.from(event.currentTarget.files ?? []).at(0) ?? null);
		setError(null);
	}, []);
	const handleAlt = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setAlt(event.currentTarget.value);
	}, []);
	const handleSubmit = React.useCallback(
		async (event: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
			event.preventDefault();
			if (file === null || alt.trim().length === 0) {
				return;
			}
			setPending(true);
			setError(null);
			try {
				const uploaded = await upload(file);
				editor?.chain().focus().insertBroadcastImage({ fileId: uploaded.fileId, alt: alt.trim(), src: uploaded.src }).run();
				setOpen(false);
				setFile(null);
				setAlt("");
			} catch (caught) {
				setError(caught instanceof Error ? caught.message : "The picture could not be uploaded. Try another one.");
			} finally {
				setPending(false);
			}
		},
		[alt, editor, file, upload],
	);
	const handleFormSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			void handleSubmit(event);
		},
		[handleSubmit],
	);
	const ready: boolean = file !== null && alt.trim().length > 0 && !pending;
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Toggle
						size="sm"
						pressed={false}
						disabled={disabled || editor === null || hasOne === true}
						aria-label="Add a picture"
						className="h-8 min-w-8 px-1.5"
						title={hasOne === true ? "A message holds one picture" : "Add a picture"}
					/>
				}>
				<ImageIcon aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent align="start" aria-label="Add a picture">
				<form className="flex flex-col gap-3" onSubmit={handleFormSubmit}>
					<p className="text-sm font-medium">Add a picture</p>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={fileId}>Picture</Label>
						<Input id={fileId} type="file" accept={accept} onChange={handleFile} />
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={altId}>Describe it (read aloud to people who can&apos;t see it)</Label>
						<Input id={altId} value={alt} onChange={handleAlt} placeholder="e.g. A slice of chocolate cake" />
					</div>
					{error === null ? null : (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
					<Button type="submit" size="sm" disabled={!ready}>
						{pending ? "Uploading…" : "Add picture"}
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	);
}

export const RichTextEditor = Object.assign(RichTextEditorRoot, {
	Toolbar,
	ControlsGroup,
	Content,
	Footer,
	Bold,
	Italic,
	Underline,
	Strikethrough,
	Code,
	H2,
	H3,
	BulletList,
	OrderedList,
	Blockquote,
	CodeBlock,
	Hr,
	Table,
	AddRow,
	AddColumn,
	DeleteTable,
	Link,
	Unlink,
	CallToAction,
	Picture,
	Undo,
	Redo,
});

export type { Editor as RichTextEditorInstance, JSONContent as RichTextEditorContent };
