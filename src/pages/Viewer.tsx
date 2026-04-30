import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, CalendarDays, Radio, NotebookText } from "lucide-react";
import { oversString, runRate, requiredRunRate } from "@/lib/scoring-engine";
import { renderName } from "@/lib/admin-name";
import { Scorecard } from "@/components/Scorecard";

const Viewer = () => {
  const { viewToken } = useParams();
  const [match, setMatch] = useState<any>(null);
  const [innings, setInnings] = useState<any>(null);
  const [allInnings, setAllInnings] = useState<any[]>([]);
  const [balls, setBalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(false);

  const load = useCallback(async () => {
    if (!viewToken) return;
    const { data: m } = await supabase.from("matches").select("*").eq("view_token", viewToken).single();
    if (!m) { setLoading(false); return; }
    setMatch(m);
    const { data: ins } = await supabase.from("innings_state").select("*").eq("match_id", m.id).order("innings_number", { ascending: true });
    setAllInnings(ins || []);
    const current = (ins || []).find((i: any) => i.innings_number === m.current_innings);
    setInnings(current);
    const { data: bs } = await supabase.from("balls").select("*").eq("match_id", m.id).order("created_at", { ascending: true });
    setBalls(bs || []);
    setLoading(false);
  }, [viewToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!viewToken) return;
    const timer = window.setInterval(() => {
      load();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [viewToken, load]);

  useEffect(() => {
    if (!match) return;
    const ch = supabase.channel(`viewer-${match.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${match.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "innings_state", filter: `match_id=eq.${match.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "balls", filter: `match_id=eq.${match.id}` }, () => {
        setFlash(true); setTimeout(() => setFlash(false), 500);
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [match, load]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!match) return (
    <div className="min-h-screen"><BrandHeader />
      <div className="container py-20 text-center">
        <h1 className="display text-4xl mb-4">Match not found</h1>
        <Button asChild><Link to="/">Go home</Link></Button>
      </div>
    </div>
  );
  if (!innings) return null;

  const rr = runRate(innings.runs, innings.balls);
  const ballsLeft = match.total_overs * 6 - innings.balls;
  const rrr = innings.target ? requiredRunRate(innings.target, innings.runs, ballsLeft) : null;
  const isEnded = match.status === "ended";
  const isLive = match.status === "live";
  const isPaused = match.status === "paused";

  // Result text
  let resultText = "";
  if (isEnded && allInnings.length === 2) {
    const i1 = allInnings[0], i2 = allInnings[1];
    if (i2.runs >= (i2.target || 0)) {
      resultText = `${i2.batting_team} won by ${10 - i2.wickets} wickets`;
    } else if (i2.runs < (i2.target || 0) - 1) {
      resultText = `${i1.batting_team} won by ${(i2.target || 0) - 1 - i2.runs} runs`;
    } else {
      resultText = "Match tied";
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <BrandHeader />
      <main className="container max-w-5xl py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isLive && <span className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-ball pulse-dot">Live</span>}
              {isPaused && <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Paused</span>}
              {isEnded && <span className="text-xs font-bold uppercase tracking-widest text-accent">Ended</span>}
              <span className="text-xs text-muted-foreground">· {match.format} · {match.total_overs} ov</span>
            </div>
            <h1 className="display text-3xl md:text-5xl">
              {renderName(match.team_a)} <span className="text-muted-foreground text-2xl mx-1">vs</span> {renderName(match.team_b)}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Scored by {renderName(match.scorer_name)}</p>
          </div>
        </div>

        {isEnded && resultText && (
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-6 text-center">
            <Trophy className="w-10 h-10 mx-auto text-accent mb-2" />
            <h2 className="display text-3xl">{resultText}</h2>
          </div>
        )}

        {/* Hero scoreboard */}
        <div className="glass rounded-2xl p-6 md:p-8">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Innings {innings.innings_number}</div>
              <div className="display text-2xl md:text-3xl">{renderName(innings.batting_team)}</div>
            </div>
            <div className="text-right">
              <div className={`display text-6xl md:text-8xl leading-none ${flash ? "flash" : ""}`}>
                {innings.runs}<span className="text-muted-foreground">/</span>{innings.wickets}
              </div>
              <div className="mono text-base text-muted-foreground mt-1">
                ({oversString(innings.balls)} / {match.total_overs} ov · RR {rr.toFixed(2)})
              </div>
            </div>
          </div>

          {innings.target && !isEnded && (
            <div className="mt-4 pt-4 border-t flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div><span className="text-muted-foreground">Target:</span> <span className="mono font-bold text-accent">{innings.target}</span></div>
              <div><span className="text-muted-foreground">Need:</span> <span className="mono font-bold">{Math.max(0, innings.target - innings.runs)}</span> from <span className="mono">{ballsLeft}</span> balls</div>
              {rrr !== null && <div><span className="text-muted-foreground">RRR:</span> <span className="mono font-bold">{rrr.toFixed(2)}</span></div>}
            </div>
          )}

          <div className="mt-6 grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Batters</div>
              <div className="font-semibold">{renderName(innings.striker) || "—"} <span className="text-accent">*</span></div>
              <div className="text-muted-foreground">{renderName(innings.non_striker) || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Bowler</div>
              <div className="font-semibold">{renderName(innings.bowler) || "—"}</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">This over</div>
            <OverStrip balls={balls.filter((ball) => ball.innings_number === innings.innings_number)} />
          </div>
        </div>

        <Tabs defaultValue="live">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="info"><CalendarDays className="mr-2 h-4 w-4" /> Match info</TabsTrigger>
            <TabsTrigger value="live"><Radio className="mr-2 h-4 w-4" /> Live</TabsTrigger>
            <TabsTrigger value="card"><NotebookText className="mr-2 h-4 w-4" /> Scorecard</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4 glass rounded-2xl p-4 md:p-6">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Batting</div>
                  <div className="display text-2xl">{renderName(innings.batting_team)}</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Batters</div>
                    <div className="font-semibold">{renderName(innings.striker) || "—"} <span className="text-accent">*</span></div>
                    <div className="text-muted-foreground">{renderName(innings.non_striker) || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Bowler</div>
                    <div className="font-semibold">{renderName(innings.bowler) || "—"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm pt-2">
                  <div><span className="text-muted-foreground">Overs:</span> <span className="mono font-bold">{oversString(innings.balls)}</span></div>
                  <div><span className="text-muted-foreground">CRR:</span> <span className="mono font-bold">{rr.toFixed(2)}</span></div>
                  {innings.target && <div><span className="text-muted-foreground">Target:</span> <span className="mono font-bold">{innings.target}</span></div>}
                </div>
              </div>
              <div className="rounded-xl border bg-secondary/20 p-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Last over</div>
                <OverStrip balls={balls.filter((ball) => ball.innings_number === innings.innings_number)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="live" className="mt-4 glass rounded-2xl p-4 md:p-6">
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-6">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Recent overs</div>
                  <div className="space-y-4">
                    {buildOverSummaries(balls.filter((ball) => ball.innings_number === innings.innings_number)).map((over) => (
                      <div key={over.over} className="rounded-xl border bg-background/60 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="font-semibold text-sm text-muted-foreground">Over {over.over}</div>
                          <div className="flex gap-2 flex-wrap">
                            {over.events.map((event, index) => (
                              <span key={`${over.over}-${index}`} className={`inline-flex items-center justify-center h-8 w-8 rounded-full border text-xs mono ${event.kind === "wicket" ? "bg-ball/20 border-ball text-ball" : event.kind === "extra" ? "bg-secondary" : event.runs >= 4 ? "bg-accent/20 border-accent text-accent" : "bg-secondary"}`}>
                                {event.label}
                              </span>
                            ))}
                          </div>
                          <div className="ml-auto mono text-sm text-muted-foreground">= {over.runs}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Commentary</div>
                  <div className="space-y-3">
                    {buildCommentary(balls.filter((ball) => ball.innings_number === innings.innings_number)).map((entry) => (
                      <div key={entry.key} className="rounded-xl border bg-background/70 p-4">
                        <div className="flex items-start gap-4">
                          <div className="min-w-16 text-sm font-semibold mono text-muted-foreground">{entry.overBall}</div>
                          <div className="h-8 w-8 rounded-full border flex items-center justify-center mono text-xs font-bold bg-secondary">{entry.shortLabel}</div>
                          <div className="flex-1">
                            <div className="font-medium">{entry.text}</div>
                            <div className="text-xs text-muted-foreground mt-1">{entry.detail}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {balls.filter((ball) => ball.innings_number === innings.innings_number).length === 0 && (
                      <div className="text-sm text-muted-foreground">Commentary will appear here as soon as the scorer records balls.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border bg-secondary/20 p-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Score summary</div>
                  <div className="display text-5xl">{innings.runs}<span className="text-muted-foreground">/</span>{innings.wickets}</div>
                  <div className="mono text-sm text-muted-foreground mt-1">({oversString(innings.balls)} ov · RR {rr.toFixed(2)})</div>
                </div>
                {innings.target && !isEnded && (
                  <div className="rounded-xl border bg-secondary/20 p-4 text-sm">
                    <div><span className="text-muted-foreground">Need:</span> <span className="mono font-bold">{Math.max(0, innings.target - innings.runs)}</span></div>
                    <div className="mt-1"><span className="text-muted-foreground">Balls left:</span> <span className="mono font-bold">{ballsLeft}</span></div>
                    {rrr !== null && <div className="mt-1"><span className="text-muted-foreground">RRR:</span> <span className="mono font-bold">{rrr.toFixed(2)}</span></div>}
                  </div>
                )}
                <div className="rounded-xl border bg-secondary/20 p-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Current over</div>
                  <OverStrip balls={balls.filter((ball) => ball.innings_number === innings.innings_number)} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="card" className="mt-4 glass rounded-2xl p-4 md:p-6">
            <Scorecard balls={balls} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

function recentOverBalls(balls: any[]) {
  let countLegal = 0;
  const out: any[] = [];
  for (let i = balls.length - 1; i >= 0; i--) {
    out.unshift(balls[i]);
    if (balls[i].is_legal) countLegal += 1;
    if (countLegal >= 6) break;
  }
  return out;
}
function ballLabel(b: any) {
  if (b.extra_type === "wide" && b.is_wicket) return `Wd${b.extra_runs > 1 ? `+${b.extra_runs - 1}` : ""}W`;
  if (b.is_wicket) return "W";
  if (b.extra_type === "wide") return `Wd${b.extra_runs > 1 ? `+${b.extra_runs - 1}` : ""}`;
  if (b.extra_type === "no_ball") return `Nb${b.runs ? `+${b.runs}` : ""}`;
  if (b.extra_type === "bye") return `${b.extra_runs}b`;
  if (b.extra_type === "leg_bye") return `${b.extra_runs}lb`;
  return String(b.runs);
}
function overBallNumber(b: any) {
  return `${b.over_number}.${b.ball_in_over}`;
}
function buildOverSummaries(balls: any[]) {
  const summaries = new Map<number, { over: number; runs: number; events: { label: string; kind: "run" | "extra" | "wicket"; runs: number }[] }>();

  for (const ball of balls) {
    const entry = summaries.get(ball.over_number) || { over: ball.over_number + 1, runs: 0, events: [] };
    if (ball.extra_type === "wide" || ball.extra_type === "no_ball") {
      const totalRuns = (ball.extra_runs || 0) + (ball.extra_type === "no_ball" ? (ball.runs || 0) : 0);
      entry.runs += totalRuns;
      entry.events.push({ label: ballLabel(ball), kind: ball.is_wicket ? "wicket" : "extra", runs: totalRuns });
    } else if (ball.extra_type === "bye" || ball.extra_type === "leg_bye") {
      entry.runs += ball.extra_runs || 0;
      entry.events.push({ label: ballLabel(ball), kind: "extra", runs: ball.extra_runs || 0 });
    } else {
      entry.runs += ball.runs || 0;
      entry.events.push({ label: ballLabel(ball), kind: ball.is_wicket ? "wicket" : "run", runs: ball.runs || 0 });
    }
    summaries.set(ball.over_number, entry);
  }

  return [...summaries.values()].slice(-4);
}

function buildCommentary(balls: any[]) {
  return [...balls]
    .slice()
    .reverse()
    .map((ball) => ({
      key: ball.id,
      overBall: overBallNumber(ball),
      shortLabel: ballLabel(ball),
      text: describeBall(ball),
      detail: `${renderName(ball.bowler) || "Bowler"} to ${renderName(ball.striker) || "batter"}`,
    }));
}

function OverStrip({ balls }: { balls: any[] }) {
  const currentOverBalls = recentOverBalls(balls);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {currentOverBalls.map((ball, index) => (
        <span
          key={ball.id ?? index}
          className={`h-8 w-8 rounded-full border flex items-center justify-center text-xs mono ${
            ball.is_wicket ? "bg-ball/20 border-ball text-ball" : ball.extra_type ? "bg-secondary" : ball.runs >= 4 ? "bg-accent/20 border-accent text-accent" : "bg-secondary"
          }`}
        >
          {ballLabel(ball)}
        </span>
      ))}
      {currentOverBalls.length === 0 && <span className="text-sm text-muted-foreground">Waiting for the over to start…</span>}
    </div>
  );
}
function describeBall(b: any) {
  if (b.extra_type === "wide") {
    const wideRuns = b.extra_runs || 1;
    if (b.is_wicket) return `Wide ${wideRuns} run${wideRuns === 1 ? "" : "s"} and stumped`;
    return `Wide ${wideRuns} run${wideRuns === 1 ? "" : "s"}`;
  }
  if (b.extra_type === "no_ball") {
    const totalRuns = b.extra_runs + (b.runs || 0);
    return `No ball, ${totalRuns} run${totalRuns === 1 ? "" : "s"}`;
  }
  if (b.extra_type === "bye") return `${b.extra_runs} bye${b.extra_runs === 1 ? "" : "s"}`;
  if (b.extra_type === "leg_bye") return `${b.extra_runs} leg bye${b.extra_runs === 1 ? "" : "s"}`;
  if (b.is_wicket) {
    const wicketText = b.wicket_type ? b.wicket_type.replace("_", " ") : "wicket";
    return `${wicketText.charAt(0).toUpperCase()}${wicketText.slice(1)}`;
  }
  if (b.runs === 0) return "Dot ball";
  return `${b.runs} run${b.runs === 1 ? "" : "s"}`;
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

export default Viewer;
