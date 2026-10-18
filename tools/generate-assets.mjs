import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import { Buffer } from "node:buffer";
const root = "public/assets";
const palette = {
  halide: ["#a9f4ea", "#387e84", "#e5fff7"],
  sulfur: ["#ffcf64", "#9d642f", "#fff4aa"],
  cobalt: ["#86b5ff", "#385184", "#dae9ff"],
  garnet: ["#f784a5", "#842f55", "#ffdce3"],
  olivine: ["#b5db77", "#647944", "#eaf8b7"],
};
const save = (file, w, h, paint) => {
  const c = createCanvas(w, h),
    g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  paint(g, w, h);
  writeFileSync(`${root}/${file}`, c.toBuffer("image/png"));
};
const rect = (g, x, y, w, h, c) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};
const circ = (g, x, y, r, c) => {
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
};
const poly = (g, pts, c) => {
  g.fillStyle = c;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
};
const line = (g, x, y, X, Y, c, w = 1) => {
  g.strokeStyle = c;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(X, Y);
  g.stroke();
};
const gear = (g, x, y, r, outer, inner) => {
  circ(g, x, y, r, outer);
  for (let i = 0; i < 8; i++) {
    let a = (i * Math.PI) / 4;
    rect(
      g,
      Math.round(x + Math.cos(a) * r - 2),
      Math.round(y + Math.sin(a) * r - 2),
      5,
      5,
      outer,
    );
  }
  circ(g, x, y, r - 4, inner);
  circ(g, x, y, 4, "#080e16");
};
for (const [id, [main, dark, light]] of Object.entries(palette))
  save(`sprites/core-${id}.png`, 28, 28, (g) => {
    circ(g, 14, 15, 13, "#08141b");
    poly(
      g,
      [
        [14, 1],
        [23, 4],
        [27, 12],
        [24, 22],
        [14, 27],
        [5, 24],
        [1, 15],
        [5, 5],
      ],
      dark,
    );
    poly(
      g,
      [
        [14, 2],
        [22, 6],
        [23, 17],
        [14, 25],
        [6, 19],
        [4, 9],
      ],
      main,
    );
    poly(
      g,
      [
        [14, 3],
        [21, 7],
        [15, 14],
        [8, 13],
        [6, 7],
      ],
      light,
    );
    poly(
      g,
      [
        [15, 14],
        [23, 17],
        [22, 21],
        [14, 25],
      ],
      "#22334577",
    );
    line(g, 5, 20, 14, 25, "#27373d");
    g.strokeStyle = "#16252c";
    g.lineWidth = 2;
    g.beginPath();
    if (id === "halide") {
      g.moveTo(8, 15);
      g.lineTo(20, 15);
      g.moveTo(14, 9);
      g.lineTo(14, 21);
    }
    if (id === "sulfur") {
      g.moveTo(9, 19);
      g.lineTo(14, 8);
      g.lineTo(19, 19);
    }
    if (id === "cobalt") {
      g.moveTo(8, 9);
      g.lineTo(20, 19);
      g.moveTo(20, 9);
      g.lineTo(8, 19);
    }
    if (id === "garnet") {
      g.moveTo(14, 8);
      g.lineTo(20, 14);
      g.lineTo(14, 20);
      g.lineTo(8, 14);
      g.closePath();
    }
    if (id === "olivine") {
      g.moveTo(7, 16);
      g.lineTo(13, 20);
      g.lineTo(21, 9);
    }
    g.stroke();
    circ(g, 9, 8, 2, "#ffffff99");
  });
const marks = {
  choke: "#f4d47c",
  backflow: "#9de9ff",
  bore: "#ff9372",
  sightline: "#d7b6ff",
};
for (const [id, col] of Object.entries(marks))
  save(`sprites/mark-${id}.png`, 16, 16, (g) => {
    circ(g, 8, 8, 7, "#0b1725dd");
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.beginPath();
    if (id === "choke") {
      g.moveTo(3, 3);
      g.lineTo(7, 8);
      g.lineTo(3, 13);
      g.moveTo(13, 3);
      g.lineTo(9, 8);
      g.lineTo(13, 13);
    }
    if (id === "backflow") {
      g.moveTo(13, 8);
      g.lineTo(3, 8);
      g.lineTo(7, 4);
      g.moveTo(3, 8);
      g.lineTo(7, 12);
    }
    if (id === "bore") {
      g.arc(8, 8, 4, 0, 7);
      g.moveTo(8, 0);
      g.lineTo(8, 5);
      g.moveTo(8, 11);
      g.lineTo(8, 16);
    }
    if (id === "sightline") {
      g.moveTo(2, 8);
      g.lineTo(14, 8);
      g.moveTo(8, 2);
      g.lineTo(8, 14);
      g.arc(8, 8, 4, 0, 7);
    }
    g.stroke();
  });
