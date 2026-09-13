/**
 * Avatars are rendered at 32-48px. 256px covers retina displays with margin.
 */
export const AVATAR_MAX_DIMENSION = 256;

/**
 * Client-side target for the encoded data URL. Kept below the server-side cap
 * (`AVATAR_MAX_DATA_URL_LENGTH` in packages/server/src/db/schema/user.ts) so a
 * normalized avatar always has headroom to pass validation.
 */
export const AVATAR_TARGET_DATA_URL_LENGTH = 48 * 1024;

/**
 * Encoding candidates, ordered from best to most compressed. WebP is tried
 * first; browsers that cannot encode it silently fall back to PNG, which we
 * detect via the returned MIME type and skip.
 */
const AVATAR_ENCODINGS: ReadonlyArray<readonly [string, number]> = [
	["image/webp", 0.85],
	["image/webp", 0.7],
	["image/jpeg", 0.82],
	["image/jpeg", 0.6],
];

const loadImageElement = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("Unable to decode the image file"));
		image.src = src;
	});

/**
 * Downscales an uploaded avatar to a square thumbnail and re-encodes it to a
 * compact format.
 *
 * Raw `FileReader.readAsDataURL` output is stored verbatim in `user.image` and
 * is inlined into every `user.get` response, so an unprocessed upload inflates
 * every API payload and page navigation. Normalizing here keeps that column in
 * the kilobyte range.
 *
 * @param file Image file selected by the user.
 *
 * @return A data URL holding the normalized avatar.
 */
export async function normalizeAvatarFile(file: File): Promise<string> {
	const objectUrl = URL.createObjectURL(file);

	try {
		const image = await loadImageElement(objectUrl);

		if (!image.width || !image.height) {
			throw new Error("Unable to read the image dimensions");
		}

		const size = AVATAR_MAX_DIMENSION;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;

		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Canvas 2D context is unavailable");
		}

		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";

		// Center-crop to a square, mirroring the `object-cover` rendering.
		const scale = Math.max(size / image.width, size / image.height);
		const drawWidth = image.width * scale;
		const drawHeight = image.height * scale;
		context.drawImage(
			image,
			(size - drawWidth) / 2,
			(size - drawHeight) / 2,
			drawWidth,
			drawHeight,
		);

		let smallest: string | null = null;

		for (const [mimeType, quality] of AVATAR_ENCODINGS) {
			const encoded = canvas.toDataURL(mimeType, quality);

			// Browsers that cannot encode the requested type return a PNG instead.
			if (!encoded.startsWith(`data:${mimeType}`)) {
				continue;
			}

			if (encoded.length <= AVATAR_TARGET_DATA_URL_LENGTH) {
				return encoded;
			}

			if (!smallest || encoded.length < smallest.length) {
				smallest = encoded;
			}
		}

		if (smallest) {
			return smallest;
		}

		return canvas.toDataURL("image/png");
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

/**
 * Checks if the given avatar value represents a solid color in hexadecimal format.
 *
 * @param value Avatar value to check.
 *
 * @return True if the avatar is a solid color, false otherwise.
 */
export function isSolidColorAvatar(value?: string | null) {
	return (
		(value?.startsWith("#") && /^#[0-9A-Fa-f]{6}$/.test(value)) ||
		value?.startsWith("color:") ||
		false
	);
}

/**
 * Gets the avatar type for form selection (RadioGroup value).
 *
 * @param value Avatar value.
 *
 * @return "upload" for base64 images, "color" for solid colors, or the original value for other types.
 */
export function getAvatarType(value?: string | null) {
	if (!value) return "";

	if (value.startsWith("data:")) return "upload";
	if (isSolidColorAvatar(value)) return "color";

	return value;
}
