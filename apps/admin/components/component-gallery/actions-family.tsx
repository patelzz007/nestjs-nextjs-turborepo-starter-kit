"use client";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@workspace/ui/components/button-group";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";
import { Toggle } from "@workspace/ui/components/toggle";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Copy, Italic, Plus, Trash2, Underline } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, DemoValue } from "@/components/component-gallery/gallery-section";

/** How long the demo "save" keeps the button busy, so the loading state is visible. */
const DEMO_SAVE_DURATION_MS = 1500;

const ButtonVariantSchema = z.enum(["default", "secondary", "outline", "ghost", "destructive", "link"]);
const BUTTON_VARIANTS: readonly z.output<typeof ButtonVariantSchema>[] = ButtonVariantSchema.options;

const ButtonSizeSchema = z.enum(["xs", "sm", "default", "lg"]);
const BUTTON_SIZES: readonly z.output<typeof ButtonSizeSchema>[] = ButtonSizeSchema.options;

const TextAlignSchema = z.enum(["left", "center", "right"]);
type TextAlign = z.output<typeof TextAlignSchema>;

const TextMarkSchema = z.enum(["bold", "italic", "underline"]);
type TextMark = z.output<typeof TextMarkSchema>;

const NO_MARKS: readonly TextMark[] = [];

