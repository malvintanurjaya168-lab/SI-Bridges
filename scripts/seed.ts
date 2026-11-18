// Seeds the Supabase database with the demo dataset.
// Usage: npx tsx scripts/seed.ts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildDemoState } from "../src/lib/demo-data";
import {
  alertToRow,
  deliveryToRow,
  detectionToRow,
  facilityToRow,
  taskToRow,
  truckToRow,
} from "../src/lib/supabase-mappers";

async function main() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env vars in .env.local");

  const supabase = createClient(url, anon);

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@gmail.com",
    password: "12345678",
  });
  if (authErr) throw new Error(`Login failed: ${authErr.message}`);
  const userId = auth.user!.id;
  console.log("Signed in as", auth.user!.email);

  const state = buildDemoState();
  console.log(
    `Generated: ${state.detections.length} detections, ${state.trucks.length} trucks, ` +
      `${state.tasks.length} tasks, ${state.facilities.length} facilities, ` +
      `${state.deliveries.length} deliveries, ${state.alerts.length} alerts`
  );

  async function upsert(table: string, rows: object[]) {
    if (!rows.length) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ${table}: ${rows.length} rows`);
  }

  await upsert("detections", state.detections.map((d) => detectionToRow(d)));
  await upsert("trucks", state.trucks.map(truckToRow));
  await upsert("facilities", state.facilities.map(facilityToRow));
  await upsert("cleaning_tasks", state.tasks.map((t) => ({ ...taskToRow(t), created_by: userId })));
  await upsert("deliveries", state.deliveries.map(deliveryToRow));
  await upsert("alerts", state.alerts.map(alertToRow));

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
