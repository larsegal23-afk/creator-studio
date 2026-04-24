window.loadSidebar = function loadSidebar(route = window.getCurrentRoute?.() || "dashboard") {
  window.renderSidebar?.(route);
};
