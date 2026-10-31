"use client";

import Link from "next/link";
import { Menu, Search, ShoppingCart, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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
import { cacheServerCart, cartEventName, readCart } from "@/lib/cart";
import { fetchCustomerCart } from "@/lib/api";

const MANAGER_LINKS = [
  { href: "/manager", label: "Manager Dashboard" },
  { href: "/warehouse", label: "Warehouses" },
  { href: "/product", label: "Products" },
  { href: "/inventory", label: "Inventory" },
  { href: "/pricing", label: "Pricing" },
  { href: "/reorder", label: "Reorders" },
];

const USER_LINKS = [{ href: "/user", label: "Shop" }, { href: "/orders", label: "Orders" }];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, hydrated } = useAuthSession();
  const [cartCount, setCartCount] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const sync = () => setCartCount(readCart(session?.email).reduce((sum, line) => sum + line.quantity, 0));
    sync();
    if (session?.role === "user" && session.token) void fetchCustomerCart(session.token).then((cart) => { cacheServerCart(cart, session.email); }).catch(() => {});
    window.addEventListener(cartEventName, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(cartEventName, sync); window.removeEventListener("storage", sync); };
  }, [session?.email, session?.role, session?.token]);

  const isLandingAccess = pathname === "/" && !session;
  const isAuthPage = pathname.startsWith("/login/") || pathname.startsWith("/signup/");
  const navLinks =
    isAuthPage
      ? []
      : isLandingAccess
      ? [
          { href: "/signup/user", label: "Shopper" },
          { href: "/login/manager", label: "Manager" },
        ]
      : session?.role === "user"
      ? USER_LINKS
      : session?.role === "warehouse_manager"
        ? MANAGER_LINKS
      : [
          { href: "/login/user", label: "Shopper sign in" },
          { href: "/signup/user", label: "Shopper sign up" },
          { href: "/login/manager", label: "Manager sign in" },
          { href: "/signup/manager", label: "Manager access" },
        ];

  const showLogout = Boolean(session);

  const logout = () => {
    window.localStorage.removeItem("warehouse_manager_session");
    clearAuthSession();
    router.push("/");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(`/user${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}#products`);
  };

  if (!hydrated) {
    return null;
  }

  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-5">
          <Link
            href={session?.role === "user" ? "/user" : session?.role === "warehouse_manager" ? "/manager" : "/"}
            className="group flex items-center gap-2"
            aria-label="SupplySync home"
          >
            <span className="forest-gradient grid size-8 place-items-center rounded-lg text-sm font-bold shadow-sm transition-transform group-hover:scale-105">
              S
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              SupplySync
            </span>
          </Link>
          {navLinks.length > 0 && <nav aria-label="Primary navigation" className={`${isLandingAccess ? "flex" : "hidden md:flex"} items-center gap-1 sm:gap-2 ${isLandingAccess ? "rounded-full border border-border bg-card/85 p-1 shadow-sm" : ""}`}>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    isLandingAccess
                      ? "rounded-full px-2.5 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm sm:px-4 sm:text-sm"
                      : "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isLandingAccess && link.href === "/signup/user"
                      ? "bg-secondary text-secondary-foreground hover:brightness-105"
                      : isLandingAccess
                        ? "forest-gradient"
                        : isActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>}
        </div>

        {session?.role === "user" && <form onSubmit={submitSearch} role="search" className="mx-4 hidden max-w-xl flex-1 md:flex">
          <label className="relative w-full"><span className="sr-only">Search products</span><Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true"/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search products, SKU, categories…" className="border-input bg-background h-10 w-full rounded-l-md border py-2 pl-9 pr-3 text-sm focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"/></label>
          <Button type="submit" variant="outline" className="h-10 rounded-l-none border-l-0"><Search className="size-4"/><span className="sr-only">Submit product search</span></Button>
        </form>}

        <div className="flex items-center gap-2">
          {session?.role === "user" && <>
            <Link href="/orders" className="hidden items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted sm:flex"><UserRound className="size-4" /> Orders</Link>
            <Link href="/cart" aria-label={`Shopping cart, ${cartCount} items`} className="relative inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"><ShoppingCart className="size-4" /><span className="hidden sm:inline">Cart</span>{cartCount > 0 && <span className="bg-primary text-primary-foreground absolute -right-2 -top-2 grid size-5 place-items-center rounded-full text-[11px] font-semibold">{cartCount > 99 ? "99+" : cartCount}</span>}</Link>
          </>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className={`md:hidden ${isLandingAccess || isAuthPage ? "hidden" : ""}`}>
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
                <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {showLogout ? (
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          ) : null}

          <ModeToggle />
        </div>
      </div>
    </header>
  );
}

