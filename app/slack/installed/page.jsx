import Link from "next/link";

export const metadata = {
  title: "slack installed",
};

export default function SlackInstalledPage() {
  return (
    <section className="auth-callback-view">
      <div className="modal auth-callback-card">
        <p className="eyebrow">slack beta</p>
        <h1>mumbl is in slack</h1>
        <p>try `/mumbl` in Slack. It saves only the thought you explicitly send, and it stays in your private dump.</p>
        <Link className="solid-button button-link" href="/dump">
          open your dump
        </Link>
      </div>
    </section>
  );
}
