import Link from "next/link";
import { requireOwner } from "@/lib/supabase/server";
import { Teleprompter } from "./teleprompter";

export default async function TeleprompterPage() {
  const supabase = await requireOwner();
  const { data: settings } = await supabase.from("settings").select("self_intro").single();

  if (!settings?.self_intro) {
    return (
      <p className="text-muted">
        Write your self-introduction in <Link href="/settings" className="text-accent hover:underline">Settings</Link> first.
      </p>
    );
  }
  return <Teleprompter script={settings.self_intro} />;
}
