# Product

## Register

product

## Users

Developers and data-adjacent engineers who work across several databases at once — Postgres, MySQL, SQLite, MongoDB, Redis — often against dev, staging, and production simultaneously. They live in editors and terminals, expect keyboard-first workflows, and open this app to get an answer or make a change, not to admire it. Context: long working sessions, frequent env-switching, real stakes when the connection badge says PROD.

## Product Purpose

DB Connect is a fast, native desktop database client (Tauri 2 · React 19 · Rust) — one window for every engine, no Electron overhead. Its differentiator is the typed function registry (dbcooper-style `prefix_query()`, `prefix_tableName()`) that lets users navigate databases the way they navigate code. Success looks like: connect in seconds, query without friction, never mutate the wrong environment by accident.

## Brand Personality

Comfortable precision. Quiet, workspace-like, trustworthy. The interface is a well-organized desk: everything within reach, nothing decorative, data always front and center. Confidence is expressed through restraint — instant state changes, visible structure, monospace data — not through flash.

## Anti-references

- **Enterprise database IDEs (DBeaver, pgAdmin):** toolbar farms, nested modal dialogs, Java-desktop chrome, preference trees ten levels deep. DB Connect stays flat, discoverable, and keyboard-first.
- **Glossy web-SaaS aesthetics:** marketing gradients, oversized rounded cards, playful illustration. This is a native tool, not a browser tab; it should never feel like a landing page.

## Design Principles

1. **Data is the interface.** Chrome recedes; query results, schemas, and cell values get the space, the contrast, and the monospace treatment. Any pixel that doesn't serve the data must justify itself.
2. **Ambient safety, never modal nagging.** Environment awareness (prod red / staging amber / local green) runs through borders, badges, CTAs, and SQL tokens continuously — so destructive-action dialogs are the last line of defense, not the first.
3. **Keyboard-first, mouse-optional.** Every workflow has a shortcut path; focus states are visible; new features ship with their key bindings, not as an afterthought.
4. **Instant over animated.** State changes are immediate. Motion exists only where it communicates (and respects reduced-motion).
5. **One window, many engines.** Features must work coherently across all five databases or degrade gracefully and honestly — no Postgres-only affordances that silently break elsewhere.

## Accessibility & Inclusion

- **WCAG AA contrast** in both dark and light themes: ≥4.5:1 body/data text, ≥3:1 large text and UI components.
- **Full keyboard operability:** every action reachable without a mouse, visible focus rings throughout.
- **Color-blind-safe safety system:** prod/staging/local signals are never color-alone — always paired with text badges ("PROD", "STG", "LCL") or icons.
- **Reduced motion:** honor `prefers-reduced-motion`; the app's motion budget is already minimal (2/10) and stays that way.
