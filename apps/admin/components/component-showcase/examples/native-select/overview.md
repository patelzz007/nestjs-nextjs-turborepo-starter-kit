## When to use

- Form fields that pick one value from a short, fixed list through the browser's own picker
- Option lists sorted under group headings, with some options shown but locked
- Mobile-heavy forms, where the operating system's picker is the most familiar control

## When not to use

- Options that carry icons, avatars, badges or descriptions in the open list: use [Select](/components/select)
- A long list people narrow by typing before picking: use [Combobox](/components/combobox)
- Choices nested more than one level deep, such as region, then country, then city: use [Cascader](/components/cascader)

## Notes

- The open list is drawn by the operating system: only the closed field follows the kit's styles
- `NativeSelectOption` paints options with the system canvas colours, so the OS popup stays legible in light and dark mode

## Native Select: the browser's own picker

`NativeSelect` is a native `select` element styled like the kit's other fields, with a chevron, three sizes and the shared invalid and disabled states. `NativeSelectOption` and `NativeSelectOptGroup` wrap `option` and `optgroup`.

### What is Native Select?

The plain HTML select, made to look at home in the kit. Because it is native, the open list is the operating system's own — a wheel on iOS, a sheet on Android — which is exactly what many mobile users expect.

### Why use Native Select?

It is the lightest select there is: no JavaScript popup, perfect keyboard and screen-reader support, form submission with no extra wiring, and the platform's own picker on touch devices.

### Native Select features

- **Native everything.** Keyboard, type-ahead, autofill and form submission come from the browser.
- **Groups.** `NativeSelectOptGroup` titles a group of options.
- **Disabled options.** `disabled` on an option shows it but locks it.
- **Sizes and states.** `sm`, `default` and `lg`; `aria-invalid` and `disabled`.

## Integrating with other components

Put it in a [Field](/components/field) with a [Label](/components/label) and an error. For a richer open list, swap to [Select](/components/select) with the same field around it.

## Frequently asked questions

### Native Select or Select?

`NativeSelect` for short, plain lists and mobile-first forms; [Select](/components/select) when options need icons, descriptions or custom rendering, or the list should match the app's look when open.

### Can I search inside it?

Native selects jump to an option as you type its first letters, but there is no search box. For filtering, use [Combobox](/components/combobox).

### How do I disable an option?

`<NativeSelectOption value="x" disabled>`. It stays visible but cannot be chosen.

### Can I style the open list?

Barely — browsers draw it. That is the trade for native behaviour; use [Select](/components/select) when the list must be styled.
