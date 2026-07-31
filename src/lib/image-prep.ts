// Prepare an image for upload to the AI parsers. iPhone photos are large and
// often HEIC — which is slow to send and which some AI gateways reject — so we
// downscale to a sane dimension and re-encode as JPEG in the browser first.
// This is the single biggest fix for "the receipt photo took forever / nothing
// was added": smaller JPEGs parse fast and avoid the size + HEIC failure modes.
//
// If the browser can't decode the file (e.g. HEIC in a non-Safari browser) or
// anything goes wrong, we fall back to the original bytes untouched, so we never
// make capture worse than before. PDFs and non-images always pass through.

export type PreparedFile = { base64: string; mimeType: string; fileName: string };

// Encode an ArrayBuffer to base64 without blowing the call stack on big buffers.
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
}

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/i;

function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXT.test(file.name || "");
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const r = Math.min(max / w, max / h);
  return { width: Math.max(1, Math.round(w * r)), height: Math.max(1, Math.round(h * r)) };
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  // createImageBitmap is fast and applies EXIF orientation; Safari decodes HEIC
  // here because the OS provides the codec.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      return bmp as ImageBitmap & { width: number; height: number };
    } catch {
      /* fall through to <img> */
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img as HTMLImageElement & { width: number; height: number });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/**
 * Downscale + transcode an image to JPEG. Returns the original bytes untouched
 * for non-images (PDF, CSV, text) or when decoding/encoding isn't possible.
 */
export async function prepareImageForUpload(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<PreparedFile> {
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.82;

  const original = async (): Promise<PreparedFile> => ({
    base64: bufferToBase64(await file.arrayBuffer()),
    mimeType: file.type || "application/octet-stream",
    fileName: file.name || "upload",
  });

  if (typeof document === "undefined" || !looksLikeImage(file)) return original();

  try {
    const src = await decode(file);
    const w = src.width || 0;
    const h = src.height || 0;
    if (!w || !h) return original();
    const { width, height } = fitWithin(w, h, maxDim);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original();
    ctx.drawImage(src, 0, 0, width, height);
    if (typeof (src as ImageBitmap).close === "function") (src as ImageBitmap).close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return original();

    const stem = (file.name || "receipt").replace(/\.[^.]+$/, "");
    return {
      base64: bufferToBase64(await blob.arrayBuffer()),
      mimeType: "image/jpeg",
      fileName: `${stem}.jpg`,
    };
  } catch {
    return original();
  }
}
