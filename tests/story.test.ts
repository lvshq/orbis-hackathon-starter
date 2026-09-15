import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acknowledgedCommand,
  steerExistingSession,
} from "../lib/orbis-commands";
import {
  applyDecision,
  initialSceneSchema,
  initializeStory,
  observeStory,
  storyContext,
  type StoryState,
} from "../lib/story";
const seed = initialSceneSchema.parse({
  title: "The Paper Garden",
  subject: "A small paper fox",
  characterName: "Fold",
  appearance: "A folded orange paper fox with a white-tipped tail",
  personality: "Curious",
  environment: "A desk beside a rain-streaked window",
  notableObjects: ["A pencil", "A closed notebook"],
  possibleStoryHooks: ["Explore the notebook"],
  openingPrompt:
    "The same small orange paper fox takes a careful step toward the closed notebook, in one continuous shot.",
});
const direction = {
  instruction:
    "The same orange paper fox nudges the blue notebook open with its folded nose. Keep the desk, rainy window and continuous shot.",
  characterReply: "I’ll take a careful look inside.",
  currentObjective: "Open the notebook",
};
test("repeated player decisions steer one session without start, reset, image upload, or reconnect", async () => {
  const calls: { command: string; data: Record<string, unknown> }[] = [];
  let state: StoryState = {
    ...initializeStory(seed),
    sessionId: "existing-live-session",
    status: "generating" as const,
  };
  for (const text of [
    "Open the notebook",
    "Follow the pencil marks",
    "Leave the desk and approach the window",
  ]) {
    await steerExistingSession(async (command, data) => {
      calls.push({ command, data });
      return { type: "prompt_accepted" };
    }, direction.instruction);
    state = { ...applyDecision(state, text, direction), status: "generating" };
  }
  assert.deepEqual(
    calls.map((c) => c.command),
    ["set_prompt", "set_prompt", "set_prompt"],
  );
  assert.equal(state.sessionId, "existing-live-session");
  assert.equal(state.interactionCount, 3);
  assert.equal(state.protagonist.appearance, seed.appearance);
});
test("a rejected instruction does not acknowledge a player decision", async () => {
  const state = initializeStory(seed);
  await assert.rejects(
    steerExistingSession(
      async () => ({ type: "command_error", data: { reason: "busy" } }),
      direction.instruction,
    ),
    /busy/,
  );
  assert.equal(state.interactionCount, 0);
});
test("missing and unexpected SDK acknowledgements fail closed", async () => {
  await assert.rejects(
    steerExistingSession(async () => undefined, direction.instruction),
    /did not confirm/,
  );
  await assert.rejects(
    steerExistingSession(
      async () => ({ type: "state" }),
      direction.instruction,
    ),
    /did not confirm/,
  );
  await assert.rejects(
    steerExistingSession(async () => ({ type: "prompt_accepted" }), "  "),
    /required/,
  );
});
test("SDK v3 envelopes are unwrapped and pause/resume use acknowledged replies", async () => {
  const message = await acknowledgedCommand(
    async () => ({ type: "generation_paused", data: { paused: true } }),
    "pause",
    {},
    "generation_paused",
  );
  assert.equal(message.paused, true);
});
test("directions are intentions; observations alone change the current scene", () => {
  const before = initializeStory(seed);
  const applied = applyDecision(before, "Open it", direction);
  assert.equal(applied.currentScene, before.currentScene);
  assert.deepEqual(applied.recentEvents, []);
  assert.equal(applied.currentObjective, "Open the notebook");
  const observed = observeStory(applied, {
    currentScene: "The paper fox stands on an open notebook",
    newEvents: ["The notebook opened"],
    currentObjective: "Explore the page",
    unresolvedProblems: ["A folded corner blocks the way"],
    decisionNeeded: true,
    characterMessage: "How do I climb this corner?",
    reason: "Visible obstacle",
    replyOptions: [
      { label: "Climb slowly", decision: "Carefully climb the folded corner." },
      { label: "Walk around", decision: "Walk around the folded corner." },
    ],
  });
  assert.equal(
    observed.currentScene,
    "The paper fox stands on an open notebook",
  );
  assert.deepEqual(observed.recentEvents, ["The notebook opened"]);
  assert.equal(observed.protagonist.identity, seed.subject);
});
test("context sent to the director excludes JWTs, images, session IDs and the full journal", () => {
  const state = {
    ...initializeStory(seed),
    sessionId: "secret-session",
    journal: [{ id: "1", kind: "system" as const, text: "Test", at: 0 }],
  };
  const context = storyContext(state);
  assert.equal("sessionId" in context, false);
  assert.equal("journal" in context, false);
  assert.equal("activePrompt" in context, false);
});
test("long stories retain bounded model context and preserve the interaction total", () => {
  let state = initializeStory(seed);
  for (let n = 0; n < 35; n++)
    state = applyDecision(state, `Decision ${n}`, direction);
  assert.equal(state.playerDecisions.length, 12);
  assert.equal(state.interactionCount, 35);
  assert.equal(state.playerDecisions[0], "Decision 23");
});
