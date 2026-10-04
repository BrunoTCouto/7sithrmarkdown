// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Clock = require("../docs/clock.js");

const TEST_SCRAMBLE = "UR2+ DR2+ DL2+ UL4+ U3+ R0+ D4+ L1+ ALL3- y2 U5+ R5- D4+ L2+ ALL5-";
const TEST_STATE = [10, 7, 0, 11, 3, 8, 10, 6, 2, 9, 6, 1, 11, 8]; // testclockstate in ClockClean.Rmd
const CONNOR_SCRAMBLE = "UR3- DR6+ DL5- UL3- U1- R0+ D4+ L0+ ALL2- y2 U1- R3- D5+ L6+ ALL3-";
const CONNOR_STATE = [1, 3, 4, 5, 8, 4, 10, 3, 0, 11, 7, 4, 10, 5]; // connorClockState in ClockClean.Rmd

const ORDERS = {
  tommy: "dl R DR BS UL L ur".split(" "),
  bpaul: "dl R DR ur L UL BS".split(" "),
  connor: "ul R UR dr L DL FS".split(" "),
};

test("scramble parser reproduces the states recorded in the notebook", () => {
  assert.deepEqual(Clock.parseScramble(TEST_SCRAMBLE), TEST_STATE);
  assert.deepEqual(Clock.parseScramble(CONNOR_SCRAMBLE), CONNOR_STATE);
});

test("scramble parser rejects garbage", () => {
  assert.throws(() => Clock.parseScramble("UR2+ XX3-"));
  assert.throws(() => Clock.parseScramble(""));
});

test("exactly 272 of the 3432 seven-pin sets have full rank, 268 of them with determinant ±1", () => {
  function* combos(arr, k, start = 0, acc = []) {
    if (acc.length === k) { yield acc.slice(); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, k, i + 1, acc); acc.pop(); }
  }
  let valid = 0, unit = 0;
  for (const set of combos(Clock.PIN_STATES, 7)) {
    const { ok, det } = Clock.invertExact(Clock.moveMatrix(set));
    if (!ok) continue;
    valid++;
    if (det.n === 1n || det.n === -1n) unit++;
  }
  assert.equal(valid, 272);
  assert.equal(unit, 268);
});

test("solutions actually solve the puzzle for the notebook's pin orders", () => {
  for (const [name, order] of Object.entries(ORDERS)) {
    for (const state of [TEST_STATE, CONNOR_STATE]) {
      const sol = Clock.solve(order, state);
      assert.ok(sol.ok, name + ": " + sol.reason);
      const after = Clock.applyMoves(order, sol.raw, state);
      assert.deepEqual(after, new Array(14).fill(0), name + " left the clock unsolved");
      for (const v of sol.raw) assert.ok(v >= -5 && v <= 6);
    }
  }
});

test("solutions solve random scrambles", () => {
  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 50; i++) {
    const state = Clock.parseScramble(Clock.randomScramble(rng));
    for (const order of Object.values(ORDERS)) {
      const sol = Clock.solve(order, state);
      assert.ok(sol.ok);
      assert.deepEqual(Clock.applyMoves(order, sol.raw, state), new Array(14).fill(0));
    }
  }
});

test("the last pin state is always intuitive and formulas look sane", () => {
  const a = Clock.analyse(ORDERS.tommy);
  assert.ok(a.intuitive.has(12) && a.intuitive.has(13));
  assert.equal(a.formulas.length, 14);
  for (const f of a.formulas) assert.match(f, /^-?(\d+(\/\d+)? )?[A-Z][A-Za-z]?b?( [+-] (\d+(\/\d+)? )?[A-Z][A-Za-z]?b?)*$|^0$/);
});

test("validateOrder catches bad input and warns about determinant ±3 sets", () => {
  assert.ok(Clock.validateOrder(["UR", "UR", "DL", "UL", "U", "L", "D"]).errors.length > 0);
  assert.ok(Clock.validateOrder(["UR", "DR", "DL"]).errors.length > 0);
  assert.ok(Clock.validateOrder(["UR", "DR", "DL", "UL", "U", "L", "D"]).errors.length > 0); // singular
  assert.deepEqual(Clock.validateOrder(ORDERS.tommy), { errors: [], warnings: [] });
  // find a det ±3 set and check that some scramble is unsolvable with it
  function* combos(arr, k, start = 0, acc = []) {
    if (acc.length === k) { yield acc.slice(); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, k, i + 1, acc); acc.pop(); }
  }
  let found = null;
  for (const set of combos(Clock.PIN_STATES, 7)) {
    const { ok, det } = Clock.invertExact(Clock.moveMatrix(set));
    if (ok && (det.n === 3n || det.n === -3n)) { found = set; break; }
  }
  assert.ok(found);
  assert.equal(Clock.validateOrder(found).warnings.length, 1);
  let failures = 0;
  for (let h = 0; h < 12; h++) { const s = new Array(14).fill(0); s[4] = h; if (Clock.solve(found, s).fractional) failures++; }
  assert.ok(failures > 0, "expected some unsolvable states for a determinant-3 set");
});

