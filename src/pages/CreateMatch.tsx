import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  PLAYER_ROLE_OPTIONS,
  type PlayerRole,
  type TeamPlayer,
  normalizeTeamPlayers,
} from "@/lib/team-roster";

const schema = z.object({
  team_a: z.string().trim().min(1, "Team A required").max(50),
  team_b: z.string().trim().min(1, "Team B required").max(50),
  format: z.enum(["T10", "T20", "ODI", "Custom"]),
  total_overs: z.number().int().min(1).max(50),
  toss_winner: z.string().trim().min(1, "Toss winner required"),
  toss_decision: z.enum(["bat", "bowl"]),
  scorer_name: z.string().trim().min(1, "Your name required").max(50),
});

type MatchForm = {
  team_a: string;
  team_b: string;
  format: "T10" | "T20" | "ODI" | "Custom";
  total_overs: number;
  toss_winner: string;
  toss_decision: "bat" | "bowl";
  scorer_name: string;
};

type MatchDraft = {
  form?: Partial<MatchForm>;
  teamAPlayers?: unknown;
  teamBPlayers?: unknown;
};

const formatToOvers: Record<string, number> = { T10: 10, T20: 20, ODI: 50, Custom: 20 };
const CREATE_MATCH_DRAFT_KEY = "create-match-draft";

const defaultForm: MatchForm = {
  team_a: "",
  team_b: "",
  format: "T20",
  total_overs: 20,
  toss_winner: "",
  toss_decision: "bat",
  scorer_name: "",
};

function createEmptyPlayer(role: PlayerRole = "batter"): TeamPlayer {
  return { name: "", role };
}

function buildInitialSquad(): TeamPlayer[] {
  return [
    createEmptyPlayer("batter"),
    createEmptyPlayer("batter"),
    createEmptyPlayer("batter"),
    createEmptyPlayer("batter"),
    createEmptyPlayer("all_rounder"),
    createEmptyPlayer("all_rounder"),
    createEmptyPlayer("all_rounder"),
    createEmptyPlayer("bowler"),
    createEmptyPlayer("bowler"),
    createEmptyPlayer("bowler"),
    createEmptyPlayer("bowler"),
  ];
}

function sanitizeSquad(players: TeamPlayer[]) {
  return normalizeTeamPlayers(players);
}

function validateSquad(label: string, players: TeamPlayer[]) {
  const squad = sanitizeSquad(players);

  if (squad.length < 2) {
    return { error: `${label} needs at least 2 players`, squad: [] as TeamPlayer[] };
  }

  const names = squad.map((player) => player.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    return { error: `${label} has duplicate player names`, squad: [] as TeamPlayer[] };
  }

  if (!squad.some((player) => player.role === "bowler" || player.role === "all_rounder")) {
    return { error: `${label} needs at least one bowler or all-rounder`, squad: [] as TeamPlayer[] };
  }

  return { error: null, squad };
}

