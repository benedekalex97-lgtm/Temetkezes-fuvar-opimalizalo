"use client";

import { Inbox } from "lucide-react";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { DecisionLog, PlanComparison } from "@/components/dashboard/plan-comparison";
import { AttentionList, FleetStatus } from "@/components/dashboard/side-panels";
import { SuggestionPanel } from "@/components/dashboard/suggestion-panel";
import { Timeline } from "@/components/dashboard/timeline";
import { UrgentEventCard } from "@/components/dashboard/urgent-event";
import { RouteMap } from "@/components/map/route-map";
import { Card, EmptyState } from "@/components/ui";
import { useDemoState } from "@/lib/client/demo-store";
import { activeSuggestion } from "@/lib/domain/selectors";

export default function DashboardPage() {
  const state = useDemoState();
  const suggestion = activeSuggestion(state);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Napi irányítópult</h1>
          <p className="text-sm text-ink-3">{state.dayLabel} · 3 jármű, 3 csapat · indulás 07:00-kor a telephelyről</p>
        </div>
      </div>

      <UrgentEventCard />
      <KpiRow />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 space-y-4">
          <Timeline />
          <RouteMap />
        </div>
        <div className="min-w-0 space-y-4">
          {suggestion ? (
            <SuggestionPanel key={suggestion.id} suggestion={suggestion} />
          ) : (
            <Card id="javaslat" className="scroll-mt-28">
              <EmptyState icon={<Inbox size={22} />} title="Nincs döntésre váró javaslat">
                Az optimalizáló csak kérésre készít javaslatot, és azt soha nem alkalmazza automatikusan.
              </EmptyState>
            </Card>
          )}
          <AttentionList />
          <FleetStatus />
        </div>
      </div>

      <PlanComparison />
      <DecisionLog />
    </div>
  );
}
