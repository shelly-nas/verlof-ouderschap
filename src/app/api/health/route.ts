import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "onbekend" },
      { status: 503 },
    );
  }
}
