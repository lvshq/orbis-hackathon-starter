import type { StoryStatus } from "./story";
export function shouldContactCharacter(input: {
  enabled: boolean;
  status: StoryStatus;
  busy: boolean;
  running: boolean;
  paused: boolean;
  now: number;
  firstFrameAt: number;
  nextContactAt: number;
  freshFrameCount: number;
}) {
  return (
    input.enabled &&
    input.status === "generating" &&
    !input.busy &&
    input.running &&
    !input.paused &&
    input.firstFrameAt > 0 &&
    input.now - input.firstFrameAt >= 10000 &&
    input.now >= input.nextContactAt &&
    input.freshFrameCount >= 2
  );
}
