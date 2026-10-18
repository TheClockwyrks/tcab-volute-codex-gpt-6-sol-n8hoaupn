import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import {
  ACTIONS,
  AIM_START,
  AIM_TURN_RATE,
  BACKFLOW_SPEED,
  BINDINGS,
  BORE_RADIUS,
  CATCHUP_SPEED,
  CELLS,
  CHAIN_RESET,
  CHANNEL,
  CHOKE_FEED_MULTIPLIER,
  CLEAR_SCORE,
  CORE_RADIUS,
  CUES,
  DANGER_S,
  EXTRACT_CUES,
  FIELD_H,
  FIELD_W,
  FIRE_COOLDOWN,
  INJECTOR_X,
  INJECTOR_Y,
  INTAKE_S,
  INTERLUDE,
  LEVELS,
  LEVEL_COUNT,
  MACHINERY_DURATIONS,
  MACHINERY_KINDS,
  MARK_INTERVAL,
  MIN_RUN,
  PATH_LENGTH,
  PRESSURE_BLEED,
  PRESSURE_DROP_PER_CORE,
  PRESSURE_FREE,
  PRESSURE_MAX,
  PRESSURE_MIN,
  PRESSURE_RISE_PER_CORE,
  PROJECTILE_SPEED,
  RECOIL,
  RECOIL_HOLD,
  SCREENS,
  SCORE_PER_CORE,
  SEEDED_CORES,
  SEEDED_HEAD_S,
  SPACING,
  STRIKE_DISTANCE,
  TICK_DT,
  TITLE_TEXT,
  VOLUTE_DEBUG_VERSION,
  CHARGE_IDS,
} from "./constants";
import type { ChargeId, MachineryKind, ScreenName } from "./constants";
export type { ChargeId, MachineryKind, ScreenName };
export interface CoreState {
  readonly charge: ChargeId;
  readonly s: number;
  readonly mark: MachineryKind | null;
}
export interface SegmentState {
  readonly count: number;
  readonly hold: number;
}
export interface ProjectileState {
  readonly charge: ChargeId;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}
export interface MachineryState {
  readonly kind: MachineryKind;
  readonly remaining: number;
}
export interface VisualEvent {
  readonly kind: "flash" | "burst" | "bore" | "pickup" | "swallow" | "recoil";
  readonly x: number;
  readonly y: number;
  readonly age: number;
  readonly charge: ChargeId | null;
  readonly seed: number;
}
export interface VoluteState {
  readonly visual: readonly VisualEvent[];
  readonly screen: ScreenName;
  readonly score: number;
  readonly level: number;
  readonly cells: number;
  readonly quotaRemaining: number;
  readonly pressure: number;
  readonly chainStep: number;
  readonly chainTimer: number;
  readonly machinery: MachineryState | null;
  readonly cores: readonly CoreState[];
  readonly segments: readonly SegmentState[];
  readonly projectiles: readonly ProjectileState[];
  readonly loaded: ChargeId | null;
  readonly queued: ChargeId | null;
  readonly aim: number;
  readonly fireCooldown: number;
  readonly interlude: number;
  readonly simTime: number;
  readonly accumulator: number;
  readonly emission: boolean;
  readonly feed: boolean;
  readonly nextEmitted: ChargeId | null;
  readonly muted: boolean;
}
type S = DeepReadonly<VoluteState>;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const norm = (n: number) => ((n % 360) + 360) % 360;
const rad = (n: number) => (n * Math.PI) / 180;
const choose = <T>(xs: readonly T[]) =>
  xs[Math.floor(Math.random() * xs.length)]!;
