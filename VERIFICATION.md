# Verification — September 12, 2026

## Live provider test

Tested in the Codex browser against the production localhost server with the supplied server-side credentials. All content was generated live; no mocked video or branching scenes were used.

- Reactor token exchange returned HTTP 200 with a scoped JWT.
- Gemini image analysis returned HTTP 200 and valid structured scene data from the starter's dog image.
- The app connected to Visko, uploaded the prepared seed image, and started live generation.
- The browser decoded a **2560 × 1440** video track with `readyState = 4` and advancing video time.
- Automatic frame analysis produced a character question and successfully held the scene.
- Decision 1: “Take the path into the trees. Move carefully over the rocks and look for a small clearing.” The prompt was acknowledged, the interaction count became 1, and the live film resumed.
- The next frame analysis observed movement along a forest path and produced another character question.
- Decision 2: “Follow the edge of the trees and look for the clearing. Stop if you find an unusual object, and show it to me.” The prompt was acknowledged, the interaction count became 2, and the film resumed.
- The resulting live video showed a small wooden object. Frame analysis described it and produced a third question about investigating it.
- The session ID shown in diagnostics remained unchanged throughout the two decisions, resumes, and three contacts.
- The test session was explicitly ended after verification.

## Validation and interface

- Real Gemini decision conversion returned HTTP 200 with a grounded visual instruction, character acknowledgement, and current objective.
- Empty frame arrays on observation returned 422; malformed JSON returned 400; foreign-origin requests returned 403.
- Verified the image preview, character messages, free-form reply box, held-scene state, model diagnostics, and story journal in the browser.
- At a 494px browser width, document width was also 494px: no horizontal overflow. The live player, scene description and interaction panel stacked correctly.
- No browser errors or warnings were reported during the live test.
- Seven automated tests pass, covering repeated steering, rejected/missing acknowledgements, event envelopes, intention versus observation, bounded context, and identity/session preservation.
- TypeScript checking and production build pass.

## Environment notes

A separate existing starter owns port 3000. Lumen uses port 3017 and does not alter that application. The machine encountered a file-watcher limit in development mode; the tested production server runs without file watchers. Startup timing and future provider availability remain dependent on Visko/Gemini capacity and account limits.


## Codex account migration and proactive conversation update

- `codex login status` confirmed an existing ChatGPT sign-in. The account-backed vision smoke test successfully described the sample image.
- Tested the real Codex adapter against all three structured response schemas: initial image understanding, frame observation, and player-decision conversion. All parsed successfully.
- A real localhost `/api/story/decide` request returned HTTP 200 through Codex.
- A real localhost `/api/story/observe` request using a two-frame still-image fixture returned HTTP 200, a first-person question about the visible lake/rocks/trees, and three scene-specific reply options. It explicitly reported no observed motion. This verifies proactive contact during a quiet scene; the fixture is not evidence of live playback.
- Sixteen automated tests pass. Added checks for autonomous contact without user input, waiting for fresh frames, not interrupting pending conversations, option retention until prompt acknowledgement, question-history context, and rendering/disabled states for all choices.
- TypeScript checking and the production build pass with the Gemini SDK removed.
- The first new browser test streamed five Visko chunks, then the live connection disconnected before a character question arrived. The app preserved the journal and surfaced the disconnection; it did not silently replace the session.

- A second live attempt could not reach Reactor for its session token. Complete live click-through verification of the new options was therefore limited by the video provider connection; Codex API/schema tests and all automated checks succeeded.
