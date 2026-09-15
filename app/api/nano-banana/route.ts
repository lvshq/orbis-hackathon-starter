import { NextResponse } from "next/server";
// This legacy starter demo is not used by Lumen's upload flow.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "The legacy Gemini image editor is disabled. Upload your original image in Lumen to start a Codex-directed story.",
    },
    { status: 410 },
  );
}
