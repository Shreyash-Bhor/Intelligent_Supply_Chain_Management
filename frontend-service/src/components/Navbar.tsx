"use client";

import Link from "next/link";
import { Bell, Boxes, ChevronDown, ShieldCheck, Truck } from "lucide-react";
import { ModeToggle } from "./ModeToggle";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// frontend-service/src/components/Navbar.tsx

export function Navbar() {
  return (
    <header>
      <div>
        <div>
          <p>Warehouse Operations Control Tower</p>
        </div>

        <div className="hidden items-center gap-5 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Pages
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/">Dashboard</Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/warehouse">Warehouse Management</Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/product">Product Management</Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/inventory">Inventory Management</Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/reorder">Reorder Queue</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
