import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Menu, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";

export type NavItem = { to: string; label: string };

/** Grupo de navegação: item direto (sem `items`) ou dropdown (com `items`). */
export type NavGroup = {
  label: string;
  icon?: LucideIcon;
  to?: string;
  items?: NavItem[];
};

export function AppShell({
  items,
  groups,
  homeTo,
  badge,
  profileTo,
  children,
}: {
  items: NavItem[];
  groups?: NavGroup[];
  homeTo: string;
  badge: string;
  profileTo?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const name = profile?.full_name || profile?.email || "Minha conta";
  const initial = (profile?.full_name || profile?.email || "?").trim().charAt(0).toUpperCase();

  const isActivePath = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const isGroupActive = (g: NavGroup) =>
    g.to ? isActivePath(g.to) : (g.items ?? []).some((i) => isActivePath(i.to));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-sidebar">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to={homeTo} className="shrink-0 text-lg font-bold tracking-tight">
            QA<span className="text-accent">Academy</span>
          </Link>
          <span className="hidden shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground sm:inline">
            {badge}
          </span>

          {groups ? (
            <>
              {/* Desktop: menu agrupado em linha única */}
              <nav className="ml-1 hidden min-w-0 flex-1 items-center gap-1 text-sm lg:flex">
                {groups.map((g) => {
                  const Icon = g.icon;
                  const active = isGroupActive(g);
                  const cls = `flex items-center gap-1.5 rounded-md px-3 py-1.5 whitespace-nowrap transition-colors ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`;
                  if (g.to) {
                    return (
                      <Link key={g.label} to={g.to} className={cls}>
                        {Icon && <Icon className="h-4 w-4" />}
                        {g.label}
                      </Link>
                    );
                  }
                  return (
                    <DropdownMenu key={g.label}>
                      <DropdownMenuTrigger className={cls}>
                        {Icon && <Icon className="h-4 w-4" />}
                        {g.label}
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="z-50 min-w-52">
                        {(g.items ?? []).map((i) => (
                          <DropdownMenuItem key={i.to} asChild>
                            <Link
                              to={i.to}
                              className={isActivePath(i.to) ? "font-medium text-foreground" : ""}
                            >
                              {i.label}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
              </nav>

              <div className="ml-auto flex items-center gap-2">
                {/* Menu do usuário */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="hidden items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground lg:flex">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                      {initial}
                    </span>
                    <span className="max-w-40 truncate">{name}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-50 min-w-48">
                    <DropdownMenuItem asChild>
                      <Link to={profileTo ?? homeTo}>
                        <User className="mr-2 h-4 w-4" /> Perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void signOut()}>
                      <LogOut className="mr-2 h-4 w-4" /> Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile / tablet: menu hambúrguer */}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="secondary" size="sm" className="lg:hidden" aria-label="Abrir menu">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80 overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="text-left">
                        {name}
                        <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          {badge}
                        </span>
                      </SheetTitle>
                    </SheetHeader>
                    <div className="px-4 pb-6">
                      <Accordion type="multiple" className="w-full">
                        {groups.map((g) => {
                          const Icon = g.icon;
                          if (g.to) {
                            return (
                              <Link
                                key={g.label}
                                to={g.to}
                                onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-2 border-b border-border py-3 text-sm ${
                                  isGroupActive(g) ? "font-medium text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {Icon && <Icon className="h-4 w-4" />}
                                {g.label}
                              </Link>
                            );
                          }
                          return (
                            <AccordionItem key={g.label} value={g.label}>
                              <AccordionTrigger className="py-3 text-sm">
                                <span className="flex items-center gap-2">
                                  {Icon && <Icon className="h-4 w-4" />}
                                  {g.label}
                                </span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="flex flex-col">
                                  {(g.items ?? []).map((i) => (
                                    <Link
                                      key={i.to}
                                      to={i.to}
                                      onClick={() => setMobileOpen(false)}
                                      className={`rounded-md px-3 py-2 text-sm ${
                                        isActivePath(i.to)
                                          ? "bg-secondary text-foreground"
                                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                      }`}
                                    >
                                      {i.label}
                                    </Link>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>

                      <div className="mt-4 flex flex-col gap-1">
                        <Link
                          to={profileTo ?? homeTo}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <User className="h-4 w-4" /> Perfil
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileOpen(false);
                            void signOut();
                          }}
                          className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <LogOut className="h-4 w-4" /> Sair
                        </button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </>
          ) : (
            <>
              <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
                {items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
                <Button variant="secondary" size="sm" onClick={signOut}>
                  <LogOut className="mr-1 h-4 w-4" /> Sair
                </Button>
              </div>
            </>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
