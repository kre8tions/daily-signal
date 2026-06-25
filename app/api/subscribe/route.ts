import { NextRequest, NextResponse } from "next/server";
import { put, head } from "@vercel/blob";

const BLOB_KEY = "subscribers.json";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  let emails: string[] = [];
  try {
    const existing = await head(BLOB_KEY);
    if (existing) {
      const res = await fetch(existing.url);
      emails = await res.json();
    }
  } catch {
    emails = [];
  }

  if (!emails.includes(normalized)) {
    emails.push(normalized);
    await put(BLOB_KEY, JSON.stringify(emails), { access: "public", addRandomSuffix: false });
  }

  return NextResponse.json({ ok: true });
}
