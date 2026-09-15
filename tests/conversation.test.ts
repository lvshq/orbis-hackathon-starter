import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReplyChoices } from "../components/reply-choices";
import { shouldContactCharacter } from "../lib/story-loop";
import {
  applyDecision,
  emptyStory,
  observeStory,
  storyContext,
  type Observation,
} from "../lib/story";
const options = [
  {
    label: "Look under the leaf",
    decision: "Carefully lift the visible leaf and look underneath.",
  },
  {
    label: "Follow the path",
    decision: "Follow the narrow path past the leaf.",
  },
  {
    label: "Watch quietly",
    decision: "Stay still and watch the leaf for a moment.",
  },
];
const scene: Observation = {
  currentScene: "A paper fox beside a leaf on a desk.",
  newEvents: [],
  currentObjective: "Inspect the leaf",
  unresolvedProblems: [],
  decisionNeeded: true,
  characterMessage: "This leaf is hiding part of the desk. What should I try?",
  reason: "Proactive exploration of the visible scene",
  replyOptions: options,
};
test("fresh live frames trigger proactive contact without any player input", () => {
  assert.equal(
    shouldContactCharacter({
      enabled: true,
      status: "generating",
      busy: false,
      running: true,
      paused: false,
      now: 12000,
      firstFrameAt: 1000,
      nextContactAt: 11000,
      freshFrameCount: 4,
    }),
    true,
  );
});
test("automatic contact waits for frames and never interrupts a pending or busy conversation", () => {
  const input = {
    enabled: true,
    status: "generating" as const,
    busy: false,
    running: true,
    paused: false,
    now: 12000,
    firstFrameAt: 1000,
    nextContactAt: 11000,
    freshFrameCount: 4,
  };
  for (const change of [
    { freshFrameCount: 0 },
    { busy: true },
    { paused: true },
    { enabled: false },
    { status: "decision_pending" as const },
    { nextContactAt: 13000 },
  ])
    assert.equal(shouldContactCharacter({ ...input, ...change }), false);
});
test("scene-specific choices persist until the selected direction is acknowledged", () => {
  const before = {
    ...emptyStory(),
    sessionId: "same-session",
    protagonist: {
      identity: "Paper fox",
      appearance: "Orange folded paper",
      personality: "Curious",
    },
    originalImageDescription: "Paper fox on desk",
  };
  const pending = {
    ...observeStory(before, scene),
    lastQuestion: scene.characterMessage,
  };
  assert.deepEqual(pending.replyOptions, options);
  const next = applyDecision(pending, options[1].decision, {
    instruction: "The same paper fox walks along the path around the leaf.",
    characterReply: "I will follow the path.",
    currentObjective: "Follow the path",
  });
  assert.equal(next.sessionId, "same-session");
  assert.equal(next.playerDecisions[0], options[1].decision);
  assert.deepEqual(next.replyOptions, []);
  assert.equal(next.lastQuestion, "");
});
test("recent character messages reach the director so answered questions are not repeated", () => {
  const s = {
    ...emptyStory(),
    originalImageDescription: "Paper fox",
    protagonist: {
      identity: "Fox",
      appearance: "Paper",
      personality: "Curious",
    },
    currentScene: "Desk",
    journal: [
      {
        id: "a",
        kind: "character" as const,
        text: "Look under this leaf?",
        at: 0,
      },
    ],
  };
  assert.deepEqual(storyContext(s).recentCharacterMessages, [
    "Look under this leaf?",
  ]);
});
test("all dynamic options render as actionable buttons and disable during a send", () => {
  const markup = renderToStaticMarkup(
    createElement(ReplyChoices, {
      options,
      disabled: false,
      onChoose: () => {},
    }),
  );
  assert.equal((markup.match(/<button/g) || []).length, 3);
  assert.ok(markup.includes("Choose: Follow the path"));
  assert.ok(markup.includes(options[1].decision));
  assert.ok(markup.includes("your own words"));
  const disabled = renderToStaticMarkup(
    createElement(ReplyChoices, {
      options,
      disabled: true,
      onChoose: () => {},
    }),
  );
  assert.equal((disabled.match(/disabled=""/g) || []).length, 3);
});
