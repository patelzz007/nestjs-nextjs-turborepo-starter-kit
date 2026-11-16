## Installation

The avatar parts ship with the kit in `packages/ui/src/components/avatar.tsx`, built on Base UI's avatar; there is nothing to install.

```showcase-example
c-avatar-1
```

## Usage

```tsx
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@workspace/ui/components/avatar";
```

```tsx
<Avatar>
	<AvatarImage src={person.photoUrl} alt={person.name} />
	<AvatarFallback>{initialsOf(person.name)}</AvatarFallback>
	<AvatarBadge className="bg-success" />
</Avatar>
```

## Examples

### Fallbacks

```showcase-example
c-avatar-2
```

### Status dots

```showcase-example
c-avatar-6
```

### Group with a count

```showcase-example
c-avatar-11
```

### User details

```showcase-example
c-avatar-16
```

## API Reference

```showcase-api

```

## Accessibility

- `AvatarImage` needs an `alt`; when the name is already shown beside it, hide the avatar (`aria-hidden`) so it is not read twice.
- A presence badge's meaning (online, away) must also be available as text.
