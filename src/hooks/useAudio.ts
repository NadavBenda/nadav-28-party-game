"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type BgTrack =
  | "bg-answering"
  | "bg-voting"
  | "bg-results"
  | "bg-leaderboard"
  | "bg-gameover";

export type SfxSound =
  | "sfx-answer-submit"
  | "sfx-vote"
  | "sfx-reveal"
  | "sfx-winner";

export interface AudioController {
  enabled: boolean;
  muted: boolean;
  enable: () => void;
  toggleMute: () => void;
  playBg: (track: BgTrack | null) => void;
  playSfx: (sound: SfxSound) => void;
}

export function useAudio(): AudioController {
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);

  const mutedRef = useRef(false);
  const enabledRef = useRef(false);
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const currentBgRef = useRef<BgTrack | null>(null);
  const pendingBgRef = useRef<BgTrack | null>(null);

  const startBg = useCallback((track: BgTrack) => {
    bgRef.current?.pause();
    const audio = new Audio(`/audio/${track}.mp3`);
    audio.loop = true;
    audio.volume = 0.28;
    audio.muted = mutedRef.current;
    audio.play().catch(() => {});
    bgRef.current = audio;
    currentBgRef.current = track;
  }, []);

  const enable = useCallback(() => {
    if (enabledRef.current) return;
    enabledRef.current = true;
    setEnabled(true);
    if (pendingBgRef.current) {
      startBg(pendingBgRef.current);
      pendingBgRef.current = null;
    }
  }, [startBg]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      if (bgRef.current) bgRef.current.muted = next;
      return next;
    });
  }, []);

  const playBg = useCallback(
    (track: BgTrack | null) => {
      if (!track) {
        bgRef.current?.pause();
        bgRef.current = null;
        currentBgRef.current = null;
        pendingBgRef.current = null;
        return;
      }
      if (currentBgRef.current === track) return;
      if (!enabledRef.current) {
        pendingBgRef.current = track;
        return;
      }
      startBg(track);
    },
    [startBg]
  );

  const playSfx = useCallback((sound: SfxSound) => {
    if (!enabledRef.current || mutedRef.current) return;
    // SFX are OGG (Kenney CC0). Chrome/Firefox/Android support OGG natively.
    // iOS/Safari will silently skip — the game is fully functional without SFX.
    const audio = new Audio(`/audio/${sound}.ogg`);
    audio.volume = 0.65;
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      bgRef.current?.pause();
    };
  }, []);

  return { enabled, muted, enable, toggleMute, playBg, playSfx };
}
