import { NextResponse } from "next/server";
import { z } from "zod";
import {
  contextSchema,
  frameSchema,
  observationSchema,
  replyOptionSchema,
} from "@/lib/story";
import {
  apiError,
  DIRECTOR_RULES,
  frameParts,
  generateStructured,
  readJson,
} from "@/lib/story-ai";
const input = z.object({
  context: contextSchema,
  frames: z.array(frameSchema).min(1).max(4),
  requestContact: z.boolean().default(false),
});
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { context, frames, requestContact } = input.parse(
      await readJson(request),
    );
    const result = await generateStructured(
      observationSchema.extend({
        decisionNeeded: z.literal(true),
        characterMessage: z.string().trim().min(1).max(600),
        replyOptions: z.array(replyOptionSchema).min(2).max(3),
      }),
      `${DIRECTOR_RULES} This is a proactive character check-in, not just a danger detector. Watch these consecutive recent frames. Start with a brief first-person reaction to something actually visible, then ask one specific open-ended question about what to do next. Even a quiet scene offers a choice: look closer, explore a visible direction, interact with a visible object, or follow the current objective. Always return decisionNeeded=true and 2–3 useful replyOptions. Each option has a short button label and a complete player decision that can directly steer the film. Options must be distinct, grounded in the supplied frames, and preserve the subject; they are suggestions, not pre-rendered branches. Never invent an object, off-screen event, sound, or danger to manufacture a question. Use recentCharacterMessages and playerDecisions to avoid asking an already answered question. Keep newEvents empty if nothing visibly changed, and only update unresolvedProblems using visual evidence.`,
      [
        { text: JSON.stringify({ context, requestContact }) },
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
