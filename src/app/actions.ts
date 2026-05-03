"use server";

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import {
  aggregateAndStoreShoppingList,
  getAllReports,
  getLatestDietaryProfiles,
  getMembers,
  getRecentWeeksMenu,
  getReportsByMember,
  insertHealthReport,
  query,
  saveWeek,
  setShoppingItemChecked,
  upsertDietaryProfile,
} from "@/lib/db";
import {
  deriveDietaryProfile,
  parseHealthReportFromFile,
  type HealthReportParsed,
} from "@/lib/health";
import {
  generateRecipe,
  generateWeekMenu,
  getDishCandidates,
} from "@/lib/menu-gen";
import { getPdfPageCount } from "@/lib/pdf";
import { type DayInput, type MemberRole } from "@/lib/shared";
import { DISH_SLOTS } from "@/lib/shared";

export async function saveWeekAction(weekId: string, days: DayInput[]) {
  await saveWeek(weekId, days);
  await aggregateAndStoreShoppingList(weekId, days);
  revalidatePath("/mama");
  revalidatePath("/naina");
  revalidatePath("/ayi");
  return { ok: true };
}

export async function toggleShoppingItemAction(
  listId: string,
  itemName: string,
  checked: boolean,
) {
  await setShoppingItemChecked(listId, itemName, checked);
  revalidatePath("/naina");
  return { ok: true };
}

