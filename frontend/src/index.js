import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Remove Emergent badge if it exists
const removeEmergentBadge = () => {
  const badge = document.getElementById("emergent-badge");
  if (badge) {
    badge.remove();
  }
  
  // Also check for any links to emergent.sh
  const emergentLinks = document.querySelectorAll('a[href*="emergent.sh"], a[href*="emergent-badge"]');
  emergentLinks.forEach(link => {
    if (link.id === "emergent-badge" || link.href.includes("emergent")) {
      link.remove();
    }
  });
};

// Remove badge immediately
removeEmergentBadge();

// Also remove it after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", removeEmergentBadge);
} else {
  removeEmergentBadge();
}

// Use MutationObserver to catch dynamically added badges
const observer = new MutationObserver(() => {
  removeEmergentBadge();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
