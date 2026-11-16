## Installation

`RichTextEditor` ships with the kit in `packages/ui-native/src/components/rich-text-editor.tsx`; there is nothing to install.

```showcase-example
c-rich-text-editor-1
```

## Usage

```tsx
import { RichTextEditor } from "@workspace/ui-native/components/rich-text-editor";
```

```tsx
<RichTextEditor initialContent={null} onChange={setDocument} label="Broadcast" />
```

## Preview

```showcase-example
c-rich-text-editor-2
```

## API Reference

```showcase-api

```

## Accessibility

- The toolbar is a named group of toggles that say whether their format is on.
- Each block is a text field named by the editor's label; list markers are hidden from screen readers.
