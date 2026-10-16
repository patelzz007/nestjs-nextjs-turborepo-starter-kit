// @vitest-environment jsdom
import { DIALOG_EXAMPLES } from "@/components/component-gallery/examples/dialog";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Dialog", DIALOG_EXAMPLES);