function ButtonDemo(): React.JSX.Element {
	const [isSaving, setIsSaving] = React.useState<boolean>(false);

	React.useEffect((): (() => void) | undefined => {
		if (!isSaving) {
			return undefined;
		}
		const timer = window.setTimeout((): void => {
			setIsSaving(false);
		}, DEMO_SAVE_DURATION_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [isSaving]);

	const handleSave = React.useCallback((): void => {
		setIsSaving(true);
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Variants">
				{BUTTON_VARIANTS.map((variant) => (
					<Button key={variant} type="button" variant={variant}>
						{variant}
					</Button>
				))}
			</DemoRow>
			<DemoRow label="Sizes">
				{BUTTON_SIZES.map((size) => (
					<Button key={size} type="button" size={size}>
						Size {size}
					</Button>
				))}
			</DemoRow>
			<DemoRow label="Icon buttons">
				<Button type="button" size="icon-xs" variant="outline" aria-label="Add (extra small)">
					<Plus />
				</Button>
				<Button type="button" size="icon-sm" variant="outline" aria-label="Add (small)">
					<Plus />
				</Button>
				<Button type="button" size="icon" variant="outline" aria-label="Add">
					<Plus />
				</Button>
				<Button type="button" size="icon-lg" variant="outline" aria-label="Add (large)">
					<Plus />
				</Button>
				<Button type="button" variant="secondary">
					<Plus data-icon="inline-start" />
					With icon
				</Button>
			</DemoRow>
			<DemoRow label="States">
				<Button type="button" loading={isSaving} onClick={handleSave}>
					{isSaving ? "Saving…" : "Save (shows loading)"}
				</Button>
				<Button type="button" disabled>
					Disabled
				</Button>
				<Button type="button" variant="outline" aria-invalid>
					Invalid
				</Button>
			</DemoRow>
		</DemoSurface>
	);
}

function ButtonGroupDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Horizontal">
				<ButtonGroup aria-label="Item actions">
					<Button type="button" variant="outline">
						<Copy data-icon="inline-start" />
						Duplicate
					</Button>
					<Button type="button" variant="outline">
						Archive
					</Button>
					<Button type="button" variant="outline" size="icon" aria-label="More actions">
						<ChevronDown />
					</Button>
				</ButtonGroup>
				<ButtonGroup aria-label="Quantity">
					<ButtonGroupText>Qty</ButtonGroupText>
					<Button type="button" variant="outline" size="icon" aria-label="Remove one">
						<Trash2 />
					</Button>
					<ButtonGroupSeparator />
					<Button type="button" variant="outline" size="icon" aria-label="Add one">
						<Plus />
					</Button>
				</ButtonGroup>
			</DemoRow>
			<DemoRow label="Vertical">
				<ButtonGroup orientation="vertical" aria-label="Zoom">
					<Button type="button" variant="outline">
						Zoom in
					</Button>
					<Button type="button" variant="outline">
						Zoom out
					</Button>
				</ButtonGroup>
			</DemoRow>
		</DemoSurface>
	);
}

function ToggleDemo(): React.JSX.Element {
	const [isBold, setIsBold] = React.useState<boolean>(false);
	const [isItalic, setIsItalic] = React.useState<boolean>(true);

	return (
		<DemoSurface>
			<DemoRow label="Variants (controlled)">
				<Toggle pressed={isBold} onPressedChange={setIsBold} aria-label="Bold">
					<Bold />
				</Toggle>
				<Toggle variant="outline" pressed={isItalic} onPressedChange={setIsItalic} aria-label="Italic">
					<Italic />
					Italic
				</Toggle>
			</DemoRow>
			<DemoRow label="Sizes">
				<Toggle size="sm" variant="outline" aria-label="Underline (small)">
					<Underline />
				</Toggle>
				<Toggle variant="outline" aria-label="Underline">
					<Underline />
				</Toggle>
				<Toggle size="lg" variant="outline" aria-label="Underline (large)">
					<Underline />
				</Toggle>
			</DemoRow>
			<DemoRow label="States">
				<Toggle variant="outline" disabled aria-label="Bold (disabled)">
					<Bold />
				</Toggle>
				<Toggle variant="outline" loading aria-label="Bold (loading)">
					<Bold />
				</Toggle>
			</DemoRow>
			<DemoValue label="Bold">{isBold ? "on" : "off"}</DemoValue>
		</DemoSurface>
	);
}

function ToggleGroupDemo(): React.JSX.Element {
	const [alignment, setAlignment] = React.useState<TextAlign>("left");
	const [marks, setMarks] = React.useState<readonly TextMark[]>(NO_MARKS);
	const alignmentValue = React.useMemo((): readonly TextAlign[] => [alignment], [alignment]);

	// Single choice: keep the current alignment when the pressed item is pressed again.
	const handleAlignmentChange = React.useCallback((values: readonly string[]): void => {
		const [next] = values;
		const parsed = TextAlignSchema.safeParse(next);
		if (parsed.success) {
			setAlignment(parsed.data);
		}
	}, []);

	const handleMarksChange = React.useCallback((values: readonly string[]): void => {
		setMarks(z.array(TextMarkSchema).parse(values));
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Single choice, joined (spacing 0)">
				<ToggleGroup multiple={false} value={alignmentValue} onValueChange={handleAlignmentChange} variant="outline" spacing={0} aria-label="Text alignment">
					<ToggleGroupItem value="left" aria-label="Align left">
						<AlignLeft />
					</ToggleGroupItem>
					<ToggleGroupItem value="center" aria-label="Align center">
						<AlignCenter />
					</ToggleGroupItem>
					<ToggleGroupItem value="right" aria-label="Align right">
						<AlignRight />
					</ToggleGroupItem>
				</ToggleGroup>
			</DemoRow>
			<DemoRow label="Multiple choice">
				<ToggleGroup multiple value={marks} onValueChange={handleMarksChange} aria-label="Text formatting">
					<ToggleGroupItem value="bold" aria-label="Bold">
						<Bold />
					</ToggleGroupItem>
					<ToggleGroupItem value="italic" aria-label="Italic">
						<Italic />
					</ToggleGroupItem>
					<ToggleGroupItem value="underline" aria-label="Underline" disabled>
						<Underline />
					</ToggleGroupItem>
				</ToggleGroup>
			</DemoRow>
			<DemoValue label="Alignment">{alignment}</DemoValue>
			<DemoValue label="Marks">{marks.length > 0 ? marks.join(", ") : "none"}</DemoValue>
		</DemoSurface>
	);
}

function KbdDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Keys and chords">
				<Kbd>Esc</Kbd>
				<KbdGroup>
					<Kbd>⌘</Kbd>
					<Kbd>K</Kbd>
				</KbdGroup>
				<KbdGroup>
					<Kbd>Ctrl</Kbd>
					<span className="text-xs text-muted-foreground">+</span>
					<Kbd>Shift</Kbd>
					<span className="text-xs text-muted-foreground">+</span>
					<Kbd>P</Kbd>
				</KbdGroup>
			</DemoRow>
			<p className="text-sm text-muted-foreground">
				Press{" "}
				<KbdGroup>
					<Kbd>⌘</Kbd>
					<Kbd>K</Kbd>
				</KbdGroup>{" "}
				to open the command palette.
			</p>
		</DemoSurface>
	);
}

/** Actions: buttons and the pressed-state controls built on them. Smart: owns every demo's state. */
export function ActionsFamily(): React.JSX.Element {
	return (
		<>
			<ComponentSection entry={GALLERY_ENTRIES.button} height="h-72">
				<ButtonDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.buttonGroup} height="h-56">
				<ButtonGroupDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.toggle} height="h-72">
				<ToggleDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.toggleGroup} height="h-56">
				<ToggleGroupDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.kbd} height="h-40">
				<KbdDemo />
			</ComponentSection>
		</>
	);
}
