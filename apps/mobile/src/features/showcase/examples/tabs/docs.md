## Installation

`Tabs` ships with the kit in `packages/ui-native/src/components/tabs.tsx`; there is nothing to install.

```showcase-example
c-tabs-1
```

## Usage

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
```

```tsx
<Tabs value={tab} onChange={setTab}>
	<TabsList>
		<TabsTrigger value="account" label="Account" />
		<TabsTrigger value="password" label="Password" />
	</TabsList>
	<TabsContent value="account">{ACCOUNT}</TabsContent>
	<TabsContent value="password">{PASSWORD}</TabsContent>
</Tabs>
```

## Styles

```showcase-example
c-tabs-2
```

```showcase-example
c-tabs-4
```

## Icons and counts

```showcase-example
c-tabs-5
```

```showcase-example
c-tabs-7
```

## API Reference

```showcase-api

```

## Accessibility

- The list is a tablist; each tab says whether it is selected.
- A count is read with its label ("Inbox, 12").
- Only the chosen panel is rendered.
