import { Suspense } from "react";
import PairClient from "./PairClient";

export const metadata = {
  title: "Connect a device — mumbl office",
  description: "Authorize a Mac to post activity to your office.",
  robots: { index: false, follow: false },
};

// The whole page reads ?code / ?name, so it can only render once the request is
// known. Static prerendering would bake in an empty code.
export const dynamic = "force-dynamic";

export default function PairPage() {
  return (
    <Suspense fallback={<section style={{ padding: "4rem 1.5rem", textAlign: "center" }}>opening…</section>}>
      <PairClient />
    </Suspense>
  );
}
