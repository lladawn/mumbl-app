import { Suspense } from "react";
import AuthCallbackClient from "../../../src/components/AuthCallbackClient";
import LoadingMark from "../../../src/components/LoadingMark";

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
        <h1>restoring your mumbl session</h1>
        <div className="auth-callback-status" aria-live="polite" aria-busy="true">
          <LoadingMark compact />
          <p>connecting this browser to your account...</p>
          <div className="auth-callback-steps" aria-label="login progress">
            <span className="active">private dump</span>
            <span className="active">room controls</span>
            <span>back to where you were</span>
          </div>
        </div>
      </div>
    </section>
  );
}