export async function generateWeekAction(
  weekId: string,
  weekStart: string,
): Promise<{ ok: true; days: DayInput[] } | { ok: false; error: string }> {
  try {
    const [members, profiles] = await Promise.all([
      getMembers(),
      getLatestDietaryProfiles(),
    ]);
    const dietary = new Map(
      profiles.map((p) => [
        p.member_id,
        {
          tags: p.tags,
          recommend: p.recommend,
          avoid: p.avoid,
          rationale: p.rationale,
        },
      ]),
    );
    const startDate = new Date(weekStart);
    const recent = await getRecentWeeksMenu(startDate, 3);
    const recentDishes = Array.from(
      new Set(recent.flatMap((r) => r.dishes)),
    );
    const weekDates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const days = await generateWeekMenu({
      members,
      weekDates,
      recentDishes,
      dietary,
    });
    await saveWeek(weekId, days);
    await aggregateAndStoreShoppingList(weekId, days);
    revalidatePath("/mama");
    revalidatePath("/naina");
    revalidatePath("/ayi");
    return { ok: true, days };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getCandidatesAction(opts: {
  weekId: string;
  dayIdx: number;
  dishIdx: number;
  days: DayInput[];
}): Promise<
  | { ok: true; candidates: { name: string; ingredients: string; reason?: string }[] }
  | { ok: false; error: string }
> {
  try {
    const slot = DISH_SLOTS[opts.dishIdx];
    if (!slot) throw new Error("invalid dish index");
    const day = opts.days[opts.dayIdx];
    const currentName = day.dishes[opts.dishIdx].name;
    const todayOtherDishes = day.dishes
      .filter((_, i) => i !== opts.dishIdx)
      .map((d) => d.name);
    const weekOtherDishes = opts.days
      .flatMap((d, di) =>
        d.dishes.map((dish, dishi) =>
          di === opts.dayIdx && dishi === opts.dishIdx ? "" : dish.name,
        ),
      )
      .filter(Boolean);
    const [members, profiles] = await Promise.all([
      getMembers(),
      getLatestDietaryProfiles(),
    ]);
    const dietary = new Map(
      profiles.map((p) => [
        p.member_id,
        {
          tags: p.tags,
          recommend: p.recommend,
          avoid: p.avoid,
          rationale: p.rationale,
        },
      ]),
    );
    const candidates = await getDishCandidates({
      members,
      slot,
      currentName,
      todayOtherDishes,
      weekOtherDishes,
      dietary,
    });
    return { ok: true, candidates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ========== Health reports ==========

export interface ReportFileSummary {
  filename: string;
  size: number;
  pages: number;
  guessedRole: MemberRole | null;
  alreadyProcessed: boolean;
}

const ROLE_KEYWORDS: Array<[MemberRole, string[]]> = [
  ["yeye", ["爷爷"]],
  ["nainai", ["奶奶"]],
  ["mama", ["妈妈"]],
  ["baba", ["爸爸"]],
  ["baby", ["宝宝", "婴儿", "幼儿"]],
];

function guessRoleFromName(filename: string): MemberRole | null {
  for (const [role, keys] of ROLE_KEYWORDS) {
    if (keys.some((k) => filename.includes(k))) return role;
  }
  return null;
}

export async function listReportFilesAction(): Promise<ReportFileSummary[]> {
  const dir = process.env.HEALTH_REPORTS_DIR;
  if (!dir) return [];
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const pdfs = names.filter((n) => n.toLowerCase().endsWith(".pdf"));
  const allReports = await getAllReports();
  const processedPaths = new Set(allReports.map((r) => r.storage_path));
  const result: ReportFileSummary[] = [];
  for (const f of pdfs) {
    const fp = join(dir, f);
    const s = await stat(fp);
    const pages = await getPdfPageCount(fp).catch(() => 0);
    result.push({
      filename: f,
      size: s.size,
      pages,
      guessedRole: guessRoleFromName(f),
      alreadyProcessed: processedPaths.has(fp),
    });
  }
  return result;
}

export async function processReportAction(opts: {
  memberId: string;
  filename: string;
}): Promise<
  | { ok: true; abnormalCount: number; ocrUsed: boolean; profileTags: string[] }
  | { ok: false; error: string }
> {
  try {
    const dir = process.env.HEALTH_REPORTS_DIR;
    if (!dir) throw new Error("HEALTH_REPORTS_DIR not set");
    const filepath = join(dir, opts.filename);
    const members = await getMembers();
    const member = members.find((m) => m.id === opts.memberId);
    if (!member) throw new Error("member not found");

    const { extractPdfText } = await import("@/lib/pdf");
    const probeText = await extractPdfText(filepath);
    const ocrUsed = probeText === null;

    const parsed = await parseHealthReportFromFile(filepath, {
      name: member.name,
      age: member.age,
    });
    await insertHealthReport({
      memberId: opts.memberId,
      year: parsed.reportYear ?? null,
      storagePath: filepath,
      ocrUsed,
      parsed: parsed as unknown as Record<string, unknown>,
    });

    // Re-derive dietary profile from ALL reports for this member
    const reportRows = await getReportsByMember(opts.memberId);
    const allParsed: HealthReportParsed[] = reportRows
      .map((r) => r.parsed as unknown as HealthReportParsed)
      .filter(Boolean);
    const profile = await deriveDietaryProfile({
      member,
      reports: allParsed,
    });
    await upsertDietaryProfile({
      memberId: opts.memberId,
      tags: profile.tags,
      recommend: profile.recommend,
      avoid: profile.avoid,
      rationale: profile.rationale ?? null,
    });

    revalidatePath("/mama/reports");
    revalidatePath("/mama/family");
    return {
      ok: true,
      abnormalCount: parsed.abnormal_summary.length,
      ocrUsed,
      profileTags: profile.tags,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function generateRecipeAction(
  dishName: string,
  ingredients: string,
): Promise<
  { ok: true; steps: string; tips?: string }
  | { ok: false; error: string }
> {
  try {
    const existing = await query<{ steps: string; notes: string | null }>(
      "select steps, notes from recipes where name = $1 limit 1",
      [dishName],
    );
    if (existing[0]) {
      return {
        ok: true,
        steps: existing[0].steps,
        tips: existing[0].notes ?? undefined,
      };
    }
    const result = await generateRecipe({ dishName, ingredients });
    await query(
      `insert into recipes (name, ingredients, steps, tags, suitable_for, notes)
       values ($1, $2::jsonb, $3, $4, $5, $6)
       on conflict do nothing`,
      [
        dishName,
        JSON.stringify([]),
        result.steps,
        [],
        [],
        result.tips ?? null,
      ],
    );
    return { ok: true, steps: result.steps, tips: result.tips };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
