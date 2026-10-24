(function () {
  "use strict";

  const DEMO_URL = "http://localhost:3000/";

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() !== "d") return;
    const active = document.querySelector(".slide.is-active");
    if (!active || !active.classList.contains("slide-three")) return;
    event.preventDefault();
    window.location.assign(DEMO_URL);
  });

  document.querySelectorAll("[data-demo-link]").forEach((link) => {
    link.addEventListener("click", () => {
      try {
        sessionStorage.setItem("bukidpay-deck-return", window.location.href);
      } catch {
        // Navigation must remain usable if storage is unavailable.
      }
    });
  });
})();
