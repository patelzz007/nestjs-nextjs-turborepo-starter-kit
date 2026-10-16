// @vitest-environment jsdom
import { COLOR_PICKER_EXAMPLES } from "@/components/component-gallery/examples/color-picker";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Color Picker", COLOR_PICKER_EXAMPLES);
