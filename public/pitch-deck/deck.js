(function () {
  "use strict";

  const FILE_DEMO_URL = "http://localhost:3000/";

  function demoUrl() {
    return window.location.protocol === "file:"
      ? FILE_DEMO_URL
      : new URL("/", window.location.origin).href;
  }

  function openDemo() {
    try {
      sessionStorage.setItem("bukidpay-deck-return", window.location.href);
    } catch {
      // Navigation must remain usable if storage is unavailable.
    }
    window.location.assign(demoUrl());
  }

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() !== "d") return;
    const active = document.querySelector(".slide.is-active");
    if (!active || !active.classList.contains("slide-three")) return;
    event.preventDefault();
    openDemo();
  });

  document.querySelectorAll("[data-demo-link]").forEach((link) => {
    link.setAttribute("href", demoUrl());
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openDemo();
    });
  });
})();
