window.loadTopbar = function loadTopbar(route = window.getCurrentRoute?.() || "dashboard") {
  window.renderTopbar?.(route);
};
