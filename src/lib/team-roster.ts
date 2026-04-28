export type PlayerRole = "batter" | "all_rounder" | "bowler";

export interface TeamPlayer {
  name: string;
  role: PlayerRole;
}

export const PLAYER_ROLE_OPTIONS: { value: PlayerRole; label: string }[] = [
  { value: "batter", label: "Batter" },
  { value: "all_rounder", label: "All-rounder" },
  { value: "bowler", label: "Bowler" },
];

function isPlayerRole(value: unknown): value is PlayerRole {
  return value === "batter" || value === "all_rounder" || value === "bowler";
}

export function normalizeTeamPlayer(value: unknown): TeamPlayer | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as { name?: unknown; role?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  if (!name) return null;

  return {
    name,
    role: isPlayerRole(candidate.role) ? candidate.role : "batter",
  };
}

export function normalizeTeamPlayers(value: unknown): TeamPlayer[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((player) => normalizeTeamPlayer(player))
    .filter((player): player is TeamPlayer => player !== null);
}

export function getBowlingSquad(players: TeamPlayer[]): TeamPlayer[] {
  const bowlingOptions = players.filter((player) => player.role !== "batter");
  return bowlingOptions.length > 0 ? bowlingOptions : players;
}

export function namesEqual(left?: string | null, right?: string | null) {
  return (left || "").trim().toLowerCase() === (right || "").trim().toLowerCase();
}
