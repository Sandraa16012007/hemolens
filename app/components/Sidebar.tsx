"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Bot,
  User,
  LogOut,
  X,
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const mainNavItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      name: "New Screening",
      href: "/dashboard",
      icon: PlusCircle,
      active: false,
    },
    {
      name: "Screening History",
      href: "/dashboard",
      icon: History,
      active: false,
    },
    {
      name: "AI Health Assistant",
      href: "/dashboard",
      icon: Bot,
      active: false,
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
                width={150}
                height={38}
                className="h-8 w-auto object-contain"
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    item.active
                      ? "bg-accent/25 text-heading font-semibold shadow-xs border border-accent/40"
                      : "text-muted hover:text-heading hover:bg-surface"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
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
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  item.name === "Log Out"
                    ? "text-muted hover:text-primary hover:bg-primary/5"
                    : item.active
                    ? "bg-accent/25 text-heading font-semibold shadow-xs border border-accent/40"
                    : "text-muted hover:text-heading hover:bg-surface"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    item.name === "Log Out"
                      ? "text-muted group-hover:text-primary"
                      : "text-muted"
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}
