import { NextResponse } from "next/server";
import { z } from "zod";
import { contextSchema, decisionSchema, frameSchema } from "@/lib/story";
import {
  apiError,
  DIRECTOR_RULES,
  frameParts,
  generateStructured,
  readJson,
} from "@/lib/story-ai";
const input = z.object({
  context: contextSchema,
  decision: z.string().trim().min(1).max(1600),
  frames: z.array(frameSchema).max(4),
});
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { context, decision, frames } = input.parse(await readJson(request));
    const result = await generateStructured(
      decisionSchema,
      `${DIRECTOR_RULES} Translate the player's free-form reply into the next visual instruction for an ALREADY RUNNING Visko session. Restate the same protagonist and distinctive appearance, ground the action in the latest visible scene, and faithfully express the player's intent as a feasible visible next action. Show the beginning of its consequences without resolving the entire adventure. Do not create a new session or starting image. characterReply acknowledges an intention, never falsely says the action already happened. currentObjective describes what the character will attempt.`,
      [
        { text: JSON.stringify({ context, playerDecision: decision }) },
        ...frameParts(frames),
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
