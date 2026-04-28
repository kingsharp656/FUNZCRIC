import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BrandHeader } from "@/components/BrandHeader";
import logo from "@/assets/funzquick-logo.png";
import { Activity, BarChart3, Trophy, Users, Zap, Share2 } from "lucide-react";
import { renderName } from "@/lib/admin-name";

const features = [
  { icon: Activity, label: "Live Score", desc: "Real-time ball-by-ball updates pushed to every viewer instantly." },
  { icon: BarChart3, label: "Stats", desc: "Run rate, required RR, partnerships and a per-over breakdown." },
  { icon: Users, label: "Teams", desc: "Track playing XI, batters, bowlers and strike rotation automatically." },
  { icon: Trophy, label: "Tournaments", desc: "Save match history and revisit past scorecards anytime." },
];

const Index = () => {
  return (
    <div className="min-h-screen">
      <BrandHeader />

      {/* HERO */}
      <section className="container py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-card/60 text-xs text-muted-foreground">
              <span className="pulse-dot" /> LIVE cricket scoring, made fast
            </div>
            <h1 className="display text-5xl md:text-7xl leading-[0.95]">
              Score every <span className="text-accent">ball.</span><br />
              Share every <span className="text-primary-glow">moment.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              FunzQuick is a real-time cricket scoring app for grassroots matches.
              The scorer taps. Viewers anywhere watch the score update live — no refresh,
              no setup, no logins. Just a shareable link.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-95 shadow-[var(--shadow-brand)] h-14 px-8 text-base">
                <Link to="/create"><Zap className="mr-2" /> Start a New Match</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 px-8 text-base border-accent/40 hover:bg-accent/10">
                <a href="#how"><Share2 className="mr-2" /> How it works</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Built by {renderName("Sunandan Singh")}
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-br from-primary/30 via-accent/20 to-transparent blur-3xl rounded-full" />
            <img
              src={logo}
              alt="FunzQuick Cric Scoring"
              className="relative w-full max-w-md mx-auto drop-shadow-[0_20px_60px_hsl(var(--primary)/0.5)]"
            />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container pb-20" id="how">
        <h2 className="display text-3xl md:text-4xl text-center mb-10">
          Everything you need on the boundary
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="score-tile p-6 text-left hover:border-accent/40 hover:-translate-y-1">
              <div className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow mb-4 shadow-[var(--shadow-brand)]">
                <Icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="display text-2xl tracking-wide mb-2">{label}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container pb-24">
        <div className="glass rounded-2xl p-8 md:p-12">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: "01", t: "Create a match", d: "Enter team names, format and toss. Get two links instantly." },
              { n: "02", t: "Start scoring", d: "Use the scorer link. Big buttons, fast taps, no fumbling." },
              { n: "03", t: "Share live link", d: "Send the viewer link. Anyone watching sees every ball in real time." },
            ].map((s) => (
              <div key={s.n} className="space-y-2">
                <div className="display text-5xl text-accent">{s.n}</div>
                <h3 className="display text-2xl">{s.t}</h3>
                <p className="text-muted-foreground text-sm">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" className="bg-gradient-to-r from-accent to-accent-glow text-accent-foreground hover:opacity-95 h-14 px-10 text-base font-bold">
              <Link to="/create">Create your first match →</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        FunzQuick Cric Scoring · Crafted by {renderName("Sunandan Singh")}
      </footer>
    </div>
  );
};

export default Index;
