#!/usr/bin/env node
/*
 * Build the pin-order database used by docs/orders.html.
 *
 * A port of the "gather statistics" loop in ClockClean.Rmd: for each of the 272 valid
 * 7-simul pin sets, score all 5040 orderings of its pin states and write them as CSV.
 *
 * Output (all plain text, so the numbers can be read straight from the repository):
 *   docs/data/orders/sets.csv   one line per pin set: its number, pin states, determinant
 *   docs/data/orders/NNN.csv    the 5040 orderings of set NNN, best (lowest total memo) first
 *
 * Columns of NNN.csv, matching the notebook's data frame:
 *   order            the seven pin states in the order they are used
 *   min_memo         shortest memo formula among the memorised turns (clocks to add up)
 *   max_memo         longest memo formula
 *   sum_memo         total memo length over all memorised turns ("Sum of Memo Lengths")
 *   memorized        turns that are not intuitive ("Memorized Moves"); mean memo = sum_memo / memorized
 *   d_moves          pin states that force a D-wheel turn (U, D, DL, DR, dl, dr)
 *   pin_changes      pins flipped over the six changes of pin state; mean per change = pin_changes / 6
 *   max_pin_changes  most pins flipped in a single change of pin state
 *
 * Run with: node scripts/build-orders.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const Clock = require("../docs/clock.js");

const D_PINS = new Set(["U", "D", "DL", "DR", "dl", "dr"]);
const OUT_DIR = path.join(__dirname, "..", "docs", "data", "orders");
const HEADER = "order,min_memo,max_memo,sum_memo,memorized,d_moves,pin_changes,max_pin_changes";

function* combos(arr, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, k, i + 1, acc); acc.pop(); }
}

function* permutations(arr) {
  if (arr.length <= 1) { yield arr.slice(); return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

/** The 272 pin sets whose 14 moves span clock space, numbered as in the notebook (combn order). */
function validSets() {
  const sets = [];
  for (const set of combos(Clock.PIN_STATES, 7)) {
    const { ok, det, inv } = Clock.invertExact(Clock.moveMatrix(set));
    if (ok) sets.push({ set, det, inv });
  }
  return sets;
}

/**
 * Statistics for one ordering of a pin set.
 * memoBySet maps pin state -> [front memo length, back memo length] for this set: the memo
 * length of a move is the number of non-zero entries in its row of the inverse move matrix,
 * and reordering the pin states only reorders those rows, so it is computed once per set.
 */
function orderStats(order, memoBySet) {
  const cols = Clock.moveMatrix(order);
  const intuitive = Clock.intuitiveMoves(cols);
  const memo = [];
  for (let i = 0; i < 7; i++) {
    const m = memoBySet[order[i]];
    memo.push(intuitive.has(2 * i) ? 0 : m[0], intuitive.has(2 * i + 1) ? 0 : m[1]);
  }
  const memorised = memo.filter((n) => n > 0);
  let pinChanges = 0, maxPinChanges = 0;
  for (let i = 1; i < 7; i++) {
    const a = Clock.PINS_UP[order[i - 1]], b = Clock.PINS_UP[order[i]];
    let d = 0;
    for (let k = 0; k < 4; k++) if (a[k] !== b[k]) d++;
    pinChanges += d;
    if (d > maxPinChanges) maxPinChanges = d;
  }
  return {
    order: order.slice(),
    min_memo: memorised.length ? Math.min(...memorised) : 0,
    max_memo: Math.max(...memo),
    sum_memo: memo.reduce((x, y) => x + y, 0),
    memorized: 14 - intuitive.size,
    d_moves: order.filter((p) => D_PINS.has(p)).length,
    pin_changes: pinChanges,
    max_pin_changes: maxPinChanges,
  };
}

/** Memo length of each pin state's front and back move within a set, from the exact inverse. */
function memoLengths(set, inv) {
  const out = {};
  set.forEach((p, i) => {
    out[p] = [inv[2 * i].filter((q) => !q.isZero()).length, inv[2 * i + 1].filter((q) => !q.isZero()).length];
  });
  return out;
}

function statsForSet(set, inv) {
  const memoBySet = memoLengths(set, inv);
  const rows = [];
  for (const order of permutations(set)) rows.push(orderStats(order, memoBySet));
  rows.sort((a, b) => a.sum_memo - b.sum_memo || a.memorized - b.memorized || a.max_memo - b.max_memo
    || a.order.join(" ").localeCompare(b.order.join(" ")));
  return rows;
}

function rowToCsv(r) {
  return [r.order.join(" "), r.min_memo, r.max_memo, r.sum_memo, r.memorized, r.d_moves, r.pin_changes, r.max_pin_changes].join(",");
}

function setFileName(n) { return String(n).padStart(3, "0") + ".csv"; }

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sets = validSets();
  const index = ["set,pins,det,d_moves"];
  const t0 = Date.now();
  sets.forEach(({ set, det, inv }, i) => {
    const n = i + 1;
    const rows = statsForSet(set, inv);
    fs.writeFileSync(path.join(OUT_DIR, setFileName(n)), HEADER + "\n" + rows.map(rowToCsv).join("\n") + "\n");
    index.push([n, set.join(" "), det.toString(), set.filter((p) => D_PINS.has(p)).length].join(","));
    if (n % 34 === 0 || n === sets.length) process.stderr.write("  " + n + "/" + sets.length + " pin sets written\n");
  });
  fs.writeFileSync(path.join(OUT_DIR, "sets.csv"), index.join("\n") + "\n");
  process.stderr.write("Wrote " + sets.length + " sets (" + sets.length * 5040 + " orders) to " + path.relative(process.cwd(), OUT_DIR)
    + " in " + ((Date.now() - t0) / 1000).toFixed(1) + " s\n");
}

module.exports = { validSets, orderStats, memoLengths, statsForSet, setFileName, HEADER, D_PINS, OUT_DIR };
if (require.main === module) main();
