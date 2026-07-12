import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "sonner/dist/styles.css";
import "./App.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initMonitoring } from "@/lib/monitoring";

initMonitoring();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <TooltipProvider>
            <App />
        </TooltipProvider>
    </React.StrictMode>,
);
