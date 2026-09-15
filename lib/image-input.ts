export async function prepareImage(
  file: File,
): Promise<{ file: File; preview: string }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Your image must be smaller than 10 MB.");
  const bitmap = await createImageBitmap(file);
  if (!bitmap.width || !bitmap.height) {
    bitmap.close();
    throw new Error("This image could not be decoded.");
  }
  // Preserve proportions and the whole subject when fitting the 16:9 model input.
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;
  const cover = Math.max(1280 / bitmap.width, 720 / bitmap.height);
  ctx.filter = "blur(28px) brightness(.55)";
  ctx.drawImage(
    bitmap,
    (1280 - bitmap.width * cover) / 2 - 30,
    (720 - bitmap.height * cover) / 2 - 30,
    bitmap.width * cover + 60,
    bitmap.height * cover + 60,
  );
  ctx.filter = "none";
  const contain = Math.min(1280 / bitmap.width, 720 / bitmap.height);
  ctx.drawImage(
    bitmap,
    (1280 - bitmap.width * contain) / 2,
    (720 - bitmap.height * contain) / 2,
    bitmap.width * contain,
    bitmap.height * contain,
  );
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Could not prepare this image.")),
      "image/jpeg",
      0.9,
    ),
  );
  return {
    file: new File([blob], "story-reference.jpg", { type: "image/jpeg" }),
    preview: URL.createObjectURL(blob),
  };
}
