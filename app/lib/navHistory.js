"use client";

/**
 * In-app navigation history, so a Back button can tell "there is an in-app
 * page behind me" (→ router.back(), keeps scroll + state) from "I was opened
 * directly / from a PWA launch / a notification" (→ go to a sensible parent,
 * instead of router.back() dumping the user out of the app).
 *
 * The stack only tracks pathnames. A visit to the path just below the top is
 * treated as a back navigation and pops, so browser/OS back gestures keep it
 * in sync too.
 */

const stack = [];

export function recordPath(path) {
  if (!path || stack[stack.length - 1] === path) return;
  if (stack.length > 1 && stack[stack.length - 2] === path) {
    stack.pop();
    return;
  }
  stack.push(path);
}

export function canGoBack() {
  return stack.length > 1;
}
