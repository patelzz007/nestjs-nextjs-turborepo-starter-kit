/** Cell values of the grid's two layers. */
const LIGHT = 0;
const DARK = 1;
const DATA_MODULE = 0;
const FUNCTION_MODULE = 1;

/**
 * The square of modules a symbol is built on, addressed `(row, column)` from the top-left.
 * Each module is dark or light, and is either a function module (finder, timing, alignment,
 * format/version information — never masked) or a data module (codeword bits — masked).
 */
export class QrModuleGrid {
	private readonly _dark: Uint8Array;
	private readonly _function: Uint8Array;

	public constructor(
		public readonly size: number,
		dark?: Uint8Array,
		functionModules?: Uint8Array,
	) {
		this._dark = dark ?? new Uint8Array(size * size);
		this._function = functionModules ?? new Uint8Array(size * size);
	}

	/** `true` when `(row, column)` lies inside the symbol. */
	public contains(row: number, column: number): boolean {
		return row >= 0 && row < this.size && column >= 0 && column < this.size;
	}

	/** `true` when the module is dark; `false` when it is light or outside the symbol (the quiet zone). */
	public isDark(row: number, column: number): boolean {
		return this.contains(row, column) && this._dark[this.cellIndex(row, column)] === DARK;
	}

	/** `true` when the module belongs to a function pattern (and is therefore never masked or overwritten by data). */
	public isFunction(row: number, column: number): boolean {
		return this.contains(row, column) && this._function[this.cellIndex(row, column)] === FUNCTION_MODULE;
	}

	/** Sets a function module's colour and marks it reserved. */
	public setFunctionModule(row: number, column: number, isDark: boolean): void {
		const index = this.cellIndex(row, column);
		this._dark[index] = isDark ? DARK : LIGHT;
		this._function[index] = FUNCTION_MODULE;
	}

	/** Sets a data module's colour (the module stays unreserved, so masks apply to it). */
	public setDataModule(row: number, column: number, isDark: boolean): void {
		const index = this.cellIndex(row, column);
		this._dark[index] = isDark ? DARK : LIGHT;
		this._function[index] = DATA_MODULE;
	}

	/** Inverts a module's colour. */
	public toggle(row: number, column: number): void {
		const index = this.cellIndex(row, column);
		this._dark[index] = this._dark[index] === DARK ? LIGHT : DARK;
	}

	/** How many modules are dark. */
	public darkCount(): number {
		let count = 0;
		for (const cell of this._dark) count += cell;
		return count;
	}

	/** An independent copy — the mask search tries every mask on its own copy. */
	public clone(): QrModuleGrid {
		return new QrModuleGrid(this.size, this._dark.slice(), this._function.slice());
	}

	/** The flat index of `(row, column)`, or a `RangeError` outside the symbol. */
	private cellIndex(row: number, column: number): number {
		if (!this.contains(row, column)) throw new RangeError(`Module (${String(row)}, ${String(column)}) is outside a ${String(this.size)}×${String(this.size)} symbol`);
		return row * this.size + column;
	}
}