test("fractional turns of determinant ±3 sets are reported as thirds, flagged impossible", () => {
  const cursed = "UR DL U D dr ul BS".split(" ");
  const sol = Clock.solve(cursed, Clock.parseScramble("ALL1+"));
  assert.equal(sol.ok, true);
  assert.equal(sol.fractional, true);
  assert.match(sol.reason, /thirds/);
  const fractions = sol.raw.filter(Clock.isFraction);
  assert.ok(fractions.length > 0);
  for (const q of fractions) {
    assert.equal(q.d, 3n); // only ±1/3 and ±2/3 (plus whole hours) can occur
    assert.ok(q.toNumber() > -6 && q.toNumber() <= 6);
  }
  for (const st of sol.steps) for (const t of [st.front, st.back]) assert.match(Clock.formatTurn(t), /^(0|\d+[+-]|\d?[⅓⅔][+-])$/);
  assert.equal(Clock.formatTurn(new Clock.Q(7n, 3n)), "2⅓+");
  assert.equal(Clock.formatTurn(new Clock.Q(-2n, 3n)), "⅔-");
  // a state this set can solve still comes out whole and passes the round-trip check
  const fine = Clock.solve(cursed, Clock.parseScramble("UR4+ DR2- DL5+ UL1+ U3- R0+ D1+ L1- ALL2- y2 U5+ R2+ D1- L3+ ALL2+"));
  assert.equal(fine.fractional, false);
  assert.ok(Clock.applyMoves(cursed, fine.raw, Clock.parseScramble("UR4+ DR2- DL5+ UL1+ U3- R0+ D1+ L1- ALL2- y2 U5+ R2+ D1- L3+ ALL2+")).every((h) => h === 0));
});

test("the pages show BS as a backslash and FS as a slash", () => {
  assert.equal(Clock.pinLabel("BS"), "\\");
  assert.equal(Clock.pinLabel("FS"), "/");
  assert.equal(Clock.pinLabel("dl"), "dl");
  assert.equal(Clock.pinFromLabel("\\"), "BS");
  assert.equal(Clock.pinFromLabel("/"), "FS");
  assert.deepEqual("dl R DR \\ UL L ur".split(" ").map(Clock.pinFromLabel), ORDERS.tommy);
});

test("newIntFinder port flags the same turns as intFinder and describes them", () => {
  function* combos(arr, k, start = 0, acc = []) {
    if (acc.length === k) { yield acc.slice(); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, k, i + 1, acc); acc.pop(); }
  }
  let seed = 5;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const orders = [];
  for (const set of combos(Clock.PIN_STATES, 7)) {
    if (!Clock.invertExact(Clock.moveMatrix(set)).ok) continue;
    orders.push(set);
    if (rng() < 0.15) orders.push(set.slice().sort(() => rng() - 0.5));
  }
  assert.ok(orders.length > 300);
  for (const order of orders) {
    const cols = Clock.moveMatrix(order);
    const ints = Clock.intuitiveMoves(cols);
    const aligns = Clock.intuitiveAlignments(cols);
    for (let c = 0; c < 14; c++) {
      assert.equal(aligns[c] !== null, ints.has(c), "column " + c + " of " + order.join(" "));
      const text = Clock.describeAlignment(aligns[c]);
      if (ints.has(c)) assert.match(text, /^align /); else assert.equal(text, "");
    }
    assert.equal(Clock.describeAlignment(aligns[12]), "align to 12");
    assert.equal(Clock.describeAlignment(aligns[13]), "align to 12");
  }
});

test("alignment descriptions match the notebook's newIntFinder(tommy) examples", () => {
  const a = Clock.analyse(ORDERS.tommy);
  assert.equal(a.alignText[4], "align C to U/L");   // third pin state, front turn
  assert.equal(a.alignText[5], "align UL to U/L");  // third pin state, back turn
  assert.equal(a.alignText[10], "align L block to R"); // sixth pin state, front turn
  assert.equal(a.alignText[12], "align to 12");
  const sol = Clock.solve(ORDERS.tommy, TEST_STATE);
  assert.equal(sol.steps[2].frontAlign, "align C to U/L");
  assert.equal(sol.steps[2].backAlign, "align UL to U/L");
  assert.equal(sol.steps[0].frontAlign, ""); // memorised turn
  assert.equal(Clock.describeAlignment({ pairs: ["UL", "U", "L", "C", "DL", "D"].map((c) => [c, "R"]) }), "align L block to R");
  assert.equal(Clock.describeAlignment({ pairs: [["C", "U"], ["C", "L"]] }), "align C to U/L");
});
