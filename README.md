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

* Paste a WCA scramble (`UR2+ DR3- … y2 U5+ …`) or type the 14 clock faces by hand.
* Pick a 7-simul pin order (the three from the notebook are presets; the last one you used is remembered).
* Read off the 14 turns, each with the memo formula you would use to compute it, and which turns are intuitive.
* A link with `?scramble=UR2%2B+DR3-+…` opens the page with that scramble applied.

Conventions match the notebook: both the front wheel (a pin that is up) and the back wheel
(a pin that is down) are turned as seen from the front, `+` is clockwise; back faces are
read with the puzzle flipped over.

## Files

| Path | What |
| --- | --- |
| `ClockClean.Rmd` | Original R notebook (derivation, method statistics) |
| `docs/clock.js` | Solver core in plain JavaScript: move matrices, exact rational inverse, intuitive-move finder, memo formulas, scramble parser |
| `docs/index.html` | The web page |
| `tests/clock.test.js` | Checks against the states and pin orders recorded in the notebook |

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
