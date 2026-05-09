export default function LoadingMark({ compact = false }) {
  return (
    <div className={compact ? "mumbl-loader compact" : "mumbl-loader"} aria-hidden="true">
      <span className="mumbl-loader-mark">m</span>
      <span className="mumbl-loader-dots">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
