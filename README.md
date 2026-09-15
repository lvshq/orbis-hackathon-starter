# Lumen

A photo becomes a continuous, interactive live movie. Characters reach out when a recent video scene presents a decision, and the player's free-form reply steers the **same Visko Orbis generation**.

## Run locally

Requires Node.js 20.9+, Reactor access to `reactor/visko-orbis-stable`, and the installed Codex CLI signed in with your ChatGPT account (`codex login status`). No Gemini or OpenAI Platform API key is needed.

```sh
npm ci
cp .env.example .env.local
# Fill the Reactor key in .env.local.
codex login
npm run build
npm start
```

Open **http://localhost:3017**. Port 3017 avoids the pre-existing starter on port 3000. The server binds to loopback only. `npm run dev` runs the development server on the same port; stop the production server first. Run production mode if your machine reaches its file-watcher limit. Restart the server after changing environment variables. When editing, stop the server before rebuilding, then start it again.

The Reactor key is configured in the local, git-ignored `.env.local`. The story director uses the installed Codex CLI through its supported non-interactive interface and existing ChatGPT sign-in. This consumes your **Codex account allowance**, not Gemini quota or a separate OpenAI Platform API key. Account limits still apply.

`CODEX_BIN` optionally selects the installed executable; on this Mac it points to the bundled CLI. `CODEX_STORY_MODEL` is optional; when omitted, Codex uses its default model with low reasoning effort. Keep the app local. The server must be allowed to start Codex and access its normal account/runtime storage. Credentials are managed by Codex; Lumen never reads, copies, or serves the login tokens.

Images and recent frames go to OpenAI through Codex; the starting image and live instructions go to Reactor. The Codex child runs in an isolated temporary working directory with ephemeral sessions, read-only mode, shell/app/multi-agent tools disabled, and no user configuration or project instruction files. The child inherits the login location but none of Lumen's API keys. Image and schema files are private temporary files deleted after completion, timeout, or cancellation. Requests are limited to one concurrent director across local tabs, with a 90-second timeout.

## Using Lumen

1. Upload JPG, PNG, or WebP (up to 10 MB), or try the starter's included dog image. The example uses the exact same pipeline as every upload.
2. Pick a starting atmosphere and choose **Begin your story**. Codex extracts the subject, appearance, environment, objects, hooks, and a visual opening instruction. This analysis is reused when retrying connection startup.
3. Visko streams the live movie. Initial model warmup can take several minutes; the first upscaler chunk may contain no video. Sound starts muted; enable it with the sound control.
4. Codex periodically inspects up to four recent playback frames. The character proactively reacts to the visible scene and asks what to do next, including during quiet exploration. Each question includes two or three scene-specific suggested replies. You can also **Check in** or send a direction anytime.
5. Click a suggested reply to send it directly, or write a custom response. Both use the exact same Visko steering path. With **Hold scene while I reply** enabled, the scene pauses before analysis so the question matches the held picture, and resumes once your new prompt is accepted. Turn it off to keep the film rolling through character conversations.
6. Use **Pause film**, **Resume film**, or **End story** as needed. **Story journal** separates observed events, character messages, and player directions. Export the JSON journal under **Behind the story**.

## Architecture and starter reuse

