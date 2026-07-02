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
} from "@/lib/push.functions";
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
  const qc = useQueryClient();
  const getKey = useServerFn(getVapidPublicKey);
  const subFn = useServerFn(subscribePush);
  const unsubFn = useServerFn(unsubscribePush);
  const getPrefs = useServerFn(getNotificationPrefs);
  const setPrefs = useServerFn(updateNotificationPrefs);
  const testFn = useServerFn(sendTestPush);

  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);

  const { data: prefs } = useQuery({ queryKey: ["notif-prefs"], queryFn: () => getPrefs() });

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (!reg) return;
      const s = await reg.pushManager.getSubscription();
      setSubscribed(!!s);
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

  async function test() {
    try {
      const r = await testFn();
      toast.success(`Test sent to ${r.sent} device(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No devices");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Web push alerts about your budget. Each type is opt-in per member.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {supported === false && (
          <p className="text-sm text-muted-foreground">
            This browser doesn't support web push. On iPhone, add the app to the home screen first.
          </p>
        )}
        {supported && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">This device</p>
              <p className="text-xs text-muted-foreground">
                {subscribed ? "Registered for push." : "Not registered yet."}
              </p>
            </div>
            <div className="flex gap-2">
              {subscribed ? (
                <>
                  <Button size="sm" variant="outline" onClick={test} disabled={busy}>
                    Send test
                  </Button>
                  <Button size="sm" variant="outline" onClick={disable} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <BellOff />} Disable
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={enable} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Bell />} Enable
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <PrefRow
            label="Weekly digest"
            desc="Monday 08:00 (Porto): last-week spending, top items, WoW change, AI outlook."
            checked={!!prefs?.weekly_digest}
            onChange={(v) => toggle("weekly_digest", v)}
          />
          <PrefRow
            label="Baseline limit warnings"
            desc="Alert when the variable pool is at 80% and when it's fully consumed."
            checked={!!prefs?.baseline_warn}
            onChange={(v) => toggle("baseline_warn", v)}
          />
          <PrefRow
            label="Emergency pool warnings"
            desc="Alert when overspend starts eating the monthly surplus (80% & 100%)."
            checked={!!prefs?.emergency_warn}
            onChange={(v) => toggle("emergency_warn", v)}
          />
        </div>
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
