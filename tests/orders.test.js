// Checks for scripts/build-orders.js and the CSV files it writes to docs/data/orders.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Clock = require("../docs/clock.js");
const build = require("../scripts/build-orders.js");

const ORDERS = {
  tommy: "dl R DR BS UL L ur".split(" "),
  bpaul: "dl R DR ur L UL BS".split(" "),
  connor: "ul R UR dr L DL FS".split(" "),
};

// Slow but direct version of the statistics: invert the ordered matrix itself, as the notebook does.
function directStats(order) {
  const a = Clock.analyse(order);
  const memorised = a.memoLength.filter((n) => n > 0);
  return {
    min_memo: Math.min(...memorised),
    max_memo: Math.max(...a.memoLength),
    sum_memo: a.memoLength.reduce((x, y) => x + y, 0),
    memorized: 14 - a.intuitive.size,
  };
}

function statsVia(setInfo, order) {
  return build.orderStats(order, build.memoLengths(setInfo.set, setInfo.inv));
}

const sets = build.validSets();
const bySetKey = new Map(sets.map((s, i) => [s.set.slice().sort().join(" "), { ...s, n: i + 1 }]));
function setOf(order) { return bySetKey.get(order.slice().sort().join(" ")); }

test("272 valid pin sets, numbered like the notebook (Connor's set is number 56)", () => {
  assert.equal(sets.length, 272);
  assert.equal(setOf(ORDERS.connor).n, 56);
});

test("per-set memo lengths agree with inverting each ordered matrix directly", () => {
  for (const order of Object.values(ORDERS)) {
    const fast = statsVia(setOf(order), order);
    const slow = directStats(order);
    for (const k of Object.keys(slow)) assert.equal(fast[k], slow[k], k + " for " + order.join(" "));
  }
  let seed = 11;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 40; i++) {
    const s = sets[Math.floor(rng() * sets.length)];
    const order = s.set.slice().sort(() => rng() - 0.5);
    const fast = statsVia(s, order), slow = directStats(order);
    for (const k of Object.keys(slow)) assert.equal(fast[k], slow[k], k + " for " + order.join(" "));
  }
});

test("pin-change and D-move counts", () => {
  const t = statsVia(setOf(ORDERS.tommy), ORDERS.tommy);
  assert.equal(t.pin_changes, 6); // dl→R→DR→BS→UL→L→ur flips exactly one pin each time
  assert.equal(t.max_pin_changes, 1);
  assert.equal(t.d_moves, 2); // dl, DR
  const c = statsVia(setOf(ORDERS.connor), ORDERS.connor);
  assert.equal(c.d_moves, 2); // dr, DL
});

test("CSV files on disk are complete and match a fresh computation", () => {
  const dir = build.OUT_DIR;
  const index = fs.readFileSync(path.join(dir, "sets.csv"), "utf8").trim().split("\n");
  assert.equal(index[0], "set,pins,det,d_moves");
  assert.equal(index.length, 273);
  const detThree = index.slice(1).filter((l) => Math.abs(parseInt(l.split(",")[2], 10)) === 3);
  assert.equal(detThree.length, 4);

  for (let n = 1; n <= 272; n++) {
    const lines = fs.readFileSync(path.join(dir, build.setFileName(n)), "utf8").trim().split("\n");
    assert.equal(lines[0], build.HEADER, "header of set " + n);
    assert.equal(lines.length, 5041, "rows of set " + n);
  }

  for (const order of Object.values(ORDERS)) {
    const s = setOf(order);
    const lines = fs.readFileSync(path.join(dir, build.setFileName(s.n)), "utf8").split("\n");
    const line = lines.find((l) => l.startsWith(order.join(" ") + ","));
    assert.ok(line, order.join(" ") + " is in its set file");
    const want = statsVia(s, order);
    const got = line.split(",").slice(1).map(Number);
    assert.deepEqual(got, [want.min_memo, want.max_memo, want.sum_memo, want.memorized, want.d_moves, want.pin_changes, want.max_pin_changes]);
  }
});

test("version.json matches the CSV files on disk", () => {
  const v = JSON.parse(fs.readFileSync(path.join(build.OUT_DIR, "version.json"), "utf8"));
  assert.equal(v.version, build.dataVersion());
  assert.equal(v.sets, 272);
  assert.equal(v.orders, 272 * 5040);
});
