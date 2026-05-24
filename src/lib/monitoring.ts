import * as Sentry from "@sentry/react";
import { invoke } from "@tauri-apps/api/core";
import packageJson from "../../package.json";

const SETTINGS_KEY = "db_connect_settings_v1";
const dsn = import.meta.env.VITE_GLITCHTIP_DSN || import.meta.env.VITE_SENTRY_DSN || "";

type TelemetryValue = string | number | boolean | null | undefined;
type TelemetryProperties = Record<string, TelemetryValue>;

let initialized = false;

export function initMonitoring() {
    if (initialized || !dsn) {
        return;
    }

    initialized = true;

    Sentry.init({
        dsn,
        release: `db-connect@${packageJson.version}`,
        environment: import.meta.env.DEV ? "development" : "production",
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend(event) {
            const isTelemetry = event.tags?.telemetry === "true";

            if (isTelemetry) {
                if (!isAnonymousTelemetryEnabled()) {
                    return null;
                }
            } else if (!isErrorReportingEnabled()) {
                return null;
            }

            delete event.user;
            delete event.request;
            return event;
        },
    });
}

export function captureReactError(error: Error, errorInfo?: { componentStack?: string | null }) {
    if (!dsn || !isErrorReportingEnabled()) {
        return;
    }

    Sentry.withScope((scope) => {
        if (errorInfo?.componentStack) {
            scope.setContext("react", { componentStack: errorInfo.componentStack });
        }

        Sentry.captureException(error);
    });
}

export function captureTelemetry(name: string, properties: TelemetryProperties = {}) {
    if (!isAnonymousTelemetryEnabled() || !isSafeName(name)) {
        return;
    }

    const safeProperties = sanitizeProperties(properties);

    if (dsn) {
        Sentry.withScope((scope) => {
            scope.setTag("telemetry", "true");
            scope.setTag("event", name);
            scope.setTag("surface", "react");
            scope.setContext("telemetry", safeProperties);
            Sentry.captureMessage(`telemetry.${name}`, "info");
        });
    }

    void invoke("monitoring_capture_telemetry", {
        name,
        properties: stringifyProperties(safeProperties),
    }).catch(() => {
        // Telemetry is best-effort and must never affect the app flow.
    });
}

export function syncTauriMonitoringPreferences(
    errorReportingEnabled: boolean,
    anonymousTelemetryEnabled: boolean,
) {
    void invoke("monitoring_set_preferences", {
        errorReportingEnabled,
        anonymousTelemetryEnabled,
    }).catch(() => {
        // Monitoring preferences should not block startup in browser-only tests.
    });
}

function isErrorReportingEnabled() {
    return readSetting("errorReportingEnabled", true);
}

function isAnonymousTelemetryEnabled() {
    return readSetting("anonymousTelemetryEnabled", false);
}

function readSetting(key: string, fallback: boolean) {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) {
            return fallback;
        }

        const value = JSON.parse(raw)?.[key];
        return typeof value === "boolean" ? value : fallback;
    } catch {
        return fallback;
    }
}

function sanitizeProperties(properties: TelemetryProperties) {
    return Object.fromEntries(
        Object.entries(properties)
            .filter(([key]) => isSafeName(key))
            .slice(0, 20)
            .map(([key, value]) => [key, normalizeTelemetryValue(value)]),
    );
}

function stringifyProperties(properties: Record<string, string | number | boolean | null>) {
    return Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [key, value == null ? "" : String(value)]),
    );
}

function normalizeTelemetryValue(value: TelemetryValue) {
    if (typeof value === "string") {
        return value.slice(0, 120);
    }

    if (typeof value === "number" || typeof value === "boolean" || value === null) {
        return value;
    }

    return null;
}

function isSafeName(value: string) {
    return /^[a-zA-Z0-9_.-]{1,64}$/.test(value);
}
