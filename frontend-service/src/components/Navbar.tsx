import { Boxes, Truck } from "lucide-react";
import { ModeToggle } from "./ModeToggle";

export function Navbar() {
  return (
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">
              Intelligent Supply Chain
            </p>
            <p className="text-muted-foreground text-xs">
              AI operations command center
            </p>
          </div>
        </div>

        <div className="text-muted-foreground hidden items-center gap-2 text-sm md:flex">
          <Boxes className="h-4 w-4" />
          Inventory + Reordering
        </div>

        <ModeToggle />
      </div>
    </header>
  );
}
