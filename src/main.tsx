import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
import { TooltipProvider } from "@/components/ui/tooltip";
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <TooltipProvider>
            <App />
        </TooltipProvider>
    </React.StrictMode>,
);
