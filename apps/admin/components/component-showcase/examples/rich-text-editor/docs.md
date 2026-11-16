## Installation

`RichTextEditor` ships with the kit in `packages/ui/src/components/rich-text-editor.tsx`, built on Tiptap, already installed.

```showcase-example
c-rich-text-editor-1
```

## Usage

```tsx
import { RichTextEditor, useRichTextEditor } from "@workspace/ui/components/rich-text-editor";
```

```tsx
const editor = useRichTextEditor({ initialContent: savedDocument, onChange: setDocument, label: "Broadcast body" });

<RichTextEditor editor={editor}>
	<RichTextEditor.Toolbar>
		<RichTextEditor.ControlsGroup>
			<RichTextEditor.Undo />
			<RichTextEditor.Redo />
		</RichTextEditor.ControlsGroup>
		<RichTextEditor.ControlsGroup>
			<RichTextEditor.Bold />
			<RichTextEditor.Italic />
			<RichTextEditor.Link />
		</RichTextEditor.ControlsGroup>
	</RichTextEditor.Toolbar>
	<RichTextEditor.Content />
</RichTextEditor>;
```

## Examples

### With a live preview

```showcase-example
c-rich-text-editor-2
```

## API Reference

```showcase-api

```

## Keyboard

| Key              | Action       |
| :--------------- | :----------- |
| `⌘ B` / `Ctrl B` | Bold.        |
| `⌘ I` / `Ctrl I` | Italic.      |
| `⌘ U` / `Ctrl U` | Underline.   |
| `⌘ Z` / `⌘ ⇧ Z`  | Undo / redo. |

## Accessibility

- The editable area is a labelled text box; toolbar controls are toggle buttons with their pressed state.