save("sprites/injector-base.png", 44, 44, (g) => {
  gear(g, 22, 22, 17, "#66757b", "#273c46");
  circ(g, 22, 22, 12, "#b19464");
  circ(g, 22, 22, 9, "#1b2d37");
  for (let i = 0; i < 4; i++) {
    let a = (i * Math.PI) / 2;
    circ(g, 22 + Math.cos(a) * 16, 22 + Math.sin(a) * 16, 2, "#d5c6a4");
  }
  circ(g, 22, 22, 5, "#b4a683");
});
save("sprites/injector-barrel.png", 44, 20, (g) => {
  poly(
    g,
    [
      [0, 4],
      [29, 4],
      [39, 1],
      [44, 3],
      [44, 17],
      [39, 19],
      [29, 16],
      [0, 16],
    ],
    "#0d1920",
  );
  rect(g, 3, 6, 29, 8, "#718890");
  rect(g, 7, 8, 23, 3, "#c6b78e");
  rect(g, 29, 4, 8, 12, "#a77643");
  rect(g, 39, 5, 4, 10, "#e0aa6e");
  rect(g, 36, 8, 8, 4, "#10191c");
});
save("sprites/intake-maw.png", 64, 64, (g) => {
  circ(g, 32, 32, 31, "#0a1118");
  gear(g, 32, 32, 27, "#5c6160", "#3c4446");
  circ(g, 32, 32, 21, "#111a20");
  circ(g, 32, 32, 17, "#03070b");
  for (let i = 0; i < 12; i++) {
    let a = (i * Math.PI) / 6;
    poly(
      g,
      [
        [32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17],
        [32 + Math.cos(a + 0.22) * 11, 32 + Math.sin(a + 0.22) * 11],
        [32 + Math.cos(a + 0.45) * 17, 32 + Math.sin(a + 0.45) * 17],
      ],
      "#af9070",
    );
  }
  circ(g, 32, 32, 5, "#361b1c");
});
save("sprites/channel-plate.png", 64, 64, (g) => {
  rect(g, 0, 0, 64, 64, "#30454d");
  for (let i = 0; i < 64; i += 8) {
    rect(g, i, 0, 1, 64, "#52636a55");
    rect(g, 0, i, 64, 1, "#1d323c44");
  }
  rect(g, 3, 3, 3, 3, "#9d9a7c");
  rect(g, 57, 3, 3, 3, "#9d9a7c");
  rect(g, 3, 57, 3, 3, "#9d9a7c");
  rect(g, 57, 57, 3, 3, "#9d9a7c");
  line(g, 8, 34, 55, 34, "#67818a", 2);
  line(g, 8, 30, 55, 30, "#1c333e", 2);
});
save("sprites/cell-icon.png", 24, 24, (g) => {
  poly(
    g,
    [
      [12, 1],
      [20, 5],
      [22, 13],
      [17, 22],
      [7, 22],
      [2, 13],
      [4, 5],
    ],
    "#161d22",
  );
  poly(
    g,
    [
      [12, 3],
      [19, 6],
      [20, 13],
      [16, 20],
      [8, 20],
      [4, 13],
      [5, 6],
    ],
    "#c68a54",
  );
  poly(
    g,
    [
      [12, 6],
      [16, 10],
      [14, 17],
      [10, 17],
      [8, 10],
    ],
    "#ffdc86",
  );
  rect(g, 11, 7, 2, 8, "#fff3bf");
});
save("sprites/pressure-icon.png", 24, 24, (g) => {
  circ(g, 12, 12, 11, "#0d1820");
  circ(g, 12, 12, 9, "#bca379");
  circ(g, 12, 12, 6, "#24343b");
  line(g, 12, 12, 17, 7, "#ffab66", 2);
  circ(g, 12, 12, 2, "#f4cf8d");
});
const fs = (name, n, w, h, fn) => {
  mkdirSync(`${root}/sheets/${name}`, { recursive: true });
  for (let i = 0; i < n; i++)
    save(`sheets/${name}/${i}.png`, w, h, (g) => fn(g, i));
};
fs("fire-recoil", 4, 44, 20, (g, i) => {
  const shift = [0, -5, -3, -1][i];
  poly(
    g,
    [
      [shift, 4],
      [29 + shift, 4],
      [39 + shift, 1],
      [44 + shift, 3],
      [44 + shift, 17],
      [39 + shift, 19],
      [29 + shift, 16],
      [shift, 16],
    ],
    "#17262c",
  );
  rect(g, 4 + shift, 6, 27, 8, "#91a1a0");
  rect(g, 29 + shift, 5, 8, 10, "#c1854c");
  rect(g, 37 + shift, 8, 6, 4, "#1b2429");
  if (i < 2) {
    poly(
      g,
      [
        [42, 7],
        [44, 3],
        [44, 8],
      ],
      "#f8d390",
    );
    poly(
      g,
      [
        [42, 12],
        [44, 17],
        [44, 11],
      ],
      "#ff9854",
    );
  }
});
fs("maw-swallow", 6, 64, 64, (g, i) => {
  circ(g, 32, 32, 30, "#444e51");
  circ(g, 32, 32, 23, "#a68d68");
  circ(g, 32, 32, 19, "#131c22");
  circ(g, 32, 32, 8 + [0, 4, 8, 6, 3, 0][i], "#02070c");
  for (let j = 0; j < 12; j++) {
    let a = (j * Math.PI) / 6;
    poly(
      g,
      [
        [32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18],
        [
          32 + Math.cos(a + 0.3) * (12 + [0, 3, 6, 4, 2, 0][i]),
          32 + Math.sin(a + 0.3) * (12 + [0, 3, 6, 4, 2, 0][i]),
        ],
        [32 + Math.cos(a + 0.5) * 18, 32 + Math.sin(a + 0.5) * 18],
      ],
      "#d2aa79",
    );
  }
});
fs("extraction-flash", 6, 48, 48, (g, i) => {
  const r = [5, 12, 22, 18, 12, 4][i];
  circ(g, 24, 24, r, "#fff6dc55");
  g.strokeStyle = "#ffffffbb";
  g.lineWidth = 2;
  for (let j = 0; j < 8; j++) {
    let a = (j * Math.PI) / 4;
    line(
      g,
      24 + Math.cos(a) * (r - 3),
      24 + Math.sin(a) * (r - 3),
      24 + Math.cos(a) * (r + 5),
      24 + Math.sin(a) * (r + 5),
      "#fff8ce",
      2,
    );
  }
  circ(g, 24, 24, Math.max(2, r / 3), "#ffffffbb");
});
// Portable particle systems authored at the logical field's dimensions.
for (const [name, count, speed, life, color] of [
  ["extraction-burst", 24, 105, 260, "#f7e6ab"],
  ["bore-detonation", 58, 135, 580, "#ffba7e"],
  ["intake-spray", 24, 75, 320, "#cc6d58"],
  ["pickup-shimmer", 18, 55, 420, "#fff5ab"],
]) {
  const dir =
    name === "pickup-shimmer"
      ? [0, 1, 0]
      : name === "intake-spray"
        ? [0, -1, 0]
        : [1, 0, 0];
  const system = {
    dimensions: 2,
    field: { width: 960, height: 540 },
    durationMs: life + 40,
    fps: 60,
    loop: false,
    emitters: [
      {
        name: "mineral",
        shape: "point",
        position: [0, 0, 0],
        extent: { radius: 0, size: [0, 0, 0] },
        emission: { mode: "burst", count, atMs: 0 },
        lifetimeMs: life,
        lifetimeSpread: life * 0.25,
        speed,
        speedSpread: speed * 0.4,
        direction: dir,
        coneAngle:
          name === "pickup-shimmer" ? 35 : name === "intake-spray" ? 65 : 180,
        particle: {
          sizeCurve: { interp: "linear", from: 0.7, to: 0 },
          opacityCurve: { interp: "linear", from: 1, to: 0 },
          colorGradient: [
            { at: 0, color },
            { at: 1, color: "#ffffff" },
          ],
        },
      },
    ],
  };
  mkdirSync(`${root}/effects/${name}`, { recursive: true });
  writeFileSync(`${root}/effects/${name}/system.json`, JSON.stringify(system));
}
const rate = 22050;
function wav(name, dur, sample) {
  const N = Math.floor(rate * dur),
    b = Buffer.alloc(44 + N * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + N * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(N * 2, 40);
  for (let i = 0; i < N; i++)
    b.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, sample(i / rate, i))) * 25000),
      44 + i * 2,
    );
  writeFileSync(`${root}/audio/${name}.wav`, b);
}
const rng = (i) => {
  let n = (i * 1664525 + 1013904223) >>> 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  return ((n >>> 0) / 4294967295) * 2 - 1;
};
const env = (t, d) => Math.sin(Math.PI * Math.min(1, t / d)) ** 0.8;
const ones = {
  fire: [0.14, 440, 150, 0.27],
  seat: [0.21, 210, 80, 0.32],
  swap: [0.12, 740, 470, 0.22],
  denied: [0.23, 170, 135, 0.34],
  machinery: [0.52, 390, 860, 0.38],
  intake: [0.8, 85, 38, 0.48],
  "level-clear": [0.95, 260, 520, 0.36],
  "cell-lost": [1, 145, 52, 0.5],
};
for (let j = 1; j <= 5; j++)
  ones[`extract-${j}`] = [0.38, 350 + j * 60, 570 + j * 90, 0.34];
