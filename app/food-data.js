// app/food-data.js

export const FOOD_CATEGORIES = {
  "Indian Breads (Roti/Paratha)": {
    "phulka (no oil)": { calories: 80, protein: 2.5, carbs: 17, fats: 0.5 }, // Standard 6-inch
    "chapati": { calories: 120, protein: 3, carbs: 18, fats: 4.5 },
    "tandoori roti": { calories: 110, protein: 3.5, carbs: 22, fats: 1 },
    "butter naan": { calories: 320, protein: 8, carbs: 48, fats: 12 },
    "garlic naan": { calories: 340, protein: 9, carbs: 48, fats: 14 },
    "plain paratha": { calories: 240, protein: 5, carbs: 28, fats: 12 }, // Pan-fried
    "aloo paratha": { calories: 340, protein: 7, carbs: 48, fats: 14 },
    "paneer paratha": { calories: 380, protein: 14, carbs: 38, fats: 18 },
    "gobi paratha": { calories: 290, protein: 6, carbs: 40, fats: 12 },
    "methi thepla": { calories: 210, protein: 5, carbs: 28, fats: 9 },
    "puri": { calories: 140, protein: 2, carbs: 16, fats: 8 }, // 1 medium piece
    "bhatura": { calories: 350, protein: 7, carbs: 50, fats: 15 }, // 1 large piece
    "missi roti": { calories: 140, protein: 5, carbs: 22, fats: 4 }, // Chickpea flour mix
    "rumali roti": { calories: 200, protein: 5, carbs: 35, fats: 4 },
  },

  "Rice & Biryani (Cooked)": {
    "white rice (1 bowl/150g)": { calories: 195, protein: 4, carbs: 42, fats: 0.5 },
    "brown rice (1 bowl/150g)": { calories: 170, protein: 3.8, carbs: 36, fats: 1.2 },
    "jeera rice": { calories: 220, protein: 4, carbs: 38, fats: 6 },
    "curd rice": { calories: 280, protein: 7, carbs: 35, fats: 12 },
    "khichdi": { calories: 240, protein: 8, carbs: 38, fats: 6 },
    "veg pulao": { calories: 230, protein: 5, carbs: 40, fats: 6 },
    "chicken biryani (standard plate)": { calories: 550, protein: 25, carbs: 65, fats: 22 },
    "mutton biryani (standard plate)": { calories: 650, protein: 28, carbs: 65, fats: 30 },
    "veg biryani": { calories: 350, protein: 8, carbs: 55, fats: 12 },
    "egg biryani": { calories: 400, protein: 14, carbs: 50, fats: 16 },
  },

  "Indian Curries (Veg - 1 Bowl/200g)": {
    "dal tadka": { calories: 280, protein: 10, carbs: 28, fats: 14 },
    "dal makhani": { calories: 400, protein: 11, carbs: 30, fats: 25 },
    "plain dal (boiled)": { calories: 120, protein: 8, carbs: 20, fats: 1 },
    "chole (chickpeas)": { calories: 320, protein: 14, carbs: 45, fats: 10 },
    "rajma masala": { calories: 300, protein: 13, carbs: 42, fats: 9 },
    "palak paneer": { calories: 340, protein: 18, carbs: 12, fats: 24 },
    "paneer butter masala": { calories: 450, protein: 16, carbs: 20, fats: 35 },
    "mattar paneer": { calories: 320, protein: 14, carbs: 18, fats: 20 },
    "kadai paneer": { calories: 360, protein: 18, carbs: 14, fats: 26 },
    "aloo gobi": { calories: 190, protein: 4, carbs: 28, fats: 8 },
    "bhindi fry": { calories: 180, protein: 4, carbs: 16, fats: 12 },
    "mix veg": { calories: 210, protein: 5, carbs: 18, fats: 14 },
    "baingan bharta": { calories: 160, protein: 3, carbs: 14, fats: 10 },
    "sambar": { calories: 130, protein: 5, carbs: 22, fats: 3 },
    "soya chaap curry": { calories: 350, protein: 18, carbs: 25, fats: 20 },
  },

  "Gym & Fitness Essentials": {
    "whey protein (1 scoop)": { calories: 120, protein: 24, carbs: 3, fats: 1.5 },
    "creatine monohydrate": { calories: 0, protein: 0, carbs: 0, fats: 0 },
    "egg whites (3 large)": { calories: 51, protein: 11, carbs: 0.6, fats: 0.2 },
    "whole egg (1 large)": { calories: 72, protein: 6, carbs: 0.6, fats: 5 },
    "chicken breast (100g cooked)": { calories: 165, protein: 31, carbs: 0, fats: 3.6 },
    "chicken breast (100g raw)": { calories: 120, protein: 23, carbs: 0, fats: 2.5 },
    "soya chunks (50g raw)": { calories: 170, protein: 26, carbs: 16, fats: 0.5 }, // High protein veg
    "paneer (100g raw)": { calories: 290, protein: 18, carbs: 1.2, fats: 24 }, // High fat veg
    "tofu (100g)": { calories: 144, protein: 16, carbs: 3, fats: 8 },
    "oats (50g raw)": { calories: 195, protein: 8, carbs: 33, fats: 3.5 },
    "peanut butter (1 tbsp)": { calories: 95, protein: 4, carbs: 3, fats: 8 },
    "sweet potato (100g boiled)": { calories: 86, protein: 1.6, carbs: 20, fats: 0.1 },
    "black coffee (pre-workout)": { calories: 2, protein: 0, carbs: 0, fats: 0 },
    "greek yogurt (100g)": { calories: 60, protein: 10, carbs: 3.6, fats: 0.4 },
    "quinoa (100g cooked)": { calories: 120, protein: 4.4, carbs: 21, fats: 1.9 },
  },

  "Non-Veg Specials": {
    "omelette (2 eggs + oil)": { calories: 210, protein: 13, carbs: 2, fats: 16 },
    "egg bhurji (2 eggs)": { calories: 250, protein: 14, carbs: 5, fats: 18 },
    "chicken curry (home style)": { calories: 300, protein: 22, carbs: 8, fats: 18 },
    "butter chicken": { calories: 550, protein: 26, carbs: 14, fats: 40 },
    "tandoori chicken (1 leg)": { calories: 280, protein: 28, carbs: 4, fats: 14 },
    "fish curry": { calories: 280, protein: 20, carbs: 8, fats: 16 },
    "fish fry (1 pc)": { calories: 220, protein: 18, carbs: 6, fats: 14 },
    "mutton curry": { calories: 450, protein: 26, carbs: 10, fats: 32 },
    "prawns masala": { calories: 300, protein: 24, carbs: 10, fats: 18 },
    "shawarma": { calories: 400, protein: 20, carbs: 35, fats: 20 },
  },

  "Indian Breakfast & Chaat": {
    "poha (1 plate)": { calories: 270, protein: 5, carbs: 48, fats: 9 },
    "upma": { calories: 250, protein: 6, carbs: 40, fats: 9 },
    "idli (1 pc)": { calories: 50, protein: 2, carbs: 10, fats: 0.1 },
    "medu vada (1 pc)": { calories: 160, protein: 4, carbs: 18, fats: 10 },
    "dosa (plain)": { calories: 180, protein: 4, carbs: 30, fats: 5 },
    "masala dosa": { calories: 400, protein: 8, carbs: 55, fats: 16 },
    "samosa (1 pc)": { calories: 260, protein: 4, carbs: 25, fats: 16 },
    "kachori (1 pc)": { calories: 200, protein: 3, carbs: 22, fats: 12 },
    "pani puri (6 pcs)": { calories: 180, protein: 3, carbs: 38, fats: 4 },
    "pav bhaji (2 pav + bhaji)": { calories: 650, protein: 14, carbs: 75, fats: 28 },
    "vada pav": { calories: 320, protein: 6, carbs: 48, fats: 14 },
    "dhokla (1 pc)": { calories: 80, protein: 3, carbs: 12, fats: 3 },
    "besan chilla": { calories: 220, protein: 10, carbs: 28, fats: 8 }, // Good veg protein
    "moong dal chilla": { calories: 200, protein: 12, carbs: 26, fats: 7 }, // Good veg protein
  },

  "Global & Fast Food": {
    "bread slice (white)": { calories: 80, protein: 2.5, carbs: 15, fats: 1 },
    "bread slice (whole wheat)": { calories: 90, protein: 4, carbs: 16, fats: 1 },
    "sandwich (veg grilled)": { calories: 320, protein: 8, carbs: 45, fats: 12 },
    "burger (mcchicken type)": { calories: 400, protein: 15, carbs: 45, fats: 20 },
    "pizza slice (cheese)": { calories: 300, protein: 12, carbs: 35, fats: 12 },
    "pasta (red sauce)": { calories: 350, protein: 9, carbs: 55, fats: 10 },
    "pasta (white sauce)": { calories: 500, protein: 14, carbs: 45, fats: 28 },
    "wrap/frankie (veg)": { calories: 350, protein: 8, carbs: 45, fats: 15 },
    "wrap/frankie (chicken)": { calories: 420, protein: 20, carbs: 40, fats: 18 },
    "french fries (medium)": { calories: 380, protein: 4, carbs: 48, fats: 19 },
    "maggi (1 pack)": { calories: 310, protein: 6, carbs: 42, fats: 13 },
  },

  "Fruits": {
    "apple (medium)": { calories: 95, protein: 0.5, carbs: 25, fats: 0.3 },
    "banana (medium)": { calories: 105, protein: 1.3, carbs: 27, fats: 0.3 },
    "orange": { calories: 62, protein: 1.2, carbs: 15, fats: 0.2 },
    "mango (1 medium)": { calories: 200, protein: 2.8, carbs: 50, fats: 1.2 },
    "grapes (1 cup)": { calories: 104, protein: 1.1, carbs: 27, fats: 0.2 },
    "watermelon (100g)": { calories: 30, protein: 0.6, carbs: 8, fats: 0.2 },
    "papaya (100g)": { calories: 43, protein: 0.5, carbs: 11, fats: 0.1 },
    "pomegranate (100g)": { calories: 83, protein: 1.7, carbs: 19, fats: 1.2 },
    "guava": { calories: 68, protein: 2.6, carbs: 14, fats: 1 },
  },

  "Dry Fruits, Nuts & Seeds (30g)": {
    "almonds (badam)": { calories: 170, protein: 6, carbs: 6, fats: 15 },
    "cashews (kaju)": { calories: 165, protein: 5, carbs: 9, fats: 13 },
    "walnuts (akhrot)": { calories: 190, protein: 4, carbs: 4, fats: 19 },
    "dates (3 pcs)": { calories: 80, protein: 0.5, carbs: 20, fats: 0 },
    "raisins (kishmish)": { calories: 90, protein: 1, carbs: 22, fats: 0 },
    "peanuts": { calories: 170, protein: 7, carbs: 6, fats: 14 },
    "chia seeds": { calories: 140, protein: 5, carbs: 12, fats: 9 },
    "flax seeds": { calories: 160, protein: 5, carbs: 8, fats: 12 },
  },

  "Dairy & Beverages": {
    "cow milk (1 cup/250ml)": { calories: 160, protein: 8, carbs: 12, fats: 9 },
    "buffalo milk (1 cup)": { calories: 240, protein: 9, carbs: 13, fats: 17 },
    "toned milk (1 cup)": { calories: 145, protein: 8, carbs: 12, fats: 7.5 },
    "curd (1 bowl)": { calories: 100, protein: 6, carbs: 8, fats: 6 },
    "masala chai": { calories: 110, protein: 2, carbs: 14, fats: 4 },
    "coffee (milk+sugar)": { calories: 120, protein: 3, carbs: 15, fats: 4 },
    "lassi (sweet)": { calories: 280, protein: 9, carbs: 40, fats: 10 },
    "buttermilk/chaas": { calories: 45, protein: 2, carbs: 4, fats: 1.5 },
    "coke (330ml can)": { calories: 140, protein: 0, carbs: 39, fats: 0 },
    "beer (1 pint/330ml)": { calories: 150, protein: 1, carbs: 13, fats: 0 },
    "whiskey/vodka (60ml)": { calories: 130, protein: 0, carbs: 0, fats: 0 },
    "coconut water": { calories: 45, protein: 1, carbs: 10, fats: 0 },
  },

  "Sweets & Desserts": {
    "gulab jamun (1 pc)": { calories: 150, protein: 2, carbs: 25, fats: 7 },
    "rasgulla (1 pc)": { calories: 100, protein: 2, carbs: 22, fats: 1 },
    "kheer (1 bowl)": { calories: 280, protein: 7, carbs: 38, fats: 12 },
    "besan ladoo": { calories: 220, protein: 4, carbs: 28, fats: 12 },
    "kaju katli": { calories: 130, protein: 2, carbs: 18, fats: 7 },
    "jalebi (100g)": { calories: 300, protein: 2, carbs: 55, fats: 12 },
    "ice cream (1 scoop)": { calories: 200, protein: 4, carbs: 25, fats: 11 },
    "chocolate bar (small)": { calories: 250, protein: 3, carbs: 30, fats: 14 },
  },
};

// Helper that flattens this for the backend search logic
export const FLATTENED_DB = {};
Object.values(FOOD_CATEGORIES).forEach((category) => {
  Object.assign(FLATTENED_DB, category);
});