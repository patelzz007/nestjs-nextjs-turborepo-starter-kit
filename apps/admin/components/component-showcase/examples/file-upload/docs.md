## Installation

`useFileUpload` ships with the kit in `packages/ui/src/hooks/use-file-upload.ts`; there is nothing to install.

```showcase-example
c-file-upload-1
```

## Usage

```tsx
import { useFileUpload } from "@workspace/ui/hooks/use-file-upload";
```

```tsx
const [{ files, errors }, { openFileDialog, getInputProps, removeFile }] = useFileUpload({ accept: "image/*", maxSize: 2 * 1024 * 1024 });

return (
	<div>
		<Button onClick={openFileDialog}>Upload image</Button>
		<input {...getInputProps()} className="sr-only" />
		{files.map((file) => (
			<div key={file.id}>
				{file.file.name}
				<Button variant="ghost" size="xs" onClick={() => removeFile(file.id)}>
					Remove
				</Button>
			</div>
		))}
		{errors.map((error) => (
			<p key={error}>{error}</p>
		))}
	</div>
);
```

## Examples

### Avatar

```showcase-example
c-file-upload-2
```

### Drag and drop

```showcase-example
c-file-upload-3
```

### Progress list

```showcase-example
c-file-upload-5
```

### Table

```showcase-example
c-file-upload-6
```

### Sortable images

```showcase-example
c-file-upload-8
```

## API Reference

```showcase-api

```

## Accessibility

- The file input stays a real `input type="file"`; open it from a labelled button so keyboard and screen-reader users can pick files.
- A drop zone is an addition, not the only way in: keep the button.
- Announce errors and the file list as text near the control.