for (const [name, [dur, a, b, g]] of Object.entries(ones))
  wav(name, dur, (t, i) => {
    const f = a + ((b - a) * t) / dur;
    const wobble = Math.sin(
      2 * Math.PI * (f * t + ((b - a) * t * t) / (2 * dur)),
    );
    const noise = rng(i) * Math.exp(-t * 35);
    const extra =
      name === "intake" || name === "cell-lost"
        ? Math.sin(2 * Math.PI * 42 * t) * 0.5
        : 0;
    return env(t, dur) * g * (wobble * 0.65 + noise * 0.22 + extra);
  });
function midi(name, roots, danger) {
  const events = [];
  const beat = 480;
  events.push({ t: 0, bytes: [0xff, 0x51, 3, 7, 0xa1, 0x20] });
  events.push({ t: 0, bytes: [0xc0, 38] });
  for (let bar = 0; bar < 4; bar++) {
    const root = roots[bar];
    for (let j = 0; j < 4; j++) {
      const start = (bar * 4 + j) * beat;
      const note = j === 2 ? root + 7 : root;
      events.push({ t: start, bytes: [0x90, note, danger ? 72 : 58] });
      events.push({ t: start + beat * 0.72, bytes: [0x80, note, 0] });
    }
  }
  events.push({ t: 16 * beat, bytes: [0xff, 0x2f, 0] });
  events.sort(
    (a, b) =>
      a.t - b.t ||
      (a.bytes[0] === 0x80 ? -1 : 1) - (b.bytes[0] === 0x80 ? -1 : 1),
  );
  const vlq = (n) => {
    const x = [n & 127];
    while ((n >>= 7)) x.unshift((n & 127) | 128);
    return x;
  };
  let prev = 0;
  const data = [];
  for (const e of events) {
    data.push(...vlq(e.t - prev), ...e.bytes);
    prev = e.t;
  }
  const header = Buffer.from([
    77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 1, 224,
  ]);
  const chunk = Buffer.alloc(8);
  chunk.write("MTrk", 0);
  chunk.writeUInt32BE(data.length, 4);
  writeFileSync(
    `${root}/audio/${name}.mid`,
    Buffer.concat([header, chunk, Buffer.from(data)]),
  );
}
for (const danger of [false, true]) {
  const name = danger ? "danger-loop" : "hall-loop",
    dur = 8,
    roots = danger ? [41, 43, 46, 43] : [41, 39, 36, 39];
  midi(name, roots, danger);
  const raw = (t, i) => {
    const time = (t + dur) % dur,
      step = Math.floor(time / 2),
      root = roots[step % 4],
      freq = 440 * 2 ** ((root - 69) / 12),
      phase = time % 2;
    const bass =
      Math.sin(2 * Math.PI * freq * phase) *
      0.18 *
      (0.55 + 0.45 * Math.exp(-phase * 2));
    const hum = Math.sin(2 * Math.PI * freq * 2 * phase) * 0.05;
    const pulse =
      Math.sin(2 * Math.PI * (danger ? 96 : 72) * time) *
      0.06 *
      Math.exp(-(time % 0.5) * 16);
    const hiss = rng(i) * 0.014 * Math.exp(-(time % 1) * 20);
    return bass + hum + pulse + hiss;
  };
  wav(
    name,
    dur,
    (t, i) => raw(t, i) * Math.min(1, t / 0.012, (dur - t) / 0.012),
  );
}
