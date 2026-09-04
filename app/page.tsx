'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Film,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Settings,
  Shuffle,
  Sparkles,
  Trash2,
  UsersRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute(input: unknown): unknown;
        },
        options?: { signal?: AbortSignal },
      ): void | Promise<void>;
    };
  }
}

type Person = { id: string; name: string; color: string; present: boolean };
type Movie = { id: string; title: string; personId: string };
type OddsMode = 'film' | 'person' | 'person-visual';
type AppData = {
  people: Person[];
  movies: Movie[];
  history: { title: string; person: string; date: string }[];
  settings?: { spinSeconds: number; oddsMode: OddsMode };
};

const palette = [
  '#ff6b6b',
  '#6c5ce7',
  '#00b894',
  '#f9ca24',
  '#0984e3',
  '#e84393',
  '#e17055',
  '#00cec9',
];
const starter: AppData = {
  people: [
    { id: 'p1', name: 'Garet', color: '#ff6b6b', present: true },
    { id: 'p2', name: 'Alex', color: '#6c5ce7', present: true },
    { id: 'p3', name: 'Sam', color: '#00b894', present: true },
  ],
  movies: [
    { id: 'm1', title: 'The Grand Budapest Hotel', personId: 'p1' },
    { id: 'm2', title: 'Knives Out', personId: 'p2' },
    { id: 'm3', title: 'Spider-Man: Into the Spider-Verse', personId: 'p3' },
    { id: 'm4', title: 'Palm Springs', personId: 'p1' },
    { id: 'm5', title: 'Arrival', personId: 'p2' },
  ],
  history: [],
};
const uid = () => Math.random().toString(36).slice(2, 10);
const shorten = (text: string, max = 24) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;
function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function wedgePath(start: number, end: number) {
  const a = polar(250, 250, 238, start);
  const b = polar(250, 250, 238, end);
  return `M250 250 L${a.x} ${a.y} A238 238 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
}

export default function Home() {
  const [data, setData] = useState<AppData>(starter);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'movies' | 'people' | 'settings'>('movies');
  const [movieTitle, setMovieTitle] = useState('');
  const [moviePerson, setMoviePerson] = useState('p1');
  const [personName, setPersonName] = useState('');
  const [personColor, setPersonColor] = useState(palette[3]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Movie | null>(null);
  const [sound, setSound] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [editingMovie, setEditingMovie] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<
    { id: number; left: number; color: string; delay: number; spin: number }[]
  >([]);
  const audioRef = useRef<AudioContext | null>(null);
  const wheelRef = useRef<SVGSVGElement | null>(null);
  const animationRef = useRef<number | null>(null);
  useEffect(() => {
    fetch('/api/data')
      .then(async (r) => {
        if (!r.ok) throw new Error('Data unavailable');
        return (await r.json()) as AppData;
      })
      .then((saved) => setData(saved))
      .catch(() => {
        const saved = localStorage.getItem('movie-night-wheel');
        if (saved) setData(JSON.parse(saved));
      })
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('movie-night-wheel', JSON.stringify(data));
    const timer = setTimeout(
      () =>
        fetch('/api/data', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
        }).catch(() => {}),
      250,
    );
    return () => clearTimeout(timer);
  }, [data, loaded]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'add_movie_suggestion',
          title: 'Add movie suggestion',
          description:
            'Add one film to the Movie Night wheel for an existing person.',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              personName: { type: 'string' },
            },
            required: ['title', 'personName'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const values = input as { title?: string; personName?: string };
            const title = values.title?.trim();
            const person = data.people.find(
              (item) =>
                item.name.toLowerCase() ===
                values.personName?.trim().toLowerCase(),
            );
            if (!title || !person)
              throw new Error(
                'A film title and matching person name are required.',
              );
            const movie = { id: uid(), title, personId: person.id };
            setData((current) => ({
              ...current,
              movies: [...current.movies, movie],
            }));
            return { added: title, person: person.name };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [data.people]);
  const activeMovies = useMemo(
    () =>
      data.movies.filter(
        (movie) =>
          data.people.find((person) => person.id === movie.personId)?.present,
      ),
    [data],
  );
  const spinSeconds = data.settings?.spinSeconds ?? 7;
  const oddsMode = data.settings?.oddsMode ?? 'film';
  const wheelSlices = useMemo(() => {
    let angle = 0;
    const eligiblePeople = data.people.filter(
      (person) =>
        person.present &&
        activeMovies.some((movie) => movie.personId === person.id),
    );
    return activeMovies.map((movie) => {
      const personMovies = activeMovies.filter(
        (item) => item.personId === movie.personId,
      );
      const size =
        oddsMode === 'person-visual'
          ? 360 / eligiblePeople.length / personMovies.length
          : 360 / activeMovies.length;
      const slice = { movie, start: angle, end: angle + size };
      angle += size;
      return slice;
    });
  }, [activeMovies, data.people, oddsMode]);
  const personFor = (id: string) =>
    data.people.find((person) => person.id === id);
  const winnerPerson = winner ? personFor(winner.personId) : undefined;
  function clickTick(delay = 0) {
    if (!sound) return;
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = audioRef.current ?? new AudioCtx();
    audioRef.current = ctx;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 720;
    gain.gain.setValueAtTime(0.055, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.035);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.04);
  }
  function winnerSound() {
    if (!sound) return;
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = audioRef.current ?? new AudioCtx();
    audioRef.current = ctx;
    const start = ctx.currentTime + 0.03;
    const tone = (
      frequency: number,
      at: number,
      length: number,
      volume: number,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, at + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + length + 0.02);
    };
    const burst = (at: number, length: number, volume: number) => {
      const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * length),
        ctx.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 2);
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      filter.Q.value = 0.7;
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + length);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(at);
    };
    burst(start, 0.28, 0.18);
    [
      [523.25, 0],
      [659.25, 0.13],
      [783.99, 0.26],
      [1046.5, 0.42],
    ].forEach(([frequency, delay], index) =>
      tone(
        frequency,
        start + delay,
        index === 3 ? 0.65 : 0.32,
        index === 3 ? 0.11 : 0.075,
      ),
    );
    for (let i = 0; i < 34; i++) {
      const delay = 0.55 + i * 0.055 + Math.random() * 0.08;
      burst(
        start + delay,
        0.13 + Math.random() * 0.09,
        0.025 + Math.random() * 0.04,
      );
    }
  }
  function celebrate() {
    setConfetti(
      Array.from({ length: 90 }, (_, id) => ({
        id,
        left: Math.random() * 100,
        color: palette[id % palette.length],
        delay: Math.random() * 0.8,
        spin: Math.random() * 720 - 360,
      })),
    );
    setTimeout(() => setConfetti([]), 4300);
  }
  function spin() {
    if (spinning || activeMovies.length < 2) return;
    setWinner(null);
    setSpinning(true);
    const eligiblePeople = data.people.filter(
      (person) =>
        person.present &&
        activeMovies.some((movie) => movie.personId === person.id),
    );
    const chosenPerson =
      eligiblePeople[Math.floor(Math.random() * eligiblePeople.length)];
    const personMovies = activeMovies.filter(
      (movie) => movie.personId === chosenPerson?.id,
    );
    const chosen =
      oddsMode === 'film'
        ? activeMovies[Math.floor(Math.random() * activeMovies.length)]
        : personMovies[Math.floor(Math.random() * personMovies.length)];
    const chosenSlice = wheelSlices.find(
      (slice) => slice.movie.id === chosen.id,
    )!;
    const targetMod = (360 - (chosenSlice.start + chosenSlice.end) / 2) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const finalRotation =
      rotation + 7 * 360 + ((targetMod - currentMod + 360) % 360);
    const start = performance.now();
    let lastSlice = -1;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / (spinSeconds * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const angle = rotation + (finalRotation - rotation) * eased;
      if (wheelRef.current)
        wheelRef.current.style.transform = `rotate(${angle}deg)`;
      const pointerAngle = (((360 - angle) % 360) + 360) % 360;
      const currentSlice = wheelSlices.findIndex(
        (slice) => pointerAngle >= slice.start && pointerAngle < slice.end,
      );
      if (currentSlice !== lastSlice) {
        if (lastSlice !== -1) clickTick();
        lastSlice = currentSlice;
      }
      if (progress < 1) animationRef.current = requestAnimationFrame(animate);
      else {
        setRotation(finalRotation);
        setSpinning(false);
        setWinner(chosen);
        celebrate();
        winnerSound();
        setData((current) => ({
          ...current,
          history: [
            {
              title: chosen.title,
              person: personFor(chosen.personId)?.name ?? '',
              date: new Date().toISOString(),
            },
            ...current.history,
          ].slice(0, 20),
        }));
      }
    };
    animationRef.current = requestAnimationFrame(animate);
  }
  function shuffleMovies() {
    if (spinning) return;
    setData((current) => {
      const movies = [...current.movies];
      for (let i = movies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [movies[i], movies[j]] = [movies[j], movies[i]];
      }
      return { ...current, movies };
    });
  }
  function addMovie(event: FormEvent) {
    event.preventDefault();
    const title = movieTitle.trim();
    if (!title || !moviePerson) return;
    setData((current) => ({
      ...current,
      movies: [...current.movies, { id: uid(), title, personId: moviePerson }],
    }));
    setMovieTitle('');
  }
  function addPerson(event: FormEvent) {
    event.preventDefault();
    const name = personName.trim();
    if (!name) return;
    const id = uid();
    setData((current) => ({
      ...current,
      people: [
        ...current.people,
        { id, name, color: personColor, present: true },
      ],
    }));
    setMoviePerson(id);
    setPersonName('');
    setPersonColor(palette[data.people.length % palette.length]);
  }
  function removePerson(id: string) {
    setData((current) => ({
      ...current,
      people: current.people.filter((person) => person.id !== id),
      movies: current.movies.filter((movie) => movie.personId !== id),
    }));
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <Film />
        </div>
        <div>
          <p className="eyebrow">TacNet</p>
          <h1>Movie Night</h1>
        </div>
        <div className="header-actions">
          <button
            className="panel-toggle"
            onClick={shuffleMovies}
            disabled={spinning}
          >
            <Shuffle />
            <span>Shuffle</span>
          </button>
          <button
            className="panel-toggle"
            onClick={() => setPanelOpen(!panelOpen)}
          >
            {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
            <span>{panelOpen ? 'Hide admin' : 'Show admin'}</span>
          </button>
          <button
            className="sound-button"
            onClick={() => setSound(!sound)}
            aria-label={sound ? 'Mute wheel sounds' : 'Turn on wheel sounds'}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </button>
        </div>
      </header>
      <section className={`workspace ${panelOpen ? '' : 'panel-hidden'}`}>
        <section className="wheel-panel">
          <div className="tonight-row">
            <div className="presence-pills">
              {data.people.map((person) => (
                <button
                  key={person.id}
                  className={`presence-pill ${person.present ? 'is-present' : ''}`}
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      people: current.people.map((p) =>
                        p.id === person.id ? { ...p, present: !p.present } : p,
                      ),
                    }))
                  }
                >
                  <span style={{ background: person.color }} />
                  {person.name}
                </button>
              ))}
            </div>
          </div>
          <div className="wheel-stage">
            <div className="pointer">
              <span />
            </div>
            <svg
              ref={wheelRef}
              className="wheel"
              viewBox="0 0 500 500"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: 'none',
              }}
              aria-label="Movie selection wheel"
            >
              <g>
                {wheelSlices.length ? (
                  wheelSlices.map(({ movie, start, end }) => {
                    const person = personFor(movie.personId);
                    const angle = (start + end) / 2;
                    const pos = polar(
                      250,
                      250,
                      activeMovies.length > 12 ? 158 : 150,
                      angle,
                    );
                    return (
                      <g key={movie.id}>
                        <path
                          d={wedgePath(start, end)}
                          fill={person?.color ?? '#555'}
                          stroke="rgba(4,10,20,.28)"
                          strokeWidth="2"
                        />
                        <text
                          x={pos.x}
                          y={pos.y}
                          transform={`rotate(${angle + 90} ${pos.x} ${pos.y})`}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="wheel-label"
                        >
                          {shorten(
                            movie.title,
                            activeMovies.length > 12 ? 15 : 23,
                          )}
                        </text>
                      </g>
                    );
                  })
                ) : (
                  <circle cx="250" cy="250" r="238" fill="#182234" />
                )}
                <circle cx="250" cy="250" r="77" className="wheel-hub" />
              </g>
            </svg>
            <button
              className="spin-button"
              onClick={spin}
              disabled={spinning || activeMovies.length < 2}
            >
              <span>{spinning ? 'Spinning…' : 'SPIN'}</span>
              {activeMovies.length < 2 && <small>Add 2 films</small>}
            </button>
          </div>
        </section>
        {panelOpen && (
          <aside className="control-panel">
            <div className="tabs">
              <button
                className={tab === 'movies' ? 'active' : ''}
                onClick={() => setTab('movies')}
              >
                <Film /> Films
              </button>
              <button
                className={tab === 'people' ? 'active' : ''}
                onClick={() => setTab('people')}
              >
                <UsersRound /> People
              </button>
              <button
                className={tab === 'settings' ? 'active' : ''}
                onClick={() => setTab('settings')}
              >
                <Settings /> Settings
              </button>
            </div>
            {tab === 'movies' ? (
              <>
                <form className="add-form" onSubmit={addMovie}>
                  <label>Film suggestion</label>
                  <input
                    value={movieTitle}
                    onChange={(e) => setMovieTitle(e.target.value)}
                    placeholder="e.g. The Nice Guys"
                    maxLength={80}
                  />
                  <label>Suggested by</label>
                  <div className="form-row">
                    <select
                      value={moviePerson}
                      onChange={(e) => setMoviePerson(e.target.value)}
                    >
                      {data.people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" disabled={!data.people.length}>
                      <Plus /> Add
                    </Button>
                  </div>
                </form>
                <div className="list-heading">
                  <span>All suggestions</span>
                  <span>{data.movies.length}</span>
                </div>
                <div className="item-list">
                  {data.movies.map((movie) => {
                    const person = personFor(movie.personId);
                    return (
                      <div
                        className={`list-item editable-row ${editingMovie === movie.id ? 'editing' : ''}`}
                        key={movie.id}
                        onClick={() => setEditingMovie(movie.id)}
                      >
                        <span
                          className="color-dot"
                          style={{ background: person?.color }}
                        />
                        {editingMovie === movie.id ? (
                          <div
                            className="inline-editor"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              autoFocus
                              value={movie.title}
                              onChange={(e) =>
                                setData((current) => ({
                                  ...current,
                                  movies: current.movies.map((m) =>
                                    m.id === movie.id
                                      ? { ...m, title: e.target.value }
                                      : m,
                                  ),
                                }))
                              }
                              onKeyDown={(e) =>
                                e.key === 'Enter' && setEditingMovie(null)
                              }
                            />
                            <select
                              value={movie.personId}
                              onChange={(e) =>
                                setData((current) => ({
                                  ...current,
                                  movies: current.movies.map((m) =>
                                    m.id === movie.id
                                      ? { ...m, personId: e.target.value }
                                      : m,
                                  ),
                                }))
                              }
                            >
                              {data.people.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button
                              aria-label="Finish editing"
                              onClick={() => setEditingMovie(null)}
                            >
                              <Check />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <strong>{movie.title}</strong>
                            <small>
                              {person?.name ?? 'Unknown'} · Click to edit
                            </small>
                          </div>
                        )}
                        <button
                          aria-label={`Remove ${movie.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setData((current) => ({
                              ...current,
                              movies: current.movies.filter(
                                (m) => m.id !== movie.id,
                              ),
                            }));
                          }}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : tab === 'people' ? (
              <>
                <form className="add-form" onSubmit={addPerson}>
                  <label>Person’s name</label>
                  <div className="form-row">
                    <input
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Name"
                      maxLength={30}
                    />
                    <input
                      className="color-input"
                      type="color"
                      value={personColor}
                      onChange={(e) => setPersonColor(e.target.value)}
                    />
                    <Button type="submit">
                      <Plus /> Add
                    </Button>
                  </div>
                </form>
                <div className="list-heading">
                  <span>Who’s here?</span>
                  <span>
                    {data.people.filter((p) => p.present).length}/
                    {data.people.length}
                  </span>
                </div>
                <div className="item-list">
                  {data.people.map((person) => (
                    <div
                      className={`list-item person-item editable-row ${editingPerson === person.id ? 'editing' : ''}`}
                      key={person.id}
                      onClick={() => setEditingPerson(person.id)}
                    >
                      <span
                        className="color-dot"
                        style={{ background: person.color }}
                      />
                      {editingPerson === person.id ? (
                        <div
                          className="inline-editor person-editor"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={person.name}
                            onChange={(e) =>
                              setData((current) => ({
                                ...current,
                                people: current.people.map((p) =>
                                  p.id === person.id
                                    ? { ...p, name: e.target.value }
                                    : p,
                                ),
                              }))
                            }
                            onKeyDown={(e) =>
                              e.key === 'Enter' && setEditingPerson(null)
                            }
                          />
                          <input
                            type="color"
                            value={person.color}
                            onChange={(e) =>
                              setData((current) => ({
                                ...current,
                                people: current.people.map((p) =>
                                  p.id === person.id
                                    ? { ...p, color: e.target.value }
                                    : p,
                                ),
                              }))
                            }
                          />
                          <button
                            aria-label="Finish editing"
                            onClick={() => setEditingPerson(null)}
                          >
                            <Check />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <strong>{person.name}</strong>
                          <small>
                            {
                              data.movies.filter(
                                (movie) => movie.personId === person.id,
                              ).length
                            }{' '}
                            suggestions · Click to edit
                          </small>
                        </div>
                      )}
                      <label
                        className="switch"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={person.present}
                          onChange={() =>
                            setData((current) => ({
                              ...current,
                              people: current.people.map((p) =>
                                p.id === person.id
                                  ? { ...p, present: !p.present }
                                  : p,
                              ),
                            }))
                          }
                        />
                        <span />
                      </label>
                      <button
                        aria-label={`Remove ${person.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removePerson(person.id);
                        }}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="settings-panel">
                <div className="setting-card">
                  <label htmlFor="spin-duration">Spin duration</label>
                  <div className="range-row">
                    <input
                      id="spin-duration"
                      type="range"
                      min="5"
                      max="15"
                      step="1"
                      value={spinSeconds}
                      onChange={(e) =>
                        setData((current) => ({
                          ...current,
                          settings: {
                            oddsMode: current.settings?.oddsMode ?? 'film',
                            spinSeconds: Number(e.target.value),
                          },
                        }))
                      }
                    />
                    <strong>{spinSeconds}s</strong>
                  </div>
                  <small>How long the wheel spins before choosing a film.</small>
                </div>
                <div className="setting-card">
                  <label htmlFor="odds-mode">Selection odds</label>
                  <select
                    id="odds-mode"
                    value={oddsMode}
                    onChange={(e) =>
                      setData((current) => ({
                        ...current,
                        settings: {
                          spinSeconds: current.settings?.spinSeconds ?? 7,
                          oddsMode: e.target.value as OddsMode,
                        },
                      }))
                    }
                  >
                    <option value="film">Equal chance per film</option>
                    <option value="person">Equal chance per person</option>
                    <option value="person-visual">
                      Equal per person — show weighted slices
                    </option>
                  </select>
                  <small>
                    The visual mode gives every present person the same total
                    wheel area, divided between their films.
                  </small>
                </div>
              </div>
            )}
          </aside>
        )}
      </section>
      {confetti.map((piece) => (
        <i
          key={piece.id}
          className="confetti"
          style={
            {
              left: `${piece.left}%`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              '--spin': `${piece.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      <Dialog open={!!winner} onOpenChange={(open) => !open && setWinner(null)}>
        <DialogContent className="winner-dialog" showCloseButton={false}>
          <DialogHeader>
            <div className="winner-icon">
              <Sparkles />
            </div>
            <p className="eyebrow">We have a winner</p>
            <DialogTitle>{winner?.title}</DialogTitle>
            <DialogDescription>
              Suggested by{' '}
              <span style={{ color: winnerPerson?.color }}>
                {winnerPerson?.name}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Keep on the wheel
            </DialogClose>
            <Button
              onClick={() => {
                if (winner)
                  setData((current) => ({
                    ...current,
                    movies: current.movies.filter(
                      (movie) => movie.id !== winner.id,
                    ),
                  }));
                setWinner(null);
              }}
            >
              Remove & close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
