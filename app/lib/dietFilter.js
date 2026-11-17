/**
 * app/lib/dietFilter.js
 *
 * Minimal, keyword-based guard that keeps foods which violate a user's diet out
 * of machine-generated suggestions (Coach's generate_meal_plan). It works on
 * food NAMES only, so it is deliberately conservative: when a keyword matches
 * we exclude the food. It cannot see hidden ingredients (onion in a dal tadka),
 * so it is a safety net, not a substitute for the model's own judgement — the
 * system prompt still treats dietary_pattern and allergies as hard rules.
 *
 * dietary_pattern keys come from HealthProfileFields: veg | eggetarian |
 * nonveg | vegan | jain. Allergy labels: Peanuts, Tree nuts, Dairy, Gluten,
 * Soy, Eggs, Shellfish, Fish.
 */

import { FOOD_CATEGORIES } from "../food-data";

const MEAT = [
  "chicken", "mutton", "lamb", "goat", "beef", "pork", "bacon", "ham", "sausage",
  "salami", "pepperoni", "turkey", "duck", "keema", "kheema", "nihari", "haleem",
  "seekh", "meat", "meatball", "fish", "prawn", "prawns", "shrimp",
  "crab", "lobster", "tuna", "salmon", "pomfret", "rohu", "surmai", "sardine",
  "mackerel", "squid", "oyster", "anchovy", "murgh", "gosht", "galouti", "shami",
  "rogan josh",
  // Dishes that are meat by default even though the name doesn't say so.
  "biryani (hyderabadi", "biryani (kolkata", "biryani (malabar", "sandwich (club",
  "club sandwich", "shawarma", "hot dog", "sushi", "caesar", "tacos", "taco",
  "quesadilla",
];
// Everything the food DB itself files under meat, by exact key.
const MEAT_KEYS = new Set(Object.keys(FOOD_CATEGORIES["Meat & Seafood"] || {}));
const meatPatterns = new Set(["veg", "vegetarian", "eggetarian", "vegan", "jain"]);
const EGG = ["egg", "eggs", "omelette", "omelet", "anda"];
const DAIRY = [
  "milk", "paneer", "curd", "yogurt", "yoghurt", "dahi", "ghee", "butter", "cheese",
  "cream", "lassi", "raita", "kheer", "khoya", "khova", "malai", "whey", "chaas",
  "buttermilk", "rabri", "rasgulla", "rasmalai", "kulfi", "ice cream", "milkshake",
  "shake", "latte", "cappuccino", "mawa", "shrikhand", "basundi", "custard",
];
const HONEY = ["honey"];
const JAIN_EXTRA = [
  "onion", "garlic", "potato", "potatoes", "aloo", "carrot", "carrots", "beetroot",
  "radish", "mooli", "ginger", "sweet potato", "shakarkandi", "pyaz", "lehsun",
  "arbi", "yam", "jimikand", "turnip",
  // Fungi are avoided in Jain diets too.
  "mushroom", "mushrooms",
  // Classic dishes built on potato/onion/garlic.
  "pav bhaji", "vada pav", "samosa", "misal", "masala dosa", "dosa (masala",
  "aloo paratha", "onion pakora", "chole bhature",
];
// Classic dishes made with butter/ghee/cream, for vegans.
const DAIRY_DISHES = ["pav bhaji", "butter chicken", "dal makhani", "malai kofta", "shahi paneer", "korma"];

const ALLERGENS = {
  peanuts: ["peanut", "peanuts", "groundnut", "moongphali", "chikki"],
  "tree nuts": ["almond", "almonds", "badam", "cashew", "cashews", "kaju", "walnut", "walnuts",
    "pistachio", "pistachios", "pista", "hazelnut", "pecan", "macadamia", "dry fruit", "dry fruits"],
  dairy: DAIRY,
  gluten: ["wheat", "atta", "maida", "roti", "chapati", "phulka", "naan", "paratha", "kulcha",
    "bhatura", "puri", "bread", "toast", "bun", "pav", "pasta", "noodles", "noodle", "pizza",
    "burger", "sandwich", "biscuit", "cookie", "cake", "brownie", "samosa", "kachori",
    "semolina", "suji", "rava", "upma", "barley", "rye", "dalia"],
  soy: ["soy", "soya", "tofu", "edamame", "tempeh"],
  eggs: EGG,
  shellfish: ["prawn", "prawns", "shrimp", "crab", "lobster", "oyster", "squid"],
  fish: ["fish", "tuna", "salmon", "pomfret", "rohu", "surmai", "sardine", "mackerel", "anchovy"],
};

// Whole-word / whole-phrase test so "egg" doesn't hit "eggplant" and "ham"
// doesn't hit "hummus".
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasTerm = (text, term) => new RegExp(`(^|[^a-z])${escape(term)}([^a-z]|$)`, "i").test(text);
const hasAny = (text, terms) => terms.some((t) => hasTerm(text, t));

// Significant words of a free-text "avoid" item ("sugary drinks" → [sugary, drinks]).
const sigWords = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);

/** Terms a food name must NOT contain for this diet pattern. */
export function forbiddenTermsForDiet(pattern) {
  switch (String(pattern || "").toLowerCase()) {
    case "veg":
    case "vegetarian":
      return [...MEAT, ...EGG];
    case "eggetarian":
      return MEAT;
    case "vegan":
      return [...MEAT, ...EGG, ...DAIRY, ...DAIRY_DISHES, ...HONEY];
    case "jain":
      return [...MEAT, ...EGG, ...JAIN_EXTRA];
    default:
      return []; // nonveg / unset: no restriction
  }
}

/**
 * Why a food is excluded for this profile, or null if it's allowed.
 *
 * @param {string} foodName  DB key, e.g. "paneer butter masala (1 bowl)"
 * @param {object} rules     { dietaryPattern, allergies[], mustAvoid[] }
 */
export function exclusionReason(foodName, { dietaryPattern, allergies = [], mustAvoid = [] } = {}) {
  const name = String(foodName || "").toLowerCase();
  if (!name) return "empty";

  const pattern = String(dietaryPattern || "").toLowerCase();
  if (meatPatterns.has(pattern) && MEAT_KEYS.has(name)) return `diet:${dietaryPattern}`;
  const dietTerms = forbiddenTermsForDiet(dietaryPattern);
  if (dietTerms.length && hasAny(name, dietTerms)) return `diet:${dietaryPattern}`;

  for (const allergy of allergies || []) {
    const terms = ALLERGENS[String(allergy).toLowerCase()] || [String(allergy).toLowerCase()];
    if (hasAny(name, terms)) return `allergy:${allergy}`;
  }

  // Medical "avoid" items are free text. Exclude only when EVERY significant
  // word of the item appears in the food name, so "white rice" excludes
  // "white rice (1 cup)" but not "brown rice".
  for (const avoid of mustAvoid || []) {
    const words = sigWords(avoid);
    if (words.length && words.every((w) => hasTerm(name, w) || hasTerm(name, w.replace(/s$/, "")))) {
      return `medical:${avoid}`;
    }
  }
  return null;
}

/** Filter [name, item] entries down to the ones allowed for this profile. */
export function filterFoodsForProfile(entries, rules) {
  return entries.filter(([name]) => exclusionReason(name, rules) === null);
}
