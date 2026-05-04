/**
 * Cricket scoring engine — pure logic, no I/O.
 * Given current innings state + a ball event, returns the new state and a ball log row.
 */

export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | null;
export type WicketType =
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket";

export interface InningsState {
  runs: number;
  wickets: number;
  balls: number; // legal balls only
  extras: number;
  striker: string;
  non_striker: string;
  bowler: string;
}

export interface BallInput {
  runs: number; // batter runs (0..6)
  extra?: ExtraType;
  extra_runs?: number; // extras credited to team, including wide/no-ball penalty
  is_wicket?: boolean;
  wicket_type?: WicketType;
  out_player?: string; // defaults to striker
  new_batter?: string; // who walks in if a wicket falls
}

export interface BallOutcome {
  state: InningsState;
  log: {
    runs: number;
    extra_type: ExtraType;
    extra_runs: number;
    is_wicket: boolean;
    wicket_type: string | null;
    out_player: string | null;
    new_batter: string | null;
    striker: string;
    non_striker: string;
    bowler: string;
    is_legal: boolean;
  };
}

const namesMatch = (left?: string | null, right?: string | null) =>
  !!left && !!right && left.trim().toLowerCase() === right.trim().toLowerCase();

const canBeOutOnNoBall = (wicketType?: WicketType) => wicketType === "run_out";

/** Apply one ball to an innings state and return the next state + a log row. */
export function applyBall(prev: InningsState, ball: BallInput): BallOutcome {
  const next: InningsState = { ...prev };
  let totalRunsThisBall = ball.runs ?? 0;
  let extraRuns = 0;
  let isLegal = true;
  let isWicket = !!ball.is_wicket;
  let wicketType = ball.wicket_type ?? null;

  if (ball.extra === "wide" || ball.extra === "no_ball") {
    // Wide/no-ball can include additional extra runs (for overthrows, running, etc.)
    extraRuns = Math.max(1, ball.extra_runs ?? 1);
    isLegal = false;
  } else if (ball.extra === "bye" || ball.extra === "leg_bye") {
    extraRuns = ball.extra_runs ?? ball.runs ?? 0;
    totalRunsThisBall = 0; // byes/leg byes don't go to batter
  }

  if (ball.extra === "no_ball" && isWicket && !canBeOutOnNoBall(ball.wicket_type)) {
    isWicket = false;
    wicketType = null;
  }

  next.runs = prev.runs + totalRunsThisBall + extraRuns;
  next.extras = prev.extras + extraRuns;

  // Wicket
  if (isWicket) {
    next.wickets = prev.wickets + 1;
    if (ball.new_batter) {
      // out player walks off, new batter takes their place at striker end
      const outPlayer = ball.out_player || prev.striker;
      if (namesMatch(outPlayer, prev.striker)) next.striker = ball.new_batter;
      else if (namesMatch(outPlayer, prev.non_striker)) next.non_striker = ball.new_batter;
    }
  }

  // Strike rotation follows runs physically completed, excluding wide/no-ball penalty.
  const rotateRuns = (() => {
    if (ball.extra === "bye" || ball.extra === "leg_bye") return extraRuns;
    if (ball.extra === "wide" || ball.extra === "no_ball") {
      return Math.max(0, extraRuns - 1) + (ball.extra === "no_ball" ? ball.runs ?? 0 : 0);
    }
    return ball.runs ?? 0;
  })();
  if (rotateRuns % 2 === 1) {
    const tmp = next.striker;
    next.striker = next.non_striker;
    next.non_striker = tmp;
  }

  // End of legal ball: increment count + maybe rotate at over end
  if (isLegal) {
    next.balls = prev.balls + 1;
    if (next.balls % 6 === 0) {
      // over completed → swap strike
      const tmp = next.striker;
      next.striker = next.non_striker;
      next.non_striker = tmp;
    }
  }

  return {
    state: next,
    log: {
      runs: ball.runs ?? 0,
      extra_type: ball.extra ?? null,
      extra_runs: extraRuns,
      is_wicket: isWicket,
      wicket_type: wicketType,
      out_player: isWicket ? ball.out_player || prev.striker : null,
      new_batter: isWicket ? ball.new_batter ?? null : null,
      striker: prev.striker,
      non_striker: prev.non_striker,
      bowler: prev.bowler,
      is_legal: isLegal,
    },
  };
}

export function oversString(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export function runRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return (runs / balls) * 6;
}

export function requiredRunRate(target: number, runs: number, ballsLeft: number): number {
  if (ballsLeft <= 0) return 0;
  return ((target - runs) / ballsLeft) * 6;
}
