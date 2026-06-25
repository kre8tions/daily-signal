import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cacheClearAll } from "@/lib/cache";

export async function GET() {
  const count = cacheClearAll();
  revalidatePath("/", "layout"); // bust ISR cache for all pages
  return NextResponse.json({ cleared: true, filesRemoved: count, at: new Date().toISOString() });
}
