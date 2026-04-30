import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, CalendarDays, Radio, NotebookText } from "lucide-react";
import { oversString, runRate, requiredRunRate } from "@/lib/scoring-engine";
import { displayName, renderName } from "@/lib/admin-name";
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
  const currentInningsBalls = balls.filter((ball) => ball.innings_number === innings.innings_number);
  const currentBatters = buildBattingCards(currentInningsBalls, innings.striker, innings.non_striker);
  const currentBowler = buildBowlingCard(currentInningsBalls, innings.bowler);
  const partnership = buildPartnership(currentInningsBalls, innings.striker, innings.non_striker);
  const lastWicket = findLastWicket(currentInningsBalls);
  const commentary = buildCommentary(currentInningsBalls);
  const projectedScores = buildProjectedScores(innings.runs, innings.balls);
  const momentum = innings.target ? computeMomentum(innings.runs, innings.balls, innings.target, ballsLeft) : 100;

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
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Innings {innings.innings_number}</div>
              <div className="display text-2xl md:text-3xl">{renderName(innings.batting_team)}</div>
            </div>
            <LiveBallPanel balls={currentInningsBalls} />
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

          <TabsContent value="live" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.85fr)]">
              <section className="glass rounded-2xl p-4 md:p-6">
                <div className="grid gap-6 xl:grid-cols-2 xl:items-center rounded-2xl border border-white/10 bg-[#0e2032] p-6 md:p-8">
                  <div className="grid grid-cols-[auto_1fr] gap-4 items-end">
                    <PlayerCard name={innings.striker} score={currentBatters[0]} active />
                    <div className="min-w-0">
                      <div className="text-sm text-muted-foreground">Striker</div>
                      <div className="font-semibold text-lg truncate">{renderName(innings.striker) || "—"} <span className="text-accent">*</span></div>
                      <div className="mono text-sm text-muted-foreground">
                        {currentBatters[0] ? `${currentBatters[0].runs} (${currentBatters[0].balls})` : "0 (0)"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[auto_1fr] gap-4 items-end justify-self-end text-left xl:text-right">
                    <PlayerCard name={innings.non_striker} score={currentBatters[1]} />
                    <div className="min-w-0">
                      <div className="text-sm text-muted-foreground">Non-striker</div>
                      <div className="font-semibold text-lg truncate">{renderName(innings.non_striker) || "—"}</div>
                      <div className="mono text-sm text-muted-foreground">
                        {currentBatters[1] ? `${currentBatters[1].runs} (${currentBatters[1].balls})` : "0 (0)"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">P'ship</div>
                    <div className="display text-xl mt-1">{partnership.runs || 0} ({partnership.balls || 0})</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Last Wkt</div>
                    <div className="font-semibold mt-1 truncate">{lastWicket || "—"}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Bowler</div>
                    <div className="font-semibold mt-1 truncate">{renderName(innings.bowler) || "—"}</div>
                    <div className="mono text-sm text-muted-foreground">{currentBowler}</div>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-muted-foreground mb-3">
                    <span>This over</span>
                    <span>{oversString(innings.balls)} ov</span>
                  </div>
                  <OverStrip balls={currentInningsBalls} />
                </div>

                <div className="mt-8">
                  <h3 className="display text-2xl mb-4">Commentary</h3>
                  <div className="flex flex-wrap gap-2 mb-5 text-sm">
                    {["All", "Highlights", "Overs", "W", "6s", "4s", "Inn 1", "Inn 2", "Milestone"].map((chip) => (
                      <span key={chip} className={`rounded-md border px-3 py-2 ${chip === "All" ? "border-accent/30 bg-accent/10 text-accent" : "border-white/10 bg-white/5 text-muted-foreground"}`}>
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {commentary.length > 0 ? commentary.map((item) => <CommentaryRow key={item.key} item={item} />) : (
                      <p className="text-sm text-muted-foreground">Commentary will appear after the first ball.</p>
                    )}
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <section className="glass rounded-2xl p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="display text-xl">Probability</h3>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted-foreground">Live</div>
                  </div>
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>{renderName(innings.batting_team)}</span>
                      <span>{innings.target ? `${momentum}%` : "100%"}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#2d4cd9]" style={{ width: `${innings.target ? momentum : 100}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{renderName(innings.batting_team)}</span>
                      <span>{innings.target ? renderName(innings.bowling_team) : "—"}</span>
                    </div>
                  </div>
                </section>

                <section className="glass rounded-2xl p-4 md:p-6">
                  <h3 className="display text-xl mb-4">Projected Score <span className="text-sm text-muted-foreground">as per RR*</span></h3>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-[1fr_repeat(3,auto)] gap-4 rounded-lg bg-white/5 px-4 py-3 text-muted-foreground">
                      <span>Run Rate</span>
                      <span className="mono">{rr.toFixed(2)}*</span>
                      <span className="mono">{(rr + 0.5).toFixed(2)}</span>
                      <span className="mono">{(rr + 1).toFixed(2)}</span>
                    </div>
                    {projectedScores.map((row) => (
                      <div key={row.label} className="grid grid-cols-[1fr_repeat(3,auto)] gap-4 border-t border-white/10 px-4 py-3">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="mono font-semibold">{row.primary}</span>
                        <span className="mono font-semibold">{row.secondary}</span>
                        <span className="mono font-semibold">{row.tertiary}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
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

function ballLabel(b: any) {
  if (b.extra_type === "wide" && b.is_wicket) return `Wd${b.extra_runs > 1 ? `+${b.extra_runs - 1}` : ""}W`;
  if (b.is_wicket) return "W";
  if (b.extra_type === "wide") return `Wd${b.extra_runs > 1 ? `+${b.extra_runs - 1}` : ""}`;
  if (b.extra_type === "no_ball") return `Nb${b.runs ? `+${b.runs}` : ""}`;
  if (b.extra_type === "bye") return `${b.extra_runs}b`;
  if (b.extra_type === "leg_bye") return `${b.extra_runs}lb`;
  return String(b.runs);
}
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
function latestDeliveryLabel(balls: any[]) {
  const lastBall = balls[balls.length - 1];
  if (!lastBall) return "Ball";
  return ballLabel(lastBall);
}
function latestDeliverySummary(balls: any[]) {
  const lastBall = balls[balls.length - 1];
  if (!lastBall) return "Waiting for the first ball";
  if (lastBall.extra_type === "wide" && lastBall.is_wicket) return `Batsman: 0, wide, stumped`;
  if (lastBall.extra_type === "wide") {
    const wideRuns = lastBall.extra_runs || 1;
    return `Batsman: 0, wide ${wideRuns} run${wideRuns === 1 ? "" : "s"}`;
  }
  if (lastBall.extra_type === "no_ball") {
    const extraRuns = lastBall.extra_runs || 1;
    const batterRuns = lastBall.runs || 0;
    return `Batsman: ${batterRuns}, no ball ${extraRuns + batterRuns} run${extraRuns + batterRuns === 1 ? "" : "s"}`;
  }
  if (lastBall.extra_type === "bye") return `Batsman: 0, ${lastBall.extra_runs} bye${lastBall.extra_runs === 1 ? "" : "s"}`;
  if (lastBall.extra_type === "leg_bye") return `Batsman: 0, ${lastBall.extra_runs} leg bye${lastBall.extra_runs === 1 ? "" : "s"}`;
  if (lastBall.is_wicket) return `Batsman: ${lastBall.runs || 0}, ${lastBall.wicket_type ? lastBall.wicket_type.split("_").join(" ") : "Wicket"}`;
  return `Batsman: ${lastBall.runs || 0} run${(lastBall.runs || 0) === 1 ? "" : "s"}`;
}

function buildBattingCards(balls: any[], striker?: string | null, nonStriker?: string | null) {
  const names = [striker, nonStriker].filter(Boolean) as string[];
  return names.map((name) => {
    let runs = 0;
    let deliveries = 0;
    for (const ball of balls) {
      if (ball.striker !== name) continue;
      if (ball.is_legal || ball.extra_type === "no_ball") deliveries += 1;
      if (ball.extra_type !== "bye" && ball.extra_type !== "leg_bye" && ball.extra_type !== "wide") runs += ball.runs || 0;
    }
    return { name, runs, balls: deliveries };
  });
}

function buildBowlingCard(balls: any[], bowler?: string | null) {
  if (!bowler) return "0-0";
  let runs = 0;
  let wickets = 0;
  let overs = 0;
  for (const ball of balls) {
    if (ball.bowler !== bowler) continue;
    if (ball.is_legal) overs += 1;
    if (ball.extra_type === "wide" || ball.extra_type === "no_ball") runs += (ball.extra_runs || 0) + (ball.extra_type === "no_ball" ? (ball.runs || 0) : 0);
    else if (ball.extra_type === "bye" || ball.extra_type === "leg_bye") runs += 0;
    else runs += ball.runs || 0;
    if (ball.is_wicket) wickets += 1;
  }
  return `${wickets}-${runs} (${Math.floor(overs / 6)}.${overs % 6})`;
}

function buildPartnership(balls: any[], striker?: string | null, nonStriker?: string | null) {
  const pair = new Set([striker, nonStriker].filter(Boolean));
  let runs = 0;
  let deliveries = 0;
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    if (ball.is_wicket && ball.out_player && pair.has(ball.out_player)) break;
    if (ball.is_legal) deliveries += 1;
    if (ball.extra_type === "wide" || ball.extra_type === "no_ball") runs += (ball.extra_runs || 0) + (ball.extra_type === "no_ball" ? (ball.runs || 0) : 0);
    else runs += (ball.runs || 0) + (ball.extra_runs || 0);
  }
  return { runs, balls: deliveries };
}

function findLastWicket(balls: any[]) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    if (ball.is_wicket && ball.out_player) {
      const over = `${ball.over_number}.${ball.ball_in_over}`;
      return `${displayName(ball.out_player)} ${over}`;
    }
  }
  return "";
}

function buildCommentary(balls: any[]) {
  return balls
    .slice()
    .reverse()
    .slice(0, 6)
    .map((ball, index) => {
      const delivery = `${ball.over_number}.${ball.ball_in_over}`;
      const text = ball.commentary || `${displayName(ball.bowler) || "Bowler"} to ${displayName(ball.striker) || "batter"} — ${ballLabel(ball)}`;
      return { key: ball.id || `${delivery}-${index}`, delivery, text };
    })
    .reverse();
}

function buildProjectedScores(runs: number, balls: number) {
  const currentRR = runRate(runs, balls);
  const projections = [15, 20].map((overs) => {
    const estimate = Math.round(currentRR * overs);
    return {
      label: `${overs} Overs`,
      primary: estimate,
      secondary: Math.max(estimate - 1, 0),
      tertiary: estimate + 3,
    };
  });
  return projections;
}

function computeMomentum(runs: number, balls: number, target: number, ballsLeft: number) {
  const currentRR = runRate(runs, balls);
  const required = requiredRunRate(target, runs, ballsLeft);
  if (!Number.isFinite(required) || required <= 0) return 100;
  const ratio = currentRR / required;
  return Math.max(0, Math.min(100, Math.round(50 + (ratio - 1) * 50)));
}

function PlayerCard({ name, score, active = false }: { name?: string | null; score?: { runs: number; balls: number }; active?: boolean }) {
  const label = displayName(name) || "—";
  const initials = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <div className={`flex h-24 w-24 items-center justify-center rounded-full border ${active ? "border-white/10 bg-white/5" : "border-white/10 bg-white/5"} text-center`}>
      <div className="space-y-1">
        <div className="display text-xl text-white/80">{initials || "•"}</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{score ? `${score.runs}/${score.balls}` : "0/0"}</div>
      </div>
    </div>
  );
}

function CommentaryRow({ item }: { item: { delivery: string; text: string } }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="mono text-base text-foreground">{item.delivery}</span>
        <span className="h-6 w-6 rounded-full border border-white/10 bg-secondary/70 flex items-center justify-center text-xs mono">{item.delivery.split(".").pop()}</span>
        <span className="text-muted-foreground">{item.text}</span>
      </div>
    </div>
  );
}

function LiveBallPanel({ balls }: { balls: any[] }) {
  return (
    <div className="mx-auto flex items-center justify-center text-center">
      <div className="display text-[4.75rem] font-black leading-none text-[#f5e89c] md:text-[6.5rem]">
        {latestDeliveryLabel(balls)}
      </div>
    </div>
  );
}

export default Viewer;
