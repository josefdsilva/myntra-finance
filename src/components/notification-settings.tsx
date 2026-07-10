import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  getNotificationPrefs,
  updateNotificationPrefs,
  sendTestPush,
  listMyDevices,
  deleteDevice,
  deleteAllMyDevices,
} from "@/lib/push.functions";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, Trash2 } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationSettings({ householdId }: { householdId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const getKey = useServerFn(getVapidPublicKey);
  const subFn = useServerFn(subscribePush);
  const unsubFn = useServerFn(unsubscribePush);
  const getPrefs = useServerFn(getNotificationPrefs);
  const setPrefs = useServerFn(updateNotificationPrefs);
  const testFn = useServerFn(sendTestPush);
  const listFn = useServerFn(listMyDevices);
  const delDevFn = useServerFn(deleteDevice);
  const delAllFn = useServerFn(deleteAllMyDevices);

  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: prefs } = useQuery({ queryKey: ["notif-prefs"], queryFn: () => getPrefs() });
  const { data: devices, refetch: refetchDevices } = useQuery({
    queryKey: ["notif-devices"],
    queryFn: () => listFn(),
  });

  useEffect(() => {
    const ok =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (!reg) return;
      const s = await reg.pushManager.getSubscription();
      setSubscribed(!!s);
      setCurrentEndpoint(s?.endpoint ?? null);
    });
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Notification permission denied");
        return;
      }
      let reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { key } = await getKey();
      if (!key) throw new Error("Server VAPID key missing");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const j = sub.toJSON();
      await subFn({
        data: {
          endpoint: sub.endpoint,
          p256dh: j.keys!.p256dh!,
          auth: j.keys!.auth!,
          user_agent: navigator.userAgent,
          household_id: householdId,
        },
      });
      setSubscribed(true);
      setCurrentEndpoint(sub.endpoint);
      refetchDevices();
      toast.success("This device will now receive push notifications.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubFn({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setCurrentEndpoint(null);
      refetchDevices();
      toast.success("Notifications disabled on this device.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: "weekly_digest" | "baseline_warn" | "emergency_warn", value: boolean) {
    try {
      await setPrefs({ data: { [key]: value } });
      qc.invalidateQueries({ queryKey: ["notif-prefs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function test(endpoint?: string) {
    try {
      const r = await testFn({ data: { endpoint: endpoint ?? null } });
      const failed = r.results.filter((x) => !x.ok);
      if (failed.length === 0) {
        toast.success(
          `Test accepted by push service on ${r.sent}/${r.total} device(s). If you don't see it, check iOS Notification settings for the installed PWA.`,
        );
      } else {
        const removed = failed.filter((f) => f.removed).length;
        const detail = failed
          .map((f) => `${f.host} → ${f.status}${f.expired ? " (expired, removed)" : ""}`)
          .join("; ");
        toast.error(
          `${r.sent}/${r.total} delivered. Failures: ${detail}${removed ? " · stale removed" : ""}`,
        );
      }
      refetchDevices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No devices");
    }
  }

  async function removeAllDevices() {
    if (
      !confirm(
        "Remove ALL registered devices for your account? You'll need to re-enable push on each one.",
      )
    )
      return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      const r = await delAllFn();
      setSubscribed(false);
      setCurrentEndpoint(null);
      refetchDevices();
      toast.success(`Removed ${r.removed} device(s). Click Enable to register this one again.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(id: string) {
    try {
      await delDevFn({ data: { id } });
      refetchDevices();
      toast.success("Device removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notif.title")}</CardTitle>
        <CardDescription>{t("notif.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {supported === false && (
          <p className="text-sm text-muted-foreground">{t("notif.unsupported")}</p>
        )}
        {supported && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("notif.thisDevice")}</p>
              <p className="text-xs text-muted-foreground">
                {subscribed ? t("notif.registered") : t("notif.notRegistered")}
              </p>
            </div>
            <div className="flex gap-2">
              {subscribed ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => test(currentEndpoint ?? undefined)}
                    disabled={busy}
                  >
                    {t("notif.testThis")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={disable} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <BellOff />} {t("notif.disable")}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={enable} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Bell />} {t("notif.enable")}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <PrefRow
            label={t("notif.weeklyDigest")}
            desc={t("notif.weeklyDigestDesc")}
            checked={!!prefs?.weekly_digest}
            onChange={(v) => toggle("weekly_digest", v)}
          />
          <PrefRow
            label={t("notif.baselineWarn")}
            desc={t("notif.baselineWarnDesc")}
            checked={!!prefs?.baseline_warn}
            onChange={(v) => toggle("baseline_warn", v)}
          />
          <PrefRow
            label={t("notif.emergencyWarn")}
            desc={t("notif.emergencyWarnDesc")}
            checked={!!prefs?.emergency_warn}
            onChange={(v) => toggle("emergency_warn", v)}
          />
        </div>

        {devices && devices.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {t("notif.registeredDevices", { count: devices.length })}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => test()} disabled={busy}>
                  {t("notif.testAll")}
                </Button>
                <Button size="sm" variant="destructive" onClick={removeAllDevices} disabled={busy}>
                  {t("notif.removeAll")}
                </Button>
              </div>
            </div>
            <ul className="space-y-2">
              {devices.map((d) => {
                const host = (() => {
                  try {
                    return new URL(d.endpoint).host;
                  } catch {
                    return "unknown";
                  }
                })();
                const isThis = d.endpoint === currentEndpoint;
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {host}{" "}
                        {isThis && (
                          <span className="text-primary">
                            · {t("notif.thisDevice").toLowerCase()}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.user_agent ?? "unknown UA"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(d.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => test(d.endpoint)}>
                        {t("notif.testThis")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeDevice(d.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-muted-foreground">{t("notif.iosHint")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrefRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
