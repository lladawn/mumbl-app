import { Suspense } from "react";
import SlackSpaceHandoffClient from "../../../src/components/SlackSpaceHandoffClient";

export const metadata = {
  title: "opening mumbl room",
};

export default function SlackSpaceHandoffPage() {
  return (
    <Suspense fallback={<SlackSpaceHandoffFallback />}>
      <SlackSpaceHandoffClient />
    </Suspense>
  );
}

function SlackSpaceHandoffFallback() {
  return (
    <section className="auth-callback-view">
      <div className="modal auth-callback-card">
        <p className="eyebrow">slack</p>
        <h1>opening your mumbl room</h1>
        <p>bringing the creator key into this browser...</p>
      </div>
    </section>
  );
}
