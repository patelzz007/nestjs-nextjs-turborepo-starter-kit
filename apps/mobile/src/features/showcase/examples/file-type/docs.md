## Installation

`FileType` ships with the kit in `packages/ui-native/src/components/file-type.tsx`; there is nothing to install.

```showcase-example
c-file-type-1
```

## Usage

```tsx
import { getFileType } from "@workspace/shared";
import { FileType } from "@workspace/ui-native/components/file-type";
```

```tsx
<FileType type={getFileType(file.name)} />
```

## Variants and sizes

```showcase-example
c-file-type-2
```

```showcase-example
c-file-type-3
```

## In lists

```showcase-example
c-file-type-7
```

```showcase-example
c-file-type-8
```

```showcase-example
c-file-type-10
```

## Resolving names

```showcase-example
c-file-type-9
```

```showcase-example
c-file-type-15
```

## API Reference

```showcase-api

```

## Accessibility

- One image, named after the type ("PDF file").
- A custom label joins the name ("V3, DOCX file").
