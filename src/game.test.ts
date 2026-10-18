import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { game } from "./game";
import type { VoluteState } from "./game";
import { TICK_DT, INTAKE_S, LEVELS, CELLS, CHAIN_RESET } from "./constants";

async function setup(realAssets = false) {
  const heard: string[] = [];
  const input = {
    register: () => {},
    value: () => 0,
    pressed: () => false,
    pointer: () => ({ x: 0, y: 0 }),
    pointerPressed: () => false,
    pointerSamples: () => [],
  };
  const audio = {
    load: async () => {},
    muted: () => false,
    setMuted: () => {},
    play: (s: string) => heard.push(s),
    loop: () => {},
    stop: () => {},
    looping: () => false,
  };
  const assets = {
    loadImage: async (_path: string) =>
      realAssets ? createCanvas(64, 64) : {},
    load: async (_path: string) =>
      realAssets
        ? new Blob([
            '{"dimensions":2,"field":{"width":960,"height":540},"durationMs":300,"fps":60,"loop":false,"emitters":[{"name":"test","shape":"point","position":[0,0,0],"extent":{"radius":0,"size":[0,0,0]},"emission":{"mode":"burst","count":4,"atMs":0},"lifetimeMs":240,"speed":60,"direction":[1,0,0],"coneAngle":180}]}',
          ])
        : new Blob([
            '{"dimensions":2,"field":{"width":960,"height":540},"durationMs":100,"fps":60,"loop":false,"emitters":[]}',
          ]),
  };
  const [initial, debug] = await game.initialize({
    input,
    audio,
    assets,
    diagnostics: { register: () => {} },
  } as unknown as Parameters<typeof game.initialize>[0]);
  const api = { input, audio } as unknown as Parameters<typeof game.update>[1];
  const frame = (s: VoluteState, n = 1) => {
    let v = s;
    for (let i = 0; i < n; i++) v = game.update(v, api, TICK_DT);
    return v;
  };
  return { initial, debug, frame, heard };
}

describe("Volute simulation", () => {
  it("seeds a level and emits a posed charge on the next open tick", async () => {
    const { initial, debug, frame } = await setup();
    let s = debug.startLevel(initial, 1);
    expect(s.cores).toHaveLength(12);
    expect(s.quotaRemaining).toBe(LEVELS[0]!.quota - 12);
    s = debug.setNextEmitted(s, "garnet");
    s = debug.clearTrain(s);
    s = frame(s);
    expect(s.cores[0]?.charge).toBe("garnet");
    expect(s.nextEmitted).toBeNull();
    expect(s.quotaRemaining).toBe(LEVELS[0]!.quota - 13);
  });

  it("seats a projectile, extracts a three-core run, and scores it", async () => {
    const { initial, debug, frame, heard } = await setup();
    let s = debug.startLevel(initial, 1);
    s = debug.setEmission(s, false);
    s = debug.setFeed(s, false);
    s = debug.poseTrain(s, [
      [4588, "halide", null],
      [4560, "halide", null],
    ]);
    s = debug.setLoaded(s, "halide");
    s = debug.setAim(s, 270);
    s = debug.fire(s);
    s = frame(s, 20);
    expect(s.cores).toHaveLength(0);
    expect(s.score).toBe(30);
    expect(s.chainStep).toBe(1);
    expect(s.chainTimer).toBeGreaterThan(0);
    expect(heard).toContain("seat");
    expect(heard).toContain("extract-1");
  });

  it("spends one cell at the intake and restarts the level after the interlude", async () => {
    const { initial, debug, frame } = await setup();
    let s = debug.startLevel(initial, 1);
    s = debug.setEmission(s, false);
    s = debug.poseTrain(s, [[INTAKE_S, "cobalt", null]]);
    s = frame(s);
    expect(s.screen).toBe("setback");
    expect(s.cells).toBe(CELLS - 1);
    expect(s.cores).toHaveLength(0);
    s = frame(s, 121);
    expect(s.screen).toBe("playing");
    expect(s.cores).toHaveLength(12);
  });

  it("awards a clear and advances to the next level", async () => {
    const { initial, debug, frame } = await setup();
    let s = debug.startLevel(initial, 1);
    s = debug.clearTrain(s);
    s = debug.setEmission(s, false);
    s = debug.setQuotaRemaining(s, 0);
    s = frame(s);
    expect(s.screen).toBe("cleared");
    expect(s.score).toBe(500);
    s = frame(s, 121);
    expect(s.level).toBe(2);
    expect(s.screen).toBe("playing");
  });

  it("ends the run when the last cell reaches the maw", async () => {
    const { initial, debug, frame } = await setup();
    let s = debug.startLevel(initial, 1);
    s = debug.setCells(s, 1);
    s = debug.poseTrain(s, [[INTAKE_S, "cobalt", null]]);
    s = frame(s);
    expect(s.screen).toBe("gameover");
    expect(s.cells).toBe(0);
  });

  it("does not extract an old run when unlike charges merge", async () => {
    const { initial, debug, frame } = await setup();
    let s = debug.startLevel(initial, 1);
    s = debug.setEmission(s, false);
    s = debug.poseTrain(s, [
      [150, "cobalt", null],
      [70, "sulfur", null],
      [42, "sulfur", null],
      [14, "sulfur", null],
    ]);
    s = frame(s, 24);
    expect(s.cores).toHaveLength(4);
    expect(s.score).toBe(0);
    expect(s.segments).toHaveLength(1);
  });

  it("backs the train toward the inlet and leaves the gate closed while active", async () => {
    const { initial, debug, frame } = await setup();
    let s = debug.startLevel(initial, 1);
    s = debug.poseTrain(s, [
      [200, "sulfur", null],
      [172, "cobalt", null],
    ]);
    s = debug.grantMachinery(s, "backflow");
    const quota = s.quotaRemaining;
    s = frame(s, 60);
    expect(s.cores[0]!.s).toBeCloseTo(140, 3);
    expect(s.cores[1]!.s).toBeCloseTo(112, 3);
    expect(s.quotaRemaining).toBe(quota);
  });

  it("renders authored frames and live particles after an extraction", async () => {
    const { initial, debug, frame } = await setup(true);
    let s = debug.startLevel(initial, 1);
    s = debug.setEmission(s, false);
    s = debug.setFeed(s, false);
    s = debug.poseTrain(s, [
      [4588, "halide", null],
      [4560, "halide", null],
    ]);
    s = debug.setLoaded(s, "halide");
    s = debug.setAim(s, 270);
    s = debug.fire(s);
    s = frame(s, 10);
    const canvas = createCanvas(960, 540);
    expect(() =>
      game.render(s, { ctx: canvas.getContext("2d") } as unknown as Parameters<
        typeof game.render
      >[1]),
    ).not.toThrow();
  });

  it("keeps debug poses pure and validates fixed domains", async () => {
    const { initial, debug } = await setup();
    const p = debug.setPressure(initial, 50);
    expect(initial.pressure).toBe(0);
    expect(debug.snapshot(p).feedSpeed).toBeCloseTo(LEVELS[0]!.feedSpeed * 1.5);
    expect(() => debug.setPressure(p, 101)).toThrow();
    expect(() => debug.setLevel(p, 0)).toThrow();
    expect(debug.setChainStep(p, 3).chainTimer).toBe(CHAIN_RESET);
    expect(debug.reset(p).pressure).toBe(0);
  });
});
