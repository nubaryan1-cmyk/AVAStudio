import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    cwd: process.cwd(),
    hasURL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasANON: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    urlPreview: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").slice(0, 40),
    anonPreview: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0, 18),
  });
}
