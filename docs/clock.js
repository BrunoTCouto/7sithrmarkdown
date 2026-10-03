/*
 * Rubik's Clock 7-simul solver — core maths.
 *
 * A straight port of the linear-algebra model in ClockClean.Rmd.
 *
 * Clock state: 14 integers (hours mod 12), in this order:
 *   front  UL U UR L C R DL D DR   (as seen from the front)
 *   back   Ub Lb Cb Rb Db          (as seen from the back)
 * The four back corner clocks are geared to the front ones, so they are not stored.
 *
 * Every pin state has two moves: the FRONT move (turn a wheel whose pin is up)
 * and the BACK move (turn a wheel whose pin is down). Both are described as
 * seen from the front: +1 = one hour clockwise as you look at the front face.
 *
 * Works in the browser (window.Clock) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Clock = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CLOCKS = ["UL", "U", "UR", "L", "C", "R", "DL", "D", "DR", "Ub", "Lb", "Cb", "Rb", "Db"];
  const PIN_STATES = ["UR", "DR", "DL", "UL", "U", "L", "D", "R", "dl", "dr", "ur", "ul", "BS", "FS"];

  // Effect of each move on the 14 clocks. First 14 numbers = front move, next 14 = back move.
  const RAW = {
    UR: [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, -1, -1, -1, -1, -1],
    DR: [0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, -1, -1, -1, -1, -1],
    DL: [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, -1, -1, -1, -1, -1],
    UL: [1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, -1, -1, -1, -1, -1],
    U:  [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, -1, -1, -1, -1],
    L:  [1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, -1, -1, -1, 0, -1],
    D:  [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0],
    R:  [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, -1, -1, -1],
    dl: [1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, -1],
    dr: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, -1, -1, 0, -1],
    ur: [1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0],
    ul: [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, -1, -1, 0],
    BS: [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, -1, -1, -1, -1],
    FS: [0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, -1, -1, -1, -1, -1],
    // ALL pins up: only needed to apply scrambles, never part of a 7-simul method.
    ALL: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, -1, -1, -1, -1, -1],
  };
  const MOVES = {};
  for (const k in RAW) MOVES[k] = { front: RAW[k].slice(0, 14), back: RAW[k].slice(14) };

  // How the pages show the two diagonal pin states: BS (backslash, UL+DR up) and FS (forward slash, UR+DL up).
  const PIN_LABELS = { BS: "\\", FS: "/" };
  const LABEL_PINS = { "\\": "BS", "/": "FS" };
  function pinLabel(p) { return PIN_LABELS[p] || p; }
  function pinFromLabel(s) { return LABEL_PINS[s] || s; }

  // Which pins are up (1) for each pin state, order UL UR DL DR (as seen from the front).
  const PINS_UP = {
    UR: [0, 1, 0, 0], DR: [0, 0, 0, 1], DL: [0, 0, 1, 0], UL: [1, 0, 0, 0],
    U: [1, 1, 0, 0], L: [1, 0, 1, 0], D: [0, 0, 1, 1], R: [0, 1, 0, 1],
    dl: [1, 1, 0, 1], dr: [1, 1, 1, 0], ur: [1, 0, 1, 1], ul: [0, 1, 1, 1],
    BS: [1, 0, 0, 1], FS: [0, 1, 1, 0], ALL: [1, 1, 1, 1],
  };

  // ---------- exact rational arithmetic (BigInt) ----------
  function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
  class Q {
    constructor(n, d = 1n) {
      if (d === 0n) throw new Error("division by zero");
      if (d < 0n) { n = -n; d = -d; }
      const g = gcd(n, d) || 1n;
      this.n = n / g; this.d = d / g;
    }
    add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { return new Q(this.n * o.n, this.d * o.d); }
    div(o) { return new Q(this.n * o.d, this.d * o.n); }
    neg() { return new Q(-this.n, this.d); }
    isZero() { return this.n === 0n; }
    isInt() { return this.d === 1n; }
    toNumber() { return Number(this.n) / Number(this.d); }
    toString() { return this.d === 1n ? this.n.toString() : this.n + "/" + this.d; }
  }

  /** Columns of the 14x14 move matrix for a pin order: [front1, back1, front2, back2, ...]. */
  function moveMatrix(order) {
    const cols = [];
    for (const p of order) {
      if (!MOVES[p]) throw new Error("Unknown pin state: " + p);
      cols.push(MOVES[p].front, MOVES[p].back);
    }
    return cols;
  }

  /** Exact inverse of a 14x14 integer matrix given as columns. Returns {ok, det, inv} (inv as rows of Q). */
  function invertExact(cols) {
    const n = cols.length;
    const A = [];
    for (let i = 0; i < n; i++) {
      A.push([]);
      for (let j = 0; j < n; j++) A[i].push(new Q(BigInt(cols[j][i])));
      for (let j = 0; j < n; j++) A[i].push(new Q(i === j ? 1n : 0n));
    }
    let det = new Q(1n);
    for (let c = 0; c < n; c++) {
      let p = -1;
      for (let r = c; r < n; r++) if (!A[r][c].isZero()) { p = r; break; }
      if (p < 0) return { ok: false, det: new Q(0n), inv: null };
      if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; det = det.neg(); }
      det = det.mul(A[c][c]);
      const pv = A[c][c];
      for (let j = c; j < 2 * n; j++) A[c][j] = A[c][j].div(pv);
      for (let r = 0; r < n; r++) {
        if (r === c || A[r][c].isZero()) continue;
        const f = A[r][c];
        for (let j = c; j < 2 * n; j++) A[r][j] = A[r][j].sub(f.mul(A[c][j]));
      }
    }
    return { ok: true, det, inv: A.map((row) => row.slice(n)) };
  }

  const cache = new Map();
  function analyse(order) {
    const key = order.join(" ");
    if (cache.has(key)) return cache.get(key);
    const cols = moveMatrix(order);
    const { ok, det, inv } = invertExact(cols);
    const result = { order: order.slice(), cols, ok, det, inv };
    if (ok) {
      result.intuitive = intuitiveMoves(cols);
      result.formulas = inv.map((row, i) => formatFormula(row));
      result.memoLength = inv.map((row, i) => (result.intuitive.has(i) ? 0 : row.filter((q) => !q.isZero()).length));
    }
    cache.set(key, result);
    return result;
  }

  /**
   * Port of intFinder: a move is "intuitive" if it aligns a front clock with another front clock
   * that it is never separated from again. Returns a Set of column indices (0-based) that are intuitive.
   */
  function intuitiveMoves(cols) {
    const anal = [];
    for (let clock = 0; clock < 9; clock++) {
      anal.push([]);
      for (let op = 0; op < 7; op++) anal[clock].push(cols[2 * op][clock] - cols[2 * op + 1][clock]);
    }
    const ints = new Set();
    for (let op = 0; op < 6; op++) {
      for (let clock = 0; clock < 9; clock++) {
        if (anal[clock][op] !== 0) continue;
        for (let other = 0; other < 9; other++) {
          if (other === clock) continue;
          let same = true;
          for (let op2 = op + 1; op2 < 7; op2++) if (anal[other][op2] !== anal[clock][op2]) { same = false; break; }
          if (!same) continue;
          const v = anal[other][op];
          if (v === 1) ints.add(2 * op);
          else if (v === -1) ints.add(2 * op + 1);
        }
      }
    }
    ints.add(12); ints.add(13); // the last pin state is always intuitive: everything gets aligned to 12
    return ints;
  }

  /** Port of mem(): human-readable formula "UL - U + 2 Cb" for the amount of one move. */
  function formatFormula(invRow) {
    const terms = [];
    for (let c = 0; c < 14; c++) {
      const coef = invRow[c].neg(); // solution = inverse * (-state)
      if (coef.isZero()) continue;
      const neg = coef.n < 0n;
      const abs = neg ? coef.neg() : coef;
      const mag = abs.n === 1n && abs.d === 1n ? "" : abs.toString() + " ";
      terms.push({ neg, text: mag + CLOCKS[c] });
    }
    if (!terms.length) return "0";
    return terms.map((t, i) => (i === 0 ? (t.neg ? "-" : "") : t.neg ? " - " : " + ") + t.text).join("");
  }

  /** Normalise a turn to the range -5..6 hours. */
  function normTurn(v) { return ((((v + 5) % 12) + 12) % 12) - 5; }
  /** Normalise a fractional turn (a Q) to the range (-6, 6]. Such turns only occur with determinant ±3 pin sets. */
  function normFrac(q) {
    const m = 12n * q.d;
    let n = ((q.n % m) + m) % m;
    if (n > 6n * q.d) n -= m;
    return new Q(n, q.d);
  }
  function isFraction(v) { return v instanceof Q && !v.isInt(); }
  const VULGAR = { "1/3": "⅓", "2/3": "⅔" };
  /** "3+", "2-", "0", or for fractional turns "⅓+", "2⅔-". */
  function formatTurn(v) {
    if (v instanceof Q) {
      if (v.isInt()) return formatTurn(Number(v.n));
      const neg = v.n < 0n, n = neg ? -v.n : v.n;
      const whole = n / v.d, rem = n % v.d + "/" + v.d;
      const frac = VULGAR[rem] || (whole ? " " : "") + rem;
      return (whole ? whole : "") + frac + (neg ? "-" : "+");
    }
    return v === 0 ? "0" : Math.abs(v) + (v > 0 ? "+" : "-");
  }

  /** Validate a pin order. Returns a list of problems (empty = fine) and warnings. */
  function validateOrder(order) {
    const errors = [], warnings = [];
    if (order.length !== 7) errors.push("A 7-simul method needs exactly 7 pin states.");
    for (const p of order) if (!PIN_STATES.includes(p)) errors.push("Unknown pin state: " + p);
    if (new Set(order).size !== order.length) errors.push("Each pin state may only be used once.");
    if (errors.length) return { errors, warnings };
    const a = analyse(order);
    if (!a.ok) errors.push("This pin set cannot solve all scrambles (the move matrix is singular).");
    else if (!(a.det.n === 1n || a.det.n === -1n))
      warnings.push("This pin set only solves 1 in " + a.det.n.toString().replace("-", "") + " scrambles (determinant " + a.det + "). Some states will have no integer solution.");
    return { errors, warnings };
  }

  /**
   * Solve a clock state with a pin order.
   * Returns {ok, reason?, steps:[{pin, front, back, frontIntuitive, backIntuitive, frontFormula, backFormula}], raw}
   */
  function solve(order, state) {
    const v = validateOrder(order);
    if (v.errors.length) return { ok: false, reason: v.errors.join(" "), warnings: v.warnings };
    const a = analyse(order);
    const neg = state.map((h) => new Q(BigInt(-(((h % 12) + 12) % 12))));
    const x = a.inv.map((row) => row.reduce((acc, q, c) => acc.add(q.mul(neg[c])), new Q(0n)));
    // With a determinant ±3 pin set the turns can come out in thirds of an hour. They are still
    // reported (as Q values, flagged `fractional`) so the page can show them, but they cannot be done.
    const fractional = x.some((q) => !q.isInt());
    const raw = x.map((q) => (q.isInt() ? normTurn(Number(q.n)) : normFrac(q)));
    const steps = order.map((pin, i) => ({
      pin,
      pinsUp: PINS_UP[pin],
      front: raw[2 * i],
      back: raw[2 * i + 1],
      frontIntuitive: a.intuitive.has(2 * i),
      backIntuitive: a.intuitive.has(2 * i + 1),
      frontFormula: a.formulas[2 * i],
      backFormula: a.formulas[2 * i + 1],
    }));
    const result = { ok: true, steps, raw, warnings: v.warnings, det: a.det.toString(), fractional };
    if (fractional) result.reason = "This scramble has no solution with this pin order: the turns marked in red come out in thirds of an hour, which the puzzle cannot do. Pick another order.";
    return result;
  }

  /** Apply a list of 14 raw move amounts (same column order as moveMatrix) to a state. */
  function applyMoves(order, raw, state) {
    const cols = moveMatrix(order);
    const s = state.slice();
    for (let j = 0; j < cols.length; j++) for (let i = 0; i < 14; i++) s[i] = (((s[i] + raw[j] * cols[j][i]) % 12) + 12) % 12;
    return s;
  }

  const SCRAMBLE_TOKEN = /^(UR|DR|DL|UL|U|R|D|L|ALL)(\d+)([+-])$/i;
  // After y2 the pins are named from the back; translate to the front-view pin state whose BACK move does the job.
  const BACK_VIEW = { U: "D", D: "U", L: "L", R: "R", ALL: "ALL", UR: "UL", UL: "UR", DR: "DL", DL: "DR" };

  /** Apply a WCA scramble (e.g. "UR2+ DR3- ... y2 U5+ ...") to the solved clock, returning the state. */
  function parseScramble(text) {
    const s = new Array(14).fill(0);
    let flipped = false;
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) throw new Error("Scramble is empty.");
    for (const tok of tokens) {
      if (/^y2$/i.test(tok)) { flipped = !flipped; continue; }
      const m = tok.match(SCRAMBLE_TOKEN);
      if (!m) throw new Error("Cannot read move \"" + tok + "\". Expected something like UR3+ or ALL2- or y2.");
      let name = m[1].length > 2 ? m[1].toUpperCase() : m[1];
      if (!(name in PINS_UP)) name = name.toUpperCase();
      if (!(name in PINS_UP)) throw new Error("Unknown pins \"" + m[1] + "\" in scramble.");
      let k = parseInt(m[2], 10) * (m[3] === "+" ? 1 : -1);
      let col;
      if (!flipped) col = MOVES[name].front;
      else { col = MOVES[BACK_VIEW[name]].back; k = -k; } // clockwise from the back = anticlockwise from the front
      for (let i = 0; i < 14; i++) s[i] = (((s[i] + k * col[i]) % 12) + 12) % 12;
    }
    return s;
  }

  /** Random WCA-style scramble. */
  function randomScramble(rng = Math.random) {
    const turn = () => { const k = Math.floor(rng() * 12) - 5; return k === 0 ? "0+" : Math.abs(k) + (k > 0 ? "+" : "-"); };
    const first = ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"].map((p) => p + turn());
    const second = ["U", "R", "D", "L", "ALL"].map((p) => p + turn());
    return [...first, "y2", ...second].join(" ");
  }

  return {
    CLOCKS, PIN_STATES, MOVES, PINS_UP, PIN_LABELS, pinLabel, pinFromLabel, Q,
    moveMatrix, invertExact, analyse, intuitiveMoves, validateOrder, solve, applyMoves,
    parseScramble, randomScramble, formatTurn, normTurn, normFrac, isFraction, formatFormula,
  };
});
