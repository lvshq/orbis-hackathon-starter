import { unwrapOrbisMessage } from "./orbis";

export type CommandSender = (
  command: string,
  data: Record<string, unknown>,
) => Promise<unknown>;
export async function acknowledgedCommand(
  send: CommandSender,
  command: string,
  data: Record<string, unknown>,
  expected?: string,
) {
  const message = unwrapOrbisMessage(await send(command, data));
  if (message.type === "command_error")
    throw new Error(`${command}: ${message.reason || "rejected by Visko"}`);
  if (expected && message.type !== expected)
    throw new Error(
      `Visko did not confirm ${command}. Your session has not been restarted.`,
    );
  return message;
}
// This is intentionally the ONLY operation used to apply a player decision.
// Neither start, reset, set_image nor a connection belongs in this path.
export async function steerExistingSession(
  send: CommandSender,
  instruction: string,
) {
  if (!instruction.trim()) throw new Error("A story instruction is required.");
  return acknowledgedCommand(
    send,
    "set_prompt",
    { prompt: instruction.trim() },
    "prompt_accepted",
  );
}
