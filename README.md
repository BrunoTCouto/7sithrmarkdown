# 7-simul Rubik's Clock solver

`ClockClean.Rmd` is the research notebook: it models Rubik's Clock as linear algebra
(14 clocks, each pin state giving a front and a back wheel turn), finds the 272 sets of
seven pin states whose 14 turns can solve any scramble, and scores all 1.3 million orderings
of those sets by memo length, intuitive turns, pin changes and so on.

`docs/` is the same solver as a web page, so friends can use it without installing R.

## Use it online

Open `docs/index.html` in a browser, or host the `docs/` folder on GitHub Pages:
repository **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main`, folder `/docs`**. The page is static and runs entirely in the browser.

* Paste a WCA scramble (`UR2+ DR3- … y2 U5+ …`) or set the 14 clock dials by tapping or dragging the hands (arrow keys and digits work too). The back face shows the geared corner dials as on the real puzzle.
* Pick a 7-simul pin order (the four from the notebook, Tommy, Bpaul, Connor and 7sh1, are presets; the last one you used is remembered).
* Read off the 14 turns, each with the memo formula you would use to compute it. Intuitive turns say what to line up instead (`align C to U/L`, `align L block to R`, `align to 12`), as worked out by the notebook's `newIntFinder`.
* Everything on the form (scramble, the 14 faces, pin order) is kept in the URL as you change it, so the address bar is always a link to what you see; **Share link** copies it. `?scramble=UR2%2B+DR3-+…` applies a scramble, `?state=11,9,…` sets the 14 faces directly, `?order=dl+R+DR+…` preselects a pin order.

## Pin order finder

`docs/orders.html` searches all 1,370,880 orderings of the 272 working pin sets, scored the way
the notebook scores them (memo lengths, memorised vs. intuitive turns, D-wheel pin states, pin
changes). Require or exclude pin states, fix the first or last one, cap any statistic, sort, and
open an order in the solver. Rows from the four determinant ±3 sets are marked `det ±3`. The filters
and sort live in the URL too (`?require=dl+\&exclude=/&first=dl&memorized=6&sort=memorized&dir=desc`),
and **Share link** copies it.

The numbers come from `node scripts/build-orders.js`, a port of the notebook's statistics loop,
and are committed as plain CSV so they can be read on GitHub:

* `docs/data/orders/sets.csv`: the 272 pin sets, numbered as in the notebook's `r14Sets`, with determinant.
* `docs/data/orders/NNN.csv`: the 5,040 orderings of set `NNN`, lowest total memo first, with columns
  `order, min_memo, max_memo, sum_memo, memorized, d_moves, pin_changes, max_pin_changes`.
  Mean memo length is `sum_memo / memorized`; mean pin changes per step is `pin_changes / 6`.

Regenerating takes a few seconds; the output is deterministic, so a rerun should produce no diff.

Conventions match the notebook: both the front wheel (a pin that is up) and the back wheel
(a pin that is down) are turned as seen from the front, `+` is clockwise; back faces are
read with the puzzle flipped over. The pages show the two diagonal pin states as `\` (the
notebook's `BS`, UL and DR up) and `/` (`FS`, UR and DL up); the code and the CSV files keep
the `BS`/`FS` names, and `?order=` accepts either spelling.

## Files

| Path | What |
| --- | --- |
| `ClockClean.Rmd` | Original R notebook (derivation, method statistics) |
| `docs/clock.js` | Solver core in plain JavaScript: move matrices, exact rational inverse, intuitive-move finder, memo formulas, scramble parser |
| `docs/index.html` | The web page |
| `docs/orders.html` | Pin order finder: filters and sorts the 1.37M scored orders in the browser |
| `docs/data/orders/` | The scored orders as CSV, one file per pin set |
| `scripts/build-orders.js` | Generates `docs/data/orders/` (port of the notebook's statistics loop) |
| `tests/clock.test.js` | Checks against the states and pin orders recorded in the notebook |
| `tests/orders.test.js` | Checks the order statistics against direct computation and the CSVs on disk |

## Tests

```
node --test
```

The tests reproduce the notebook's two recorded scramble → state pairs, the count of 272 valid
pin sets, and verify that every produced solution really returns all 14 clocks to 12.

## A note on the maths

Of the 272 valid pin sets, 268 have a move matrix with determinant ±1 and solve every
scramble with whole-hour turns. The other 4 have determinant ±3: their inverse contains
thirds, so they only solve one scramble in three. The web solver warns when such an order
is chosen and says so when a given scramble has no solution with it. This is why the notebook
needed its "round to the nearest third" helper.
