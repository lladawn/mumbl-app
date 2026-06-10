import { Suspense } from "react";
import SlackConnectClient from "../../../src/components/SlackConnectClient";

export const metadata = {
  title: "connect slack",
};

export default function SlackConnectPage() {
  return (
    <Suspense fallback={<SlackConnectFallback />}>
      <SlackConnectClient />
    </Suspense>
  );
}

function SlackConnectFallback() {
  return (
    <section className="auth-callback-view">
      <div className="modal auth-callback-card">
        <p className="eyebrow">slack beta</p>
        <h1>connecting slack</h1>
        <p>checking your mumbl login...</p>
      </div>
    </section>
  );
}
