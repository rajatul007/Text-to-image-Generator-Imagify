"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { SerializedJob } from "@/lib/queries/jobs";

const ACTIVE = new Set(["QUEUED", "PROCESSING", "UPLOADING"]);
export const isActive = (j: Pick<SerializedJob, "status">) => ACTIVE.has(j.status);

/** Polls a job until it reaches a terminal state. Backs off gently while waiting. */
export function useJobPolling(initial: SerializedJob, onFinish?: (job: SerializedJob) => void) {
  const [job, setJob] = useState(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const finished = useRef(!isActive(initial));
  const cb = useRef(onFinish);
  useEffect(() => {
    cb.current = onFinish;
  });

  useEffect(() => {
    if (!isActive(initial)) return;
    let stopped = false;
    let delay = 1200;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await api<{ job: SerializedJob }>(`/api/generations/${initial.id}`);
        if (stopped) return;
        setPollError(null);
        setJob(res.job);
        if (!isActive(res.job)) {
          if (!finished.current) {
            finished.current = true;
            cb.current?.(res.job);
          }
          return;
        }
      } catch (e) {
        if (!stopped) setPollError((e as Error).message);
      }
      delay = Math.min(delay * 1.15, 4000);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [initial]);

  return { job, setJob, pollError };
}
