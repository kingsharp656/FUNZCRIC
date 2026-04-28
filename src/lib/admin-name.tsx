import { ReactNode } from "react";

const ADMIN_NAME = "sunandan singh";

/** Title-case a string, preserving spaces. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** True if the given text equals the admin name (case-insensitive, trimmed). */
export function isAdminName(name?: string | null): boolean {
  if (!name) return false;
  return name.trim().toLowerCase() === ADMIN_NAME;
}

/**
 * Render a name with the special "Sunandan Singh (Admin)" gold treatment when matched.
 * Use this everywhere a user-provided name is shown (teams, players, scorer name, etc.).
 */
export function renderName(name?: string | null): ReactNode {
  if (!name) return null;
  if (isAdminName(name)) {
    return (
      <span className="gold-name">
        {titleCase(name)} <span className="opacity-90">(Admin)</span>
      </span>
    );
  }
  return <>{name}</>;
}

/** Plain string version (for places that need a string, not JSX). */
export function displayName(name?: string | null): string {
  if (!name) return "";
  if (isAdminName(name)) return `${titleCase(name)} (Admin)`;
  return name;
}
