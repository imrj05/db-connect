import React from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

import { TooltipProvider } from "@/components/ui/tooltip";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
);
