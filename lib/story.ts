import { z } from "zod";

const shortText = z.string().trim().min(1).max(1600);
const notes = z.array(shortText).max(8);
export const initialSceneSchema = z.object({
  title: z.string().min(1).max(80),
  subject: shortText,
  characterName: z.string().min(1).max(60),
  appearance: shortText,
  personality: z.string().max(300),
  environment: shortText,
  notableObjects: notes,
  possibleStoryHooks: notes.min(1),
  openingPrompt: z.string().min(20).max(2600),
});
export type InitialScene = z.infer<typeof initialSceneSchema>;
export const contextSchema = z.object({
  originalImageDescription: shortText,
  protagonist: z.object({
    identity: shortText,
    appearance: shortText,
    personality: z.string().max(300),
  }),
  currentScene: shortText,
  recentEvents: z.array(shortText).max(12),
  playerDecisions: z.array(shortText).max(12),
  currentObjective: z.string().max(1600),
  unresolvedProblems: notes,
  interactionCount: z.number().int().min(0).max(10000),
  lastQuestion: z.string().max(600),
  recentCharacterMessages: z.array(z.string().max(600)).max(6).default([]),
});
export const replyOptionSchema = z.object({
  label: z.string().trim().min(1).max(65),
  decision: z.string().trim().min(1).max(350),
});
export type ReplyOption = z.infer<typeof replyOptionSchema>;
export const observationSchema = z.object({
  currentScene: shortText,
  newEvents: z.array(shortText).max(3),
  currentObjective: z.string().max(1000),
  unresolvedProblems: notes,
  decisionNeeded: z.boolean(),
  characterMessage: z.string().max(600),
  reason: z.string().max(500),
  replyOptions: z.array(replyOptionSchema).max(3),
});
export type Observation = z.infer<typeof observationSchema>;
export const decisionSchema = z.object({
  instruction: z.string().min(20).max(2600),
  characterReply: z.string().min(1).max(500),
  currentObjective: shortText,
});
export type Decision = z.infer<typeof decisionSchema>;
export const frameSchema = z.object({
  data: z
    .string()
    .min(100)
    .max(700000)
    .regex(/^[A-Za-z0-9+/=]+$/),
  capturedAt: z.number().finite(),
  videoTime: z.number().finite().min(0),
});
export type Frame = z.infer<typeof frameSchema>;
export type StoryStatus =
  | "idle"
  | "initializing"
  | "generating"
  | "decision_pending"
  | "applying_decision"
  | "paused"
  | "ended"
  | "error";
export type JournalEntry = {
  id: string;
  kind: "scene" | "character" | "player" | "system";
  text: string;
  at: number;
};
export interface StoryState extends z.infer<typeof contextSchema> {
  sessionId: string | null;
  title: string;
  characterName: string;
  status: StoryStatus;
  journal: JournalEntry[];
  activePrompt: string;
  startedAt: number | null;
  replyOptions: ReplyOption[];
  lastObservation: {
    frameCount: number;
    videoTime: number;
    capturedAt: number;
  } | null;
}
export function emptyStory(): StoryState {
  return {
    sessionId: null,
    title: "An unwritten adventure",
    characterName: "Your character",
    originalImageDescription: "",
    protagonist: { identity: "", appearance: "", personality: "" },
    currentScene: "",
    recentEvents: [],
    playerDecisions: [],
    currentObjective: "",
    unresolvedProblems: [],
    interactionCount: 0,
    lastQuestion: "",
    recentCharacterMessages: [],
    replyOptions: [],
    lastObservation: null,
    status: "idle",
    journal: [],
    activePrompt: "",
    startedAt: null,
  };
}
export function storyContext(story: StoryState) {
  return contextSchema.parse({
    ...story,
    recentEvents: story.recentEvents.slice(-12),
    playerDecisions: story.playerDecisions.slice(-12),
    recentCharacterMessages: story.journal
      .filter((e) => e.kind === "character")
      .slice(-6)
      .map((e) => e.text.slice(0, 600)),
  });
}
export function initializeStory(scene: InitialScene): StoryState {
  return {
    ...emptyStory(),
    title: scene.title,
    characterName: scene.characterName,
    originalImageDescription:
      `${scene.subject}. ${scene.appearance}. ${scene.environment}`.slice(
        0,
        1600,
      ),
    protagonist: {
      identity: scene.subject,
      appearance: scene.appearance,
      personality: scene.personality,
    },
    currentScene: scene.environment,
    currentObjective: scene.possibleStoryHooks[0],
    activePrompt: scene.openingPrompt,
  };
}
export function observeStory(
  story: StoryState,
  observation: Observation,
): StoryState {
  return {
    ...story,
    currentScene: observation.currentScene,
    recentEvents: [...story.recentEvents, ...observation.newEvents].slice(-12),
    currentObjective: observation.currentObjective,
    unresolvedProblems: observation.unresolvedProblems,
    replyOptions: observation.decisionNeeded ? observation.replyOptions : [],
  };
}
// Commit intent only after Orbis acknowledges set_prompt; never describe it as an observed event.
export function applyDecision(
  story: StoryState,
  text: string,
  result: Decision,
): StoryState {
  return {
    ...story,
    playerDecisions: [...story.playerDecisions, text].slice(-12),
    interactionCount: story.interactionCount + 1,
    currentObjective: result.currentObjective,
    activePrompt: result.instruction,
    lastQuestion: "",
    replyOptions: [],
    status: "generating",
  };
}
