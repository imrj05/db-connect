import "@testing-library/jest-dom/vitest";

import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

function createStorageMock() {
  let store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store = new Map<string, string>();
    }),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
  };
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange, readOnly }: { value?: string; onChange?: (value: string) => void; readOnly?: boolean }) =>
    readOnly ? (
      <div data-testid="mock-codemirror-readonly">{value}</div>
    ) : (
      <textarea
        data-testid="mock-codemirror"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
      />
    ),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.className = "";
});

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

if (!window.ResizeObserver) {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", { value: ResizeObserver });
}

Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });
Object.defineProperty(window, "requestAnimationFrame", {
  value: (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0),
  writable: true,
});
Object.defineProperty(window, "cancelAnimationFrame", {
  value: (id: number) => clearTimeout(id),
  writable: true,
});
Object.defineProperty(window, "confirm", {
  value: vi.fn(() => true),
  writable: true,
});

Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
  configurable: true,
});
