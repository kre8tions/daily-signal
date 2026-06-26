import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { cacheClearAll } from "@/lib/cache";
import { getEdition } from "@/lib/stories";

export async function GET() {
  const count = cacheClearAll();
  const { key: editionKey } = getEdition();
  revalidateTag(`edition-${editionKey}`);
  revalidatePath("/", "layout");
  return NextResponse.json({ cleared: true, filesRemoved: count, editionKey, at: new Date().toISOString() });
}