const CreateMatch = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<MatchForm>(defaultForm);
  const [teamAPlayers, setTeamAPlayers] = useState<TeamPlayer[]>(buildInitialSquad());
  const [teamBPlayers, setTeamBPlayers] = useState<TeamPlayer[]>(buildInitialSquad());

  useEffect(() => {
    const savedDraft = localStorage.getItem(CREATE_MATCH_DRAFT_KEY);
    if (!savedDraft) return;

    try {
      const parsedDraft = JSON.parse(savedDraft) as MatchDraft;
      const parsedForm = schema.partial().safeParse(parsedDraft.form ?? {});
      if (parsedForm.success) {
        setForm((current) => ({ ...current, ...parsedForm.data }));
      }

      const savedTeamAPlayers = normalizeTeamPlayers(parsedDraft.teamAPlayers);
      const savedTeamBPlayers = normalizeTeamPlayers(parsedDraft.teamBPlayers);
      if (savedTeamAPlayers.length > 0) setTeamAPlayers(savedTeamAPlayers);
      if (savedTeamBPlayers.length > 0) setTeamBPlayers(savedTeamBPlayers);
    } catch {
      localStorage.removeItem(CREATE_MATCH_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      CREATE_MATCH_DRAFT_KEY,
      JSON.stringify({ form, teamAPlayers, teamBPlayers }),
    );
  }, [form, teamAPlayers, teamBPlayers]);

  const updateTeamPlayer = (
    setter: React.Dispatch<React.SetStateAction<TeamPlayer[]>>,
    index: number,
    field: keyof TeamPlayer,
    value: string,
  ) => {
    setter((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? { ...player, [field]: value } : player,
      ),
    );
  };

  const addTeamPlayer = (setter: React.Dispatch<React.SetStateAction<TeamPlayer[]>>) => {
    setter((current) => [...current, createEmptyPlayer()]);
  };

  const removeTeamPlayer = (setter: React.Dispatch<React.SetStateAction<TeamPlayer[]>>, index: number) => {
    setter((current) => current.filter((_, playerIndex) => playerIndex !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (form.team_a.trim().toLowerCase() === form.team_b.trim().toLowerCase()) {
      toast.error("Both teams cannot have the same name");
      return;
    }
    if (
      form.toss_winner.trim().toLowerCase() !== form.team_a.trim().toLowerCase() &&
      form.toss_winner.trim().toLowerCase() !== form.team_b.trim().toLowerCase()
    ) {
      toast.error("Toss winner must be one of the two teams");
      return;
    }

    const teamASquadValidation = validateSquad(form.team_a || "Team A", teamAPlayers);
    if (teamASquadValidation.error) {
      toast.error(teamASquadValidation.error);
      return;
    }

    const teamBSquadValidation = validateSquad(form.team_b || "Team B", teamBPlayers);
    if (teamBSquadValidation.error) {
      toast.error(teamBSquadValidation.error);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("matches")
      .insert({
        team_a: form.team_a.trim(),
        team_b: form.team_b.trim(),
        team_a_players: teamASquadValidation.squad,
        team_b_players: teamBSquadValidation.squad,
        format: form.format,
        total_overs: form.total_overs,
        toss_winner: form.toss_winner.trim(),
        toss_decision: form.toss_decision,
        scorer_name: form.scorer_name.trim(),
        status: "setup",
      })
      .select("id, scorer_token, view_token")
      .single();

    if (error || !data) {
      setLoading(false);
      toast.error(error?.message || "Could not create match");
      return;
    }

    const battingTeam =
      form.toss_decision === "bat"
        ? form.toss_winner.trim()
        : form.toss_winner.trim().toLowerCase() === form.team_a.trim().toLowerCase()
          ? form.team_b.trim()
          : form.team_a.trim();
    const bowlingTeam = battingTeam === form.team_a.trim() ? form.team_b.trim() : form.team_a.trim();

    await supabase.from("innings_state").insert({
      match_id: data.id,
      innings_number: 1,
      batting_team: battingTeam,
      bowling_team: bowlingTeam,
    });

    localStorage.removeItem(CREATE_MATCH_DRAFT_KEY);
    toast.success("Match created! Redirecting to scorer console…");
    navigate(`/score/${data.id}/${data.scorer_token}`);
  };

  const renderSquadEditor = (
    label: string,
    players: TeamPlayer[],
    setter: React.Dispatch<React.SetStateAction<TeamPlayer[]>>,
  ) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="display text-2xl">{label} squad</h2>
          <p className="text-sm text-muted-foreground">
            Add your players and roles so live scoring can suggest batters and bowlers correctly.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => addTeamPlayer(setter)}>
          <Plus className="w-4 h-4 mr-2" /> Add player
        </Button>
      </div>

      <div className="space-y-3">
        {players.map((player, index) => (
          <div key={`${label}-${index}`} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_180px_auto]">
            <div className="space-y-2">
              <Label htmlFor={`${label}-player-${index}`}>Player {index + 1}</Label>
              <Input
                id={`${label}-player-${index}`}
                maxLength={50}
                value={player.name}
                onChange={(e) => updateTeamPlayer(setter, index, "name", e.target.value)}
                placeholder="Player name"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={player.role}
                onValueChange={(value) => updateTeamPlayer(setter, index, "role", value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAYER_ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeTeamPlayer(setter, index)}
                disabled={players.length <= 2}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <BrandHeader />
      <main className="container max-w-4xl py-10">
        <h1 className="display text-4xl md:text-5xl mb-2">Create New Match</h1>
        <p className="text-muted-foreground mb-8">
          Set the match basics and both squads. The scorer will then pick live batters and bowlers from those teams in both innings.
        </p>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 md:p-8 space-y-8">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="team_a">Team A</Label>
              <Input
                id="team_a"
                maxLength={50}
                value={form.team_a}
                onChange={(e) => setForm({ ...form, team_a: e.target.value })}
                placeholder="e.g. Mumbai Indians"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team_b">Team B</Label>
              <Input
                id="team_b"
                maxLength={50}
                value={form.team_b}
                onChange={(e) => setForm({ ...form, team_b: e.target.value })}
                placeholder="e.g. Chennai Super Kings"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={form.format}
                onValueChange={(value) =>
                  setForm({ ...form, format: value as MatchForm["format"], total_overs: formatToOvers[value] })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="T10">T10 (10 overs)</SelectItem>
                  <SelectItem value="T20">T20 (20 overs)</SelectItem>
                  <SelectItem value="ODI">ODI (50 overs)</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="overs">Total overs</Label>
              <Input
                id="overs"
                type="number"
                min={1}
                max={50}
                value={form.total_overs}
                onChange={(e) => setForm({ ...form, total_overs: parseInt(e.target.value, 10) || 1 })}
                disabled={form.format !== "Custom"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Toss winner</Label>
            <RadioGroup
              value={form.toss_winner}
              onValueChange={(value) => setForm({ ...form, toss_winner: value })}
              className="grid grid-cols-2 gap-3"
            >
              {[form.team_a, form.team_b].filter(Boolean).map((team) => (
                <Label
                  key={team}
                  htmlFor={`toss-${team}`}
                  className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:bg-card/50 has-[:checked]:border-accent has-[:checked]:bg-accent/5"
                >
                  <RadioGroupItem id={`toss-${team}`} value={team} />
                  <span className="font-semibold">{team}</span>
                </Label>
              ))}
              {(!form.team_a || !form.team_b) && (
                <p className="text-sm text-muted-foreground col-span-2">Enter both team names first.</p>
              )}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Toss decision</Label>
            <RadioGroup
              value={form.toss_decision}
              onValueChange={(value) => setForm({ ...form, toss_decision: value as MatchForm["toss_decision"] })}
              className="grid grid-cols-2 gap-3"
            >
              <Label htmlFor="bat" className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:bg-card/50 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                <RadioGroupItem id="bat" value="bat" /> Chose to bat
              </Label>
              <Label htmlFor="bowl" className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:bg-card/50 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                <RadioGroupItem id="bowl" value="bowl" /> Chose to bowl
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scorer">Your name (scorer)</Label>
            <Input
              id="scorer"
              maxLength={50}
              value={form.scorer_name}
              onChange={(e) => setForm({ ...form, scorer_name: e.target.value })}
              placeholder="Who is scoring this match?"
            />
          </div>

          {renderSquadEditor(form.team_a || "Team A", teamAPlayers, setTeamAPlayers)}
          {renderSquadEditor(form.team_b || "Team B", teamBPlayers, setTeamBPlayers)}

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-primary-glow shadow-[var(--shadow-brand)] h-14 text-base"
          >
            {loading ? <><Loader2 className="mr-2 animate-spin" /> Creating…</> : "Create Match & Open Scorer"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default CreateMatch;
