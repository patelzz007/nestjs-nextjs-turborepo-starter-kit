## When to use

- A short, plain list where the platform's own picker is wanted
- A form field that should look like the rest of the kit's fields
- Options with disabled entries or groups

## When not to use

- A long list people need to search: use [SelectField](/showcase/select) or [Combobox](/showcase/combobox)
- Options with descriptions or icons: use [SelectField](/showcase/select)
- A few options shown at once: use [ToggleGroup](/showcase/toggle-group) or [RadioGroup](/showcase/radio-group)

## Notes

- On iOS the system action sheet lists the options; Android has no system list picker, so the kit's sheet does
- The trigger is `SelectField`'s, so both look the same in a form

## NativeSelect: the platform's own picker

`NativeSelect` opens the platform's picker from a kit-styled field: the iOS action sheet, or the kit's option sheet elsewhere.

### What is it?

A field that opens a system list.

### Why use it?

The system picker is familiar and fast for short lists.

### Features

- **System sheet.** iOS action sheet with disabled options.
- **Groups.** Headings in the kit's sheet.
- **Sizes and states.** Like `SelectField`.

## Integrating with other components

Put it in a [Field](/showcase/field).

## Frequently asked questions

### Why does it look different on Android?

React Native gives Android no system list picker, so the kit's own sheet stands in; the field looks the same.
