/*
 * Light/dark theme toggle shared by the pages.
 *
 * The pages follow the system theme until the visitor picks one with the ☀️/🌕 switch; the
 * choice is remembered in localStorage. Load this in <head> so a remembered choice is applied
 * before the first paint. The CSS reacts to data-theme="light" / "dark" on <html>.
 */
(function () {
  "use strict";
  const KEY = "clock7.theme";
  const root = document.documentElement;
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function current() { return root.dataset.theme || (media && media.matches ? "dark" : "light"); }
  function apply(theme) {
    if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
    try { if (theme) localStorage.setItem(KEY, theme); else localStorage.removeItem(KEY); } catch (e) {}
  }

  const initial = saved();
  if (initial === "light" || initial === "dark") root.dataset.theme = initial;

  /** Wire a <button class="theme"> with two spans (☀️ and 🌕) and a knob. */
  function mount(button) {
    const render = () => {
      const t = current();
      button.dataset.theme = t;
      button.setAttribute("aria-checked", t === "dark" ? "true" : "false");
      button.title = (t === "dark" ? "Dark" : "Light") + " theme" + (root.dataset.theme ? "" : " (following your system)") + ". Click to switch.";
    };
    button.addEventListener("click", () => { apply(current() === "dark" ? "light" : "dark"); render(); });
    if (media) media.addEventListener("change", () => { if (!root.dataset.theme) render(); });
    render();
  }

  window.ClockTheme = { mount, current, apply };
})();
