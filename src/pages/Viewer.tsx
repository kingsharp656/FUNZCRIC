import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy } from "lucide-react";
import { oversString, runRate, requiredRunRate } from "@/lib/scoring-engine";
import { renderName } from "@/lib/admin-name";
import { Scorecard } from "@/components/Scorecard";
import { RunRateChart } from "@/components/RunRateChart";

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

          {/* Recent balls */}
          <div className="mt-6 pt-4 border-t">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">This over</div>
            <div className="flex gap-2 flex-wrap">
              {recentOverBalls(balls.filter((b) => b.innings_number === innings.innings_number)).map((b, i) => (
                <span key={i} className={`mono text-sm rounded-md px-2.5 py-1 border ${b.is_wicket ? "bg-ball/20 border-ball text-ball" : b.extra_type ? "bg-secondary" : b.runs >= 4 ? "bg-accent/20 border-accent text-accent" : "bg-secondary"}`}>
                  {ballLabel(b)}
                </span>
              ))}
              {balls.length === 0 && <span className="text-sm text-muted-foreground">Waiting for first ball…</span>}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Ball by ball</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {balls
                .filter((ball) => ball.innings_number === innings.innings_number)
                .map((ball, index) => (
                  <div key={ball.id ?? index} className="rounded-lg border bg-secondary/30 px-3 py-2 text-sm flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold mono">{overBallNumber(ball)}</div>
                      <div className="text-muted-foreground">{describeBall(ball)}</div>
                    </div>
                    <div className={`mono text-xs rounded-md px-2 py-1 border ${ball.is_wicket ? "bg-ball/20 border-ball text-ball" : ball.extra_type ? "bg-background" : "bg-background"}`}>
                      {ballLabel(ball)}
                    </div>
                  </div>
                ))}
            </div>
            {balls.filter((ball) => ball.innings_number === innings.innings_number).length === 0 && (
              <div className="text-sm text-muted-foreground">Ball-by-ball updates will appear here as soon as scoring starts.</div>
            )}
          </div>
        </div>

        <Tabs defaultValue="card">
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="card">Scorecard</TabsTrigger>
            <TabsTrigger value="rr">Run Rate</TabsTrigger>
          </TabsList>
          <TabsContent value="card" className="mt-4 glass rounded-2xl p-4 md:p-6">
            <Scorecard balls={balls} />
          </TabsContent>
          <TabsContent value="rr" className="mt-4 glass rounded-2xl p-4 md:p-6">
            <RunRateChart data={overSeries(balls.filter((b) => b.innings_number === innings.innings_number))} />
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
