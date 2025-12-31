// app/food-data.js

export const FOOD_CATEGORIES = {
  "Indian Breads (Roti/Paratha)": {
    "roti": { calories: 120, protein: 3, carbs: 18, fats: 3.5 },
    "chapati": { calories: 120, protein: 3, carbs: 18, fats: 3.5 },
    "phulka": { calories: 80, protein: 2, carbs: 15, fats: 1 },
    "plain paratha": { calories: 220, protein: 5, carbs: 25, fats: 12 },
    "aloo paratha": { calories: 320, protein: 7, carbs: 45, fats: 12 },
    "paneer paratha": { calories: 350, protein: 12, carbs: 35, fats: 16 },
    "gobi paratha": { calories: 290, protein: 6, carbs: 38, fats: 12 },
    "methi thepla": { calories: 200, protein: 5, carbs: 25, fats: 10 },
    "naan": { calories: 260, protein: 9, carbs: 45, fats: 5 },
    "butter naan": { calories: 320, protein: 9, carbs: 45, fats: 12 },
    "garlic naan": { calories: 330, protein: 9, carbs: 46, fats: 12 },
    "puri": { calories: 140, protein: 2, carbs: 15, fats: 8 }, // 1 piece
    "bhatura": { calories: 280, protein: 6, carbs: 40, fats: 12 }, // 1 piece
  },

  "Rice & Biryani": {
    "white rice": { calories: 130, protein: 2.7, carbs: 28, fats: 0.3 }, // 1 bowl cooked
    "brown rice": { calories: 111, protein: 2.6, carbs: 23, fats: 0.9 },
    "jeera rice": { calories: 180, protein: 3, carbs: 30, fats: 5 },
    "curd rice": { calories: 250, protein: 6, carbs: 35, fats: 10 },
    "khichdi": { calories: 250, protein: 8, carbs: 35, fats: 8 },
    "veg pulao": { calories: 200, protein: 4, carbs: 35, fats: 6 },
    "chicken biryani": { calories: 400, protein: 20, carbs: 45, fats: 15 },
    "mutton biryani": { calories: 450, protein: 22, carbs: 45, fats: 20 },
    "veg biryani": { calories: 300, protein: 8, carbs: 45, fats: 10 },
    "egg biryani": { calories: 350, protein: 12, carbs: 40, fats: 12 },
  },

  "Indian Curries (Veg)": {
    "dal tadka": { calories: 250, protein: 12, carbs: 28, fats: 10 },
    "dal makhani": { calories: 350, protein: 10, carbs: 30, fats: 20 },
    "dal fry": { calories: 220, protein: 10, carbs: 25, fats: 8 },
    "chole": { calories: 280, protein: 14, carbs: 35, fats: 8 },
    "rajma": { calories: 300, protein: 14, carbs: 40, fats: 9 },
    "palak paneer": { calories: 320, protein: 18, carbs: 10, fats: 25 },
    "paneer butter masala": { calories: 400, protein: 16, carbs: 15, fats: 30 },
    "mattar paneer": { calories: 350, protein: 16, carbs: 15, fats: 22 },
    "kadai paneer": { calories: 380, protein: 18, carbs: 12, fats: 28 },
    "aloo gobi": { calories: 180, protein: 4, carbs: 25, fats: 8 },
    "bhindi fry": { calories: 160, protein: 4, carbs: 14, fats: 10 },
    "mix veg": { calories: 200, protein: 5, carbs: 15, fats: 12 },
    "baingan bharta": { calories: 150, protein: 3, carbs: 12, fats: 10 },
    "sambar": { calories: 150, protein: 6, carbs: 25, fats: 2 },
  },

  "Non-Veg & Eggs": {
    "boiled egg": { calories: 78, protein: 6, carbs: 0.6, fats: 5 },
    "omelette": { calories: 160, protein: 13, carbs: 1, fats: 12 }, // 2 egg
    "scrambled eggs": { calories: 180, protein: 13, carbs: 2, fats: 14 },
    "egg bhurji": { calories: 200, protein: 14, carbs: 4, fats: 16 },
    "egg curry": { calories: 250, protein: 14, carbs: 8, fats: 18 },
    "chicken curry": { calories: 350, protein: 25, carbs: 8, fats: 22 },
    "butter chicken": { calories: 490, protein: 28, carbs: 12, fats: 35 },
    "tandoori chicken": { calories: 260, protein: 30, carbs: 5, fats: 13 }, // 1 leg piece
    "chicken breast": { calories: 165, protein: 31, carbs: 0, fats: 3.6 }, // 100g
    "fish curry": { calories: 300, protein: 22, carbs: 8, fats: 20 },
    "fish fry": { calories: 350, protein: 25, carbs: 10, fats: 25 },
    "mutton curry": { calories: 400, protein: 28, carbs: 10, fats: 30 },
    "grilled chicken": { calories: 200, protein: 30, carbs: 0, fats: 8 },
  },

  "Indian Breakfast & Snacks": {
    "poha": { calories: 250, protein: 5, carbs: 45, fats: 8 }, // 1 plate
    "upma": { calories: 250, protein: 6, carbs: 40, fats: 9 },
    "idli": { calories: 60, protein: 2, carbs: 12, fats: 0 }, // 1 piece
    "dosa (plain)": { calories: 170, protein: 4, carbs: 29, fats: 4 },
    "masala dosa": { calories: 350, protein: 8, carbs: 45, fats: 15 },
    "vada": { calories: 140, protein: 4, carbs: 15, fats: 9 }, // 1 piece
    "samosa": { calories: 260, protein: 4, carbs: 24, fats: 17 }, // 1 piece
    "kachori": { calories: 180, protein: 3, carbs: 20, fats: 10 },
    "pakora": { calories: 75, protein: 2, carbs: 8, fats: 5 }, // 1 piece
    "pav bhaji": { calories: 600, protein: 15, carbs: 70, fats: 25 }, // 2 pav + bhaji
    "vada pav": { calories: 300, protein: 6, carbs: 45, fats: 12 },
    "dhokla": { calories: 80, protein: 3, carbs: 10, fats: 3 }, // 1 piece
    "maggi": { calories: 310, protein: 6, carbs: 45, fats: 12 }, // 1 pack
    "momos": { calories: 40, protein: 2, carbs: 6, fats: 1 }, // 1 piece
  },

  "Western & Global": {
    "bread slice": { calories: 80, protein: 3, carbs: 15, fats: 1 },
    "toast with butter": { calories: 120, protein: 3, carbs: 15, fats: 6 },
    "oats": { calories: 150, protein: 5, carbs: 27, fats: 3 }, // cooked
    "cereal/cornflakes": { calories: 120, protein: 4, carbs: 24, fats: 2 },
    "pancake": { calories: 100, protein: 3, carbs: 15, fats: 4 }, // 1 piece
    "sandwich": { calories: 300, protein: 10, carbs: 35, fats: 12 },
    "burger": { calories: 450, protein: 20, carbs: 45, fats: 22 },
    "pizza slice": { calories: 285, protein: 12, carbs: 36, fats: 10 },
    "pasta (red sauce)": { calories: 300, protein: 8, carbs: 50, fats: 8 },
    "pasta (white sauce)": { calories: 450, protein: 12, carbs: 45, fats: 25 },
    "wrap": { calories: 350, protein: 15, carbs: 35, fats: 15 },
    "salad (caesar)": { calories: 200, protein: 10, carbs: 10, fats: 15 },
    "french fries": { calories: 365, protein: 4, carbs: 48, fats: 17 }, // medium
  },

  Fruits: {
    "apple": { calories: 95, protein: 0.5, carbs: 25, fats: 0.3 },
    "banana": { calories: 105, protein: 1.3, carbs: 27, fats: 0.3 },
    "orange": { calories: 62, protein: 1.2, carbs: 15, fats: 0.2 },
    "mango": { calories: 200, protein: 2.8, carbs: 50, fats: 1.2 },
    "grapes": { calories: 70, protein: 0.7, carbs: 18, fats: 0.2 }, // 100g
    "watermelon": { calories: 30, protein: 0.6, carbs: 8, fats: 0.2 }, // 100g
    "papaya": { calories: 43, protein: 0.5, carbs: 11, fats: 0.1 },
    "pomegranate": { calories: 83, protein: 1.7, carbs: 19, fats: 1.2 },
    "guava": { calories: 68, protein: 2.6, carbs: 14, fats: 1 },
    "pineapple": { calories: 50, protein: 0.5, carbs: 13, fats: 0.1 },
  },

  "Dry Fruits & Nuts (30g)": {
    "almonds": { calories: 170, protein: 6, carbs: 6, fats: 15 },
    "cashews": { calories: 165, protein: 5, carbs: 9, fats: 13 },
    "walnuts": { calories: 190, protein: 4, carbs: 4, fats: 19 },
    "dates": { calories: 80, protein: 0.5, carbs: 20, fats: 0 }, // 3 pieces
    "raisins": { calories: 90, protein: 1, carbs: 22, fats: 0 },
    "peanuts": { calories: 170, protein: 7, carbs: 6, fats: 14 },
    "pistachios": { calories: 160, protein: 6, carbs: 8, fats: 13 },
  },

  "Dairy & Beverages": {
    "milk (1 cup)": { calories: 150, protein: 8, carbs: 12, fats: 8 },
    "curd/yogurt": { calories: 100, protein: 6, carbs: 8, fats: 6 }, // 1 bowl
    "chai (with sugar)": { calories: 100, protein: 2, carbs: 14, fats: 3 },
    "coffee (milk+sugar)": { calories: 120, protein: 3, carbs: 15, fats: 4 },
    "black coffee": { calories: 5, protein: 0, carbs: 0, fats: 0 },
    "green tea": { calories: 2, protein: 0, carbs: 0, fats: 0 },
    "lassi (sweet)": { calories: 280, protein: 8, carbs: 35, fats: 12 },
    "buttermilk/chaas": { calories: 40, protein: 2, carbs: 3, fats: 1 },
    "coke/soft drink": { calories: 140, protein: 0, carbs: 39, fats: 0 }, // 1 can
    "beer": { calories: 150, protein: 1, carbs: 13, fats: 0 }, // 1 pint
    "whiskey/vodka": { calories: 65, protein: 0, carbs: 0, fats: 0 }, // 30ml
    "fruit juice": { calories: 120, protein: 1, carbs: 28, fats: 0 },
  },

  "Sweets & Desserts": {
    "gulab jamun": { calories: 150, protein: 2, carbs: 25, fats: 6 }, // 1 piece
    "rasgulla": { calories: 100, protein: 2, carbs: 20, fats: 1 }, // 1 piece
    "kheer": { calories: 250, protein: 6, carbs: 35, fats: 10 },
    "ice cream scoop": { calories: 200, protein: 4, carbs: 25, fats: 10 },
    "chocolate bar": { calories: 270, protein: 4, carbs: 30, fats: 15 }, // small bar
    "cake slice": { calories: 350, protein: 4, carbs: 50, fats: 15 },
    "biscuit/cookie": { calories: 50, protein: 0.5, carbs: 7, fats: 2 }, // 1 piece
  },
};

// Helper that flattens this for the backend search logic
export const FLATTENED_DB = {};
Object.values(FOOD_CATEGORIES).forEach((category) => {
  Object.assign(FLATTENED_DB, category);
});
