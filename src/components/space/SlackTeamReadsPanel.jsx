"use client";

import { useState } from "react";
import { trackEvent } from "../../lib/analytics";

export default function SlackTeamReadsPanel({ space, startSetup, updatePosting, onToast }) {
  const channel = space.slackTeamReads;
  const [isSaving, setIsSaving] = useState(false);
  const [postingEnabled, setPostingEnabled] = useState(channel?.postingEnabled === true);

  async function handleSetup() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const result = await startSetup();
      trackEvent("slack_team_reads_setup_started");
      window.location.href = result.installUrl;
    } catch (error) {
      trackEvent("slack_team_reads_setup_failed");
      onToast(error.message || "couldn't start the Slack team reads upgrade.");
      setIsSaving(false);
    }
  }

  async function handleToggle() {
    if (!channel || isSaving) return;
    const nextValue = !postingEnabled;
    setPostingEnabled(nextValue);
    setIsSaving(true);
    try {
      await updatePosting({ postingEnabled: nextValue });
      trackEvent("slack_team_reads_posting_toggled", { enabled: nextValue });
      onToast(nextValue ? "team reads will post to Slack." : "team reads will stay in mumbl.");
    } catch (error) {
      setPostingEnabled(!nextValue);
      trackEvent("slack_team_reads_posting_toggle_failed", { enabled: nextValue });
      onToast(error.message || "couldn't update Slack posting.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel slack-team-reads-panel" aria-busy={isSaving}>
      <div>
        <h3>team reads on Slack</h3>
        <p className="panel-copy">
          optional. mumbl creates one private Slack channel and posts published team reads there. no channel history, no member tracking.
        </p>
      </div>
      {channel ? (
        <>
          <div className="slack-channel-status">
            <span className={`dump-pill ${postingEnabled ? "team" : "private"}`}>{postingEnabled ? "posting on" : "posting off"}</span>
            <strong>#{channel.channelName}</strong>
          </div>
          {channel.lastPostError && <p className="panel-copy warning-copy">last Slack post missed: {channel.lastPostError}</p>}
          <button className={`anon-toggle ${postingEnabled ? "" : "off"}`} type="button" onClick={handleToggle} disabled={isSaving}>
            {postingEnabled ? "post team reads to Slack" : "mumbl only"}
          </button>
        </>
      ) : (
        <>
          <p className="panel-copy">Mumbl needs one optional permission upgrade to create a private channel and post team reads there.</p>
          <button className="share-button primary button-with-loader" type="button" onClick={handleSetup} disabled={isSaving}>
            {isSaving && <span className="mini-loader" aria-hidden="true" />}
            enable Slack team reads
          </button>
        </>
      )}
    </section>
  );
}
