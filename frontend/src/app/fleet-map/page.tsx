import { Suspense } from "react";
import { FleetMapPage } from "@/features/fleet/FleetMapPage";
import { Skeleton } from "@/components/ui/Skeleton";

export default function FleetMapRoute() {
  return (
    <Suspense fallback={<Skeleton className="map-skeleton" />}>
      <FleetMapPage />
    </Suspense>
  );
}
