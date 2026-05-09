import LoadingMark from "../src/components/LoadingMark";

export default function Loading() {
  return (
    <section className="create-view">
      <div className="panel loading-panel" aria-live="polite" aria-busy="true">
        <LoadingMark />
        <h2>loading mumbl.</h2>
        <p className="panel-copy">getting the room warmed up.</p>
      </div>
    </section>
  );
}
