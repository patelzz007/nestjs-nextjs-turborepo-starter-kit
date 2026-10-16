// @vitest-environment jsdom
import { PHONE_INPUT_EXAMPLES } from "@/components/component-gallery/examples/phone-input";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Phone Input", PHONE_INPUT_EXAMPLES);