Foundation: [Visko Orbis hackathon starter](https://github.com/Visko-Platform/orbis-hackathon-starter), commit `6de7ad733e90967f25979afcfca55b73a71f064a`.

The original Reactor SDK, token exchange, `ReactorProvider`, model/tracks configuration, `ReactorView` player, media transport, upload flow, and `useOrbisSession` integration remain the foundation. The old demo components remain for reference. The legacy Nano Banana image-edit endpoint is disabled (HTTP 410); the optional prompt-grounding endpoint also uses Codex. The Gemini SDK has been removed. The session hook is extended for SDK v3 correlated acknowledgements and event-driven generation state.

| File                             | Responsibility                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `app/api/token/route.ts`         | Server-side scoped Reactor authentication                                                             |
| `hooks/use-orbis-session.ts`     | Existing Visko transport, session ID, image upload, generation events, prompt steering, pause/resume  |
| `components/orbis-player.tsx`    | Original SDK video/audio playback                                                                     |
| `lib/orbis-commands.ts`          | Acknowledgement validation; decision path sends only `set_prompt`                                     |
| `hooks/use-story.ts`             | Explicit story state, bounded frame buffer, serialized operations, decision loop, journal persistence |
| `lib/story.ts`                   | State types, runtime schemas, context projection and state transitions                                |
| `app/api/story/analyze/route.ts` | Structured image-to-story understanding                                                               |
| `app/api/story/observe/route.ts` | Recent-frame understanding and meaningful contact detection                                           |
| `app/api/story/decide/route.ts`  | Player intent to continuity-preserving visual instruction                                             |
| `lib/image-input.ts`             | Proportion-preserving 16:9 input preparation, without cropping the subject                            |
| `components/story-studio.tsx`    | Responsive studio interface                                                                           |

### Continuity invariant

The initialization path is `connect → uploadFile → set_image → set_prompt → start`. A decision is **only** `set_prompt`, followed by `resume` if the model was paused. There is no `reset`, `start`, `set_image`, token mint, or reconnect in the decision path. The current SDK session ID is checked before steering. Player decisions are committed only after `prompt_accepted`; if resume fails, the accepted intent is retained and a separate Resume control is offered without resending it.

### Frame-driven story loop

During actual playback, sample one JPEG every two seconds, at 768px width, retaining only the last four frames. Stalled playback does not produce duplicate captures. The first proactive check-in becomes eligible about ten seconds after actual frames arrive, with at least two fresh captures. After each answered question, allow twenty-two seconds for the action to develop before the next conversation. Model response time adds to these intervals. Automatic contact is enabled by default and has a visible toggle beside the composer.

Each check-in describes a visible detail, asks an open-ended question, and offers two or three dynamic options with complete player instructions. These are suggestions, not fixed story branches. The last six character messages and recent player decisions help avoid repeating answered questions. The UI shows how many frames grounded the question and their latest playback timestamp. Manual check-ins also require recent video frames; the starting photo is never substituted for live video. No second question interrupts a pending answer. With scene holding enabled, Visko is paused before analysis and resumed if the director fails, so a failed analysis does not silently strand the film.

Only one AI/command operation runs at a time. Late results are discarded when the story ends, and requests are aborted. An observation failure backs off for sixty seconds while leaving the session intact. Held scenes can reuse their last frames when the player takes time to reply; rolling scenes only use fresh captures. Codex sees a bounded semantic context, not the complete transcript, session JWT, or session ID.

### State and persistence

`StoryState` retains session ID, original description, protagonist, current scene, recent observed events, decisions, objective, unresolved problems, interaction count, active prompt, status, and journal. Statuses include idle, initializing, generating, decision_pending, applying_decision, paused, ended, and error.

The last 160 journal entries persist in local storage; the last 12 decisions and observed events are supplied to the director, with the full interaction count retained. Intent is never mislabeled as a visually observed event. No image, frame, or JWT is persisted. **Refreshing or closing the page does not resume a Visko session.** Saved journals are explicitly presented as ended sessions. The app does not silently create a replacement session after disconnection or `generation_complete`.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Automated tests cover repeated steering without restarts, command rejection/missing acknowledgement, SDK message envelopes, identity and session preservation, separation of intention from observation, and bounded model context. Browser verification and live API smoke checks are described in `VERIFICATION.md`.

## Prototype limits

This app provides character text messages and Visko's native generated audio, not synthesized character phone calls. Frame-based scene understanding is approximate, and exact visual adherence depends on Visko. Warmup time, connection lifetime, model capacity, and quotas depend on the providers. There is no fabricated video fallback, reconnect masquerading as continuity, or promise of session recovery after a page reload. Journals are stored on this browser, not in an account database. This configuration is intended for local use; a public deployment would need user authentication and per-user rate limits.

Provider references: [Visko Orbis Stable](https://www.reactor.inc/models/visko-orbis-stable/api), [Codex authentication](https://learn.chatgpt.com/docs/auth), [Codex non-interactive structured output](https://learn.chatgpt.com/docs/non-interactive-mode).
