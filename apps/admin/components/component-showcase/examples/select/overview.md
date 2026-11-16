## When to use

- Form fields that pick one value from a short, fixed list, such as a timezone, a country or a size
- Pickers whose options carry a status dot, a badge, an avatar, a flag, an icon or a one-line description
- Toolbar filters and property pickers, such as status, priority, access level or assignee

## When not to use

- A long list people want to search by typing part of a name: use [Combobox](/components/combobox)
- A plain form field that should open the phone's or browser's own picker: use [Native Select](/components/native-select)
- Options nested in levels, such as a category and then its subcategories: use [Cascader](/components/cascader)

## Notes

- Pass `alignItemWithTrigger={false}` on `SelectContent` to open the list below the trigger rather than over it
- Give `Select` its `items` so `SelectValue` prints the chosen option's label, not its raw value
- `multiple` collects several values; show them as chips with `SelectChips` in the trigger

## Select: one value, or several, from a list

`Select` opens a list of options from a trigger button and shows the chosen one in it. It is built on Base UI's select, so typing a letter jumps to an option, the arrow keys move through the list, and options can hold any content — icons, avatars, badges, descriptions.

### What is Select?

A styled replacement for the native select. `SelectTrigger` shows the value through `SelectValue`; `SelectContent` holds `SelectItem`s, optionally in `SelectGroup`s with `SelectLabel`s and `SelectSeparator`s. With `multiple`, it collects several values and can show them as removable chips.

### Why use Select?

Native selects cannot show rich options and look different on every platform. `Select` keeps the app's look when open, supports rich rows and groups, and still behaves like a select for the keyboard and screen readers.

### Select features

- **Single or multiple.** `multiple`, with chips and a clear-all button.
- **Rich options.** Icons, avatars, status dots, badges and descriptions in each row.
- **Groups and separators.** Labelled sections of options.
- **Sizes and states.** `size`, `disabled`, `invalid`, `loading`; disabled options.
- **Clear button.** `SelectClear` inside the trigger for an optional value.

## Integrating with other components

Wrap it in a [Field](/components/field) with a label and an error. Show a [Badge](/components/badge) or an [Avatar](/components/avatar) inside options, and put a select beside an [Input](/components/input) in a [Button Group](/components/button-group) for "amount + currency". Inside a [Dialog](/components/dialog) the list portals above it.

## Frequently asked questions

### Select or native select?

[Native Select](/components/native-select) for short, plain lists, especially on mobile; `Select` when options are rich or the list must match the app's look.

### Select or Combobox?

`Select` when people browse a short list; [Combobox](/components/combobox) when they search a long one by typing.

### Can I add search?

Not inside `Select` — use [Combobox](/components/combobox), which is built for typing to filter.

### How do I select several values?

Set `multiple`; the value becomes an array. The Multiple Selection example shows chips in the trigger.

### Is it accessible?

Yes: the trigger is a combobox button that opens a listbox; the arrow keys, type-ahead, Home and End work, and the chosen option is announced.
