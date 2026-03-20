"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  Package,
  Megaphone,
  TrendingUp,
  CalendarDays,
  Tag,
  Users,
  LogOut,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Sales", href: "/sales", icon: ShoppingBag },
  { label: "Bids", href: "/bids", icon: FileText },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Products", href: "/products", icon: Tag },
  { label: "Warehouse", href: "/warehouse", icon: Package },
  { label: "Marketing", href: "/marketing", icon: Megaphone },
  { label: "Cashflow", href: "/cashflow", icon: TrendingUp },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-14 items-center border-b border-zinc-200 px-4">
        <span className="text-sm font-semibold tracking-tight text-zinc-900">
          Verslo Sistema
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
