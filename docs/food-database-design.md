# Food database redesign

Status: built 2026-11-21 (all phases). The app works before the SQL is run: it falls back to the bundled seed plus each user's old custom foods.

## Rollout (owner)
1. Run `docs/foods-schema.sql` in Supabase → SQL Editor.
2. Deploy.
3. Admin → Foods → Setup → **Load built-in foods** (copies `app/data/foods-seed.json` and links existing logs).
4. Setup → **Preview** the custom-food migration, then **Apply**.
5. Work through **Review** (merge or keep), then **Promote** and **Gaps** when useful.
6. Check `docs/food-gram-weights.csv` (rows marked `low`) and fix weights in Admin → Foods. Saving a food there marks it reviewed, and later seed refreshes leave it alone.

## Where things live
| Piece | File |
|---|---|
| Seed generator (names, weights, aliases, new foods) | `scripts/food-seed/` → `node scripts/food-seed/build.mjs` |
| Bundled catalog | `app/data/foods-seed.json` |
| Food + portion model, flat lookup for old code | `app/lib/foodModel.js` |
| One search and matcher | `app/lib/foodSearch.js` |
| Loading (table, cache, seed fallback, old custom foods) | `app/lib/foodCatalog.js` |
| Creating your own food | `app/lib/myFoods.js` |
| Admin API / page | `app/api/admin/foods/route.js`, `app/admin/foods/page.js` |


## Why

Measured on 2026-11-21:

- **The name is also the ID, and it includes the portion.** `chicken tikka (4 pcs)` is a food; `chicken tikka (100g)` would be another. Every new portion or variant becomes a new food.
- **Four sources are merged by name into one flat list:** 368 built-in foods (`app/food-data.js`), **651 custom foods from all 12 users** (Home loads everyone's; voice, photo and Coach load only the user's own), Open Food Facts web results, and free text from photo, voice and Coach.
- **Duplicates:** 147 custom foods are near-copies of built-in foods (`1 medium apple`, `boiled egg (2 eggs)`, `chicken tikka (150g)`), and 33 more groups are the same custom food spelled differently (`dal palak` / `palak dal (1 cup)`, `grilled paneer (100g|150g|200g)`). 133 custom names have a portion inside the name.
- **Unclear portions:** custom foods without a portion ("1 of what?"); web foods are per 100 g but saved without saying so.
- **Four matchers:** `LogFoodSheet` substring search, `voiceLog.matchFood` (voice and photo), `agentTools` (Coach), and an unused `/api/analyze` route.
- **Coverage:** of 4,384 logged items, 59% match a built-in food, 22% a custom food and **19% match nothing**. 144 built-in foods have never been logged.
- **Quality:** 3 built-in foods have calories that don't fit their macros; two custom foods share a name with more than 50% difference in calories; 2 custom foods have zero calories.

## Decisions

| Question | Decision |
|---|---|
| Custom foods | **Private to each user.** Popular, checked ones are promoted into the shared list by an admin. |
| Nutrition basis | **Per 100 g (or 100 ml)**, plus a gram weight for each portion. Any amount can be computed. |
| Existing duplicates | **Obvious ones merge automatically**; uncertain ones go to a review list. |
| Where the shared list lives | **Supabase table**, editable from Admin without a deploy. |

## Data model

```sql
foods
  id            uuid pk
  slug          text unique              -- "chicken-tikka" (built-in only)
  name          text                     -- "Chicken tikka" (display, no portion)
  family        text                     -- "Kebabs & tikka" (browse grouping; biryani variants share one)
  category      text                     -- today's 16 categories
  aliases       text[]                   -- "murgh tikka", Hindi/regional names, common misspellings
  basis         text  'g' | 'ml'
  kcal, protein, carbs, fat, fiber  numeric   -- per 100 g / 100 ml
  owner_id      uuid null                -- null = built-in (shared); set = a user's private food
  source        text  'builtin' | 'user' | 'web' | 'barcode' | 'ai'
  barcode       text null
  verified      boolean                  -- built-ins reviewed by an admin
  status        text  'active' | 'hidden' | 'merged'
  merged_into   uuid null                -- where a duplicate now points
  legacy_keys   text[]                   -- old names, e.g. "chicken tikka (4 pcs)", so history resolves
  created_at, updated_at

food_portions
  id, food_id → foods
  label         text     -- "1 pc", "1 bowl", "1 glass", "1 slice"
  grams         numeric  -- weight of that portion (ml for liquids)
  is_default    boolean
  sort          int

food_logs (existing) + food_id uuid null, portion text null, grams numeric null
  -- name and macro columns stay as a snapshot of what was logged, so history never changes
```

