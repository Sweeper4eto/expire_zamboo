import { Suspense } from "react";
import { ScanFlow } from "./scan-flow";

export default function ScanPage() {
  return (
    <Suspense>
      <ScanFlow />
    </Suspense>
  );
}