function point(s: number) {
  if (s <= 0) return CHANNEL[0]!;
  let left = s;
  for (let i = 0; i < CHANNEL.length - 1; i++) {
    const a = CHANNEL[i]!,
      b = CHANNEL[i + 1]!,
      d = Math.hypot(b.x - a.x, b.y - a.y);
    if (left < d || i === CHANNEL.length - 2)
      return {
        x: a.x + (b.x - a.x) * clamp(left / d, 0, 1),
        y: a.y + (b.y - a.y) * clamp(left / d, 0, 1),
      };
    left -= d;
  }
  return CHANNEL[CHANNEL.length - 1]!;
}
function forward(s: number) {
  let left = Math.max(0, s);
  for (let i = 0; i < CHANNEL.length - 1; i++) {
    const a = CHANNEL[i]!,
      b = CHANNEL[i + 1]!,
      d = Math.hypot(b.x - a.x, b.y - a.y);
    if (left < d || i === CHANNEL.length - 2)
      return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
    left -= d;
  }
  return { x: -1, y: 0 };
}
function segments(
  cores: readonly CoreState[],
  old: readonly SegmentState[] = [],
): SegmentState[] {
  const out: SegmentState[] = [];
  let offset = 0;
  for (let i = 0; i < cores.length; i++) {
    if (i === 0 || Math.abs(cores[i - 1]!.s - cores[i]!.s - SPACING) > 1e-7) {
      out.push({
        count: 1,
        hold:
          old.find((_, j) => {
            let n = 0;
            for (let k = 0; k <= j; k++) n += old[k]!.count;
            return i < n;
          })?.hold ?? 0,
      });
      offset = out.length - 1;
    } else out[offset] = { ...out[offset]!, count: out[offset]!.count + 1 };
  }
  return out;
}
function feedSpeed(s: S) {
  return (
    LEVELS[s.level - 1]!.feedSpeed *
    (1 + s.pressure / 100) *
    (s.machinery?.kind === "choke" ? CHOKE_FEED_MULTIPLIER : 1)
  );
}
function danger(s: S) {
  return (
    s.screen === "playing" && !!s.cores.length && s.cores[0]!.s >= DANGER_S
  );
}
function drawCharge(s: S) {
  const distinct = [...new Set(s.cores.map((c) => c.charge))];
  return choose(distinct.length ? distinct : LEVELS[s.level - 1]!.charges);
}
function markFor(n: number): MachineryKind | null {
  return n % MARK_INTERVAL === 0
    ? MACHINERY_KINDS[(n / MARK_INTERVAL - 1) % MACHINERY_KINDS.length]!
    : null;
}
function title(s?: S): VoluteState {
  return {
    screen: "title",
    visual: [],
    score: 0,
    level: 1,
    cells: CELLS,
    quotaRemaining: LEVELS[0]!.quota,
    pressure: 0,
    chainStep: 1,
    chainTimer: 0,
    machinery: null,
    cores: [],
    segments: [],
    projectiles: [],
    loaded: null,
    queued: null,
    aim: AIM_START,
    fireCooldown: 0,
    interlude: 0,
    simTime: 0,
    accumulator: 0,
    emission: s?.emission ?? true,
    feed: s?.feed ?? true,
    nextEmitted: null,
    muted: s?.muted ?? false,
  };
}
function start(s: S, level: number): VoluteState {
  const cores = Array.from({ length: SEEDED_CORES }, (_, i): CoreState => ({
    s: SEEDED_HEAD_S - i * SPACING,
    charge: choose(LEVELS[level - 1]!.charges),
    mark: markFor(i + 1),
  }));
  const base = {
    ...s,
    screen: "playing" as const,
    visual: [],
    level,
    quotaRemaining: LEVELS[level - 1]!.quota - SEEDED_CORES,
    pressure: 0,
    chainStep: 1,
    chainTimer: 0,
    machinery: null,
    cores,
    segments: [{ count: SEEDED_CORES, hold: 0 }],
    projectiles: [],
    loaded: choose(LEVELS[level - 1]!.charges),
    queued: choose(LEVELS[level - 1]!.charges),
    fireCooldown: 0,
    interlude: 0,
    accumulator: 0,
  };
  return base;
}
function shot(s: S): VoluteState {
  const charge = s.loaded ?? drawCharge(s),
    queued = s.queued ?? drawCharge(s);
  return {
    ...s,
    loaded: queued,
    queued: drawCharge(s),
    fireCooldown: FIRE_COOLDOWN,
    visual: [
      ...s.visual,
      {
        kind: "recoil",
        x: INJECTOR_X,
        y: INJECTOR_Y,
        age: 0,
        charge: null,
        seed: s.simTime,
      },
    ],
    projectiles: [
      ...s.projectiles,
      { charge, x: INJECTOR_X, y: INJECTOR_Y, angle: s.aim },
    ],
  };
}
function remove(
  s: VoluteState,
  indices: number[],
  k: number,
  extraction: boolean,
  cue: Set<string>,
): VoluteState {
  if (!indices.length) return s;
  const taken = indices.map((i) => s.cores[i]!);
  const removed = new Set(indices);
  let cores = s.cores.filter((_, i) => !removed.has(i));
  const old = segments(cores, s.segments);
  let groupStart = cores.findIndex((c) => c.s < taken[0]!.s);
  if (groupStart < 0) groupStart = cores.length;
  for (let i = groupStart; i < cores.length;) {
    let end = i + 1;
    while (
      end < cores.length &&
      Math.abs(cores[end - 1]!.s - cores[end]!.s - SPACING) < 1e-7
    )
      end++;
    const tail = cores[end - 1]!,
      behind = cores[end];
    const room = Math.min(
      tail.s,
      behind ? tail.s - behind.s - SPACING : RECOIL,
    );
    const moved = clamp(room, 0, RECOIL);
    cores = cores.map((c, j) =>
      j >= i && j < end ? { ...c, s: c.s - moved } : c,
    );
    i = end;
  }
  const segs = segments(cores, old).map((seg, i) => {
    let n = 0;
    for (let j = 0; j < i; j++) n += segments(cores, old)[j]!.count;
    return n >= groupStart ? { ...seg, hold: RECOIL_HOLD } : seg;
  });
  let next: VoluteState = {
    ...s,
    visual: [
      ...s.visual,
      ...(extraction
        ? taken.flatMap((c) => {
            const p = point(c.s);
            return [
              {
                kind: "flash" as const,
                x: p.x,
                y: p.y,
                age: 0,
                charge: c.charge,
                seed: s.simTime + c.s,
              },
              {
                kind: "burst" as const,
                x: p.x,
                y: p.y,
                age: 0,
                charge: c.charge,
                seed: s.simTime + c.s + 0.1,
              },
              ...(c.mark
                ? [
                    {
                      kind: "pickup" as const,
                      x: p.x,
                      y: p.y,
                      age: 0,
                      charge: c.charge,
                      seed: s.simTime + c.s + 0.2,
                    },
                  ]
                : []),
            ];
          })
        : []),
    ],
    cores,
    segments: segs,
    score: s.score + SCORE_PER_CORE * taken.length * k,
    pressure: clamp(
      s.pressure - taken.length * PRESSURE_DROP_PER_CORE,
      PRESSURE_MIN,
      PRESSURE_MAX,
    ),
    chainStep: extraction ? k : s.chainStep,
    chainTimer: extraction ? CHAIN_RESET : s.chainTimer,
  };
  if (extraction) {
    cue.add(EXTRACT_CUES[Math.min(k, EXTRACT_CUES.length) - 1]!);
    for (const core of taken) {
      if (core.mark) {
        cue.add(CUES.machinery);
        if (core.mark === "bore") {
          const p = point(core.s);
          next = {
            ...next,
            visual: [
              ...next.visual,
              {
                kind: "bore",
                x: p.x,
                y: p.y,
                age: 0,
                charge: core.charge,
                seed: s.simTime + core.s,
              },
            ],
          };
          const hits = next.cores.flatMap((c, i) => {
            const q = point(c.s);
            return Math.hypot(q.x - p.x, q.y - p.y) <= BORE_RADIUS ? [i] : [];
          });
          next = remove(next, hits, next.chainStep, false, cue);
        } else
          next = {
            ...next,
            machinery: {
              kind: core.mark,
              remaining: MACHINERY_DURATIONS[core.mark],
            },
          };
      }
    }
  }
  return next;
}
function extractAt(
  s: VoluteState,
  index: number,
  merge: boolean,
  cue: Set<string>,
): VoluteState {
  if (index < 0 || index >= s.cores.length) return s;
  const segs = segments(s.cores, s.segments);
  let a = 0,
    b = s.cores.length - 1,
    n = 0;
  for (const seg of segs) {
    if (index < n + seg.count) {
      a = n;
      b = n + seg.count - 1;
      break;
    }
    n += seg.count;
  }
  while (index > a && s.cores[index - 1]!.charge === s.cores[index]!.charge)
    index--;
  let end = index;
  while (end < b && s.cores[end + 1]!.charge === s.cores[index]!.charge) end++;
  return end - index + 1 >= MIN_RUN
    ? remove(
        s,
        Array.from({ length: end - index + 1 }, (_, i) => index + i),
        merge ? s.chainStep + 1 : 1,
        true,
        cue,
      )
    : s;
}
function tick(input: S, cue: Set<string>): VoluteState {
  let s: VoluteState = {
    ...input,
    visual: input.visual
      .map((v) => ({ ...v, age: v.age + TICK_DT }))
      .filter((v) => v.age < 0.65),
    fireCooldown: Math.max(0, input.fireCooldown - TICK_DT),
    chainTimer: Math.max(0, input.chainTimer - TICK_DT),
    machinery: input.machinery
      ? { ...input.machinery, remaining: input.machinery.remaining - TICK_DT }
      : null,
    segments: input.segments.map((x) => ({
      ...x,
      hold: Math.max(0, x.hold - TICK_DT),
    })),
  };
  if (s.chainTimer === 0) s = { ...s, chainStep: 1 };
  if (s.machinery && s.machinery.remaining <= 0) s = { ...s, machinery: null };
  if (s.feed && s.cores.length) {
    let cores = [...s.cores],
      segs = segments(cores, s.segments);
    if (s.machinery?.kind === "backflow") {
      for (let i = cores.length - 1; i >= 0; i--)
        cores[i] = {
          ...cores[i]!,
          s: Math.max(
            cores[i]!.s < 0 ? cores[i]!.s : 0,
            cores[i]!.s - BACKFLOW_SPEED * TICK_DT,
            i < cores.length - 1 ? cores[i + 1]!.s + SPACING : 0,
          ),
        };
    } else {
      let offset = 0;
      for (let j = 0; j < segs.length; j++) {
        const seg = segs[j]!;
        let move =
          seg.hold > 0 ? 0 : (j === 0 ? feedSpeed(s) : CATCHUP_SPEED) * TICK_DT;
        if (j > 0) {
          const cap = cores[offset - 1]!.s - SPACING - cores[offset]!.s;
          move = Math.min(move, Math.max(0, cap));
        }
        for (let i = offset; i < offset + seg.count; i++)
          cores[i] = { ...cores[i]!, s: cores[i]!.s + move };
        if (
          j > 0 &&
          Math.abs(cores[offset - 1]!.s - cores[offset]!.s - SPACING) < 1e-7 &&
          move > 0 &&
          cores[offset - 1]!.charge === cores[offset]!.charge
        ) {
          const temp = { ...s, cores, segments: segments(cores, segs) };
          const result = extractAt(temp, offset, true, cue);
          if (result.cores.length < cores.length) {
            s = result;
            cores = [...s.cores];
            segs = segments(cores, s.segments);
            break;
          }
        }
        offset += seg.count;
      }
    }
    s = { ...s, cores, segments: segments(cores, segs) };
  }
  const projectiles: ProjectileState[] = [];
  for (const p of s.projectiles) {
    const x = p.x + Math.cos(rad(p.angle)) * PROJECTILE_SPEED * TICK_DT,
      y = p.y + Math.sin(rad(p.angle)) * PROJECTILE_SPEED * TICK_DT;
    if (x < 0 || x > FIELD_W || y < 0 || y > FIELD_H) continue;
    let index = -1,
      best = STRIKE_DISTANCE;
    for (let i = 0; i < s.cores.length; i++) {
      const q = point(s.cores[i]!.s),
        d = Math.hypot(x - q.x, y - q.y);
      if (
        d <= best + 1e-9 &&
        (d < best - 1e-9 || index < 0 || s.cores[i]!.s > s.cores[index]!.s)
      ) {
        index = i;
        best = d;
      }
    }
    if (index < 0) {
      projectiles.push({ ...p, x, y });
      continue;
    }
    cue.add(CUES.seat);
    const target = s.cores[index]!,
      q = point(target.s),
      f = forward(target.s),
      ahead = (x - q.x) * f.x + (y - q.y) * f.y > 0,
      pos = target.s - (ahead ? 0 : SPACING);
    const cores = s.cores.map((c) =>
      c.s <= pos ? { ...c, s: c.s - SPACING } : c,
    );
    const insertIndex = ahead ? index : index + 1;
    cores.splice(insertIndex, 0, { charge: p.charge, s: pos, mark: null });
    s = { ...s, cores, segments: segments(cores, s.segments) };
    s = extractAt(s, insertIndex, false, cue);
  }
  s = { ...s, projectiles };
  const rise =
    Math.max(0, s.cores.length - PRESSURE_FREE) * PRESSURE_RISE_PER_CORE;
  const bleed = s.cores.length <= PRESSURE_FREE ? PRESSURE_BLEED : 0;
  s = {
    ...s,
    pressure: clamp(
      s.pressure + (rise - bleed) * TICK_DT,
      PRESSURE_MIN,
      PRESSURE_MAX,
    ),
  };
  if (s.cores[0] && s.cores[0].s >= INTAKE_S) {
    cue.add(CUES.intake);
    cue.add(CUES.cellLost);
    const cells = Math.max(0, s.cells - 1);
    return {
      ...s,
      visual: [
        ...s.visual,
        {
          kind: "swallow",
          x: 480,
          y: 320,
          age: 0,
          charge: null,
          seed: s.simTime,
        },
      ],
      cells,
      screen: cells ? "setback" : "gameover",
      cores: [],
      segments: [],
      projectiles: [],
      pressure: 0,
      machinery: null,
      chainStep: 1,
      chainTimer: 0,
      quotaRemaining: LEVELS[s.level - 1]!.quota - SEEDED_CORES,
      interlude: cells ? INTERLUDE : 0,
      accumulator: 0,
    };
  }
  if (s.quotaRemaining === 0 && !s.cores.length) {
    cue.add(CUES.levelClear);
    return {
      ...s,
      score: s.score + CLEAR_SCORE,
      screen: s.level === LEVEL_COUNT ? "victory" : "cleared",
      interlude: s.level === LEVEL_COUNT ? 0 : INTERLUDE,
      accumulator: 0,
    };
  }
  if (
    s.emission &&
    s.machinery?.kind !== "backflow" &&
    s.quotaRemaining > 0 &&
    (!s.cores.length || s.cores[s.cores.length - 1]!.s >= SPACING)
  ) {
    const count = LEVELS[s.level - 1]!.quota - s.quotaRemaining + 1;
    const core: CoreState = {
      s: 0,
      charge: s.nextEmitted ?? drawCharge(s),
      mark: markFor(count),
    };
    const cores = [...s.cores, core];
    s = {
      ...s,
      cores,
      segments: segments(cores, s.segments),
      quotaRemaining: s.quotaRemaining - 1,
      nextEmitted: null,
    };
  }
  return s;
}
export interface VoluteDebugApi {
  readonly version: number;
  reset(s: S): VoluteState;
  reconcile(s: S): VoluteState;
  snapshot(s: S): ReturnType<typeof snapshot>;
  setScreen(s: S, name: ScreenName): VoluteState;
  setLevel(s: S, n: number): VoluteState;
  setScore(s: S, n: number): VoluteState;
  setCells(s: S, n: number): VoluteState;
  setChainStep(s: S, n: number): VoluteState;
  startLevel(s: S, n: number): VoluteState;
  poseTrain(
    s: S,
    cores: readonly (readonly [number, ChargeId, MachineryKind | null])[],
  ): VoluteState;
  clearTrain(s: S): VoluteState;
  setLoaded(s: S, c: ChargeId): VoluteState;
  setQueued(s: S, c: ChargeId): VoluteState;
  setAim(s: S, n: number): VoluteState;
  fire(s: S): VoluteState;
  setPressure(s: S, n: number): VoluteState;
  setQuotaRemaining(s: S, n: number): VoluteState;
  setEmission(s: S, b: boolean): VoluteState;
  setNextEmitted(s: S, c: ChargeId | null): VoluteState;
  setFeed(s: S, b: boolean): VoluteState;
  grantMachinery(s: S, k: Exclude<MachineryKind, "bore">): VoluteState;
  pause(s: S): VoluteState;
  resume(s: S): VoluteState;
}
function validNumber(
  n: number,
  min = -Infinity,
  max = Infinity,
  whole = false,
) {
  if (
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (whole && !Number.isInteger(n))
  )
    throw new RangeError(`Invalid value ${n}`);
}
function member<T>(n: T, xs: readonly T[]) {
  if (!xs.includes(n)) throw new RangeError(`Invalid value ${String(n)}`);
}
function snapshot(s: S) {
  let i = 0;
  const train = s.cores.map((c) => {
    while (
      i < s.segments.length - 1 &&
      s.cores.indexOf(c) >=
        s.segments.slice(0, i + 1).reduce((n, x) => n + x.count, 0)
    )
      i++;
    return { ...c, ...point(c.s), segment: i };
  });
  return {
    version: VOLUTE_DEBUG_VERSION,
    screen: s.screen,
    score: s.score,
    level: s.level,
    cells: s.cells,
    quotaRemaining: s.quotaRemaining,
    emitted: LEVELS[s.level - 1]!.quota - s.quotaRemaining,
    pressure: s.pressure,
    feedSpeed: feedSpeed(s),
    chainStep: s.chainStep,
    chainTimer: s.chainTimer,
    interlude: s.interlude,
    danger: danger(s),
    train,
    segments: s.segments.map((x) => ({ ...x })),
    injector: {
      aim: s.aim,
      cooldown: s.fireCooldown,
      loaded: s.loaded,
      queued: s.queued,
    },
    projectiles: s.projectiles.map((x) => ({ ...x })),
    machinery: s.machinery ? { ...s.machinery } : null,
    emission: s.emission,
    feed: s.feed,
    nextEmitted: s.nextEmitted,
    muted: s.muted,
    simTime: s.simTime,
  };
}
const debug: VoluteDebugApi = {
  version: VOLUTE_DEBUG_VERSION,
  reset: title,
  reconcile: (s) => ({ ...s, segments: segments(s.cores, s.segments) }),
  snapshot,
  setScreen: (s, n) => {
    member(n, SCREENS);
    return { ...s, screen: n };
  },
  setLevel: (s, n) => {
    validNumber(n, 1, LEVEL_COUNT, true);
    return { ...s, level: n };
  },
  setScore: (s, n) => {
    validNumber(n, 0, Infinity, true);
    return { ...s, score: n };
  },
  setCells: (s, n) => {
    validNumber(n, 0, CELLS, true);
    return { ...s, cells: n };
  },
  setChainStep: (s, n) => {
    validNumber(n, 1, Infinity, true);
    return { ...s, chainStep: n, chainTimer: CHAIN_RESET };
  },
  startLevel: (s, n) => {
    validNumber(n, 1, LEVEL_COUNT, true);
    return start(s, n);
  },
  poseTrain: (s, items) => {
    const cores = items
      .map(([v, c, m]) => {
        validNumber(v, -Infinity, PATH_LENGTH);
        member(c, CHARGE_IDS);
        if (m !== null) member(m, MACHINERY_KINDS);
        return { s: v, charge: c, mark: m };
      })
      .sort((a, b) => b.s - a.s);
    return { ...s, cores, segments: segments(cores) };
  },
  clearTrain: (s) => ({ ...s, cores: [], segments: [], projectiles: [] }),
  setLoaded: (s, c) => {
    member(c, CHARGE_IDS);
    return { ...s, loaded: c };
  },
  setQueued: (s, c) => {
    member(c, CHARGE_IDS);
    return { ...s, queued: c };
  },
  setAim: (s, n) => {
    validNumber(n);
    return { ...s, aim: norm(n) };
  },
  fire: (s) =>
    shot({ ...s, fireCooldown: 0, loaded: s.loaded ?? drawCharge(s) }),
  setPressure: (s, n) => {
    validNumber(n, PRESSURE_MIN, PRESSURE_MAX);
    return { ...s, pressure: n };
  },
  setQuotaRemaining: (s, n) => {
    validNumber(n, 0, Infinity, true);
    return { ...s, quotaRemaining: n };
  },
  setEmission: (s, b) => {
    if (typeof b !== "boolean") throw new TypeError("Invalid emission");
    return { ...s, emission: b };
  },
  setNextEmitted: (s, c) => {
    if (c !== null) member(c, CHARGE_IDS);
    return { ...s, nextEmitted: c };
  },
  setFeed: (s, b) => {
    if (typeof b !== "boolean") throw new TypeError("Invalid feed");
    return { ...s, feed: b };
  },
  grantMachinery: (s, k) => {
    member(
      k,
      MACHINERY_KINDS.filter((x) => x !== "bore"),
    );
    return { ...s, machinery: { kind: k, remaining: MACHINERY_DURATIONS[k] } };
  },
  pause: (s) => ({ ...s, screen: "paused" }),
  resume: (s) => ({ ...s, screen: "playing" }),
};
export const BACKGROUND = "#101c23";
const chargeColors: Record<ChargeId, string> = {
  halide: "#a9f4ea",
  sulfur: "#ffcf64",
  cobalt: "#86b5ff",
  garnet: "#f784a5",
  olivine: "#b5db77",
};
const images = new Map<string, ImageBitmap>();
const effects = new Map<string, ParticleSystem>();
const particlePlayers = new Map<
  string,
  {
    player: ParticleCanvasPlayer;
    age: number;
    canvas: HTMLCanvasElement;
    scale: number;
  }
