/*
 * Desktop behaviour for the Windows XP look: window title-bar buttons (minimise, maximise,
 * close + restore from the taskbar), the Start menu, the About window and the tray clock.
 * Purely cosmetic; the solver and finder logic lives in the pages and clock.js.
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  // ---- windows ----
  const tasks = $("tasks");
  function restoreButton(win) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "taskbtn restore";
    const title = win.querySelector(".title-bar-text");
    b.innerHTML = (title ? title.innerHTML : win.dataset.win) ;
    b.title = "Reopen " + (win.dataset.win || "window");
    b.addEventListener("click", () => { win.hidden = false; b.remove(); win.scrollIntoView({ block: "nearest" }); });
    return b;
  }
  for (const win of document.querySelectorAll(".window[data-win]")) {
    const btn = (label) => win.querySelector('.title-bar-controls button[aria-label="' + label + '"]');
    const min = btn("Minimize"), max = btn("Maximize"), close = btn("Close");
    if (min) min.addEventListener("click", () => {
      win.classList.toggle("minimized");
      if (win.classList.contains("minimized")) win.classList.remove("maximized");
    });
    if (max) max.addEventListener("click", () => {
      win.classList.remove("minimized");
      const on = win.classList.toggle("maximized");
      max.setAttribute("aria-label", on ? "Restore" : "Maximize");
      max.title = on ? "Restore" : "Maximize";
    });
    if (close) close.addEventListener("click", () => {
      win.classList.remove("maximized", "minimized");
      if (max) max.setAttribute("aria-label", "Maximize");
      win.hidden = true;
      if (tasks) tasks.appendChild(restoreButton(win));
    });
  }
  // Escape leaves a maximised window
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const win of document.querySelectorAll(".window.maximized")) {
      win.classList.remove("maximized");
      const max = win.querySelector('.title-bar-controls button[aria-label="Restore"]');
      if (max) max.setAttribute("aria-label", "Maximize");
    }
    closeStart();
  });

  // ---- start menu ----
  const start = $("start"), menu = $("startmenu");
  function closeStart() { if (!menu || menu.hidden) return; menu.hidden = true; start.setAttribute("aria-expanded", "false"); }
  if (start && menu) {
    start.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      start.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { const first = menu.querySelector("a, button"); if (first) first.focus(); }
    });
    menu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", closeStart);
  }

  // ---- about window ----
  const about = $("about");
  if (about) {
    for (const b of document.querySelectorAll("[data-open-about]")) b.addEventListener("click", () => { about.hidden = false; closeStart(); });
    for (const b of about.querySelectorAll('[aria-label="Close"], [data-close-about]')) b.addEventListener("click", () => { about.hidden = true; });
  }

  // ---- tray clock ----
  const clock = $("clock");
  if (clock) {
    const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
    tick(); setInterval(tick, 15000);
  }
})();
