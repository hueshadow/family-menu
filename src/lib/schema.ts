import { z } from "zod";

export const FamilyMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.enum(["yeye", "nainai", "baba", "mama", "baby"]),
  age: z.number().int().min(0).max(120),
  profile: z.object({
    healthFlags: z.array(z.string()).default([]),
    allergies: z.array(z.string()).default([]),
    intolerances: z.array(z.string()).default([]),
    goals: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }),
});
export type FamilyMember = z.infer<typeof FamilyMemberSchema>;

export const HealthReportSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  year: z.number().int(),
  storagePath: z.string(),
  ocrUsed: z.boolean(),
  parsed: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type HealthReport = z.infer<typeof HealthReportSchema>;

export const DietaryProfileSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  version: z.number().int(),
  tags: z.array(z.string()),
  recommend: z.array(z.string()),
  avoid: z.array(z.string()),
  rationale: z.string().optional(),
  generatedAt: z.string().datetime(),
});
export type DietaryProfile = z.infer<typeof DietaryProfileSchema>;

export const IngredientSchema = z.object({
  name: z.string(),
  qty: z.number().nonnegative(),
  unit: z.string(),
  category: z.enum([
    "protein",
    "vegetable",
    "fruit",
    "dairy",
    "grain",
    "seasoning",
    "other",
  ]),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

export const RecipeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ingredients: z.array(IngredientSchema),
  steps: z.string(),
  tags: z.array(z.string()),
  suitableFor: z.array(z.string()),
  notes: z.string().optional(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const DishRefSchema = z.object({
  recipeId: z.string().uuid(),
  name: z.string(),
  reason: z.string().optional(),
});

export const DISH_SLOTS = [
  "主荤",
  "副荤",
  "蔬菜",
  "凉菜",
  "汤",
] as const;
export const DISHES_PER_DAY = DISH_SLOTS.length;

export const DaySchema = z.object({
  date: z.string(),
  style: z.string().optional(),
  dishes: z.array(DishRefSchema).length(DISHES_PER_DAY),
});

export const WeeklyMenuSchema = z.object({
  id: z.string().uuid(),
  weekStart: z.string(),
  status: z.enum(["draft", "reviewing", "locked", "archived"]),
  days: z.array(DaySchema),
  lockedAt: z.string().datetime().nullable(),
});
export type WeeklyMenu = z.infer<typeof WeeklyMenuSchema>;

export const ShoppingItemSchema = IngredientSchema.extend({
  checked: z.boolean().default(false),
  forMember: z.string().optional(),
});

export const ShoppingListSchema = z.object({
  id: z.string().uuid(),
  weekId: z.string().uuid(),
  items: z.array(ShoppingItemSchema),
});
export type ShoppingList = z.infer<typeof ShoppingListSchema>;
