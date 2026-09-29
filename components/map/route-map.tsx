"use client";

import { Info, Map as MapIcon, Route, Waypoints } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useDemoState } from "@/lib/client/demo-store";
import { Card, CardHeader, cx } from "../ui";
import { buildMapData, URGENT_COLOR } from "./map-data";
import { SchematicMap } from "./schematic-map";

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-ink-3">Térkép betöltése…</div>,
});

type View = "map" | "schematic";

export function RouteMap({ className }: { className?: string }) {
  const state = useDemoState();
  const data = useMemo(() => buildMapData(state), [state]);
  const [view, setView] = useState<View>("map");
  const [tilesFailed, setTilesFailed] = useState(false);
  const onTileFailure = useCallback(() => {
    setTilesFailed(true);
    setView("schematic");
  }, []);

  return (
    <Card className={className}>
      <CardHeader
        icon={<Route size={17} />}
        title="Becsült útvonal"
        subtitle="Légvonalas szakaszok, közelítő koordináták · Szimulált ETA, nem valós idejű"
        actions={
          <div className="flex rounded-lg border border-line bg-subtle p-0.5">
            {(
              [
                ["map", "Térkép", <MapIcon key="m" size={14} />],
                ["schematic", "Sematikus", <Waypoints key="s" size={14} />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={cx(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-[12.5px] font-medium",
                  view === id ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        }
      />
      {tilesFailed && view === "schematic" && (
        <div className="flex items-center gap-2 border-b border-line bg-subtle px-4 py-1.5 text-[12.5px] text-ink-3">
          <Info size={14} /> A térképcsempék nem érhetők el — sematikus nézet látható. Az adatok és az útvonalak változatlanok.
        </div>
      )}
      <div className="relative h-[340px] overflow-hidden rounded-b-xl sm:h-[420px]">
        {view === "map" && !tilesFailed ? <LeafletMap data={data} onTileFailure={onTileFailure} /> : <SchematicMap data={data} />}
        {view === "map" && tilesFailed && (
          <div className="absolute inset-x-0 top-0 bg-surface/90 px-3 py-1 text-[12px] text-ink-3">
            A térképcsempék nem érhetők el, ezért a sematikus nézet látható.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-[12px] text-ink-2">
        {state.vehicles.map((v) => (
          <span key={v.id} className="flex items-center gap-1.5">
            <span className="h-1 w-5 rounded-full" style={{ backgroundColor: v.color }} />
            <span className="font-mono font-semibold">{v.id}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full" style={{ backgroundColor: URGENT_COLOR }} /> sürgős felvétel
        </span>
        {data.hasProposal && (
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-ink-2" /> javasolt (még nem jóváhagyott)
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" /> telephely
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-primary bg-white" /> AEVUM-iroda
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#a7b0b3]" /> felvételi helytörzs
        </span>
      </div>
    </Card>
  );
}
