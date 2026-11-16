## Installation

`FileType` and its helpers ship with the kit in `packages/ui/src/components/file-type.tsx`; there is nothing to install.

```showcase-example
c-file-type-1
```

## Usage

```tsx
import { FileType, getFileType } from "@workspace/ui/components/file-type";
```

```tsx
<FileType type="pdf" />
<FileType type={getFileType("Q3 report.xlsx")} variant="solid" />
```

## Examples

### Variants

```showcase-example
c-file-type-2
```

### Attachment list

```showcase-example
c-file-type-7
```

### Resolve from a name

```showcase-example
c-file-type-9
```

### Format picker

```showcase-example
c-file-type-12
```

## API Reference

```showcase-api

```

## Accessibility

- An image named by its format; hide it (`aria-hidden`) when the file name next to it already says the type.
