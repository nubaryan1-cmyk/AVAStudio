import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    cwd: process.cwd(),
    hasURL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasANON: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    urlPreview: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").slice(0, 40),
    anonPreview: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0, 18),
  });
}
