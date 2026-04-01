"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ModeToggle } from "./ModeToggle";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { clearAuthSession } from "@/lib/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

const MANAGER_LINKS = [
  { href: "/", label: "Manager Dashboard" },
  { href: "/warehouse", label: "Warehouses" },
  { href: "/product", label: "Products" },
  { href: "/inventory", label: "Inventory" },
  { href: "/reorder", label: "Reorders" },
];

const USER_LINKS = [{ href: "/user", label: "User Dashboard" }];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, hydrated } = useAuthSession();

  const navLinks =
    session?.role === "user"
      ? USER_LINKS
      : session?.role === "warehouse_manager"
        ? MANAGER_LINKS
        : [{ href: "/", label: "Access Portal" }];

  const showLogout = session?.role === "user";

  if (!hydrated) {
    return null;
  }

  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button
                variant="outline"
                size="icon"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
              {navLinks.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
              {showLogout ? (
                <DropdownMenuItem
                  onClick={() => {
                    clearAuthSession();
                    router.push("/");
                  }}
                >
                  Logout
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {showLogout ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearAuthSession();
                router.push("/");
              }}
            >
              Logout
            </Button>
          ) : null}

          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