RLS: read built-in rows (`owner_id is null and status = 'active'`) or your own; insert, update and delete your own only. Built-in rows are written by the service role (admin tools, seed scripts).

Nutrition for a log = per-100 values × grams / 100, where grams = portion grams × amount, or grams typed directly.

## Search: one module everywhere

`app/lib/foodSearch.js` is used by the food sheet, voice, photo, Coach and barcode.

- **Normalise** the query and each name: lowercase, remove portion words (`1 bowl`, `150g`, `medium`), singular and plural, and common transliteration variants (aa→a, ee→i, oo→u, w→v, ph→f).
- **Rank:** exact name, then alias, then starts-with, then every word present. Your own foods come first when tied.
- **Return foods, not portions:** one row per food, then a portion picker (1 pc · 2 pcs · 100 g · custom grams).
- Keep the precision-first rules from `voiceLog.matchFood` (`water` must not match `watermelon`; ambiguous words stay unmatched), plus the `DEFAULT_FOR` defaults (`tea` → chai with sugar).

**Loading:** built-ins (~400–600 rows) are cached on the client with a version stamp (max `updated_at`) and refreshed when it changes; your own foods are fetched with your profile. Server routes keep an in-memory cache with a short expiry.

## Creating a food (My foods)

1. Typing a new name first shows **"Is it one of these?"** with close matches from search. Picking one adds a portion or alias instead of a new food.
2. A new food asks for nutrition in one of three ways: per 100 g, per portion with its weight, or "per 1 pc / 1 bowl" (the gram weight is estimated and editable).
3. Web and barcode foods are saved with `basis = g`, per-100 values and the pack size as a portion.
4. Coach's `save_food_to_database` and photo/voice "save as new" go through the same duplicate check.

## Migration

### Built-in list → `foods` + `food_portions`
1. A script parses today's keys: `base (variant, portion)` becomes a food. A variant that changes the dish (chicken or veg biryani) is a separate food in the same family; a size word (medium, slice) becomes a portion.
2. **Gram weights:** for each current serving, propose a weight (AI-assisted, using Indian food composition references), give it a confidence, and produce a CSV **for the owner to review**. Then per-100 values = serving values × 100 / grams. This is the largest task: about 368 servings.
3. Add aliases for regional names (`bhindi`, `palak`, `khajur` …), drawn partly from the 33 spelling clusters.
4. Store every old key in `legacy_keys`, so recents, saved meals, recipes and logs keep resolving.

### Custom foods → private `foods`
- **Auto-merge** when the cleaned-up name equals a built-in name or alias **and** calories per gram are within ±15%: the user's food is marked `merged_into` the built-in, and their logs are relinked by `food_id` with the name snapshot unchanged.
- **Same user, same food spelled differently** (the 33 clusters): merge into the most-logged one, keeping the other names as aliases.
- **Everything else** goes to a review list in Admin: merge, keep as private, or promote.
- Portions inside names (`grilled paneer (150g)`) become portions of one food.

### Logs
- Fill in `food_id` for existing logs by exact name, legacy key or merged food; leave the rest null (they still display from their snapshot).
- New logs always write `food_id`, `portion` and `grams`.

## Admin
- **Foods:** search, edit values, portions and aliases, hide or show.
- **Review list:** uncertain merges and the gram-weight review.
- **Promote:** most-logged private foods across users (counts only), promoted into a verified built-in food.
- **Gaps:** most-logged names that match nothing (counts only), each one a candidate new built-in food.

## Phases

| # | Phase | Database change |
|---|---|---|
| 0 | Quick wins: own custom foods only (matches voice, photo and Coach), web foods saved per 100 g, duplicate check on save, fix 3 calorie mismatches, delete `/api/analyze` | none |
| 1 | `foods` / `food_portions` tables + RLS, seed script, gram-weight review CSV, legacy keys | yes (SQL file) |
| 2 | `foodSearch` module + loader/cache; switch the sheet, voice, photo, Coach and barcode; portion picker UI | no |
| 3 | My foods: creation flow, migrate custom foods (auto-merge + review list), `food_logs.food_id` | yes |
| 4 | Admin: foods editor, review list, promotions, gaps | no |
| 5 | Fill gaps from unmatched logs; data-quality checks (calories vs macros) in the seed and editor | no |

Each phase ships on its own and keeps old data readable. The old `food-data.js` stays as a fallback until phase 2 is live.

## Risks
- **Gram weights are estimates** for home-cooked dishes; a "bowl" varies a lot. Show the weight on the portion ("1 bowl · 200 g") so users can adjust, and keep sources and confidence in the review CSV.
- **Offline / first load:** the cached client copy keeps search instant; the seed version stays bundled as a fallback.
- **The Supabase migration must be run by the owner** (MCP access is read-only).
