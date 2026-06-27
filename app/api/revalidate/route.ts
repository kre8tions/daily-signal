import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { cacheClearAll } from "@/lib/cache";
import { getEdition } from "@/lib/stories";

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = cacheClearAll();
  const { key: editionKey } = getEdition();
  revalidateTag(`edition-${editionKey}`);
  revalidatePath("/", "layout");
  return NextResponse.json({ cleared: true, filesRemoved: count, editionKey, at: new Date().toISOString() });
}
