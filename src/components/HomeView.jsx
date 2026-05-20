"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRecentSlug } from "../hooks/useRecentSlug";
import { feedbackRoom, publicDemoRoom } from "../lib/constants";
import JoinModal from "./JoinModal";

export default function HomeView() {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const recentSlug = useRecentSlug();

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">anonymous · always</p>
          <h1>say the thing you've been mumbling all week.</h1>
          <p>
            mumbl is a living team room for the honest thoughts that never survive standup. no signup, no manager view,
            no polished survey energy.
          </p>
          <div className="hero-actions">
            <Link className="solid-button button-link" href="/create">
              create your space
            </Link>
            <Link className="ghost-button button-link" href={publicDemoRoom.href}>
              try the open room
            </Link>
            <Link className="ghost-button button-link" href={feedbackRoom.href}>
              help shape mumbl
            </Link>
            <button className="ghost-button" type="button" onClick={() => setJoinOpen(true)}>
              already have a link?
            </button>
          </div>
          <div className="room-strip-stack">
            <Link className="open-room-strip feedback-strip" href={feedbackRoom.href} aria-label={`help shape ${feedbackRoom.name}`}>
              <span>beta feedback room</span>
              <strong>{feedbackRoom.slug}</strong>
              <em>tell us what felt good, weird, missing, or worth keeping</em>
            </Link>
            <Link className="open-room-strip" href={publicDemoRoom.href} aria-label={`try the ${publicDemoRoom.name} public room`}>
              <span>public demo room</span>
              <strong>{publicDemoRoom.slug}</strong>
              <em>anonymous by default · public by choice</em>
            </Link>
          </div>
        </div>
        <div className="artifact-board" aria-label="mumbl room preview">
          <div className="artifact feed">
            <div className="artifact-title">
              <span>backend gremlins</span>
              <span>chaotic good</span>
            </div>
            <MiniPost avatar="?" tint />
            <MiniPost avatar="r" short />
            <MiniPost avatar="?" tint />
          </div>
          <div className="artifact heartbeat">
            <div className="artifact-title">monday heartbeat</div>
            <strong>heavy but alive.</strong>
            <p className="muted">the ticket lied, the tests recovered, and people absolutely noticed.</p>
          </div>
          <div className="artifact post-it">
            <strong>drop it on mumbl</strong>
            <p className="muted">someone else is probably already thinking it.</p>
          </div>
          <Link className="artifact open-room" href={publicDemoRoom.href} aria-label={`open ${publicDemoRoom.name}`}>
            <div className="artifact-title">
              <span>open room</span>
              <span>public</span>
            </div>
            <strong>{publicDemoRoom.slug}</strong>
            <p className="muted">peek in. post once. leave no badge behind.</p>
          </Link>
          <Link className="artifact feedback-room" href={feedbackRoom.href} aria-label={`open ${feedbackRoom.name}`}>
            <div className="artifact-title">
              <span>beta room</span>
              <span>public</span>
            </div>
            <strong>help shape mumbl</strong>
            <p className="muted">what should feel sharper, weirder, easier, or more alive?</p>
          </Link>
        </div>
      </section>

      {joinOpen && (
        <JoinModal
          recentSlug={recentSlug}
          close={() => setJoinOpen(false)}
          navigate={(path) => router.push(path)}
        />
      )}
    </>
  );
}

function MiniPost({ avatar, tint = false, short = false }) {
  return (
    <div className="mini-post">
      <span className="avatar">{avatar}</span>
      <span className="mini-lines">
        <span className={`line ${tint ? "tint" : ""}`} />
        <span className={`line ${short ? "tint short" : ""}`} />
        {!short && <span className="line short" />}
      </span>
    </div>
  );
}
