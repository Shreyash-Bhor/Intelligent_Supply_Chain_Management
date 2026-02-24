import { Bell, Boxes, ShieldCheck, Truck } from "lucide-react";
import { ModeToggle } from "./ModeToggle";

export function Navbar() {
  return (
    <header className="bg-background/90 sticky top-0 z-30 border-b shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="from-primary/15 to-primary/5 text-primary rounded-xl border bg-gradient-to-br p-2.5">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">
              Intelligent Supply Chain
            </p>
            <p className="text-muted-foreground text-xs">
              Warehouse Operations Control Tower
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-5 md:flex">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4" />
            Manager-Secured
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Boxes className="h-4 w-4" />
            Inventory Intelligence
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" />
            Live Monitoring
          </div>
        </div>

        <ModeToggle />
      </div>
    </header>
  );
}
