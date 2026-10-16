// The type of a generic control's value callback (`onChange(value)`).
//
// A generic component (`RadioGroup<TValue>`, `SelectField<TValue>`) is
// wrapped in `React.memo(React.forwardRef(…))`, and both wrappers erase the
// type parameter. The kit re-types the export with a generic call signature;
// for that to be assignable, the callback's parameter is checked bivariantly.
// TypeScript does that for a function type read off a METHOD signature —
// the technique @types/react uses for its own `EventHandler`. Call sites
// still infer `TValue` and still reject a callback for the wrong value type.
//
// `TValue` is inferred from the control's `options` / `value`, never from the
// callback (`NoInfer`): a state setter (`setTheme`, whose parameter also takes
// an updater function) would otherwise widen it to the constraint.

/** `(value: TValue) => void`, checked bivariantly so a generic component keeps its type through `memo` / `forwardRef`. */
export type ValueHandler<TValue> = { bivarianceHack(value: NoInfer<TValue>): void }["bivarianceHack"];
