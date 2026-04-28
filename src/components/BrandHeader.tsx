import { Link } from "react-router-dom";
import logo from "@/assets/funzquick-logo.png";
import { renderName } from "@/lib/admin-name";

export const BrandHeader = () => {
  return (
    <header className="sticky top-0 z-40 w-full glass border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src={logo}
            alt="FunzQuick Cric Scoring logo"
            className="h-10 w-10 rounded-lg shadow-[var(--shadow-brand)] transition-transform group-hover:scale-110"
          />
          <div className="leading-tight">
            <div className="display text-xl tracking-wider">
              <span className="text-foreground">Funz</span>
              <span className="text-accent">Quick</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground -mt-1">
              Cric Scoring
            </div>
          </div>
        </Link>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span>by</span>
          <span>{renderName("Sunandan Singh")}</span>
        </div>
      </div>
    </header>
  );
};
