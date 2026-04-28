import { renderName } from "@/lib/admin-name";

type Ball = {
  id: string;
  innings_number: number;
  runs: number;
  extra_type: string | null;
  extra_runs: number;
  is_wicket: boolean;
  out_player: string | null;
  striker: string | null;
  non_striker: string | null;
  bowler: string | null;
  is_legal: boolean;
  created_at: string;
};

interface BatterStat {
  name: string;
  runs: number;
  balls: number;
  out: boolean;
  out_desc?: string;
}
interface BowlerStat {
  name: string;
  runs: number;
  balls: number; // legal
  wickets: number;
}

function buildBatterStats(balls: Ball[]): BatterStat[] {
  const map = new Map<string, BatterStat>();
  for (const b of balls) {
    if (b.striker) {
      const s = map.get(b.striker) || { name: b.striker, runs: 0, balls: 0, out: false };
      // count balls only when batter is on strike and ball is legal or no-ball (no-ball faced)
      if (b.is_legal || b.extra_type === "no_ball") s.balls += 1;
      // batter runs: only when not bye/leg-bye and not pure wide
      if (b.extra_type !== "bye" && b.extra_type !== "leg_bye" && b.extra_type !== "wide") {
        s.runs += b.runs;
      }
      map.set(b.striker, s);
    }
    if (b.is_wicket && b.out_player) {
      const s = map.get(b.out_player) || { name: b.out_player, runs: 0, balls: 0, out: false };
      s.out = true;
      map.set(b.out_player, s);
    }
  }
  return [...map.values()];
}

function buildBowlerStats(balls: Ball[]): BowlerStat[] {
  const map = new Map<string, BowlerStat>();
  for (const b of balls) {
    if (!b.bowler) continue;
    const s = map.get(b.bowler) || { name: b.bowler, runs: 0, balls: 0, wickets: 0 };
    if (b.is_legal) s.balls += 1;
    // runs conceded by bowler: batter runs + wides + no-balls (not byes/leg byes)
    let conceded = 0;
    if (b.extra_type === "wide" || b.extra_type === "no_ball") conceded += b.extra_runs + (b.extra_type === "no_ball" ? b.runs : 0);
    else if (b.extra_type === "bye" || b.extra_type === "leg_bye") conceded += 0;
    else conceded += b.runs;
    s.runs += conceded;
    if (b.is_wicket && b.out_player) s.wickets += 1;
    map.set(b.bowler, s);
  }
  return [...map.values()];
}

function buildFow(balls: Ball[]): { score: number; player: string; over: string }[] {
  const out: { score: number; player: string; over: string }[] = [];
  let runs = 0, legal = 0;
  for (const b of balls) {
    if (b.extra_type === "wide" || b.extra_type === "no_ball") runs += b.extra_runs + (b.extra_type === "no_ball" ? b.runs : 0);
    else runs += b.runs + b.extra_runs;
    if (b.is_legal) legal += 1;
    if (b.is_wicket && b.out_player) {
      out.push({
        score: runs,
        player: b.out_player,
        over: `${Math.floor(legal / 6)}.${legal % 6}`,
      });
    }
  }
  return out;
}

export const Scorecard = ({ balls }: { balls: Ball[] }) => {
  const innings1 = balls.filter((b) => b.innings_number === 1);
  const innings2 = balls.filter((b) => b.innings_number === 2);

  const renderInnings = (inningsBalls: Ball[], label: string) => {
    if (inningsBalls.length === 0) return null;
    const batters = buildBatterStats(inningsBalls);
    const bowlers = buildBowlerStats(inningsBalls);
    const fow = buildFow(inningsBalls);
    return (
      <div className="space-y-4">
        <h3 className="display text-2xl text-accent">{label}</h3>
        <div>
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Batting</h4>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase">
                <tr><th className="text-left p-2">Batter</th><th className="text-right p-2">R</th><th className="text-right p-2">B</th><th className="text-right p-2">SR</th></tr>
              </thead>
              <tbody>
                {batters.map((b) => (
                  <tr key={b.name} className="border-t">
                    <td className="p-2">{renderName(b.name)} {b.out && <span className="text-xs text-muted-foreground">(out)</span>}{!b.out && <span className="text-xs text-accent">*</span>}</td>
                    <td className="p-2 text-right mono font-bold">{b.runs}</td>
                    <td className="p-2 text-right mono">{b.balls}</td>
                    <td className="p-2 text-right mono">{b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Bowling</h4>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase">
                <tr><th className="text-left p-2">Bowler</th><th className="text-right p-2">O</th><th className="text-right p-2">R</th><th className="text-right p-2">W</th><th className="text-right p-2">Econ</th></tr>
              </thead>
              <tbody>
                {bowlers.map((b) => (
                  <tr key={b.name} className="border-t">
                    <td className="p-2">{renderName(b.name)}</td>
                    <td className="p-2 text-right mono">{Math.floor(b.balls / 6)}.{b.balls % 6}</td>
                    <td className="p-2 text-right mono">{b.runs}</td>
                    <td className="p-2 text-right mono font-bold">{b.wickets}</td>
                    <td className="p-2 text-right mono">{b.balls ? ((b.runs / b.balls) * 6).toFixed(2) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {fow.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Fall of Wickets</h4>
            <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              {fow.map((f, i) => (
                <span key={i}><span className="text-foreground font-semibold">{f.score}</span>-{i + 1} ({renderName(f.player)}, {f.over})</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (balls.length === 0) {
    return <p className="text-sm text-muted-foreground">Scorecard will appear after the first ball.</p>;
  }

  return (
    <div className="space-y-8">
      {renderInnings(innings1, "1st Innings")}
      {renderInnings(innings2, "2nd Innings")}
    </div>
  );
};
