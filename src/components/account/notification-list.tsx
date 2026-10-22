"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "../ui/button";
import { EmptyState, Skeleton } from "../ui/misc";
import { Pagination } from "../ui/pagination";
import { Segmented } from "../ui/segmented";
import { api } from "@/lib/client/api";
import { cn, timeAgo } from "@/lib/utils";

interface Item {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationList() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Item[]; pages: number; unread: number } | null>(null);

  const load = useCallback(async () => {
    setData(await api(`/api/notifications?page=${page}${filter === "unread" ? "&unread=1" : ""}`));
  }, [page, filter]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching
    void load();
  }, [load]);

  const markAll = async () => {
    await api("/api/notifications/read", { body: { all: true } });
    await load();
    router.refresh();
  };
  const open = async (n: Item) => {
    if (!n.readAt) await api("/api/notifications/read", { body: { ids: [n.id] } }).catch(() => undefined);
    router.refresh();
    if (n.link) router.push(n.link);
    else void load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Segmented
          label="Filter"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: `Unread${data?.unread ? ` (${data.unread})` : ""}` },
          ]}
        />
        <Button variant="secondary" size="sm" onClick={markAll} disabled={!data?.unread}>
          <CheckCheck className="size-4" /> Mark all as read
        </Button>
      </div>
      {!data && <Skeleton className="h-64" />}
      {data?.items.length === 0 && (
        <EmptyState icon={<Bell className="size-5" />} title={filter === "unread" ? "You're all caught up" : "No notifications yet"}>
          Completed generations, payments, refunds and low-credit alerts show up here.
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-panel">
          {data.items.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-panel-2/60", !n.readAt && "bg-violet/5")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-violet")} aria-label={n.readAt ? undefined : "Unread"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block text-sm text-muted">{n.body}</span>
                </span>
                <span className="shrink-0 text-xs text-faint">{timeAgo(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={page} pages={data.pages} onChange={setPage} />}
      <p className="mt-6 text-center text-xs text-faint">
        Choose which emails you get in{" "}
        <Link href="/settings" className="underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
