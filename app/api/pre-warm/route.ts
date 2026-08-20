import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { revalidateTag } from "next/cache";
import { buildPageData, getNextEdition, isDarkDay } from "@/lib/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runPreWarm(editionKey: string, editionLabel: string) {
  try {
    await buildPageData(editionKey, editionLabel);
    revalidateTag(`edition-${editionKey}`);
    console.log(`[pre-warm] ${editionKey} complete`);
  } catch (e) {
    console.error(`[pre-warm] ${editionKey} failed`, e);
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = new URL(req.url).searchParams.get("secret");
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = secret === process.env.CRON_SECRET;

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: editionKey, label: editionLabel } = getNextEdition();

  // Publishing runs six days a week. The crons stay daily and the skip happens here, because
  // the cron's UTC weekday and the edition's UTC+14 date are not the same day — filtering in
  // vercel.json would drop the wrong editions. A manual warm can still force a dark-day build.
  if (isDarkDay(editionKey) && !isManual) {
    console.log(`[pre-warm] ${editionKey} skipped — dark day`);
    return NextResponse.json({ skipped: "dark day", editionKey, at: new Date().toISOString() }, { status: 200 });
  }

  waitUntil(runPreWarm(editionKey, editionLabel));
  return NextResponse.json({ accepted: true, editionKey, at: new Date().toISOString() }, { status: 202 });
}
