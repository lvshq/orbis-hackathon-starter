"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOrbisSession } from "./use-orbis-session";
import { prepareImage } from "@/lib/image-input";
import { shouldContactCharacter } from "@/lib/story-loop";
import {
  applyDecision,
  emptyStory,
  initializeStory,
  observeStory,
  storyContext,
  type Decision,
  type Frame,
  type InitialScene,
  type JournalEntry,
  type Observation,
  type StoryState,
} from "@/lib/story";

const STORAGE_KEY = "lumen-story-journal-v1";
export function useStory(clearJwt: () => void) {
  const [story, setStory] = useState<StoryState>(emptyStory);
  const state = useRef(story);
  const [preview, setPreview] = useState("");
  const previewRef = useRef("");
  const file = useRef<File | null>(null);
  const [scene, setScene] = useState<InitialScene | null>(null);
  const sceneRef = useRef<InitialScene | null>(null);
  const [mood, setMood] = useState("Wonder");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phase, setPhase] = useState("");
  const [observing, setObserving] = useState(false);
  const [hasFrames, setHasFrames] = useState(false);
  const [holdScene, setHoldScene] = useState(true);
  const [autoContact, setAutoContact] = useState(true);
  const [archive, setArchive] = useState<StoryState | null>(null);
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const frames = useRef<Frame[]>([]);
  const lastVideoTime = useRef(-1);
  const nextObservation = useRef(0);
  const operation = useRef(false);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const firstFrameAt = useRef(0);
  function update(fn: (s: StoryState) => StoryState) {
    const next = fn(state.current);
    state.current = next;
    setStory(next);
    return next;
  }
  function journal(kind: JournalEntry["kind"], text: string) {
    if (!text.trim()) return;
    update((s) => ({
      ...s,
      journal: [
        ...s.journal,
        { id: crypto.randomUUID(), kind, text, at: Date.now() },
      ].slice(-160),
    }));
  }
  const disconnected = useCallback(() => {
    clearJwt();
    if (
      [
        "generating",
        "decision_pending",
        "applying_decision",
        "paused",
      ].includes(state.current.status)
    ) {
      epoch.current++;
      controller.current?.abort();
      operation.current = false;
      setBusy(false);
      setObserving(false);
      const next = { ...state.current, status: "error" as const };
      state.current = next;
      setStory(next);
      setError(
        "The live connection ended. Your journal is saved. End this story before starting a new session.",
      );
    }
    frames.current = [];
    setHasFrames(false);
  }, [clearJwt]);
  const session = useOrbisSession(disconnected);
  const live = useRef(session);
  live.current = session;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.title && Array.isArray(saved.journal)) setArchive(saved);
    } catch {
      /* Storage is optional. */
    }
  }, []);
  useEffect(() => {
    if (story.startedAt)
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...story, status: "ended" }),
        );
      } catch {
        /* Private browsing/storage quota must not interrupt a film. */
      }
  }, [story]);
  useEffect(() => {
    if (
      session.sessionId &&
      story.sessionId !== session.sessionId &&
      story.status !== "idle"
    )
      update((s) => ({ ...s, sessionId: session.sessionId }));
  }, [session.sessionId, story.sessionId, story.status]);
  useEffect(() => {
    if (
      session.completed &&
      state.current.startedAt &&
      state.current.status !== "ended"
    ) {
      epoch.current++;
      controller.current?.abort();
      operation.current = false;
      setBusy(false);
      setObserving(false);
      update((s) => ({ ...s, status: "ended" }));
      journal(
        "system",
        "Visko finished this live generation. Your story journal is saved.",
      );
    }
  }, [session.completed]);
  useEffect(() => {
    if (
      session.runStarted &&
      state.current.status === "error" &&
      session.connected
    ) {
      update((s) => ({
        ...s,
        status: session.paused ? "paused" : "generating",
        startedAt: s.startedAt || Date.now(),
      }));
      setError("");
    }
  }, [session.runStarted, session.connected, session.paused]);
  useEffect(
    () => () => {
      epoch.current++;
      controller.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (live.current.runStarted) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function claim() {
    if (operation.current) return null;
    operation.current = true;
    const id = ++epoch.current;
    controller.current = new AbortController();
    setBusy(true);
    setError("");
    return id;
  }
  function release(id: number) {
    if (epoch.current === id) {
      operation.current = false;
      setBusy(false);
      setObserving(false);
      setPhase("");
    }
  }
  function freshFrames() {
    return frames.current
      .filter((f) => Date.now() - f.capturedAt < 12000)
      .slice(-4);
  }
  async function post<T>(url: string, body: FormData | object): Promise<T> {
    const r = await fetch(url, {
      method: "POST",
      ...(body instanceof FormData
        ? { body }
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
      signal: controller.current?.signal,
    });
    const data = await r.json();
    if (!r.ok)
      throw new Error(data.error || "The request could not be completed.");
    return data;
  }
  async function selectImage(input: File) {
    if (operation.current || live.current.runStarted) return;
    const id = claim();
    if (id === null) return;
    try {
      const prepared = await prepareImage(input);
      if (id !== epoch.current) {
        URL.revokeObjectURL(prepared.preview);
        return;
      }
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = prepared.preview;
      file.current = prepared.file;
      setPreview(prepared.preview);
      setScene(null);
      sceneRef.current = null;
      setNotice("");
      update(() => emptyStory());
      frames.current = [];
      firstFrameAt.current = 0;
      setHasFrames(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This image could not be loaded.",
      );
    } finally {
      release(id);
    }
  }
  async function useExample() {
    try {
      const r = await fetch("/story-seed.png");
      if (!r.ok) throw new Error("Could not load the example.");
      await selectImage(
        new File([await r.blob()], "mountain-companion.png", {
          type: "image/png",
        }),
      );
    } catch (e) {
      setError(String(e));
    }
  }
  async function begin() {
    if (!file.current || state.current.startedAt || live.current.runStarted)
      return;
    const id = claim();
    if (id === null) return;
    update((s) => ({ ...s, status: "initializing" }));
    setNotice("");
    try {
      let initial = sceneRef.current;
      if (!initial) {
        setPhase("Finding the story in your image…");
        const form = new FormData();
        form.set("image", file.current);
        form.set("mood", mood);
        initial = await post<InitialScene>("/api/story/analyze", form);
        if (id !== epoch.current) return;
        sceneRef.current = initial;
        setScene(initial);
      }
      update(() => ({ ...initializeStory(initial!), status: "initializing" }));
      setPhase(
        "Connecting to your live film… The model may take a few minutes to warm up.",
      );
      if (!live.current.connected) await live.current.connectStrict();
      if (id !== epoch.current) {
        await live.current.disconnectSession();
        return;
      }
      setPhase("Bringing your first frame to life…");
      await live.current.startGeneration(file.current, initial.openingPrompt);
      if (id !== epoch.current) {
        await live.current.disconnectSession();
        return;
      }
      update((s) => ({
        ...s,
        status: "generating",
        sessionId: live.current.sessionId,
        startedAt: Date.now(),
      }));
      journal("scene", initial.environment);
      nextObservation.current = Date.now() + 18000;
    } catch (e) {
      if (id === epoch.current) {
        update((s) => ({ ...s, status: "error" }));
        setError(
          e instanceof Error ? e.message : "Your story could not start.",
        );
      }
    } finally {
      release(id);
    }
  }
  function capture(force = false) {
    const video = playerRef.current?.querySelector("video");
    if (
      !video ||
      !video.srcObject ||
      video.readyState < 2 ||
      !video.videoWidth ||
      video.currentTime === lastVideoTime.current ||
      (live.current.paused && !force) ||
      !live.current.runStarted
    )
      return;
    try {
      const c = document.createElement("canvas");
      c.width = 768;
      c.height = Math.round((video.videoHeight / video.videoWidth) * 768);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.65).split(",")[1];
      lastVideoTime.current = video.currentTime;
      frames.current = [
        ...frames.current,
        { data, capturedAt: Date.now(), videoTime: video.currentTime },
      ].slice(-4);
      if (!firstFrameAt.current) {
        firstFrameAt.current = Date.now();
        nextObservation.current = Date.now() + 10000;
      }
      setHasFrames(true);
    } catch {
      setNotice(
        "This browser could not read the live frames. You can still send directions, but automatic character contact is unavailable.",
      );
    }
  }
  async function observe(requestContact = false) {
    if (
      state.current.status !== "generating" ||
      !live.current.runStarted ||
      live.current.paused
    )
      return;
    let recent = freshFrames();
    if (recent.length < 2) {
      if (requestContact)
        setNotice(
          "Waiting for a fresh video frame before contacting your character.",
        );
      return;
    }
    const id = claim();
    if (id === null) return;
    setObserving(true);
    setNotice("");
    let heldForAnalysis = false;
    try {
      // Hold BEFORE analysis so the character's question refers to the scene
      // the player is still watching when the director finishes.
      if (holdScene && !live.current.paused) {
        try {
          await live.current.pauseGeneration();
          heldForAnalysis = true;
          capture(true);
          recent = freshFrames();
          if (!recent.length) recent = frames.current.slice(-4);
        } catch (pauseError) {
          if (!live.current.connected) throw pauseError;
          // Holding is optional: a rejected pause must not prevent a question.
          setNotice("The scene is still rolling while your character thinks.");
        }
      }
      const result = await post<Observation>("/api/story/observe", {
        context: storyContext(state.current),
        frames: recent,
        requestContact: true,
      });
      if (id !== epoch.current) return;
      update((s) => ({
        ...observeStory(s, result),
        lastObservation: {
          frameCount: recent.length,
          videoTime: recent[recent.length - 1].videoTime,
          capturedAt: recent[recent.length - 1].capturedAt,
        },
      }));
      for (const event of result.newEvents) journal("scene", event);
      if (result.decisionNeeded && result.characterMessage.trim()) {
        update((s) => ({
          ...s,
          status: "decision_pending",
          lastQuestion: result.characterMessage,
        }));
        journal("character", result.characterMessage);
      } else {
        if (heldForAnalysis) await live.current.resumeGeneration();
        nextObservation.current = Date.now() + 20000;
        if (requestContact)
          setNotice(
            "Your character is still exploring. You can send them an idea anytime.",
          );
      }
    } catch (e) {
      if (id === epoch.current) {
        setNotice(
          e instanceof Error
            ? e.message
            : "Scene analysis failed. Your film is still running.",
        );
        if (heldForAnalysis && live.current.connected) {
          try {
            await live.current.resumeGeneration();
          } catch {
            update((s) => ({ ...s, status: "paused" }));
          }
        }
        nextObservation.current = Date.now() + 60000;
      }
    } finally {
      release(id);
    }
  }
  const loop = useRef({ capture, observe, autoContact });
  loop.current = { capture, observe, autoContact };
  useEffect(() => {
    const timer = setInterval(() => {
      loop.current.capture();
      if (
        shouldContactCharacter({
          enabled: loop.current.autoContact,
          status: state.current.status,
          busy: operation.current,
          running: live.current.runStarted,
          paused: live.current.paused,
          now: Date.now(),
          firstFrameAt: firstFrameAt.current,
          nextContactAt: nextObservation.current,
          freshFrameCount: freshFrames().length,
        })
      )
        void loop.current.observe();
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  async function decide(text: string): Promise<boolean> {
    text = text.trim();
    if (
      !text ||
      !live.current.connected ||
      !live.current.runStarted ||
      !["generating", "decision_pending", "paused"].includes(
        state.current.status,
      )
    )
      return false;
    const id = claim();
    if (id === null) return false;
    const previous = state.current.status;
    const sessionId = live.current.sessionId;
    let applied = false;
    update((s) => ({ ...s, status: "applying_decision" }));
    try {
      // A held scene may use its last frames even after the player takes time.
      const recent = live.current.paused
        ? frames.current.slice(-4)
        : freshFrames();
      const result = await post<Decision>("/api/story/decide", {
        context: storyContext(state.current),
        decision: text,
        frames: recent,
      });
      if (id !== epoch.current) return false;
      if (
        live.current.sessionId !== sessionId ||
        !live.current.connected ||
        !live.current.runStarted
      )
        throw new Error(
          "The original live session is no longer available. Your reply was not applied.",
        );
      await live.current.steerPrompt(result.instruction);
      if (id !== epoch.current) return false;
      applied = true;
      update((s) => applyDecision(s, text, result));
      journal("player", text);
      journal("character", result.characterReply);
      if (live.current.paused) {
        try {
          await live.current.resumeGeneration();
        } catch {
          update((s) => ({ ...s, status: "paused" }));
          setNotice(
            "Your direction was accepted. Use Resume film to continue the same session.",
          );
        }
      }
      nextObservation.current = Date.now() + 22000;
      frames.current = [];
      return true;
    } catch (e) {
      if (id === epoch.current) {
        if (!applied) update((s) => ({ ...s, status: previous }));
        setError(
          e instanceof Error
            ? e.message
            : "Your reply could not be applied. Try again.",
        );
      }
      return applied;
    } finally {
      release(id);
    }
  }
  async function togglePause() {
    const id = claim();
    if (id === null) return;
    try {
      if (live.current.paused) {
        await live.current.resumeGeneration();
        update((s) => ({
          ...s,
          status: s.lastQuestion ? "decision_pending" : "generating",
        }));
        nextObservation.current = Date.now() + 18000;
      } else {
        await live.current.pauseGeneration();
        update((s) => ({
          ...s,
          status: s.lastQuestion ? "decision_pending" : "paused",
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change playback.");
    } finally {
      release(id);
    }
  }
  async function end() {
    epoch.current++;
    controller.current?.abort();
    operation.current = true;
    setBusy(true);
    setObserving(false);
    setPhase("");
    update((s) => ({ ...s, status: "ended" }));
    try {
      await live.current.disconnectSession();
      clearJwt();
      journal(
        "system",
        "You ended this live story. Its journal is saved on this device.",
      );
      setArchive({ ...state.current, status: "ended" });
      setError("");
      setNotice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close the session.");
    } finally {
      operation.current = false;
      setBusy(false);
      frames.current = [];
      setHasFrames(false);
    }
  }
  function newStory() {
    if (live.current.connected || operation.current) return;
    sceneRef.current = null;
    setScene(null);
    update(() => emptyStory());
    setError("");
    setNotice("");
    firstFrameAt.current = 0;
    lastVideoTime.current = -1;
  }
  function changeMood(value: string) {
    if (state.current.startedAt || operation.current) return;
    setMood(value);
    sceneRef.current = null;
    setScene(null);
  }
  function exportJournal() {
    const data = state.current.journal.length ? state.current : archive;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lumen-story-journal.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {
    story,
    preview,
    scene,
    mood,
    setMood: changeMood,
    error: error || session.error,
    notice,
    phase,
    observing,
    hasFrames,
    holdScene,
    setHoldScene,
    autoContact,
    setAutoContact,
    archive,
    busy,
    playerRef,
    session,
    selectImage,
    useExample,
    begin,
    observe,
    decide,
    togglePause,
    end,
    newStory,
    exportJournal,
  };
}
