import { NextResponse } from "next/server";
import { initialSceneSchema } from "@/lib/story";
import {
  apiError,
  checkOrigin,
  DIRECTOR_RULES,
  generateStructured,
  InputError,
} from "@/lib/story-ai";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
      throw new InputError("Choose an image smaller than 10 MB.", 413);
    const form = await request.formData();
    const image = form.get("image");
    if (
      !(image instanceof File) ||
      !["image/jpeg", "image/png", "image/webp"].includes(image.type)
    )
      throw new InputError("Upload a JPG, PNG, or WebP image.");
    if (!image.size || image.size > 10 * 1024 * 1024)
      throw new InputError("Choose an image smaller than 10 MB.", 413);
    const mood = String(form.get("mood") || "Wonder").slice(0, 100);
    const scene = await generateStructured(
      initialSceneSchema,
      `${DIRECTOR_RULES} Analyze the uploaded image as a story seed. Describe the central subject precisely, environment, distinctive visual features, and notable objects. Invent a short fictional characterName and a beautiful 2–5 word story title. PossibleStoryHooks must be 2–3 modest, open-ended opportunities supported by this environment, not events claimed to have already happened. OpeningPrompt should bring the exact uploaded scene gently to life, introduce one small intriguing situation, and leave room for the player. Personality is a fictional creative choice. Preserve the image's photographic or illustrative style.`,
      [
        { text: `The player chose this story atmosphere: ${mood}.` },
        {
          inlineData: {
            mimeType: image.type,
            data: Buffer.from(await image.arrayBuffer()).toString("base64"),
          },
        },
      ],
      request.signal,
    );
    return NextResponse.json(scene, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
