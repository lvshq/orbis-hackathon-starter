"use client";
import { ReactorProvider } from "@reactor-team/js-sdk";
import {
  Aperture,
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  Download,
  Expand,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  Radio,
  Send,
  Sparkles,
  Square,
  Upload,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ORBIS_MODEL_NAME, ORBIS_TRACKS, requestReactorJwt } from "@/lib/orbis";
import { OrbisPlayer } from "./orbis-player";
import { useStory } from "@/hooks/use-story";
import { ReplyChoices } from "./reply-choices";
const tracks = [...ORBIS_TRACKS];
const connectOptions = { autoConnect: false };
export function StoryStudio() {
  const jwtPromise = useRef<Promise<string> | null>(null);
  const getJwt = useCallback(() => {
    jwtPromise.current ??= requestReactorJwt().catch((e) => {
      jwtPromise.current = null;
      throw e;
    });
    return jwtPromise.current;
  }, []);
  const clearJwt = useCallback(() => {
    jwtPromise.current = null;
  }, []);
  return (
    <ReactorProvider
      apiUrl="https://api.reactor.inc"
      modelName={ORBIS_MODEL_NAME}
      modelTracks={tracks}
      connectOptions={connectOptions}
      jwtToken={getJwt}
    >
      <Studio clearJwt={clearJwt} />
    </ReactorProvider>
  );
}
function Studio({ clearJwt }: { clearJwt: () => void }) {
  const app = useStory(clearJwt);
  const { story, session } = app;
  const inputRef = useRef<HTMLInputElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [reply, setReply] = useState("");
  const [tab, setTab] = useState("conversation");
  const [dragging, setDragging] = useState(false);
  const [help, setHelp] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const started = Boolean(story.startedAt);
  const active = session.runStarted;
  const pending = story.status === "decision_pending";
  const ended = story.status === "ended";
  const messages = story.journal.filter(
    (e) => e.kind === "player" || e.kind === "character",
  );
  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [story.journal.length, tab]);
  useEffect(() => {
    if (pending) {
      setTab("conversation");
      replyRef.current?.focus({ preventScroll: true });
    }
  }, [pending]);
  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void app.selectImage(e.target.files[0]);
    e.target.value = "";
  };
  const submit = async (text = reply) => {
    if (await app.decide(text)) setReply("");
  };
  const fullscreen = () => {
    void app.playerRef.current?.requestFullscreen().catch(() => {});
  };
  const statusText = ended
    ? "STORY ENDED"
    : session.paused
      ? "SCENE HELD"
      : active && app.hasFrames
        ? "LIVE STORY"
        : story.status === "initializing"
          ? "COMING TO LIFE"
          : active
            ? "WARMING UP"
            : "YOUR STORY STARTS HERE";
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Lumen home">
          <span className="brand-mark">
            <Aperture size={23} />
          </span>
          lumen<span className="brand-dot">.</span>
        </a>
        <div className="header-center">
          <span className="tiny-dot" /> A little imagination. A living story.
        </div>
        <button className="text-button" onClick={() => setHelp(true)}>
          How it works <ArrowRight size={15} />
        </button>
      </header>
      <main className="studio">
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> THE STORY ISN’T WRITTEN YET
            </div>
            <h1>
              Every picture has a story.
              <br />
              <em>This one listens to you.</em>
            </h1>
          </div>
          <p>
            Bring a character to life. Watch their world unfold.
            <br className="desktop-br" /> And when they need you, help write
            what happens next.
          </p>
        </section>
        <section className="workspace" aria-label="Interactive story studio">
          <div className="film-column">
            <div className="film-frame" ref={app.playerRef}>
              {active ? (
                <OrbisPlayer
                  connected={session.connected}
                  muted={session.muted}
                  runStarted={session.runStarted}
                  status={session.status}
                />
              ) : (
                <img
                  className="seed-image"
                  src={app.preview || "/story-seed.png"}
                  alt={
                    app.preview
                      ? "Your uploaded story reference"
                      : "Example story seed: a golden retriever overlooking a mountain lake at sunset"
                  }
                />
              )}
              <div className="film-shade" />
              <div className="film-top">
                <span
                  className={`film-badge ${active && !session.paused && app.hasFrames ? "is-live" : ""}`}
                >
                  <span />
                  {statusText}
                </span>
                <span className="format-badge">
                  16:9 <span>✦</span> LIVE CINEMA
                </span>
              </div>
              {(!active || !app.hasFrames) && (
                <div
                  className={`film-title ${story.status === "initializing" || active ? "is-loading" : ""}`}
                >
                  {(story.status === "initializing" || active) && (
                    <LoaderCircle className="spin" size={28} />
                  )}
                  <span className="film-overline">
                    {app.preview
                      ? "A WORLD WAITING FOR YOU"
                      : "A GLIMPSE OF POSSIBILITY"}
                  </span>
                  <h2>
                    {app.scene
                      ? story.title
                      : app.preview
                        ? "Meet your next adventure."
                        : "The world is bigger\nwhen you’re curious."}
                  </h2>
                  <p>
                    {app.phase ||
                      (active
                        ? "Visko is preparing the first live frames. This can take a few minutes."
                        : app.preview
                          ? "Your image is the beginning. What happens next is up to you."
                          : "Start with a photo. See where the story takes you.")}
                  </p>
                  {!app.preview && (
                    <button
                      className="glass-button"
                      onClick={() => void app.useExample()}
                      disabled={app.busy}
                    >
                      <Play size={13} fill="currentColor" /> Try this character{" "}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
              {active && session.paused && app.hasFrames && (
                <div className="held-note">
                  <Pause size={14} />{" "}
                  {pending
                    ? "Your character is waiting. Take your time."
                    : "Scene held. The story stays right here."}
                </div>
              )}
              <div className="film-bottom">
                <span>
                  <Aperture size={16} />{" "}
                  {active
                    ? "GENERATED LIVE, MOMENT BY MOMENT"
                    : app.preview
                      ? "YOUR ORIGINAL STORY SEED"
                      : "EXAMPLE IMAGE · YOUR ADVENTURE AWAITS"}
                </span>
                <button
                  className="icon-button light"
                  aria-label="View fullscreen"
                  onClick={fullscreen}
                >
                  <Expand size={17} />
                </button>
              </div>
            </div>
            <div className="playback-bar">
              <div className="playback-actions">
                <button
                  className="round-control"
                  onClick={() => void app.togglePause()}
                  disabled={!active || app.busy}
                  aria-label={session.paused ? "Resume film" : "Pause film"}
                >
                  {session.paused ? (
                    <Play size={15} fill="currentColor" />
                  ) : (
                    <Pause size={15} />
                  )}
                </button>
                <button
                  className="icon-button"
                  onClick={session.toggleMuted}
                  disabled={!active}
                  aria-label={session.muted ? "Enable sound" : "Mute sound"}
                >
                  {session.muted ? (
                    <VolumeX size={17} />
                  ) : (
                    <Volume2 size={17} />
                  )}
                </button>
                <span className="playback-label">
                  {active
                    ? session.paused
                      ? "Ready when you are"
                      : app.hasFrames
                        ? "The story is unfolding"
                        : "Waiting for the first frame"
                    : "Every adventure starts with you"}
                </span>
              </div>
              <div className="playback-status">
                <span className={active ? "tiny-dot green" : "tiny-dot"} />
                {active
                  ? `${session.chunk} chunks · ${story.interactionCount} ${story.interactionCount === 1 ? "decision" : "decisions"}`
                  : "Powered by Visko"}
              </div>
            </div>
            {started && (
              <div className="scene-caption">
                <div className="eyebrow">IN THIS MOMENT</div>
                <p>{story.currentScene}</p>
                <div className="scene-caption-footer">
                  <span>
                    <Sparkles size={14} />
                    {story.currentObjective}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => void app.end()}
                    disabled={app.busy && story.status !== "applying_decision"}
                  >
                    <Square size={12} /> End story
                  </button>
                </div>
              </div>
            )}
            <div className="three-notes">
              <div>
                <span className="note-icon">
                  <ImagePlus size={18} />
                </span>
                <div>
                  <h3>Your image, their world</h3>
                  <p>A familiar face. An unfamiliar adventure.</p>
                </div>
              </div>
              <div>
                <span className="note-icon">
                  <Radio size={18} />
                </span>
                <div>
                  <h3>Made in the moment</h3>
                  <p>A living film that keeps unfolding.</p>
                </div>
              </div>
              <div>
                <span className="note-icon">
                  <MessageCircle size={18} />
                </span>
                <div>
                  <h3>You’re part of the story</h3>
                  <p>No scripts. Just say what you’re thinking.</p>
                </div>
              </div>
            </div>
          </div>
          <aside className={`director-panel ${started ? "live-panel" : ""}`}>
            {!started && !active ? (
              <>
                <div className="panel-eyebrow">
                  <Sparkles size={15} /> YOUR DIRECTOR’S CHAIR
                </div>
                <h2>Make the first move.</h2>
                <p className="panel-description">
                  Choose who’s going on an adventure.
                  <br />
                  We’ll take it from there. Together.
                </p>
                <input
                  ref={inputRef}
                  id="story-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={choose}
                  hidden
                />
                <button
                  className={`upload-zone ${dragging ? "dragging" : ""} ${app.preview ? "has-preview" : ""}`}
                  onClick={() => inputRef.current?.click()}
                  disabled={app.busy}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (e.dataTransfer.files[0])
                      void app.selectImage(e.dataTransfer.files[0]);
                  }}
                >
                  {app.preview ? (
                    <>
                      <img src={app.preview} alt="Selected image preview" />
                      <span className="replace-image">
                        <Check size={13} /> Image ready <span>Change</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="upload-icon">
                        <Upload size={22} />
                        <span>+</span>
                      </span>
                      <strong>Drop a little possibility here</strong>
                      <span>
                        or <u>choose an image</u>
                      </span>
                      <small>JPG, PNG or WebP · Up to 10 MB</small>
                    </>
                  )}
                </button>
                <div className="mood-label">
                  <span>Set the feeling</span>
                  <span>A starting point, not a script</span>
                </div>
                <div className="moods">
                  {["Wonder", "Adventure", "Mystery", "Dreamlike"].map(
                    (m, i) => (
                      <button
                        key={m}
                        disabled={app.busy}
                        className={app.mood === m ? "selected" : ""}
                        onClick={() => app.setMood(m)}
                      >
                        <span>{["✦", "↗", "◒", "☾"][i]}</span>
                        {m}
                      </button>
                    ),
                  )}
                </div>
                <button
                  className="primary-button"
                  onClick={() => void app.begin()}
                  disabled={!app.preview || app.busy}
                >
                  {app.busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <WandSparkles size={18} />
                  )}{" "}
                  {app.busy
                    ? "Setting the scene…"
                    : story.status === "error"
                      ? "Try starting again"
                      : "Begin your story"}
                  {!app.busy && <ArrowRight size={18} />}
                </button>
                <p className="under-button">
                  {app.phase || "One image. A story that’s yours alone."}
                </p>
                {app.busy && (
                  <button
                    className="text-button cancel-button"
                    onClick={() => void app.end()}
                  >
                    Cancel setup
                  </button>
                )}
                <div className="panel-divider" />
                <div className="incoming-preview">
                  <div className="small-avatar">
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <strong>When the story needs you…</strong>
                    <p>
                      Your character will reach out. Reply in your own words and
                      watch what happens.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="character-header">
                  <div
                    className={`character-avatar ${pending ? "ringing" : ""}`}
                  >
                    {app.preview ? (
                      <img src={app.preview} alt={story.characterName} />
                    ) : (
                      <Aperture size={26} />
                    )}
                    <span className={ended ? "offline" : ""} />
                  </div>
                  <div>
                    <div className="panel-eyebrow">YOUR LINE TO THE STORY</div>
                    <h2>{story.characterName}</h2>
                    <p>
                      {ended
                        ? "Until the next adventure"
                        : pending
                          ? "Has a question for you"
                          : app.observing
                            ? "Taking in the scene…"
                            : story.status === "applying_decision"
                              ? "Listening to your idea…"
                              : "Out there, with you"}
                    </p>
                  </div>
                  <AudioLines size={23} className="audio-mark" />
                </div>
                <div className="panel-tabs">
                  <button
                    onClick={() => setTab("conversation")}
                    className={tab === "conversation" ? "selected" : ""}
                  >
                    Conversation{" "}
                    {messages.length > 0 && <span>{messages.length}</span>}
                  </button>
                  <button
                    onClick={() => setTab("journal")}
                    className={tab === "journal" ? "selected" : ""}
                  >
                    Story journal
                  </button>
                </div>
                {pending && (
                  <div className="incoming-label">
                    <span className="tiny-dot" /> INCOMING MESSAGE · IT’S YOUR
                    MOVE
                    {story.lastObservation && (
                      <span className="frame-grounding">
                        From {story.lastObservation.frameCount} recent frames ·{" "}
                        {Math.floor(story.lastObservation.videoTime / 60)}:
                        {String(
                          Math.floor(story.lastObservation.videoTime % 60),
                        ).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                )}
                <div
                  className="messages"
                  ref={messagesRef}
                  aria-live="polite"
                  aria-label={
                    tab === "conversation"
                      ? "Character conversation"
                      : "Story journal"
                  }
                >
                  {tab === "conversation" ? (
                    messages.length ? (
                      messages.map((e) => (
                        <div key={e.id} className={`message ${e.kind}`}>
                          <span>
                            {e.kind === "player"
                              ? "YOU"
                              : story.characterName.toUpperCase()}
                          </span>
                          <p>{e.text}</p>
                        </div>
                      ))
                    ) : (
                      <div className="conversation-empty">
                        <div className="connection-orbit">
                          <MessageCircle size={25} />
                          <span />
                        </div>
                        <h3>A connection worth waiting for.</h3>
                        <p>
                          Your character will reach out after watching the
                          latest moments of the film—with a question and a few
                          ideas for what to do next.
                        </p>
                        <span>You can send an idea anytime.</span>
                      </div>
                    )
                  ) : (
                    <div className="journal-list">
                      {story.journal.map((e, i) => (
                        <div key={e.id} className="journal-entry">
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <div>
                            <small>
                              {e.kind === "scene"
                                ? "OBSERVED"
                                : e.kind === "player"
                                  ? "YOUR DIRECTION"
                                  : e.kind === "character"
                                    ? story.characterName.toUpperCase()
                                    : "STORY NOTE"}
                            </small>
                            <p>{e.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {app.observing && (
                    <div className="thinking">
                      <span />
                      <span />
                      <span /> Reading the latest scene and finding a question
                      for you…
                    </div>
                  )}
                  {story.status === "applying_decision" && (
                    <div className="thinking">
                      <span />
                      <span />
                      <span /> Turning your idea into the next moment
                    </div>
                  )}
                </div>
                {ended ? (
                  <div className="ended-actions">
                    <p>This chapter of your adventure is saved.</p>
                    <button
                      className="primary-button"
                      onClick={() => {
                        if (session.connected)
                          void app.end().then(app.newStory);
                        else app.newStory();
                      }}
                    >
                      Start a new story <ArrowRight size={17} />
                    </button>
                    <button className="text-button" onClick={app.exportJournal}>
                      <Download size={14} /> Save story journal
                    </button>
                  </div>
                ) : (
                  <div className="composer-area">
                    {story.lastQuestion && (
                      <ReplyChoices
                        options={story.replyOptions}
                        disabled={app.busy || !active}
                        onChoose={(text) => void submit(text)}
                      />
                    )}
                    {pending && (
                      <label className="freestyle-label" htmlFor="player-reply">
                        Your own idea
                      </label>
                    )}
                    <form
                      className="composer"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                      }}
                    >
                      <label className="sr-only" htmlFor="player-reply">
                        Your direction to the character
                      </label>
                      <textarea
                        id="player-reply"
                        ref={replyRef}
                        value={reply}
                        maxLength={1600}
                        onChange={(e) => setReply(e.target.value)}
                        disabled={
                          !active || story.status === "applying_decision"
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            if (!app.busy) void submit();
                          }
                        }}
                        placeholder={
                          pending
                            ? "What should they do? Tell them…"
                            : "Send a thought into their world…"
                        }
                      />
                      <div>
                        <span>
                          {reply.length
                            ? `${reply.length}/1600`
                            : "YOUR WORDS CHANGE WHAT HAPPENS"}
                        </span>
                        <button
                          type="submit"
                          disabled={!reply.trim() || app.busy || !active}
                          aria-label="Send direction"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </form>
                    <label className="proactive-control">
                      <input
                        type="checkbox"
                        checked={app.autoContact}
                        onChange={(e) => app.setAutoContact(e.target.checked)}
                      />
                      <span>Let my character start conversations</span>
                      <span className="tiny-dot green" />
                    </label>
                    <div className="contact-controls">
                      <button
                        className="text-button"
                        disabled={
                          !active || app.busy || session.paused || pending
                        }
                        onClick={() => void app.observe(true)}
                      >
                        <MessageCircle size={13} />
                        {app.observing ? "Reading the scene…" : "Check in"}
                      </button>
                      <label>
                        <input
                          type="checkbox"
                          checked={app.holdScene}
                          onChange={(e) => app.setHoldScene(e.target.checked)}
                        />{" "}
                        Hold scene while I reply
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </section>
        {(app.error || app.notice) && (
          <div
            className={`notice ${app.error ? "error" : ""}`}
            role={app.error ? "alert" : "status"}
          >
            <span>{app.error || app.notice}</span>
            {active && session.paused && (
              <button
                onClick={() => void app.togglePause()}
                disabled={app.busy}
              >
                Resume film
              </button>
            )}
          </div>
        )}
        <div className="studio-bottom">
          <span>
            <span className="tiny-dot green" /> IMAGINATION, CONNECTED.
          </span>
          <div>
            {app.archive && !started && (
              <button
                className="text-button"
                onClick={() => setShowArchive(true)}
              >
                Your last story <ArrowRight size={13} />
              </button>
            )}
            <span>Visko Orbis × Codex</span>
          </div>
        </div>
        {(started || session.connected) && (
          <details className="technical-details">
            <summary>
              Behind the story <ChevronDown size={14} />
            </summary>
            <div className="technical-grid">
              <div>
                <span>LIVE SESSION</span>
                <code>
                  {story.sessionId || session.sessionId || "Connecting…"}
                </code>
                <p>
                  Status: {story.status} · Transport: {session.status} · Chunk:{" "}
                  {session.chunk}
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={app.autoContact}
                    onChange={(e) => app.setAutoContact(e.target.checked)}
                  />{" "}
                  Let the character contact me automatically
                </label>
                <button className="text-button" onClick={app.exportJournal}>
                  <Download size={14} /> Export journal
                </button>
              </div>
              <div>
                <span>CURRENT VISUAL INSTRUCTION</span>
                <p>{story.activePrompt}</p>
                <span>RECENT MODEL EVENTS</span>
                <code>
                  {session.events.join(" → ") || "Awaiting model events"}
                </code>
              </div>
            </div>
          </details>
        )}
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-title"
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close-modal"
              aria-label="Close instructions"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <Aperture className="modal-icon" size={30} />
            <div className="eyebrow">WELCOME TO LUMEN</div>
            <h2 id="how-title">
              You don’t just watch.
              <br />
              <em>You’re part of it.</em>
            </h2>
            <ol>
              <li>
                <strong>Give the story a beginning.</strong>
                <p>
                  Upload a person, pet, toy, character, or scene. We find the
                  story possibilities while preserving its appearance.
                </p>
              </li>
              <li>
                <strong>Watch it come to life.</strong>
                <p>
                  Visko generates a continuous live film. Codex checks recent
                  video frames for moments where your character needs you.
                </p>
              </li>
              <li>
                <strong>Tell them what to do.</strong>
                <p>
                  Reply freely, or send an idea anytime. Your direction shapes
                  the next moments of the same live film.
                </p>
              </li>
            </ol>
            <p className="modal-note">
              First-time model startup can take a few minutes. Holding a scene
              preserves the live session while you reply. Closing or refreshing
              the page ends the live connection; your text journal stays on this
              device.
            </p>
            <button className="primary-button" onClick={() => setHelp(false)}>
              Let’s find a story <ArrowRight size={17} />
            </button>
          </section>
        </div>
      )}
      {showArchive && app.archive && (
        <div className="modal-backdrop" onClick={() => setShowArchive(false)}>
          <section
            className="modal archive-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Previous story journal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close-modal"
              aria-label="Close journal"
              onClick={() => setShowArchive(false)}
            >
              <X />
            </button>
            <div className="eyebrow">SAVED ON THIS DEVICE · SESSION ENDED</div>
            <h2>{app.archive.title}</h2>
            <div className="archive-entries">
              {app.archive.journal.map((e) => (
                <p key={e.id}>
                  <small>{e.kind.toUpperCase()}</small>
                  {e.text}
                </p>
              ))}
            </div>
            <button className="text-button" onClick={app.exportJournal}>
              <Download size={15} /> Export journal
            </button>
          </section>
        </div>
      )}
    </>
  );
}
