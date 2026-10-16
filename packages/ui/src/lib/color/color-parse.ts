/**
 * Reads CSS colour strings for the colour picker (ported from reui). Every
 * pattern names its groups (rules/27); the input is a typed string, so no
 * runtime type checks are needed (rules/28).
 */
import {
	ALPHA_MAX,
	clamp,
	composeMatrices,
	decodeSrgbUnit,
	HUE_MAX_DEGREES,
	linearSrgbToOklch,
	mapTriple,
	multiplyMatrix,
	OKLCH_CHROMA_MAX,
	oklabToOklch,
	PERCENT_MAX,
	radiansToDegrees,
	RGB_CHANNEL_MAX,
	wrapHue,
	degreesToRadians,
	type ColorMatrix,
	type ColorPickerColor,
	type ColorPickerColorSpace,
	type ColorTriple,
} from "@workspace/ui/lib/color/color-space";

const HEX_PATTERN = /^#?(?<digits>[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/u;
/* [\s\S], not ".", so a function pretty-printed over several lines reads. */
const FUNCTION_PATTERN = /^(?<name>[a-z][a-z\d-]*)\((?<body>[\s\S]*)\)$/u;
const NUMBER_PATTERN = /^(?<value>[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?<unit>%|deg|rad|grad|turn)?$/u;
const SEPARATOR_PATTERN = /[\s,]+/u;
const ALPHA_SUFFIX_PATTERN = /a$/u;
const ANY_CHARACTER_PATTERN = /./gu;

const HEX_RADIX = 16;
const HEX_BYTE_LENGTH = 2;
/** Digits of a short hex (`#rgb` / `#rgba`) that double into a long one. */
const SHORT_HEX_MAX_LENGTH = 4;
const HEX_WITH_ALPHA_LENGTH = 8;
const HEX_RED_OFFSET = 0;
const HEX_GREEN_OFFSET = 2;
const HEX_BLUE_OFFSET = 4;
const HEX_ALPHA_OFFSET = 6;
/** Length of the six hex digits that end each `NAMED_COLORS` entry. */
const NAMED_COLOR_HEX_LENGTH = 6;

const GRADIANS_TO_DEGREES = 0.9;
/** CSS `lab()`: 100% of a or b is 125. */
const LAB_AB_PERCENT_REFERENCE = 125;
/** CSS `lch()`: 100% of chroma is 150. */
const LCH_CHROMA_PERCENT_REFERENCE = 150;
/** Channels of a `color()` call: the space name, then three values. */
const COLOR_FUNCTION_PARTS = 4;
const CHANNEL_COUNT = 3;
const LEGACY_ALPHA_PARTS = 4;
/** How far a `color(srgb …)` channel may stray from 0..1 and stay plain sRGB. */
const UNIT_EPSILON = 1e-6;

/* The 148 CSS named colours, each name then its hex. */
const NAMED_COLORS =
	"alicebluef0f8ff antiquewhitefaebd7 aqua00ffff aquamarine7fffd4 " +
	"azuref0ffff beigef5f5dc bisqueffe4c4 black000000 blanchedalmondffebcd " +
	"blue0000ff blueviolet8a2be2 browna52a2a burlywooddeb887 " +
	"cadetblue5f9ea0 chartreuse7fff00 chocolated2691e coralff7f50 " +
	"cornflowerblue6495ed cornsilkfff8dc crimsondc143c cyan00ffff " +
	"darkblue00008b darkcyan008b8b darkgoldenrodb8860b darkgraya9a9a9 " +
	"darkgreen006400 darkgreya9a9a9 darkkhakibdb76b darkmagenta8b008b " +
	"darkolivegreen556b2f darkorangeff8c00 darkorchid9932cc darkred8b0000 " +
	"darksalmone9967a darkseagreen8fbc8f darkslateblue483d8b " +
	"darkslategray2f4f4f darkslategrey2f4f4f darkturquoise00ced1 " +
	"darkviolet9400d3 deeppinkff1493 deepskyblue00bfff dimgray696969 " +
	"dimgrey696969 dodgerblue1e90ff firebrickb22222 floralwhitefffaf0 " +
	"forestgreen228b22 fuchsiaff00ff gainsborodcdcdc ghostwhitef8f8ff " +
	"goldffd700 goldenroddaa520 gray808080 green008000 greenyellowadff2f " +
	"grey808080 honeydewf0fff0 hotpinkff69b4 indianredcd5c5c indigo4b0082 " +
	"ivoryfffff0 khakif0e68c lavendere6e6fa lavenderblushfff0f5 " +
	"lawngreen7cfc00 lemonchiffonfffacd lightblueadd8e6 lightcoralf08080 " +
	"lightcyane0ffff lightgoldenrodyellowfafad2 lightgrayd3d3d3 " +
	"lightgreen90ee90 lightgreyd3d3d3 lightpinkffb6c1 lightsalmonffa07a " +
	"lightseagreen20b2aa lightskyblue87cefa lightslategray778899 " +
	"lightslategrey778899 lightsteelblueb0c4de lightyellowffffe0 lime00ff00 " +
	"limegreen32cd32 linenfaf0e6 magentaff00ff maroon800000 " +
	"mediumaquamarine66cdaa mediumblue0000cd mediumorchidba55d3 " +
	"mediumpurple9370db mediumseagreen3cb371 mediumslateblue7b68ee " +
	"mediumspringgreen00fa9a mediumturquoise48d1cc mediumvioletredc71585 " +
	"midnightblue191970 mintcreamf5fffa mistyroseffe4e1 moccasinffe4b5 " +
	"navajowhiteffdead navy000080 oldlacefdf5e6 olive808000 olivedrab6b8e23 " +
	"orangeffa500 orangeredff4500 orchidda70d6 palegoldenrodeee8aa " +
	"palegreen98fb98 paleturquoiseafeeee palevioletreddb7093 " +
	"papayawhipffefd5 peachpuffffdab9 perucd853f pinkffc0cb plumdda0dd " +
	"powderblueb0e0e6 purple800080 rebeccapurple663399 redff0000 " +
	"rosybrownbc8f8f royalblue4169e1 saddlebrown8b4513 salmonfa8072 " +
	"sandybrownf4a460 seagreen2e8b57 seashellfff5ee siennaa0522d " +
	"silverc0c0c0 skyblue87ceeb slateblue6a5acd slategray708090 " +
	"slategrey708090 snowfffafa springgreen00ff7f steelblue4682b4 tand2b48c " +
	"teal008080 thistled8bfd8 tomatoff6347 turquoise40e0d0 violetee82ee " +
	"wheatf5deb3 whiteffffff whitesmokef5f5f5 yellowffff00 " +
	"yellowgreen9acd32";

let namedColorMap: Map<string, string> | null = null;

function namedColorHex(name: string): string | undefined {
	namedColorMap ??= new Map(NAMED_COLORS.split(" ").map((entry: string): [string, string] => [entry.slice(0, -NAMED_COLOR_HEX_LENGTH), entry.slice(-NAMED_COLOR_HEX_LENGTH)]));
	return namedColorMap.get(name);
}

/**
 * One CSS number: 100% is worth `percentOf`, computed as value * percentOf /
 * 100 so 50% of 255 is exactly 127.5; angle units only where `isAngle`.
 */
export function readCssNumber(token: string | undefined, percentOf: number, isAngle = false): number | null {
	if (token === undefined) {
		return null;
	}
	if (token === "none") {
		return 0;
	}
	const groups = NUMBER_PATTERN.exec(token)?.groups;
	if (groups?.value === undefined) {
		return null;
	}
	const value = Number(groups.value);
	if (!Number.isFinite(value)) {
		return null;
	}
	const unit = groups.unit;
	if (unit === undefined) {
		return value;
	}
	if (unit === "%") {
		return isAngle ? null : (value * percentOf) / PERCENT_MAX;
	}
	if (!isAngle) {
		return null;
	}
	if (unit === "rad") {
		return radiansToDegrees(value);
	}
	if (unit === "grad") {
		return value * GRADIANS_TO_DEGREES;
	}
	if (unit === "turn") {
		return value * HUE_MAX_DEGREES;
	}
	return value;
}

/* CSS Color 4's matrices: XYZ D65 to linear sRGB, each RGB space to XYZ, and Bradford from D50. */
const XYZ_TO_SRGB: ColorMatrix = [
	[12831 / 3959, -329 / 214, -1974 / 3959],
	[-851781 / 878810, 1648619 / 878810, 36519 / 878810],
	[705 / 12673, -2585 / 12673, 705 / 667],
];
const D50_TO_D65: ColorMatrix = [
	[0.955473421488075, -0.02309845494876471, 0.06325924320057072],
	[-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
	[0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const D50_TO_SRGB = composeMatrices(XYZ_TO_SRGB, D50_TO_D65);

const A98_GAMMA = 563 / 256;
const PROPHOTO_LINEAR_LIMIT = 16 / 512;
const PROPHOTO_LINEAR_SLOPE = 16;
const PROPHOTO_GAMMA = 1.8;
const REC2020_ALPHA = 1.09929682680944;
const REC2020_BETA = 0.018053968510807;
const REC2020_LINEAR_SLOPE = 4.5;
const REC2020_GAMMA = 0.45;

interface RgbSpaceDefinition {
	readonly decode: (value: number) => number;
	readonly toSrgb: ColorMatrix | null;
}

function identity(value: number): number {
	return value;
}

const RGB_SPACES: ReadonlyMap<string, RgbSpaceDefinition> = new Map<string, RgbSpaceDefinition>([
	["srgb", { decode: decodeSrgbUnit, toSrgb: null }],
	["srgb-linear", { decode: identity, toSrgb: null }],
	[
		"display-p3",
		{
			decode: decodeSrgbUnit,
			toSrgb: composeMatrices(XYZ_TO_SRGB, [
				[0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
				[0.2289745640697488, 0.6917385218365064, 0.079286914093745],
				[0, 0.04511338185890264, 1.043944368900976],
			]),
		},
	],
	[
		"a98-rgb",
		{
			decode: (value: number): number => Math.sign(value) * Math.abs(value) ** A98_GAMMA,
			toSrgb: composeMatrices(XYZ_TO_SRGB, [
				[573536 / 994567, 263643 / 1420810, 187206 / 994567],
				[591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
				[53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
			]),
		},
	],
	[
		"prophoto-rgb",
		{
			decode: (value: number): number => {
				const size = Math.abs(value);
				return size <= PROPHOTO_LINEAR_LIMIT ? value / PROPHOTO_LINEAR_SLOPE : Math.sign(value) * size ** PROPHOTO_GAMMA;
			},
			toSrgb: composeMatrices(D50_TO_SRGB, [
				[0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
				[0.2880748288194013, 0.711835234241873, 0.00008993693872564],
				[0, 0, 0.8251046025104602],
			]),
		},
	],
	[
		"rec2020",
		{
			decode: (value: number): number => {
				const size = Math.abs(value);
				return size < REC2020_BETA * REC2020_LINEAR_SLOPE
					? value / REC2020_LINEAR_SLOPE
					: Math.sign(value) * ((size + REC2020_ALPHA - 1) / REC2020_ALPHA) ** (1 / REC2020_GAMMA);
			},
			toSrgb: composeMatrices(XYZ_TO_SRGB, [
				[0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
				[0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
				[0, 0.028072693049087428, 1.060985057710791],
			]),
		},
	],
	["xyz", { decode: identity, toSrgb: XYZ_TO_SRGB }],
	["xyz-d65", { decode: identity, toSrgb: XYZ_TO_SRGB }],
	["xyz-d50", { decode: identity, toSrgb: D50_TO_SRGB }],
]);

/* CIE Lab constants (CSS Color 4). */
const LAB_KAPPA = 24389 / 27;
const LAB_EPSILON = 216 / 24389;
const LAB_OFFSET = 16;
const LAB_SCALE = 116;
const LAB_A_SCALE = 500;
const LAB_B_SCALE = 200;
const D50_WHITE_X = 0.3457;
const D50_WHITE_Y = 0.3585;
const CUBE = 3;

/* CIE Lab, D50 white, to XYZ D50, as CSS Color 4 writes it. */
function labToXyz(lab: ColorTriple): ColorTriple {
	const [lightness, a, b] = lab;
	const fy = (lightness + LAB_OFFSET) / LAB_SCALE;
	const fx = a / LAB_A_SCALE + fy;
	const fz = fy - b / LAB_B_SCALE;
	const x = fx ** CUBE > LAB_EPSILON ? fx ** CUBE : (LAB_SCALE * fx - LAB_OFFSET) / LAB_KAPPA;
	const y = lightness > LAB_KAPPA * LAB_EPSILON ? fy ** CUBE : lightness / LAB_KAPPA;
	const z = fz ** CUBE > LAB_EPSILON ? fz ** CUBE : (LAB_SCALE * fz - LAB_OFFSET) / LAB_KAPPA;
	return [x * (D50_WHITE_X / D50_WHITE_Y), y, z * ((1 - D50_WHITE_X - D50_WHITE_Y) / D50_WHITE_Y)];
}

function isUnitTriple(channels: ColorTriple): boolean {
	return channels.every((channel: number): boolean => channel >= -UNIT_EPSILON && channel <= 1 + UNIT_EPSILON);
}

interface ReadChannels {
	readonly space: ColorPickerColorSpace;
	readonly channels: ColorTriple;
}

/** Three CSS numbers, or `null` when any fails to read. */
function readTriple(parts: readonly string[], percentOf: readonly [number, number, number], angles: readonly [boolean, boolean, boolean]): ColorTriple | null {
	const [first, second, third] = parts;
	const [firstPercent, secondPercent, thirdPercent] = percentOf;
	const [firstAngle, secondAngle, thirdAngle] = angles;
	const a = readCssNumber(first, firstPercent, firstAngle);
	const b = readCssNumber(second, secondPercent, secondAngle);
	const c = readCssNumber(third, thirdPercent, thirdAngle);
	if (a === null || b === null || c === null) {
		return null;
	}
	return [a, b, c];
}

const NO_ANGLES: readonly [boolean, boolean, boolean] = [false, false, false];
const LEADING_ANGLE: readonly [boolean, boolean, boolean] = [true, false, false];
const TRAILING_ANGLE: readonly [boolean, boolean, boolean] = [false, false, true];

function readRgbChannels(parts: readonly string[]): ReadChannels | null {
	const rgb = readTriple(parts, [RGB_CHANNEL_MAX, RGB_CHANNEL_MAX, RGB_CHANNEL_MAX], NO_ANGLES);
	return rgb === null ? null : { space: "rgb", channels: mapTriple(rgb, (value: number): number => clamp(value, 0, RGB_CHANNEL_MAX)) };
}

function readCylindricalChannels(name: string, parts: readonly string[]): ReadChannels | null {
	const read = readTriple(parts, [1, PERCENT_MAX, PERCENT_MAX], LEADING_ANGLE);
	if (read === null) {
		return null;
	}
	const [hue, first, second] = read;
	const x = clamp(first, 0, PERCENT_MAX);
	const y = clamp(second, 0, PERCENT_MAX);
	if (name === "hsl") {
		return { space: "hsl", channels: [hue, x, y] };
	}
	if (name !== "hwb") {
		return { space: "hsv", channels: [hue, x, y] };
	}
	/* hwb(): whiteness and blackness are HSB's saturation and brightness read from the other end; past 100% they make a grey. */
	const total = x + y;
	if (total >= PERCENT_MAX) {
		return { space: "hsv", channels: [hue, 0, (x / total) * PERCENT_MAX] };
	}
	const brightness = PERCENT_MAX - y;
	return { space: "hsv", channels: [hue, (1 - x / brightness) * PERCENT_MAX, brightness] };
}

function readOklabChannels(name: string, parts: readonly string[]): ReadChannels | null {
	const isPolar = name === "oklch";
	const read = readTriple(parts, [1, OKLCH_CHROMA_MAX, isPolar ? 1 : OKLCH_CHROMA_MAX], isPolar ? TRAILING_ANGLE : NO_ANGLES);
	if (read === null) {
		return null;
	}
	const [lightness, second, third] = read;
	const l = clamp(lightness, 0, 1);
	if (isPolar) {
		return { space: "oklch", channels: [l * PERCENT_MAX, Math.max(0, second), third] };
	}
	return { space: "oklch", channels: oklabToOklch([l, second, third]) };
}

function readLabChannels(name: string, parts: readonly string[]): ReadChannels | null {
	const isPolar = name === "lch";
	const read = readTriple(
		parts,
		[PERCENT_MAX, isPolar ? LCH_CHROMA_PERCENT_REFERENCE : LAB_AB_PERCENT_REFERENCE, isPolar ? 1 : LAB_AB_PERCENT_REFERENCE],
		isPolar ? TRAILING_ANGLE : NO_ANGLES,
	);
	if (read === null) {
		return null;
	}
	const [lightness, second, third] = read;
	const l = clamp(lightness, 0, PERCENT_MAX);
	const angle = degreesToRadians(third);
	const chroma = Math.max(0, second);
	const lab: ColorTriple = isPolar ? [l, chroma * Math.cos(angle), chroma * Math.sin(angle)] : [l, second, third];
	return { space: "oklch", channels: linearSrgbToOklch(multiplyMatrix(D50_TO_SRGB, labToXyz(lab))) };
}

function readColorFunctionChannels(parts: readonly string[]): ReadChannels | null {
	const [spaceName, ...values] = parts;
	const target = spaceName === undefined ? undefined : RGB_SPACES.get(spaceName);
	if (target === undefined || parts.length !== COLOR_FUNCTION_PARTS) {
		return null;
	}
	const channels = readTriple(values, [1, 1, 1], NO_ANGLES);
	if (channels === null) {
		return null;
	}
	if (spaceName === "srgb" && isUnitTriple(channels)) {
		return { space: "rgb", channels: mapTriple(channels, (value: number): number => clamp(value, 0, 1) * RGB_CHANNEL_MAX) };
	}
	const linear = mapTriple(channels, target.decode);
	return { space: "oklch", channels: linearSrgbToOklch(target.toSrgb === null ? linear : multiplyMatrix(target.toSrgb, linear)) };
}

/* The channels of one function, as a colour in the picker's spaces. */
function readChannels(name: string, parts: readonly string[]): ReadChannels | null {
	switch (name) {
		case "rgb":
			return readRgbChannels(parts);
		case "hsl":
		case "hsv":
		case "hsb":
		case "hwb":
			return readCylindricalChannels(name, parts);
		case "oklch":
		case "oklab":
			return readOklabChannels(name, parts);
		case "lab":
		case "lch":
			return readLabChannels(name, parts);
		case "color":
			return readColorFunctionChannels(parts);
		default:
			return null;
	}
}

function parseHex(digits: string): ColorPickerColor {
	const long = digits.length <= SHORT_HEX_MAX_LENGTH ? digits.replace(ANY_CHARACTER_PATTERN, "$&$&") : digits;
	const byte = (offset: number): number => Number.parseInt(long.slice(offset, offset + HEX_BYTE_LENGTH), HEX_RADIX);
	return {
		space: "rgb",
		channels: [byte(HEX_RED_OFFSET), byte(HEX_GREEN_OFFSET), byte(HEX_BLUE_OFFSET)],
		alpha: long.length === HEX_WITH_ALPHA_LENGTH ? byte(HEX_ALPHA_OFFSET) / RGB_CHANNEL_MAX : ALPHA_MAX,
	};
}

/** Hue wrapped into 0..360 for the spaces that carry one. */
function wrapChannelsHue(read: ReadChannels): ColorTriple {
	const [first, second, third] = read.channels;
	if (read.space === "rgb") {
		return read.channels;
	}
	return read.space === "oklch" ? [first, second, wrapHue(third)] : [wrapHue(first), second, third];
}

function parseFunction(name: string, body: string): ColorPickerColor | null {
	const [main = "", slash, ...rest] = body.split("/");
	if (rest.length > 0) {
		return null;
	}
	const parts = main.split(SEPARATOR_PATTERN).filter((part: string): boolean => part.length > 0);
	const isColorFunction = name === "color";
	/* color() names its space first, and takes alpha only after a slash. */
	const count = isColorFunction ? COLOR_FUNCTION_PARTS : CHANNEL_COUNT;
	const isLegacyAlpha = !isColorFunction && parts.length === LEGACY_ALPHA_PARTS && slash === undefined;
	if (parts.length !== count && !isLegacyAlpha) {
		return null;
	}
	/* Alpha follows a slash, or is the fourth value of the comma syntax. */
	const legacyAlphaToken = isLegacyAlpha ? parts.at(-1) : undefined;
	const alphaToken = slash?.trim() ?? legacyAlphaToken;
	const alpha = alphaToken === undefined ? ALPHA_MAX : readCssNumber(alphaToken, 1);
	const read = readChannels(name, parts.slice(0, count));
	if (alpha === null || read === null) {
		return null;
	}
	if (read.channels.some((channel: number): boolean => !Number.isFinite(channel))) {
		return null;
	}
	return { space: read.space, channels: wrapChannelsHue(read), alpha: clamp(alpha, 0, ALPHA_MAX) };
}

/**
 * Reads a CSS colour: hex with 3, 4, 6 or 8 digits, `#` optional; the 148
 * named colours and `transparent`; `rgb()`, `hsl()`, `hwb()`, `lab()`,
 * `lch()`, `oklab()`, `oklch()` and `color()` in any of CSS Color 4's RGB and
 * XYZ spaces, plus `hsb()` or `hsv()`; modern or comma syntax, with or without
 * alpha. A colour that can fall outside sRGB is kept as OKLCH. Anything else,
 * `var()` and `currentColor` included, is `null`.
 */
export function parseColor(input: string | null | undefined): ColorPickerColor | null {
	if (input === null || input === undefined) {
		return null;
	}
	const text = input.trim().toLowerCase();
	if (text.length === 0) {
		return null;
	}
	if (text === "transparent") {
		return { space: "rgb", channels: [0, 0, 0], alpha: 0 };
	}
	const hexDigits = HEX_PATTERN.exec(namedColorHex(text) ?? text)?.groups?.digits;
	if (hexDigits !== undefined) {
		return parseHex(hexDigits);
	}
	const call = FUNCTION_PATTERN.exec(text)?.groups;
	if (call?.name === undefined || call.body === undefined) {
		return null;
	}
	return parseFunction(call.name.replace(ALPHA_SUFFIX_PATTERN, ""), call.body);
}
