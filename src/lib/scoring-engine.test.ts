import { describe, expect, it } from "vitest";
import { applyBall, type InningsState } from "./scoring-engine";

const baseState: InningsState = {
  runs: 0,
  wickets: 0,
  balls: 0,
  extras: 0,
  striker: "Gill",
  non_striker: "Shub",
  bowler: "Solihu8",
};

describe("applyBall", () => {
  it("adds no-ball penalty and bat runs without counting a legal ball", () => {
    const { state, log } = applyBall(baseState, {
      runs: 4,
      extra: "no_ball",
      extra_runs: 1,
    });

    expect(state.runs).toBe(5);
    expect(state.extras).toBe(1);
    expect(state.balls).toBe(0);
    expect(log.is_legal).toBe(false);
    expect(log.runs).toBe(4);
    expect(log.extra_runs).toBe(1);
  });

  it("rotates strike on no-ball by completed runs, excluding the penalty", () => {
    const { state } = applyBall(baseState, {
      runs: 0,
      extra: "no_ball",
      extra_runs: 2,
    });

    expect(state.striker).toBe("Shub");
    expect(state.non_striker).toBe("Gill");
  });

  it("allows run out on a no-ball and keeps the dismissed player off strike", () => {
    const { state, log } = applyBall(baseState, {
      runs: 1,
      extra: "no_ball",
      extra_runs: 1,
      is_wicket: true,
      wicket_type: "run_out",
      out_player: "Gill",
      new_batter: "Randawa",
    });

    expect(state.runs).toBe(2);
    expect(state.wickets).toBe(1);
    expect(state.balls).toBe(0);
    expect(new Set([state.striker, state.non_striker])).toEqual(new Set(["Randawa", "Shub"]));
    expect(log.out_player).toBe("Gill");
    expect(log.new_batter).toBe("Randawa");
  });

  it("does not allow bowled on a no-ball", () => {
    const { state, log } = applyBall(baseState, {
      runs: 0,
      extra: "no_ball",
      is_wicket: true,
      wicket_type: "bowled",
      out_player: "Gill",
      new_batter: "Randawa",
    });

    expect(state.wickets).toBe(0);
    expect(state.striker).toBe("Gill");
    expect(log.is_wicket).toBe(false);
    expect(log.wicket_type).toBeNull();
  });
});