>();
function img(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
) {
  const image = images.get(name);
  if (image)
    ctx.drawImage(
      image,
      Math.round(x - (w ?? image.width) / 2),
      Math.round(y - (h ?? image.height) / 2),
      w ?? image.width,
      h ?? image.height,
    );
}
function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size = 18,
  color = "#e8dfc8",
  align: CanvasTextAlign = "left",
) {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px system-ui`;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}
function drawHall(ctx: CanvasRenderingContext2D, s: S) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#142630";
  for (let x = 0; x < FIELD_W; x += 40)
    for (let y = 0; y < FIELD_H; y += 40) {
      ctx.fillRect(x + 1, y + 1, 38, 38);
      if ((x + y) % 120 === 0) {
        ctx.fillStyle = "#213741";
        ctx.fillRect(x + 5, y + 6, 2, 2);
        ctx.fillStyle = "#142630";
      }
    }
  ctx.strokeStyle = "#54616a";
  ctx.lineWidth = 39;
  ctx.lineJoin = "round";
  ctx.beginPath();
  CHANNEL.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = "#293d47";
  ctx.lineWidth = 32;
  ctx.stroke();
  for (let q = 0; q <= PATH_LENGTH; q += 32) {
    const p = point(q);
    img(ctx, "channel-plate", p.x, p.y, 32, 32);
  }
  ctx.strokeStyle = "#9b8f70";
  ctx.lineWidth = 2;
  ctx.beginPath();
  CHANNEL.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  img(ctx, "intake-maw", 480, 320);
  for (const core of s.cores) {
    const p = point(core.s);
    img(ctx, `core-${core.charge}`, p.x, p.y);
    if (core.mark) img(ctx, `mark-${core.mark}`, p.x, p.y);
  }
  for (const p of s.projectiles) img(ctx, `core-${p.charge}`, p.x, p.y);
  img(ctx, "injector-base", INJECTOR_X, INJECTOR_Y);
  ctx.save();
  ctx.translate(INJECTOR_X, INJECTOR_Y);
  ctx.rotate(rad(s.aim));
  img(ctx, "injector-barrel", 20, 0);
  ctx.restore();
  if (s.loaded) img(ctx, `core-${s.loaded}`, INJECTOR_X, INJECTOR_Y);
  if (s.machinery?.kind === "sightline") {
    ctx.strokeStyle = "#e8dfc888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(INJECTOR_X, INJECTOR_Y);
    const a = rad(s.aim);
    let len = 1000;
    for (const c of s.cores) {
      const p = point(c.s),
        dx = p.x - INJECTOR_X,
        dy = p.y - INJECTOR_Y,
        along = dx * Math.cos(a) + dy * Math.sin(a),
        perp = Math.abs(dx * Math.sin(a) - dy * Math.cos(a));
      if (along > 0 && perp < CORE_RADIUS)
        len = Math.min(len, along - Math.sqrt(CORE_RADIUS ** 2 - perp ** 2));
    }
    ctx.lineTo(INJECTOR_X + Math.cos(a) * len, INJECTOR_Y + Math.sin(a) * len);
    ctx.stroke();
  }
}
function drawVisual(ctx: CanvasRenderingContext2D, s: S) {
  const live = new Set<string>();
  for (const v of s.visual) {
    if (v.kind === "flash" || v.kind === "recoil" || v.kind === "swallow") {
      const name =
        v.kind === "flash"
          ? "extraction-flash"
          : v.kind === "recoil"
            ? "fire-recoil"
            : "maw-swallow";
      const count = v.kind === "recoil" ? 4 : 6;
      const frame = Math.min(
        count - 1,
        Math.floor(v.age * (v.kind === "recoil" ? 25 : 18)),
      );
      const image = images.get(`${name}/${frame}`);
      if (image) {
        ctx.save();
        if (v.kind === "flash" && v.charge) {
          ctx.globalAlpha = 0.82;
          ctx.globalCompositeOperation = "screen";
          ctx.filter = `hue-rotate(${CHARGE_IDS.indexOf(v.charge) * 66}deg)`;
        }
        if (v.kind === "recoil") {
          ctx.translate(v.x, v.y);
          ctx.rotate(rad(s.aim));
          ctx.drawImage(image, 0, -10);
        } else
          ctx.drawImage(image, v.x - image.width / 2, v.y - image.height / 2);
        ctx.restore();
      }
    }
    const name =
      v.kind === "burst"
        ? "extraction-burst"
        : v.kind === "bore"
          ? "bore-detonation"
          : v.kind === "pickup"
            ? "pickup-shimmer"
            : v.kind === "swallow"
              ? "intake-spray"
              : null;
    if (name) {
      const base = effects.get(name);
      if (base) {
        const transform = ctx.getTransform();
        const cw = ctx.canvas.width,
          ch = ctx.canvas.height;
        const scale = (Math.abs(transform.a) + Math.abs(transform.d)) / 2;
        const key = `${name}:${v.seed}`;
        live.add(key);
        let entry = particlePlayers.get(key);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (!entry || entry.canvas !== ctx.canvas || entry.scale !== scale) {
          const system: ParticleSystem = {
            ...base,
            field: { width: cw, height: ch },
            emitters: base.emitters.map((e) => ({
              ...e,
              position: [
                v.x * transform.a + transform.e,
                ch - (v.y * transform.d + transform.f),
                0,
              ],
              speed: e.speed * scale,
              particle:
                v.charge && name === "extraction-burst"
                  ? {
                      ...e.particle,
                      colorGradient: [
                        { at: 0, color: chargeColors[v.charge] },
                        { at: 1, color: "#ffffff" },
                      ],
                    }
                  : e.particle,
            })),
          };
          entry = {
            player: new ParticleCanvasPlayer(system, ctx, {
              clear: false,
              pixelRadius: 2.2 * scale,
              seed: Math.floor(v.seed * 1000),
            }),
            age: 0,
            canvas: ctx.canvas,
            scale,
          };
          particlePlayers.set(key, entry);
        }
        entry.player.update(Math.max(0, v.age - entry.age));
        entry.age = v.age;
        ctx.restore();
      }
    }
  }
  for (const key of particlePlayers.keys())
    if (!live.has(key)) particlePlayers.delete(key);
}
function drawHud(ctx: CanvasRenderingContext2D, s: S) {
  ctx.fillStyle = "#0b151de9";
  ctx.fillRect(298, 247, 294, 58);
  ctx.strokeStyle = "#bba678";
  ctx.strokeRect(298.5, 247.5, 293, 57);
  text(ctx, `SCORE ${s.score.toString().padStart(5, "0")}`, 310, 269, 14);
  text(ctx, `LEVEL ${s.level}`, 310, 291, 13);
  for (let i = 0; i < s.cells; i++) img(ctx, "cell-icon", 480 + i * 26, 262);
  img(ctx, "pressure-icon", 465, 289);
  ctx.fillStyle = "#42545b";
  ctx.fillRect(482, 283, 95, 11);
  ctx.fillStyle = s.pressure > 65 ? "#ff704d" : "#dfaf67";
  ctx.fillRect(482, 283, (95 * s.pressure) / 100, 11);
  text(ctx, "READY", 293, 367, 12);
  if (s.loaded) img(ctx, `core-${s.loaded}`, 340, 360);
  text(ctx, "NEXT", 483, 367, 12);
  if (s.queued) img(ctx, `core-${s.queued}`, 530, 360);
  if (danger(s)) {
    ctx.fillStyle = "#e56950";
    ctx.fillRect(332, 183, 222, 24);
    text(ctx, "⚠ INTAKE PRESSURE", 443, 200, 15, "#19232b", "center");
  }
}
function panel(
  ctx: CanvasRenderingContext2D,
  title: string,
  lines: string[],
  accent = "#f1cf84",
) {
  ctx.fillStyle = "#0b1820ef";
  ctx.fillRect(255, 116, 450, 308);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(255, 116, 450, 308);
  text(ctx, title, 480, 178, 39, accent, "center");
  lines.forEach((l, i) =>
    text(ctx, l, 480, 228 + i * 31, 17, "#e9e3d2", "center"),
  );
}
export const game: Game<VoluteState, VoluteDebugApi> = {
  async initialize(api) {
    for (const a of ACTIONS) api.input.register(a, { keys: [...BINDINGS[a]] });
    const names = [
      ...CHARGE_IDS.map((x) => `core-${x}`),
      ...MACHINERY_KINDS.map((x) => `mark-${x}`),
      "injector-base",
      "injector-barrel",
      "intake-maw",
      "channel-plate",
      "cell-icon",
      "pressure-icon",
      ...["fire-recoil", "maw-swallow", "extraction-flash"].flatMap((n) =>
        Array.from(
          { length: n === "fire-recoil" ? 4 : 6 },
          (_, i) => `${n}/${i}`,
        ),
      ),
    ];
    await Promise.all(
      names.map(async (n) =>
        images.set(
          n,
          await api.assets.loadImage(
            `${n.includes("/") ? "sheets" : "sprites"}/${n}.png`,
          ),
        ),
      ),
    );
    await Promise.all(
      Object.values(CUES).map((c) => api.audio.load(c, `audio/${c}.wav`)),
    );
    await Promise.all(
      [
        "extraction-burst",
        "bore-detonation",
        "intake-spray",
        "pickup-shimmer",
      ].map(async (n) => {
        const data = await (
          await api.assets.load(`effects/${n}/system.json`)
        ).text();
        effects.set(n, JSON.parse(data) as ParticleSystem);
      }),
    );
    for (const [name, source] of Object.entries({
      screen: (s: S) => s.screen,
      level: (s: S) => `${s.level} · ${s.score}`,
      cells: (s: S) => s.cells,
      quota: (s: S) => s.quotaRemaining,
      pressure: (s: S) =>
        `${s.pressure.toFixed(1)} · ${feedSpeed(s).toFixed(1)}`,
      chain: (s: S) => s.chainStep,
      cores: (s: S) => `${s.cores.length} · ${s.cores[0]?.s.toFixed(1) ?? "—"}`,
      segments: (s: S) => s.segments.length,
      danger: (s: S) => danger(s),
      injector: (s: S) =>
        `${s.loaded}/${s.queued} ${s.aim.toFixed(0)}° ${s.fireCooldown.toFixed(2)}`,
      projectiles: (s: S) => s.projectiles.length,
      machinery: (s: S) =>
        s.machinery
          ? `${s.machinery.kind} ${s.machinery.remaining.toFixed(1)}`
          : "—",
    }))
      api.diagnostics.register(name, source);
    return [title(), debug];
  },
  update(prev, api, dt) {
    let s: VoluteState = {
      ...prev,
      simTime: prev.simTime + dt,
      muted: api.audio.muted(),
    };
    if (api.input.pressed("mute")) {
      api.audio.setMuted(!api.audio.muted());
      s = { ...s, muted: api.audio.muted() };
    }
    const press =
      api.input.pointerPressed() &&
      (() => {
        const p = api.input.pointer();
        return p.x >= 0 && p.x <= FIELD_W && p.y >= 0 && p.y <= FIELD_H;
      })();
    const confirm = api.input.pressed("confirm") || press;
    if (s.screen === "title") {
      if (confirm) s = start({ ...s, score: 0, cells: CELLS }, 1);
    } else if (s.screen === "gameover" || s.screen === "victory") {
      if (confirm) s = title(s);
    } else if (s.screen === "paused") {
      if (api.input.pressed("pause")) s = { ...s, screen: "playing" };
    } else if (s.screen === "playing") {
      if (api.input.pressed("pause"))
        s = { ...s, screen: "paused", accumulator: 0 };
      else {
        const p = api.input.pointer();
        if (
          api.input.pointerSamples().length > 0 &&
          (p.x || p.y) &&
          !(p.x === INJECTOR_X && p.y === INJECTOR_Y) &&
          p.x >= 0 &&
          p.x <= FIELD_W &&
          p.y >= 0 &&
          p.y <= FIELD_H
        )
          s = {
            ...s,
            aim: norm(
              (Math.atan2(p.y - INJECTOR_Y, p.x - INJECTOR_X) * 180) / Math.PI,
            ),
          };
        s = {
          ...s,
          aim: norm(
            s.aim +
              (api.input.value("right") - api.input.value("left")) *
                AIM_TURN_RATE *
                dt,
          ),
        };
        if (api.input.pressed("b")) {
          s = { ...s, loaded: s.queued, queued: s.loaded };
          api.audio.play(CUES.swap);
        }
        if (api.input.pressed("a") || press) {
          if (s.fireCooldown > 0) api.audio.play(CUES.denied);
          else {
            s = shot(s);
            api.audio.play(CUES.fire);
          }
        }
      }
    }
    if (s.screen === "cleared" || s.screen === "setback") {
      const t = s.interlude - dt;
      s =
        t <= 0
          ? start(s, s.screen === "cleared" ? s.level + 1 : s.level)
          : {
              ...s,
              interlude: t,
              accumulator: 0,
              visual: s.visual
                .map((v) => ({ ...v, age: v.age + dt }))
                .filter((v) => v.age < 0.65),
            };
    }
    if (s.screen === "playing") {
      let time = s.accumulator + Math.max(0, dt);
      while (time + 1e-9 >= TICK_DT && s.screen === "playing") {
        const cues = new Set<string>();
        s = tick(s, cues);
        for (const cue of cues) api.audio.play(cue);
        time -= TICK_DT;
      }
      s = { ...s, accumulator: s.screen === "playing" ? Math.max(0, time) : 0 };
    }
    const bed =
      s.screen === "playing"
        ? danger(s)
          ? CUES.dangerLoop
          : CUES.hallLoop
        : null;
    for (const loop of [CUES.hallLoop, CUES.dangerLoop]) {
      if (loop === bed) {
        if (!api.audio.looping(loop)) api.audio.loop(loop);
      } else if (api.audio.looping(loop)) api.audio.stop(loop);
    }
    return s;
  },
  render(s, api) {
    const ctx = api.ctx;
    drawHall(ctx, s);
    drawVisual(ctx, s);
    if (s.screen !== "title") drawHud(ctx, s);
    if (s.screen === "title")
      panel(ctx, TITLE_TEXT, [
        "GEOTHERMAL CORE EXTRACTION",
        "ENTER / TAP TO START",
        "A D OR ◀ ▶  TURN  ·  POINTER AIMS",
        "SPACE / TAP FIRES  ·  X SWAPS",
        "ESC PAUSES  ·  M MUTES",
      ]);
    if (s.screen === "paused")
      panel(ctx, "PAUSED", ["THE HALL IS HOLDING", "ESC / P TO RESUME"]);
    if (s.screen === "cleared")
      panel(ctx, `LEVEL ${s.level} CLEAR`, [
        `+${CLEAR_SCORE} POINTS`,
        `SCORE ${s.score}`,
        "PREPARING NEXT CHANNEL",
      ]);
    if (s.screen === "setback")
      panel(ctx, "CELL LOST", [`${s.cells} CELLS REMAIN`, "RESTARTING LEVEL"]);
    if (s.screen === "gameover")
      panel(ctx, "HALL SHUTDOWN", [
        `FINAL SCORE ${s.score}`,
        `LEVEL REACHED ${s.level}`,
        "ENTER / TAP TO RETURN",
      ]);
    if (s.screen === "victory")
      panel(ctx, "HALL CLEARED", [
        `FINAL SCORE ${s.score}`,
        "ALL FIVE LEVELS COMPLETE",
        "ENTER / TAP TO RETURN",
      ]);
  },
};
