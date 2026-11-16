## When to use

- Views of the same thing: account, password and preferences
- 2 to 4 sections with short labels

## When not to use

- Steps done in order: use [Stepper](/showcase/stepper)
- Many sections: use a list of [ListRow](/showcase/item)s or a [Select](/showcase/select)
- A value choice in a form: use [SegmentedControl](/showcase/tabs) or [RadioGroup](/showcase/radio-group)

## Notes

- Only the chosen panel is rendered
- Tabs share the row's width, or hug their labels with `fill={false}`
- A vertical list sits beside the panels; on a phone keep it narrow

## Tabs: switch between panels

`Tabs` holds a `TabsList` of `TabsTrigger`s and a `TabsContent` per tab.

### What is it?

A controlled set of panels: `value` in, `onChange` out.

### Why use it?

It keeps related views on one screen without stacking them.

### Features

- **Two styles.** A filled track, or an underline.
- **Orientation.** A row over the panels, or a column beside them.
- **Icons and counts.** `icon` and `badge` on each tab.
- **Width.** Shared or hugging.

## Integrating with other components

Panels hold [Card](/showcase/card)s and forms; `SegmentedControl` is the compact switch for a value.

## Frequently asked questions

### Tabs or a segmented control?

Tabs switch panels; a segmented control picks a value (a period, a view mode).
