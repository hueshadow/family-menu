# R2 Photo Route Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch four Next.js photo API routes from local filesystem reads to R2 object reads via `getFromR2`.

**Architecture:** Keep each route thin and deterministic: validate params, derive a single R2 key, fetch object, and stream `obj.body` back with image headers. Remove all local disk dependencies from these handlers.

**Tech Stack:** Next.js App Router route handlers, TypeScript, R2 helper at `@/lib/r2`

### Task 1: Rewrite dish photo route

**Files:**
- Modify: `src/app/api/photo/dish/[dayIdx]/[slotIdx]/route.ts`

**Step 1: Review current handler**

Read the route and confirm it currently imports `readFile`, `join`, and local photo dir constants.

**Step 2: Replace local file reads with R2 lookup**

Use:

```ts
import { getFromR2 } from "@/lib/r2";
```

Build key:

```ts
const key = `dish-images/d${dayIdx}-s${slotIdx}.png`;
```

Return:

```ts
return new Response(obj.body, {
  status: 200,
  headers: {
    "Content-Type": obj.httpMetadata?.contentType ?? "image/png",
    "Cache-Control": "public, max-age=86400",
  },
});
```

**Step 3: Verify diff shape**

Confirm no `node:fs/promises`, `node:path`, or local dir import remains.

### Task 2: Rewrite table photo route

**Files:**
- Modify: `src/app/api/photo/table/[date]/route.ts`

**Step 1: Keep existing date validation**

Preserve:

```ts
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  return new Response("invalid date", { status: 400 });
}
```

**Step 2: Replace local file reads with R2 lookup**

Build key:

```ts
const key = `table-photos/${date}.png`;
```

Reuse the same response/header pattern as Task 1.

**Step 3: Verify diff shape**

Confirm no `TABLE_PHOTOS_DIR`, `readFile`, or `join` usage remains.

### Task 3: Rewrite menu board route

**Files:**
- Modify: `src/app/api/photo/menu-board/[weekStart]/route.ts`

**Step 1: Keep existing weekStart validation**

Preserve:

```ts
if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
  return new Response("invalid weekStart", { status: 400 });
}
```

**Step 2: Replace local file reads with R2 lookup**

Build key:

```ts
const key = `menu-boards/${weekStart}_week.png`;
```

Use the same streamed response pattern.

**Step 3: Verify diff shape**

Confirm no `MENU_BOARDS_DIR`, `readFile`, or `join` usage remains.

### Task 4: Rewrite day board route

**Files:**
- Modify: `src/app/api/photo/day-board/[date]/route.ts`

**Step 1: Remove generation/caching logic**

Delete disk cache reads, `composeDayBoard`, DB lookup, weekday constants, and table-photo existence checks.

**Step 2: Replace with direct R2 lookup**

Build key:

```ts
const key = `day-boards/${date}.png`;
```

Return the streamed object response with:

```ts
"Content-Type": obj.httpMetadata?.contentType ?? "image/png"
```

and the existing cache header.

**Step 3: Verify final shape**

Ensure the route now matches the same simple pattern as the other three handlers.

### Task 5: Validation

**Files:**
- Verify: the four route files above

**Step 1: Inspect the final files**

Confirm each route imports only `getFromR2` plus framework globals.

**Step 2: Optional static validation**

If the repository has a working lint/typecheck setup and `@/lib/r2` exists locally, run project validation. Otherwise record the skip reason.
