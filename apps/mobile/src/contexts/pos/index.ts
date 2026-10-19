// ============================================
// contexts/pos — the context's public surface
// ============================================
// Point of sale — the till: pairing this phone as a POS terminal, then scanning and redeeming rewards.
// Code outside this folder (routes in src/app, runtime features, screen tests)
// imports from here, never from a file inside it
// (docs/architecture/ddd-cqrs-migration-plan.md §14.5).

export { TILL_COPY, TILL_TITLE } from "./labels";
export { type PairedTerminal, pairedTerminalOf, savePairedTerminal } from "./paired-terminal";
export { TillCounter } from "./till-counter";
export { TillPairing } from "./till-pairing";
export { usePairedTerminal } from "./use-paired-terminal";
