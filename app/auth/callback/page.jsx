import { Suspense } from "react";
import AuthCallbackClient from "../../../src/components/AuthCallbackClient";

export const metadata = {
  title: "login",
};

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackClient />
    </Suspense>
  );
}

function AuthCallbackFallback() {
  return (
    <section className="auth-callback-view">
      <div className="modal auth-callback-card">
        <p className="eyebrow">login</p>
        <h1>keeping your dump</h1>
        <p>finishing login...</p>
      </div>
    </section>
  );
}
