import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Loader2, Undo2, Trophy, Pause, Play } from "lucide-react";
import { applyBall, oversString, runRate, type ExtraType, type WicketType } from "@/lib/scoring-engine";
import { renderName, displayName } from "@/lib/admin-name";
import { Scorecard } from "@/components/Scorecard";
import { RunRateChart } from "@/components/RunRateChart";
import { getBowlingSquad, namesEqual, normalizeTeamPlayers, type TeamPlayer } from "@/lib/team-roster";

type Match = any;
type Innings = any;
type Ball = any;

const Scorer = () => {
  const { matchId, scorerToken } = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [innings, setInnings] = useState<Innings | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // Setup-time inputs (first/new batters & bowler)
  const [setupOpen, setSetupOpen] = useState(false);
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const [overBowlerOpen, setOverBowlerOpen] = useState(false);
  const [nextBowler, setNextBowler] = useState("");

  // Wicket dialog
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketType, setWicketType] = useState<WicketType>("bowled");
  const [outPlayer, setOutPlayer] = useState("");
  const [newBatter, setNewBatter] = useState("");
  const [wicketRuns, setWicketRuns] = useState(0);

  // Pending bye/leg-bye runs dialog
  const [byeOpen, setByeOpen] = useState<null | "bye" | "leg_bye">(null);
  const [byeRuns, setByeRuns] = useState(1);
  const [wideOpen, setWideOpen] = useState(false);
  const [wideRuns, setWideRuns] = useState(1);

  // Load + subscribe
  const load = useCallback(async () => {
    if (!matchId || !scorerToken) return;
    const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).single();
    if (!m || m.scorer_token !== scorerToken) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    setMatch(m);
    const { data: ins } = await supabase
      .from("innings_state").select("*")
      .eq("match_id", matchId).eq("innings_number", m.current_innings).single();
    setInnings(ins);
    const { data: bs } = await supabase
      .from("balls").select("*").eq("match_id", matchId).order("created_at", { ascending: true });
    setBalls(bs || []);
    if (ins && (!ins.striker || !ins.bowler)) setSetupOpen(true);
    setLoading(false);
  }, [matchId, scorerToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase.channel(`scorer-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        (p) => setMatch(p.new))
      .on("postgres_changes", { event: "*", schema: "public", table: "innings_state", filter: `match_id=eq.${matchId}` },
        () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "balls", filter: `match_id=eq.${matchId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, load]);

  const currentInningsBalls = balls.filter((ball) => ball.innings_number === innings?.innings_number);
  const lastCurrentInningsBall = currentInningsBalls[currentInningsBalls.length - 1];
  const battingSquad = getTeamSquad(match, innings?.batting_team);
  const bowlingSquad = getBowlingSquad(getTeamSquad(match, innings?.bowling_team));
  const dismissedPlayers = currentInningsBalls
    .filter((ball) => ball.is_wicket && ball.out_player)
    .map((ball) => ball.out_player as string);
  const availableIncomingBatters = battingSquad.filter(
    (player) =>
      !namesEqual(player.name, innings?.striker) &&
      !namesEqual(player.name, innings?.non_striker) &&
      !dismissedPlayers.some((dismissedPlayer) => namesEqual(dismissedPlayer, player.name)),
  );
  const strictNextOverBowlerOptions = bowlingSquad.filter((player) => !namesEqual(player.name, innings?.bowler));
  const nextOverBowlerOptions = strictNextOverBowlerOptions.length > 0 ? strictNextOverBowlerOptions : bowlingSquad;
  const mustChangeBowler = strictNextOverBowlerOptions.length > 0;
  const needsBowlerChange =
    !!innings &&
    !innings.is_complete &&
    innings.balls > 0 &&
    innings.balls % 6 === 0 &&
    !!lastCurrentInningsBall?.is_legal &&
    lastCurrentInningsBall?.bowler === innings.bowler;

  useEffect(() => {
    if (!needsBowlerChange || setupOpen || wicketOpen || byeOpen !== null || wideOpen) return;
    setNextBowler("");
    setOverBowlerOpen(true);
  }, [needsBowlerChange, setupOpen, wicketOpen, byeOpen, wideOpen]);

  useEffect(() => {
    if (!setupOpen || !innings) return;

    const defaultStriker = innings.striker || battingSquad[0]?.name || "";
    const defaultNonStriker =
      innings.non_striker ||
      battingSquad.find((player) => !namesEqual(player.name, defaultStriker))?.name ||
      "";
    const defaultBowler = innings.bowler || bowlingSquad[0]?.name || "";

    setStriker((current) =>
      battingSquad.some((player) => namesEqual(player.name, current)) ? current : defaultStriker,
    );
    setNonStriker((current) =>
      battingSquad.some((player) => namesEqual(player.name, current) && !namesEqual(player.name, striker))
        ? current
        : defaultNonStriker,
    );
    setBowler((current) =>
      bowlingSquad.some((player) => namesEqual(player.name, current)) ? current : defaultBowler,
    );
  }, [setupOpen, innings, battingSquad, bowlingSquad, striker]);

  useEffect(() => {
    if (!wicketOpen || !innings) return;
    setOutPlayer((current) => {
      if (namesEqual(current, innings.striker) || namesEqual(current, innings.non_striker)) return current;
      return innings.striker || innings.non_striker || "";
    });
    setNewBatter((current) =>
      availableIncomingBatters.some((player) => namesEqual(player.name, current))
        ? current
        : availableIncomingBatters[0]?.name || "",
    );
  }, [wicketOpen, innings, availableIncomingBatters]);

  useEffect(() => {
    if (!overBowlerOpen) return;
    setNextBowler((current) =>
      nextOverBowlerOptions.some((player) => namesEqual(player.name, current))
        ? current
        : nextOverBowlerOptions[0]?.name || "",
    );
  }, [overBowlerOpen, nextOverBowlerOptions]);

  const persist = async (newState: any, log: any) => {
    if (!match || !innings) return;
    // 1. insert ball log
    const legalBallsBefore = innings.balls;
    const overNumber = Math.floor(legalBallsBefore / 6);
    const ballInOver = (legalBallsBefore % 6) + 1;
    const { data: insertedBall, error: insertBallError } = await supabase.from("balls").insert({
      match_id: match.id,
      innings_number: innings.innings_number,
      over_number: overNumber,
      ball_in_over: ballInOver,
      ...log,
    }).select().single();
    if (insertBallError) throw insertBallError;

    // 2. update innings state
    const { error: updateInningsError } = await supabase.from("innings_state").update({
      runs: newState.runs,
      wickets: newState.wickets,
      balls: newState.balls,
      extras: newState.extras,
      striker: newState.striker,
      non_striker: newState.non_striker,
      bowler: newState.bowler,
    }).eq("id", innings.id);
    if (updateInningsError) throw updateInningsError;

    setBalls((current) => [...current, insertedBall]);
    setInnings((current: Innings | null) => current ? {
      ...current,
      runs: newState.runs,
      wickets: newState.wickets,
      balls: newState.balls,
      extras: newState.extras,
      striker: newState.striker,
      non_striker: newState.non_striker,
      bowler: newState.bowler,
    } : current);

    // 3. set match status to live on first ball
    if (match.status === "setup") {
      const { error: updateMatchStatusError } = await supabase.from("matches").update({ status: "live" }).eq("id", match.id);
      if (updateMatchStatusError) throw updateMatchStatusError;
      setMatch((current: Match | null) => current ? { ...current, status: "live" } : current);
    }

    // 4. innings end?
    const allOut = newState.wickets >= 10;
    const oversDone = newState.balls >= match.total_overs * 6;
    const targetReached = innings.target && newState.runs >= innings.target;
    if (allOut || oversDone || targetReached) {
      const { error: completeInningsError } = await supabase.from("innings_state").update({ is_complete: true }).eq("id", innings.id);
      if (completeInningsError) throw completeInningsError;
      if (innings.innings_number === 1) {
        // start 2nd innings
        const { error: createSecondInningsError } = await supabase.from("innings_state").insert({
          match_id: match.id,
          innings_number: 2,
          batting_team: innings.bowling_team,
          bowling_team: innings.batting_team,
          target: newState.runs + 1,
        });
        if (createSecondInningsError) throw createSecondInningsError;
        const { error: advanceMatchError } = await supabase.from("matches").update({ current_innings: 2 }).eq("id", match.id);
        if (advanceMatchError) throw advanceMatchError;
        await load();
        toast.success(`Innings 1 complete! Target: ${newState.runs + 1}`);
      } else {
        const { error: endMatchError } = await supabase.from("matches").update({ status: "ended" }).eq("id", match.id);
        if (endMatchError) throw endMatchError;
        setMatch((current: Match | null) => current ? { ...current, status: "ended" } : current);
        toast.success("Match complete!");
      }
    }
  };

  const score = async (input: { runs?: number; extra?: ExtraType; extra_runs?: number; is_wicket?: boolean; wicket_type?: WicketType; out_player?: string; new_batter?: string }) => {
    if (!innings || !innings.striker || !innings.bowler) {
      toast.error("Set striker, non-striker and bowler first");
      setSetupOpen(true);
      return;
    }
    if (needsBowlerChange) {
      toast.error("Set the next bowler before starting the new over");
      setOverBowlerOpen(true);
      return;
    }
    if (innings.is_complete) { toast.info("Innings is complete"); return; }
    const { state, log } = applyBall(innings, {
      runs: input.runs ?? 0,
      extra: input.extra ?? null,
      extra_runs: input.extra_runs,
      is_wicket: input.is_wicket,
      wicket_type: input.wicket_type,
      out_player: input.out_player,
      new_batter: input.new_batter,
    });
    try {
      await persist(state, log);
    } catch (error: any) {
      toast.error(error?.message || "Could not save this ball");
    }
  };

  const undoLast = async () => {
    if (balls.length === 0) return;
    const last = balls[balls.length - 1];
    if (last.innings_number !== innings?.innings_number) {
      toast.error("Cannot undo across innings");
      return;
    }
    // delete last ball, recompute state from scratch
    await supabase.from("balls").delete().eq("id", last.id);
    const remaining = balls.slice(0, -1).filter((b) => b.innings_number === innings.innings_number);
    // Replay won't track names properly, so just adjust totals from remaining balls:
    let runs = 0, wickets = 0, legal = 0, extras = 0;
    for (const b of remaining) {
      if (b.extra_type === "wide" || b.extra_type === "no_ball") {
        runs += b.extra_runs + (b.extra_type === "no_ball" ? b.runs : 0);
        extras += b.extra_runs;
      } else if (b.extra_type === "bye" || b.extra_type === "leg_bye") {
        runs += b.extra_runs; extras += b.extra_runs;
      } else { runs += b.runs; }
      if (b.is_legal) legal += 1;
      if (b.is_wicket) wickets += 1;
    }
    await supabase.from("innings_state").update({
      runs, wickets, balls: legal, extras,
    }).eq("id", innings.id);
    toast.success("Last ball undone");
  };

  const saveSetup = async () => {
    if (!innings) return;
    if (!striker || !nonStriker || !bowler) { toast.error("All three required"); return; }
    if (namesEqual(striker, nonStriker)) { toast.error("Striker and non-striker must differ"); return; }
    await supabase.from("innings_state").update({ striker, non_striker: nonStriker, bowler }).eq("id", innings.id);
    setInnings((current: Innings | null) => current ? {
      ...current,
      striker,
      non_striker: nonStriker,
      bowler,
    } : current);
    setSetupOpen(false);
    toast.success("Players set");
  };

  const togglePause = async () => {
    if (!match) return;
    const newStatus = match.status === "paused" ? "live" : "paused";
    await supabase.from("matches").update({ status: newStatus }).eq("id", match.id);
  };

  const copyViewerLink = () => {
    if (!match) return;
    const url = `${window.location.origin}/match/${match.view_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Viewer link copied!");
  };

  const saveNextBowler = async () => {
    if (!innings) return;
    const trimmedBowler = nextBowler.trim();
    if (!trimmedBowler) {
      toast.error("Enter the next bowler");
      return;
    }
    if (mustChangeBowler && namesEqual(trimmedBowler, innings.bowler)) {
      toast.error("Choose a different bowler for the new over");
      return;
    }
    await supabase.from("innings_state").update({ bowler: trimmedBowler }).eq("id", innings.id);
    setInnings((current: Innings | null) => current ? {
      ...current,
      bowler: trimmedBowler,
    } : current);
    setOverBowlerOpen(false);
    setNextBowler("");
    toast.success("Next bowler set");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (unauthorized) return (
    <div className="min-h-screen"><BrandHeader />
      <div className="container py-20 text-center">
        <h1 className="display text-4xl mb-4">Invalid scorer link</h1>
        <p className="text-muted-foreground mb-6">This link does not match any active scorer session.</p>
        <Button asChild><Link to="/">Go home</Link></Button>
      </div>
    </div>
  );
  if (!match || !innings) return null;

  const rr = runRate(innings.runs, innings.balls);
  const ballsLeft = match.total_overs * 6 - innings.balls;
  const isPaused = match.status === "paused";
  const isEnded = match.status === "ended";
  const scoringLocked = isPaused || needsBowlerChange;
  const requiresReplacementBatter = innings.wickets < 9;

  return (
    <div className="min-h-screen pb-20">
      <BrandHeader />
      <main className="container max-w-5xl py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="display text-3xl md:text-4xl">
              {renderName(match.team_a)} <span className="text-muted-foreground text-xl mx-1">vs</span> {renderName(match.team_b)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {match.format} · {match.total_overs} overs · Scored by {renderName(match.scorer_name)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={copyViewerLink}><Copy className="w-4 h-4 mr-1" /> Viewer link</Button>
            {!isEnded && <Button variant="outline" size="sm" onClick={togglePause}>
              {isPaused ? <><Play className="w-4 h-4 mr-1" /> Resume</> : <><Pause className="w-4 h-4 mr-1" /> Pause</>}
            </Button>}
          </div>
        </div>

        {/* Live scoreboard */}
        <div className="glass rounded-2xl p-6 grid sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Batting</div>
            <div className="display text-2xl">{renderName(innings.batting_team)}</div>
            <div className="display text-6xl mt-2">
              {innings.runs}<span className="text-muted-foreground">/</span>{innings.wickets}
            </div>
            <div className="mono text-lg text-muted-foreground">
              ({oversString(innings.balls)} / {match.total_overs} ov · RR {rr.toFixed(2)})
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">On strike</div>
            <div className="font-semibold">{renderName(innings.striker) || "—"} <span className="text-accent">*</span></div>
            <div className="text-sm text-muted-foreground">{renderName(innings.non_striker) || "—"}</div>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Bowler</div>
            <div className="font-semibold">{renderName(innings.bowler) || "—"}</div>
            {innings.target && (
              <div className="text-sm">
                <span className="text-muted-foreground">Target:</span> <span className="mono font-bold text-accent">{innings.target}</span>
              </div>
            )}
          </div>
        </div>

        {needsBowlerChange && !isEnded && (
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Over complete</div>
              <div className="text-sm text-muted-foreground">Select the bowler for the next over before scoring again.</div>
            </div>
            <Button
              onClick={() => {
                setNextBowler("");
                setOverBowlerOpen(true);
              }}
            >
              Set next bowler
            </Button>
          </div>
        )}

        {isEnded && (
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-6 text-center">
            <Trophy className="w-10 h-10 mx-auto text-accent mb-2" />
            <h2 className="display text-3xl">Match Ended</h2>
          </div>
        )}

        {/* Scoring controls */}
        {!isEnded && (
          <Tabs defaultValue="score">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="score">Score</TabsTrigger>
              <TabsTrigger value="card">Scorecard</TabsTrigger>
              <TabsTrigger value="rr">Run Rate</TabsTrigger>
            </TabsList>

            <TabsContent value="score" className="space-y-4 mt-4">
              {/* Runs */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                  <Button key={r} disabled={scoringLocked} onClick={() => score({ runs: r })}
                    className={`scoring-btn h-16 ${r === 4 ? "bg-accent text-accent-foreground hover:bg-accent/90" : r === 6 ? "bg-gradient-to-br from-accent to-accent-glow text-accent-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                    {r}
                  </Button>
                ))}
              </div>

              {/* Extras */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  disabled={scoringLocked}
                  variant="outline"
                  className="scoring-btn h-14"
                  onClick={() => {
                    setWideRuns(1);
                    setWideOpen(true);
                  }}
                >
                  Wide
                </Button>
                <Button disabled={scoringLocked} variant="outline" className="scoring-btn h-14" onClick={() => score({ extra: "no_ball" })}>No Ball</Button>
                <Button disabled={scoringLocked} variant="outline" className="scoring-btn h-14" onClick={() => { setByeRuns(1); setByeOpen("bye"); }}>Bye</Button>
                <Button disabled={scoringLocked} variant="outline" className="scoring-btn h-14" onClick={() => { setByeRuns(1); setByeOpen("leg_bye"); }}>Leg Bye</Button>
              </div>

              {/* Wicket + Undo */}
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={scoringLocked} className="scoring-btn h-14 bg-ball text-ball-foreground hover:bg-ball/90"
                  onClick={() => { setOutPlayer(innings.striker || ""); setWicketRuns(0); setNewBatter(""); setWicketType("bowled"); setWicketOpen(true); }}>
                  WICKET
                </Button>
                <Button variant="outline" className="scoring-btn h-14" onClick={undoLast}>
                  <Undo2 className="w-4 h-4 mr-2" /> Undo last
                </Button>
              </div>

              <Button variant="ghost" size="sm" className="w-full" onClick={() => {
                setStriker(innings.striker || ""); setNonStriker(innings.non_striker || ""); setBowler(innings.bowler || "");
                setSetupOpen(true);
              }}>
                Change batters / bowler
              </Button>
            </TabsContent>

            <TabsContent value="card" className="mt-4">
              <Scorecard balls={balls} />
            </TabsContent>

            <TabsContent value="rr" className="mt-4">
              <RunRateChart data={overSeries(balls.filter(b => b.innings_number === innings.innings_number))} />
            </TabsContent>
          </Tabs>
        )}

        {/* Recent balls */}
        <div className="glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">This over</div>
          <div className="flex gap-2 flex-wrap">
            {recentOverBalls(balls.filter(b => b.innings_number === innings.innings_number)).map((b, i) => (
              <span key={i} className={`mono text-sm rounded-md px-2.5 py-1 border ${b.is_wicket ? "bg-ball/20 border-ball text-ball" : b.extra_type ? "bg-secondary" : b.runs >= 4 ? "bg-accent/20 border-accent text-accent" : "bg-secondary"}`}>
                {ballLabel(b)}
              </span>
            ))}
            {recentOverBalls(balls.filter(b => b.innings_number === innings.innings_number)).length === 0 && (
              <span className="text-sm text-muted-foreground">First ball of the over.</span>
            )}
          </div>
        </div>
      </main>

      {/* Setup dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set striker, non-striker & bowler</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Striker</Label>
              <Select value={striker} onValueChange={setStriker}>
                <SelectTrigger><SelectValue placeholder="Select striker" /></SelectTrigger>
                <SelectContent>
                  {battingSquad.map((player) => (
                    <SelectItem key={`striker-${player.name}`} value={player.name}>{displayName(player.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Non-striker</Label>
              <Select value={nonStriker} onValueChange={setNonStriker}>
                <SelectTrigger><SelectValue placeholder="Select non-striker" /></SelectTrigger>
                <SelectContent>
                  {battingSquad
                    .filter((player) => !namesEqual(player.name, striker))
                    .map((player) => (
                      <SelectItem key={`non-striker-${player.name}`} value={player.name}>{displayName(player.name)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bowler</Label>
              <Select value={bowler} onValueChange={setBowler}>
                <SelectTrigger><SelectValue placeholder="Select bowler" /></SelectTrigger>
                <SelectContent>
                  {bowlingSquad.map((player) => (
                    <SelectItem key={`bowler-${player.name}`} value={player.name}>{displayName(player.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={saveSetup}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wicket dialog */}
      <Dialog open={wicketOpen} onOpenChange={setWicketOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Wicket details</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>How out?</Label>
              <Select value={wicketType} onValueChange={(v) => setWicketType(v as WicketType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bowled">Bowled</SelectItem>
                  <SelectItem value="caught">Caught</SelectItem>
                  <SelectItem value="lbw">LBW</SelectItem>
                  <SelectItem value="run_out">Run Out</SelectItem>
                  <SelectItem value="stumped">Stumped</SelectItem>
                  <SelectItem value="hit_wicket">Hit Wicket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Out player</Label>
              <Select value={outPlayer} onValueChange={setOutPlayer}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {innings.striker && <SelectItem value={innings.striker}>{displayName(innings.striker)} (striker)</SelectItem>}
                  {innings.non_striker && <SelectItem value={innings.non_striker}>{displayName(innings.non_striker)} (non-striker)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Runs completed before wicket (for run outs)</Label>
              <Input type="number" min={0} max={6} value={wicketRuns} onChange={(e) => setWicketRuns(parseInt(e.target.value) || 0)} />
            </div>
            {requiresReplacementBatter && (
              <div>
                <Label>New batter walking in</Label>
                <Select value={newBatter} onValueChange={setNewBatter}>
                  <SelectTrigger><SelectValue placeholder="Select next batter" /></SelectTrigger>
                  <SelectContent>
                    {availableIncomingBatters.map((player) => (
                      <SelectItem key={`new-batter-${player.name}`} value={player.name}>{displayName(player.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              if (requiresReplacementBatter && !newBatter.trim()) {
                toast.error("Select the new batter");
                return;
              }
              await score({
                runs: wicketRuns,
                is_wicket: true,
                wicket_type: wicketType,
                out_player: outPlayer,
                new_batter: requiresReplacementBatter ? newBatter.trim() : undefined,
              });
              setWicketOpen(false);
            }}>Record wicket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bye / Leg-bye runs dialog */}
      <Dialog open={byeOpen !== null} onOpenChange={(o) => !o && setByeOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{byeOpen === "bye" ? "Byes" : "Leg byes"} — how many runs?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <Button key={n} variant={byeRuns === n ? "default" : "outline"} className="h-14" onClick={() => setByeRuns(n)}>{n}</Button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              await score({ extra: byeOpen!, extra_runs: byeRuns });
              setByeOpen(null);
            }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wide runs dialog */}
      <Dialog open={wideOpen} onOpenChange={setWideOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Wide — total runs on this ball?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} variant={wideRuns === n ? "default" : "outline"} className="h-14" onClick={() => setWideRuns(n)}>{n}</Button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              await score({ extra: "wide", extra_runs: wideRuns });
              setWideOpen(false);
            }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overBowlerOpen} onOpenChange={setOverBowlerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Select next over bowler</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Next bowler</Label>
              <Select value={nextBowler} onValueChange={setNextBowler}>
                <SelectTrigger><SelectValue placeholder="Select next bowler" /></SelectTrigger>
                <SelectContent>
                  {nextOverBowlerOptions.map((player) => (
                    <SelectItem key={`next-bowler-${player.name}`} value={player.name}>{displayName(player.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              The next over cannot start until the bowler is updated.
            </p>
          </div>
          <DialogFooter><Button onClick={saveNextBowler}>Save bowler</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helpers
function recentOverBalls(balls: any[]) {
  // last 6 legal balls + interleaved extras since last over completion
  let countLegal = 0;
  const out: any[] = [];
  for (let i = balls.length - 1; i >= 0; i--) {
    out.unshift(balls[i]);
    if (balls[i].is_legal) countLegal += 1;
    if (countLegal >= 6) break;
  }
  return out;
}

function getTeamSquad(match: Match | null, teamName?: string | null): TeamPlayer[] {
  if (!match || !teamName) return [];
  if (namesEqual(teamName, match.team_a)) return normalizeTeamPlayers(match.team_a_players);
  if (namesEqual(teamName, match.team_b)) return normalizeTeamPlayers(match.team_b_players);
  return [];
}
function ballLabel(b: any) {
  if (b.is_wicket) return "W";
  if (b.extra_type === "wide") return `Wd${b.extra_runs > 1 ? `+${b.extra_runs - 1}` : ""}`;
  if (b.extra_type === "no_ball") return `Nb${b.runs ? `+${b.runs}` : ""}`;
  if (b.extra_type === "bye") return `${b.extra_runs}b`;
  if (b.extra_type === "leg_bye") return `${b.extra_runs}lb`;
  return String(b.runs);
}
function overSeries(balls: any[]) {
  const points: { over: number; runs: number }[] = [];
  let runs = 0, legal = 0;
  for (const b of balls) {
    if (b.extra_type === "wide" || b.extra_type === "no_ball") runs += b.extra_runs + (b.extra_type === "no_ball" ? b.runs : 0);
    else runs += b.runs + b.extra_runs;
    if (b.is_legal) {
      legal += 1;
      if (legal % 6 === 0) points.push({ over: legal / 6, runs });
    }
  }
  return points;
}

export default Scorer;
