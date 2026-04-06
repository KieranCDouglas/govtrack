import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Remove any stale localStorage quiz result (migrated to sessionStorage)
try { localStorage.removeItem("civicism_quiz_result"); } catch { /* ignore */ }

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
