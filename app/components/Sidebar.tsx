"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Bot,
  User,
  LogOut,
  X,
} from "lucide-react";
import { signOut } from "@/lib/supabase/auth";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    if (onClose) onClose();
    await signOut();
    router.push("/");
    router.refresh();
  };

  const mainNavItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      name: "New Screening",
      href: "/new-screening",
      icon: PlusCircle,
      active: pathname === "/new-screening",
    },
    {
      name: "Screening History",
      href: "/screening-history",
      icon: History,
      active: pathname === "/screening-history",
    },
    {
      name: "AI Assistant",
      href: "/ai-assistant",
      icon: Bot,
      active: pathname === "/ai-assistant",
    },
  ];

  const bottomNavItems = [
    {
      name: "Profile",
      href: "/onboarding",
      icon: User,
      active: pathname === "/onboarding",
    },
    {
      name: "Log Out",
      href: "/",
      icon: LogOut,
      active: false,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-border flex flex-col justify-between p-4 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Section: Logo & Main Navigation */}
        <div className="flex flex-col gap-6">
          {/* Header / Logo */}
          <div className="flex items-center justify-between px-2 pt-2">
            <Link href="/" className="flex items-center">
              <Image
                src="/assets/logo.png"
                alt="HemoLens"
                width={180}
                height={46}
                className="h-10 sm:h-11 w-auto object-contain"
                priority
              />
            </Link>
            {/* Close Button on Mobile */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-surface text-muted lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Main Nav Links */}
          <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer active:scale-[0.98] ${
                    item.active
                      ? "bg-accent/25 text-heading font-semibold shadow-xs border border-accent/40"
                      : "text-muted hover:text-heading hover:bg-surface hover:translate-x-0.5"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      item.active ? "text-accent-dark" : "text-muted"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Profile & Log Out */}
        <div className="border-t border-border pt-3 flex flex-col gap-1.5">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            if (item.name === "Log Out") {
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer active:scale-[0.98] text-muted hover:text-primary hover:bg-primary/5 hover:translate-x-0.5 text-left w-full"
                >
                  <Icon className="w-4 h-4 transition-colors text-muted group-hover:text-primary" />
                  <span>{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer active:scale-[0.98] ${
                  item.active
                    ? "bg-accent/25 text-heading font-semibold shadow-xs border border-accent/40"
                    : "text-muted hover:text-heading hover:bg-surface hover:translate-x-0.5"
                }`}
              >
                <Icon className="w-4 h-4 transition-colors text-muted" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}
