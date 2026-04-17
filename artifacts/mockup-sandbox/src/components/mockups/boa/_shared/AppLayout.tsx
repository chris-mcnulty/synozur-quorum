import "./_group.css";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  active: "dashboard" | "boards" | "sessions" | "documents" | "people" | "settings";
  crumbs?: { label: string; href?: string }[];
  rightSlot?: ReactNode;
  tenant?: string;
};

export function AppLayout({ children, active, crumbs, rightSlot, tenant }: Props) {
  return (
    <div className="boa min-h-screen flex">
      <Sidebar active={active} tenant={tenant} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar crumbs={crumbs} rightSlot={rightSlot} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
