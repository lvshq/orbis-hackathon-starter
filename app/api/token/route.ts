import { NextResponse } from "next/server";
import { checkOrigin, InputError } from "@/lib/story-ai";
import { ORBIS_MODEL_NAME } from "@/lib/orbis";

// Original starter token exchange: one scoped, short-lived session credential.
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const apiKey = process.env.REACTOR_API_KEY;
    if (!apiKey)
      throw new InputError(
        "Set REACTOR_API_KEY in .env.local, then restart the server.",
        503,
      );
    const response = await fetch("https://api.reactor.inc/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Reactor-API-Key": apiKey,
      },
      body: JSON.stringify({
        expires_after: 3600,
        authorization_details: [
          {
            type: "session",
            resources: { models: { match: [ORBIS_MODEL_NAME] } },
            constraints: { max_sessions: 1 },
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const message =
        response.status === 429
          ? "Reactor is at its request limit. Wait a moment and try again."
          : response.status === 401 || response.status === 403
            ? "Reactor could not authorize this API key. Check its Visko model access."
            : `Reactor could not create a session token (${response.status}). Please retry.`;
      return NextResponse.json({ error: message }, { status: response.status });
    }
    const result = (await response.json()) as { jwt?: string };
    if (!result.jwt)
      throw new InputError(
        "Reactor returned no session token. Please retry.",
        502,
      );
    return NextResponse.json(
      { jwt: result.jwt },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof InputError
            ? e.message
            : "Could not reach Reactor. Check your connection and try again.",
      },
      { status: e instanceof InputError ? e.status : 502 },
    );
  }
}
