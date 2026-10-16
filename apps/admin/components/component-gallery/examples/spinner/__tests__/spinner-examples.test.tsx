// @vitest-environment jsdom
import { SPINNER_EXAMPLES } from "@/components/component-gallery/examples/spinner";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Spinner", SPINNER_EXAMPLES);
