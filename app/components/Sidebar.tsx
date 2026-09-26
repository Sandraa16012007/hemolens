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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { signOut } from "@/lib/supabase/auth";
import { useSidebar } from "../context/SidebarContext";
import { useLanguage } from "../context/LanguageContext";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleCollapse } = useSidebar();
  const { t } = useLanguage();

  const handleLogout = async () => {
    if (onClose) onClose();
    await signOut();
    router.push("/");
    router.refresh();
  };

  const mainNavItems = [
    {
      name: t("nav.dashboard", "Dashboard"),
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      name: t("nav.newScreening", "New Screening"),
      href: "/new-screening",
      icon: PlusCircle,
      active: pathname === "/new-screening",
    },
    {
      name: t("nav.screeningHistory", "Screening History"),
      href: "/screening-history",
      icon: History,
      active: pathname === "/screening-history",
    },
    {
      name: t("nav.aiAssistant", "AI Assistant"),
      href: "/ai-assistant",
      icon: Bot,
      active: pathname === "/ai-assistant",
    },
  ];

  const bottomNavItems = [
    {
      name: t("nav.profile", "Profile"),
      href: "/profile",
      icon: User,
      active: pathname === "/profile",
    },
    {
      name: t("nav.logout", "Log Out"),
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
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-border flex flex-col justify-between p-3 sm:p-4 transition-all duration-300 ${isCollapsed ? "lg:w-20" : "lg:w-64"
          } w-64 ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        {/* Top Section: Logo & Main Navigation */}
        <div className="flex flex-col gap-5">
          {/* Header / Logo + Collapse Toggle */}
          <div className="flex items-center justify-between px-1 pt-1">
            <Link href="/" className="flex items-center overflow-hidden">
              {isCollapsed ? (
                <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-2xs hover:scale-105 transition-transform">
                  <Image
                    src="/assets/favicon.png"
                    alt="HemoLens"
                    width={24}
                    height={24}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
              ) : (
                <Image
                  src="/assets/logo.png"
                  alt="HemoLens"
                  width={180}
                  height={46}
                  className="h-9 sm:h-10 w-auto object-contain"
                  priority
                />
              )}
            </Link>

            {/* Desktop Collapse Button */}
            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface transition-colors cursor-pointer"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

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
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center ${isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3.5 py-2.5"
                    } rounded-xl text-sm font-medium transition-all cursor-pointer active:scale-[0.98] ${item.active
                      ? "bg-accent/25 text-heading font-semibold shadow-xs border border-accent/40"
                      : "text-muted hover:text-heading hover:bg-surface hover:translate-x-0.5"
                    }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${item.active ? "text-accent-dark" : "text-muted"
                      }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
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
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center ${isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3.5 py-2.5"
                    } rounded-xl text-sm font-medium transition-all cursor-pointer active:scale-[0.98] text-muted hover:text-primary hover:bg-primary/5 hover:translate-x-0.5 text-left w-full`}
                >
                  <Icon className="w-4 h-4 shrink-0 transition-colors text-muted group-hover:text-primary" />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center ${isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3.5 py-2.5"
                  } rounded-xl text-sm font-medium transition-all cursor-pointer active:scale-[0.98] ${item.active
                    ? "bg-accent/25 text-heading font-semibold shadow-xs border border-accent/40"
                    : "text-muted hover:text-heading hover:bg-surface hover:translate-x-0.5"
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0 transition-colors text-muted" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}
