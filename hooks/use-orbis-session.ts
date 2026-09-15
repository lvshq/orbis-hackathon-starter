"use client";

import { useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import { useEffect, useRef, useState } from "react";
import { type OrbisMessage, unwrapOrbisMessage } from "@/lib/orbis";
import {
  acknowledgedCommand,
  steerExistingSession,
} from "@/lib/orbis-commands";

// Extended from the hackathon starter: same provider, transport, upload and
// command sequence. SDK v3 correlated acknowledgements are consumed directly.
export function useOrbisSession(onDisconnected: () => void) {
  const {
    status,
    sessionId,
    lastError,
    connect,
    disconnect,
    sendCommand,
    uploadFile,
  } = useReactor((s) => ({
    status: s.status,
    sessionId: s.sessionId,
    lastError: s.lastError,
    connect: s.connect,
    disconnect: s.disconnect,
    sendCommand: s.sendCommand,
    uploadFile: s.uploadFile,
  }));
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [resolution, setResolution] = useState("");
  const [availableResolutions, setAvailableResolutions] = useState<string[]>(
    [],
  );
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nanoBusy, setNanoBusy] = useState(false);
  const [runStarted, setRunStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imageStatus, setImageStatus] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [chunk, setChunk] = useState(0);
  const [completed, setCompleted] = useState(false);
  const previousStatus = useRef(status);
  const expectsImage = useRef(false);
  const starting = useRef(false);
  const startWaiter = useRef<{
    resolve: () => void;
    reject: (e: Error) => void;
  } | null>(null);
  useEffect(() => {
    if (
      status === "disconnected" &&
      previousStatus.current !== "disconnected"
    ) {
      onDisconnected();
      setRunStarted(false);
      setPaused(false);
      startWaiter.current?.reject(new Error("The live session disconnected."));
    }
    previousStatus.current = status;
  }, [status, onDisconnected]);
  useEffect(
    () => () => {
      startWaiter.current?.reject(new Error("Session closed."));
    },
    [],
  );
  function receive(message: OrbisMessage) {
    if (message.type)
      setEvents((current) => [message.type!, ...current].slice(0, 12));
    if (typeof message.session_chunk === "number")
      setChunk(message.session_chunk);
    else if (message.type === "chunk_complete")
      setChunk((current) => current + 1);
    if (message.type === "state") {
      if (typeof message.started === "boolean") setRunStarted(message.started);
      if (typeof message.paused === "boolean") setPaused(message.paused);
      if (message.started) startWaiter.current?.resolve();
      if (message.available_resolutions?.length)
        setAvailableResolutions(message.available_resolutions.map(String));
    }
    if (message.type === "generation_started") {
      setRunStarted(true);
      setPaused(false);
      setCompleted(false);
      if (expectsImage.current && message.image_conditioned === false) {
        setError("Visko started without image conditioning.");
        startWaiter.current?.reject(
          new Error("Visko did not preserve the reference image."),
        );
      } else startWaiter.current?.resolve();
    }
    if (message.type === "generation_paused") setPaused(true);
    if (message.type === "generation_resumed") setPaused(false);
    if (
      message.type === "generation_complete" ||
      message.type === "generation_reset"
    ) {
      setRunStarted(false);
      setPaused(false);
      setCompleted(message.type === "generation_complete");
    }
    if (message.type === "command_error") {
      const e = new Error(
        `${message.command || "Visko"}: ${message.reason || "command rejected"}`,
      );
      setError(e.message);
      startWaiter.current?.reject(e);
    }
  }
  useReactorMessage((raw) => receive(unwrapOrbisMessage(raw)));
  async function command(
    name: string,
    data: Record<string, unknown> = {},
    expected?: string,
  ) {
    const reply = await acknowledgedCommand(sendCommand, name, data, expected);
    receive(reply);
    return reply;
  }
  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function startGeneration(startImage: File | null, runPrompt: string) {
    if (starting.current || runStarted)
      throw new Error("This session already has a story in progress.");
    if (!runPrompt.trim())
      throw new Error("A starting instruction is required.");
    starting.current = true;
    setError("");
    expectsImage.current = Boolean(startImage);
    try {
      if (startImage) {
        const uploaded = await uploadFile(startImage, {
          name: startImage.name,
        });
        await command("set_image", { image: uploaded }, "image_accepted");
        setImageStatus("Reference image accepted");
      }
      if (resolution && availableResolutions.includes(resolution))
        await command("set_resolution", { resolution }, "resolution_accepted");
      await command(
        "set_prompt",
        { prompt: runPrompt.trim() },
        "prompt_accepted",
      );
      let timer: ReturnType<typeof setTimeout> | undefined;
      const started = new Promise<void>((resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Visko has not confirmed generation yet. The session is retained; wait for its status before retrying.",
              ),
            ),
          45000,
        );
        startWaiter.current = { resolve, reject };
      });
      // Register before send: broadcasts can arrive before the command resolves.
      try {
        await Promise.all([command("start"), started]);
      } finally {
        clearTimeout(timer);
        startWaiter.current = null;
      }
    } finally {
      starting.current = false;
    }
  }
  async function steerPrompt(value: string) {
    const reply = await steerExistingSession(sendCommand, value);
    receive(reply);
    setPrompt(value);
  }
  async function pauseGeneration() {
    await command("pause", {}, "generation_paused");
  }
  async function resumeGeneration() {
    await command("resume", {}, "generation_resumed");
  }
  async function disconnectSession() {
    setRunStarted(false);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await disconnect();
  }
  return {
    status,
    sessionId: sessionId ?? null,
    connected: status === "ready",
    controlsBusy: busy || nanoBusy,
    runStarted,
    paused,
    muted,
    prompt,
    image,
    imageStatus,
    resolution,
    availableResolutions,
    error: error || lastError?.message || "",
    events,
    chunk,
    completed,
    connectStrict: async () => {
      setError("");
      await connect();
    },
    startGeneration,
    steerPrompt,
    pauseGeneration,
    resumeGeneration,
    clearError: () => setError(""),
    connectSession: () => runAction(() => connect()),
    disconnectSession,
    toggleMuted: () => setMuted((x) => !x),
    setPrompt,
    selectImage: (file: File | null) => {
      setImage(file);
      setImageStatus("");
    },
    setResolution,
    startRun: () => runAction(() => startGeneration(image, prompt)),
    startFromNanoOutput: async (file: File, text: string) => {
      setImage(file);
      setPrompt(text);
      await runAction(() => startGeneration(file, text));
    },
    setNanoBusy,
    steer: () => runAction(() => steerPrompt(prompt)),
    pause: () => runAction(pauseGeneration),
    resume: () => runAction(resumeGeneration),
    reset: () => runAction(() => command("reset")),
  };
}
export type OrbisSession = ReturnType<typeof useOrbisSession>;
