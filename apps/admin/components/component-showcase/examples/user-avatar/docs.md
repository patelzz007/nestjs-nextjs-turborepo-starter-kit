## Installation

`UserAvatar` ships with the kit in `packages/ui/src/components/user-avatar.tsx`; there is nothing to install.

```showcase-example
c-user-avatar-1
```

## Usage

```tsx
import { UserAvatar } from "@workspace/ui/components/user-avatar";
```

```tsx
<UserAvatar name={user.name} image={user.avatar} drawnSize={40} className="size-10" />
```

## API Reference

```showcase-api

```

## Accessibility

- `alt` defaults to the person's name; pass `alt=""` (or hide it) when the name is already beside the avatar.
