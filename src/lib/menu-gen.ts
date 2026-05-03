import "server-only";
import { z } from "zod";
import { chatJson, MODELS } from "@/lib/ai-server";
import {
  buildCandidatesPrompt,
  buildNutritionPrompt,
  buildRecipePrompt,
  buildSubstitutePrompt,
  buildWeekPrompt,
  SYSTEM_NUTRITIONIST,
  type DietaryProfileForPrompt,
} from "@/lib/prompts";
import {
  DISH_SLOTS,
  type DayInput,
  type MemberRow,
} from "@/lib/shared";

const DishOutputSchema = z.object({
  slot: z.enum(DISH_SLOTS),
  name: z.string().min(1),
  ingredients: z.string(),
  reason: z.string().optional(),
});

const WeekOutputSchema = z.object({
  days: z.array(
    z.object({
      date: z.string(),
      dishes: z.array(DishOutputSchema).length(DISH_SLOTS.length),
    }),
  ),
});

const CandidatesOutputSchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string().min(1),
        ingredients: z.string(),
        reason: z.string().optional(),
      }),
    )
    .min(2)
    .max(5),
});

const RecipeOutputSchema = z.object({
  steps: z.string().min(1),
  tips: z.string().optional(),
});

export async function generateWeekMenu(opts: {
  members: MemberRow[];
  weekDates: string[];
  recentDishes: string[];
  dietary?: Map<string, DietaryProfileForPrompt>;
}): Promise<DayInput[]> {
  const raw = await chatJson<unknown>({
    model: MODELS.primary,
    system: SYSTEM_NUTRITIONIST,
    user: buildWeekPrompt(opts),
  });
  const parsed = WeekOutputSchema.parse(raw);
  if (parsed.days.length !== opts.weekDates.length) {
    throw new Error(
      `AI returned ${parsed.days.length} days, expected ${opts.weekDates.length}`,
    );
  }
  return parsed.days.map((d, i) => ({
    date: opts.weekDates[i],
    dishes: DISH_SLOTS.map((slot) => {
      const found = d.dishes.find((x) => x.slot === slot);
      return {
        name: found?.name ?? "",
        ingredients: found?.ingredients ?? "",
      };
    }),
  }));
}

export async function getDishCandidates(opts: {
  members: MemberRow[];
  slot: (typeof DISH_SLOTS)[number];
  currentName: string;
  todayOtherDishes: string[];
  weekOtherDishes: string[];
  dietary?: Map<string, DietaryProfileForPrompt>;
}) {
  const raw = await chatJson<unknown>({
    model: MODELS.primary,
    system: SYSTEM_NUTRITIONIST,
    user: buildCandidatesPrompt(opts),
  });
  const parsed = CandidatesOutputSchema.parse(raw);
  return parsed.candidates.slice(0, 3);
}

const NutritionLevelSchema = z.enum([
  "充足",
  "基本满足",
  "略不足",
  "明显不足",
  "偏高",
]);

const NutritionAnalysisSchema = z.object({
  overall: z.string(),
  metrics: z
    .array(
      z.object({
        name: z.string(),
        level: NutritionLevelSchema,
        note: z.string(),
      }),
    )
    .min(5)
    .max(10),
  perMember: z
    .array(
      z.object({
        name: z.string(),
        comment: z.string(),
      }),
    )
    .min(3)
    .max(6),
  improvements: z.array(z.string()).min(1).max(6),
});
export type NutritionAnalysis = z.infer<typeof NutritionAnalysisSchema>;

export async function analyzeWeekNutrition(opts: {
  members: MemberRow[];
  days: { date: string; dishes: { name: string; ingredients: string }[] }[];
  dietary?: Map<string, DietaryProfileForPrompt>;
}): Promise<NutritionAnalysis> {
  const raw = await chatJson<unknown>({
    model: MODELS.primary,
    system: SYSTEM_NUTRITIONIST,
    user: buildNutritionPrompt(opts),
  });
  return NutritionAnalysisSchema.parse(raw);
}

const SubstitutesSchema = z.object({
  substitutes: z
    .array(
      z.object({
        name: z.string(),
        howto: z.string(),
        tradeoff: z.string().optional(),
      }),
    )
    .min(2)
    .max(5),
});
export type Substitutes = z.infer<typeof SubstitutesSchema>;

export async function getIngredientSubstitutes(opts: {
  ingredient: string;
  dishName: string;
  members: MemberRow[];
}): Promise<Substitutes["substitutes"]> {
  const raw = await chatJson<unknown>({
    model: MODELS.cheap,
    system: SYSTEM_NUTRITIONIST,
    user: buildSubstitutePrompt(opts),
  });
  const parsed = SubstitutesSchema.parse(raw);
  return parsed.substitutes.slice(0, 3);
}

export async function generateRecipe(opts: {
  dishName: string;
  ingredients: string;
}) {
  const raw = await chatJson<unknown>({
    model: MODELS.cheap,
    system: SYSTEM_NUTRITIONIST,
    user: buildRecipePrompt(opts),
  });
  return RecipeOutputSchema.parse(raw);
}
