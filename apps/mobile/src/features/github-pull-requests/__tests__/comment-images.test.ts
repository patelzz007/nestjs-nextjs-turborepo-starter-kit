import {
	COMMENT_IMAGE_POLICY,
	imageMarkdown,
	pickedImageMimeType,
	pickedImageName,
	pickedImageProblem,
	uploadingPlaceholder,
	withLineAppended,
	withPlaceholderReplaced,
} from "../comment-images";

describe("picked pictures", () => {
	it("accepts a JPEG, PNG or WebP within the size limit", () => {
		const photo = { fileName: "IMG_1.jpg", mimeType: "image/jpeg", fileSize: 2_000_000 };

		expect(pickedImageProblem(photo)).toBeNull();
		expect(pickedImageMimeType(photo)).toBe("image/jpeg");
		expect(pickedImageProblem({ ...photo, fileSize: null })).toBeNull();
	});

	it("refuses another type, or one over the size limit, in words", () => {
		expect(pickedImageProblem({ fileName: "a.heic", mimeType: "image/heic", fileSize: 10 })).toBe("Attach a JPEG, PNG or WebP picture.");
		expect(pickedImageProblem({ fileName: "a.avif", mimeType: "image/avif", fileSize: 10 })).toBe("Attach a JPEG, PNG or WebP picture.");
		expect(pickedImageMimeType({ fileName: "a.avif", mimeType: "image/avif", fileSize: 10 })).toBeNull();
		expect(pickedImageProblem({ fileName: "a.png", mimeType: null, fileSize: 10 })).toBe("Attach a JPEG, PNG or WebP picture.");
		expect(pickedImageProblem({ fileName: "a.png", mimeType: "image/png", fileSize: COMMENT_IMAGE_POLICY.maxBytes + 1 })).toBe("Pictures can be up to 10 MB.");
	});

	it("names a picture the picker gave no name", () => {
		expect(pickedImageName({ fileName: " shot.png ", mimeType: null, fileSize: null })).toBe("shot.png");
		expect(pickedImageName({ fileName: null, mimeType: null, fileSize: null })).toBe("image");
	});
});

describe("comment picture markdown", () => {
	it("holds the picture's place while it uploads, then shows it", () => {
		expect(uploadingPlaceholder("Screen [1].png")).toBe("![Uploading Screen 1…]()");
		expect(imageMarkdown("Screen [1].png", "https://cdn.example.com/u/1/a b.png")).toBe("![Screen 1](https://cdn.example.com/u/1/a%20b.png)");
		// An address already encoded (Firebase's `%2F`) is kept as it is.
		expect(imageMarkdown("a.png", "https://storage.example.com/o/users%2F1%2Fa.png?alt=media")).toBe("![a](https://storage.example.com/o/users%2F1%2Fa.png?alt=media)");
	});

	it("adds a line at the end of the comment", () => {
		expect(withLineAppended("", "![x]()")).toBe("![x]()");
		expect(withLineAppended("Looks good", "![x]()")).toBe("Looks good\n![x]()");
		expect(withLineAppended("Looks good\n", "![x]()")).toBe("Looks good\n![x]()");
	});

	it("swaps the placeholder for the picture, or takes it out with its line", () => {
		const placeholder = uploadingPlaceholder("a.png");

		expect(withPlaceholderReplaced(`Hi\n${placeholder}\nmore`, placeholder, "![a](https://x.test/a.png)")).toBe("Hi\n![a](https://x.test/a.png)\nmore");
		expect(withPlaceholderReplaced(`Hi\n${placeholder}`, placeholder, "")).toBe("Hi");
		expect(withPlaceholderReplaced(placeholder, placeholder, "")).toBe("");
		expect(withPlaceholderReplaced("Edited away", placeholder, "")).toBe("Edited away");
	});
});
