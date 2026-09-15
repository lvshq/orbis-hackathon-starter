import { NextResponse } from "next/server";
import { z } from "zod";
import { ORBIS_PROMPT_SYSTEM_INSTRUCTION } from "@/lib/orbis-prompt";
import {
  apiError,
  checkOrigin,
  generateStructured,
  InputError,
} from "@/lib/story-ai";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const form = await request.formData();
    const image = form.get("image");
    const prompt = form.get("prompt");
    if (
      !(image instanceof File) ||
      !["image/jpeg", "image/png", "image/webp"].includes(image.type)
    )
      throw new InputError("A JPG, PNG or WebP reference image is required.");
    if (image.size > 10 * 1024 * 1024)
      throw new InputError("The image must be 10 MB or smaller.", 413);
    if (typeof prompt !== "string" || !prompt.trim())
      throw new InputError("A motion prompt is required.");
    const result = await generateStructured(
      z.object({ prompt: z.string().min(1).max(2600) }),
      ORBIS_PROMPT_SYSTEM_INSTRUCTION.replace(
        "Return only one concise plain-text prompt.",
        "Return the concise prompt in the required JSON object.",
      ).replace(
        "Do not return HTML, XML-style tags, Markdown, JSON, headings, labels, analysis, or commentary.",
        "Do not add commentary outside the JSON response.",
      ),
      [
        { text: prompt.slice(0, 2600) },
        {
          inlineData: {
            mimeType: image.type,
            data: Buffer.from(await image.arrayBuffer()).toString("base64"),
          },
        },
      ],
      request.signal,
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
