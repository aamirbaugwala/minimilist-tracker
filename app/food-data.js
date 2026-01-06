// app/food-data.js

export const FOOD_CATEGORIES = {
  "World Famous Foods": {
    "french fries (medium)": { calories: 365, protein: 4, carbs: 48, fats: 17, fiber: 3.8 },
    "burger (veg)": { calories: 350, protein: 9, carbs: 50, fats: 14, fiber: 4.5 },
    "burger (chicken)": { calories: 450, protein: 22, carbs: 45, fats: 20, fiber: 2.0 },
    "burger (cheese)": { calories: 500, protein: 24, carbs: 40, fats: 28, fiber: 2.0 },
    "pizza (margherita, 1 slice)": { calories: 250, protein: 10, carbs: 32, fats: 10, fiber: 1.5 },
    "pizza (veggie, 1 slice)": { calories: 280, protein: 11, carbs: 34, fats: 11, fiber: 2.5 },
    "pizza (pepperoni, 1 slice)": { calories: 320, protein: 13, carbs: 32, fats: 16, fiber: 1.5 },
    "pasta (white sauce, 1 cup)": { calories: 450, protein: 12, carbs: 55, fats: 22, fiber: 2.0 },
    "pasta (red sauce, 1 cup)": { calories: 320, protein: 9, carbs: 60, fats: 8, fiber: 4.0 }, // Higher due to tomato sauce
    "noodles (instant, 1 pack)": { calories: 380, protein: 8, carbs: 54, fats: 14, fiber: 2.0 },
    "hot dog": { calories: 290, protein: 10, carbs: 24, fats: 18, fiber: 1.0 },
    "falafel wrap": { calories: 450, protein: 14, carbs: 55, fats: 18, fiber: 8.0 }, // Chickpeas are high fiber
    "shawarma roll": { calories: 500, protein: 25, carbs: 45, fats: 22, fiber: 2.5 },
    "sushi (6 pcs)": { calories: 300, protein: 12, carbs: 55, fats: 4, fiber: 1.5 },
    "caesar salad": { calories: 350, protein: 10, carbs: 12, fats: 28, fiber: 2.5 },
    "greek salad": { calories: 200, protein: 6, carbs: 10, fats: 15, fiber: 3.0 },
    "tacos (2 pcs)": { calories: 350, protein: 16, carbs: 36, fats: 16, fiber: 4.0 },
    "quesadilla (1 pc)": { calories: 320, protein: 14, carbs: 32, fats: 16, fiber: 2.5 },
    "hummus & pita": { calories: 350, protein: 10, carbs: 50, fats: 12, fiber: 6.5 },
    "fish & chips": { calories: 700, protein: 25, carbs: 75, fats: 35, fiber: 3.0 },
    croissant: { calories: 270, protein: 5, carbs: 31, fats: 14, fiber: 1.5 },
    waffle: { calories: 300, protein: 6, carbs: 45, fats: 12, fiber: 1.0 },
    pancake: { calories: 150, protein: 4, carbs: 25, fats: 5, fiber: 0.8 },
    donut: { calories: 300, protein: 4, carbs: 35, fats: 16, fiber: 1.0 },
    "ice cream cone": { calories: 220, protein: 4, carbs: 32, fats: 9, fiber: 0.5 },
  },

  Vegetables: {
    "carrot (1 medium)": { calories: 25, protein: 0.6, carbs: 6, fats: 0.1, fiber: 1.7 },
    "cucumber (1 medium)": { calories: 16, protein: 0.7, carbs: 3.8, fats: 0.1, fiber: 0.5 },
    "tomato (1 medium)": { calories: 22, protein: 1.1, carbs: 4.8, fats: 0.2, fiber: 1.5 },
    "beetroot (1 medium)": { calories: 35, protein: 1.3, carbs: 8, fats: 0.1, fiber: 2.8 },
    "radish (1 medium)": { calories: 16, protein: 0.7, carbs: 3.4, fats: 0.1, fiber: 1.6 },
    "capsicum (1 medium)": { calories: 24, protein: 1, carbs: 6, fats: 0.2, fiber: 2.0 },
    "broccoli (100g)": { calories: 34, protein: 2.8, carbs: 7, fats: 0.4, fiber: 2.6 },
    "cauliflower (100g)": { calories: 25, protein: 2, carbs: 5, fats: 0.3, fiber: 2.0 },
    "spinach (100g)": { calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, fiber: 2.2 },
    "lettuce (100g)": { calories: 15, protein: 1.4, carbs: 2.9, fats: 0.2, fiber: 1.3 },
    "brinjal (100g)": { calories: 25, protein: 1, carbs: 6, fats: 0.2, fiber: 3.0 },
    "pumpkin (100g)": { calories: 26, protein: 1, carbs: 6.5, fats: 0.1, fiber: 0.5 },
    "sweet potato (100g)": { calories: 86, protein: 1.6, carbs: 20, fats: 0.1, fiber: 3.0 },
    "peas (50g)": { calories: 42, protein: 2.7, carbs: 7.5, fats: 0.2, fiber: 2.8 },
    "okra (100g)": { calories: 33, protein: 2, carbs: 7, fats: 0.2, fiber: 3.2 },
    "mushroom (100g)": { calories: 22, protein: 3.1, carbs: 3.3, fats: 0.3, fiber: 1.0 },
    "zucchini (100g)": { calories: 17, protein: 1.2, carbs: 3.1, fats: 0.3, fiber: 1.0 },
    "asparagus (100g)": { calories: 20, protein: 2.2, carbs: 3.9, fats: 0.1, fiber: 2.1 },
    "avocado (1/2)": { calories: 160, protein: 2, carbs: 8.5, fats: 15, fiber: 6.7 },
    "corn (1/2 cob)": { calories: 60, protein: 2, carbs: 14, fats: 0.5, fiber: 2.0 },
    "turnip (1 medium)": { calories: 34, protein: 1, carbs: 8, fats: 0.1, fiber: 2.2 },
    "cabbage (100g)": { calories: 25, protein: 1.3, carbs: 6, fats: 0.1, fiber: 2.5 },
    "onion (1 medium)": { calories: 44, protein: 1.2, carbs: 10, fats: 0.1, fiber: 1.9 },
    "potato (1 medium)": { calories: 110, protein: 3, carbs: 26, fats: 0.1, fiber: 2.2 },
    "garlic (5 cloves)": { calories: 22, protein: 1, carbs: 5, fats: 0, fiber: 0.3 },
    "ginger (1 inch)": { calories: 5, protein: 0.1, carbs: 1, fats: 0, fiber: 0.2 },
  },

  FruitsExtra: {
    "black grapes (10 pcs)": { calories: 35, protein: 0.3, carbs: 9, fats: 0.1, fiber: 0.4 },
    "green grapes (10 pcs)": { calories: 34, protein: 0.3, carbs: 9, fats: 0.1, fiber: 0.4 },
    "raspberry (10 pcs)": { calories: 10, protein: 0.2, carbs: 2.3, fats: 0.1, fiber: 1.2 },
    "cranberry (10 pcs)": { calories: 5, protein: 0, carbs: 1.2, fats: 0, fiber: 0.5 },
    "gooseberry (amla, 1 pc)": { calories: 20, protein: 0.5, carbs: 5, fats: 0, fiber: 3.4 },
    "jackfruit (1 cup)": { calories: 155, protein: 2.4, carbs: 40, fats: 0.5, fiber: 2.5 },
    "sapota (chikoo, 1 pc)": { calories: 83, protein: 0.4, carbs: 20, fats: 1, fiber: 5.3 },
    "starfruit (1 pc)": { calories: 28, protein: 0.9, carbs: 6, fats: 0.3, fiber: 2.8 },
    "dragon fruit (100g)": { calories: 60, protein: 1.2, carbs: 13, fats: 0, fiber: 2.9 },
    "passion fruit (1 pc)": { calories: 17, protein: 0.4, carbs: 4, fats: 0.1, fiber: 1.9 },
    "persimmon (1 pc)": { calories: 118, protein: 1, carbs: 31, fats: 0.3, fiber: 6.0 },
    "longan (10 pcs)": { calories: 17, protein: 0.3, carbs: 4, fats: 0, fiber: 0.2 },
    "mulberry (10 pcs)": { calories: 8, protein: 0.2, carbs: 2, fats: 0, fiber: 0.7 },
    "tamarind (10g)": { calories: 24, protein: 0.3, carbs: 6, fats: 0, fiber: 0.5 },
    "fig (1 pc)": { calories: 37, protein: 0.3, carbs: 10, fats: 0.2, fiber: 1.4 },
    "date (1 pc)": { calories: 23, protein: 0.2, carbs: 6, fats: 0, fiber: 1.6 },
    "apricot (1 pc)": { calories: 17, protein: 0.5, carbs: 3.9, fats: 0.1, fiber: 0.7 },
    "pear (1 pc)": { calories: 100, protein: 0.6, carbs: 27, fats: 0.2, fiber: 5.5 },
    "plum (1 pc)": { calories: 30, protein: 0.5, carbs: 7.5, fats: 0.2, fiber: 0.9 },
    "nectarine (1 pc)": { calories: 60, protein: 1.5, carbs: 15, fats: 0.5, fiber: 2.2 },
    "currant (10 pcs)": { calories: 6, protein: 0.1, carbs: 1.4, fats: 0, fiber: 0.5 },
  },

  "Bread Slices": {
    "white bread slice": { calories: 75, protein: 2.5, carbs: 14, fats: 1, fiber: 0.6 },
    "brown bread slice": { calories: 70, protein: 3, carbs: 13, fats: 1, fiber: 1.5 },
    "multigrain bread slice": { calories: 80, protein: 4, carbs: 14, fats: 1.5, fiber: 1.9 },
    "whole wheat bread slice": { calories: 75, protein: 3.5, carbs: 13, fats: 1, fiber: 2.0 },
    "milk bread slice": { calories: 75, protein: 2, carbs: 14, fats: 1.5, fiber: 0.5 },
    "garlic bread slice": { calories: 120, protein: 3, carbs: 15, fats: 6, fiber: 0.8 },
  },

  "More Indian Foods": {
    "chicken pulao": { calories: 450, protein: 20, carbs: 60, fats: 14, fiber: 2.5 },
    "veg cutlet (2 pcs)": { calories: 250, protein: 6, carbs: 35, fats: 10, fiber: 3.5 },
    "paneer tikka": { calories: 280, protein: 18, carbs: 10, fats: 18, fiber: 1.5 },
    "dal khichdi": { calories: 340, protein: 12, carbs: 55, fats: 8, fiber: 5.0 }, // Lentils + Rice
    "methi paratha": { calories: 220, protein: 6, carbs: 32, fats: 8, fiber: 3.0 },
    "palak paratha": { calories: 210, protein: 6, carbs: 30, fats: 8, fiber: 2.8 },
    "moong dal dosa": { calories: 150, protein: 8, carbs: 20, fats: 4, fiber: 2.5 },
    "rava upma": { calories: 250, protein: 5, carbs: 40, fats: 8, fiber: 1.5 },
    "corn chaat": { calories: 150, protein: 4, carbs: 28, fats: 3, fiber: 3.0 },
    "sprouts chaat": { calories: 120, protein: 7, carbs: 18, fats: 2, fiber: 4.5 },
    "mutton curry": { calories: 450, protein: 25, carbs: 10, fats: 35, fiber: 1.5 },
    "paneer bhurji": { calories: 250, protein: 16, carbs: 6, fats: 18, fiber: 0.5 },
    "bhindi masala": { calories: 160, protein: 4, carbs: 12, fats: 10, fiber: 4.0 },
  },

  Sandwiches: {
    "vegetable sandwich": { calories: 220, protein: 6, carbs: 35, fats: 6, fiber: 4.0 },
    "grilled cheese sandwich": { calories: 350, protein: 12, carbs: 30, fats: 20, fiber: 1.2 },
    "egg sandwich": { calories: 300, protein: 16, carbs: 28, fats: 12, fiber: 1.5 },
    "chicken sandwich": { calories: 320, protein: 22, carbs: 30, fats: 10, fiber: 1.5 },
    "paneer sandwich": { calories: 340, protein: 16, carbs: 30, fats: 16, fiber: 1.8 },
    "club sandwich": { calories: 550, protein: 25, carbs: 45, fats: 30, fiber: 3.0 },
    "cheese chutney sandwich": { calories: 280, protein: 9, carbs: 30, fats: 14, fiber: 1.5 },
    "bombay masala sandwich": { calories: 400, protein: 10, carbs: 55, fats: 16, fiber: 4.5 }, // Potatoes add fiber
    "tandoori chicken sandwich": { calories: 350, protein: 24, carbs: 32, fats: 12, fiber: 2.0 },
    "corn & cheese sandwich": { calories: 320, protein: 10, carbs: 34, fats: 15, fiber: 2.5 },
  },

  "Indian Snacks": {
    "pani puri (6 pcs)": { calories: 150, protein: 3, carbs: 32, fats: 2, fiber: 1.5 },
    "sev puri (6 pcs)": { calories: 320, protein: 6, carbs: 45, fats: 14, fiber: 2.5 },
    "dahi puri (6 pcs)": { calories: 280, protein: 7, carbs: 38, fats: 10, fiber: 2.0 },
    "bhel puri (1 plate)": { calories: 280, protein: 6, carbs: 50, fats: 8, fiber: 3.5 }, // Puffed rice + veggies
    "ragda pattice": { calories: 350, protein: 10, carbs: 55, fats: 12, fiber: 6.0 }, // Dried peas = high fiber
    "samosa (1 pc)": { calories: 260, protein: 4, carbs: 24, fats: 16, fiber: 1.5 },
    "kachori (1 pc)": { calories: 240, protein: 5, carbs: 26, fats: 14, fiber: 2.0 }, // Lentil filling helps
    dabeli: { calories: 280, protein: 6, carbs: 45, fats: 10, fiber: 3.0 },
    "vada pav": { calories: 300, protein: 7, carbs: 45, fats: 12, fiber: 2.5 },
    "batata vada": { calories: 220, protein: 3, carbs: 25, fats: 12, fiber: 2.0 },
    "dhokla (2 pcs)": { calories: 140, protein: 6, carbs: 20, fats: 4, fiber: 2.0 }, // Fermented gram flour
    "pakora (4 pcs)": { calories: 250, protein: 6, carbs: 28, fats: 14, fiber: 2.5 },
    "aloo tikki (2 pcs)": { calories: 240, protein: 4, carbs: 32, fats: 10, fiber: 2.5 },
    "chole bhature": { calories: 600, protein: 18, carbs: 70, fats: 28, fiber: 7.0 }, // Chickpeas are high fiber
    "samosa pav": { calories: 350, protein: 8, carbs: 52, fats: 14, fiber: 2.0 },
    "mirchi bajji (2 pcs)": { calories: 180, protein: 3, carbs: 18, fats: 10, fiber: 1.5 },
    "moong dal chilla (2 pcs)": { calories: 220, protein: 12, carbs: 30, fats: 6, fiber: 4.5 },
  },

  "Indian-Chinese Cuisine": {
    "veg manchurian (dry, 6 pcs)": { calories: 300, protein: 6, carbs: 35, fats: 16, fiber: 3.5 },
    "veg manchurian (gravy, 1 bowl)": { calories: 350, protein: 7, carbs: 40, fats: 18, fiber: 4.0 },
    "gobi manchurian (dry, 8 pcs)": { calories: 320, protein: 6, carbs: 38, fats: 18, fiber: 4.5 }, // Cauliflower
    "paneer chilli (1 plate)": { calories: 450, protein: 18, carbs: 30, fats: 28, fiber: 2.0 },
    "chilli chicken (1 plate)": { calories: 480, protein: 30, carbs: 25, fats: 28, fiber: 1.5 },
    "chicken lollipop (4 pcs)": { calories: 450, protein: 24, carbs: 15, fats: 32, fiber: 0.5 },
    "hakka noodles (veg, 1 plate)": { calories: 450, protein: 10, carbs: 70, fats: 14, fiber: 3.5 },
    "hakka noodles (chicken, 1 plate)": { calories: 520, protein: 22, carbs: 68, fats: 18, fiber: 2.5 },
    "schezwan noodles (veg, 1 plate)": { calories: 480, protein: 10, carbs: 72, fats: 16, fiber: 3.5 },
    "fried rice (veg, 1 plate)": { calories: 400, protein: 8, carbs: 60, fats: 14, fiber: 3.0 },
    "fried rice (egg, 1 plate)": { calories: 450, protein: 14, carbs: 58, fats: 18, fiber: 1.5 },
    "fried rice (chicken, 1 plate)": { calories: 500, protein: 22, carbs: 58, fats: 20, fiber: 1.5 },
    "american chopsuey (veg, 1 plate)": { calories: 550, protein: 10, carbs: 85, fats: 22, fiber: 4.0 },
    "spring rolls (veg, 2 pcs)": { calories: 240, protein: 4, carbs: 28, fats: 12, fiber: 2.5 },
    "spring rolls (chicken, 2 pcs)": { calories: 280, protein: 10, carbs: 24, fats: 14, fiber: 1.0 },
    "hot & sour soup (veg, 1 bowl)": { calories: 90, protein: 2, carbs: 14, fats: 3, fiber: 2.0 },
    "hot & sour soup (chicken, 1 bowl)": { calories: 120, protein: 8, carbs: 14, fats: 4, fiber: 1.0 },
    "sweet corn soup (veg, 1 bowl)": { calories: 130, protein: 3, carbs: 24, fats: 3, fiber: 2.5 },
    "sweet corn soup (chicken, 1 bowl)": { calories: 160, protein: 9, carbs: 24, fats: 4, fiber: 1.5 },
    "schezwan fried rice (veg, 1 plate)": { calories: 450, protein: 8, carbs: 65, fats: 16, fiber: 3.0 },
    "schezwan fried rice (chicken, 1 plate)": { calories: 520, protein: 20, carbs: 65, fats: 20, fiber: 1.5 },
  },

  "Mughlai Cuisine": {
    "chicken seekh kebab (2 pcs)": { calories: 250, protein: 20, carbs: 5, fats: 16, fiber: 0.5 },
    "mutton seekh kebab (2 pcs)": { calories: 290, protein: 18, carbs: 5, fats: 22, fiber: 0.5 },
    "chicken reshmi kebab (2 pcs)": { calories: 240, protein: 22, carbs: 4, fats: 14, fiber: 0.2 },
    "chicken malai tikka (4 pcs)": { calories: 360, protein: 30, carbs: 6, fats: 24, fiber: 0.2 },
    "murgh musallam (1 serving)": { calories: 550, protein: 40, carbs: 10, fats: 38, fiber: 1.5 },
    "mutton rogan josh (1 bowl)": { calories: 500, protein: 25, carbs: 12, fats: 38, fiber: 1.0 },
    "chicken korma (1 bowl)": { calories: 450, protein: 24, carbs: 12, fats: 32, fiber: 1.0 },
    "mutton korma (1 bowl)": { calories: 520, protein: 26, carbs: 12, fats: 40, fiber: 1.0 },
    "nihari (1 bowl)": { calories: 450, protein: 25, carbs: 8, fats: 35, fiber: 0.5 },
    "chicken changezi (1 bowl)": { calories: 420, protein: 26, carbs: 10, fats: 30, fiber: 1.0 },
    "shami kebab (2 pcs)": { calories: 220, protein: 14, carbs: 10, fats: 14, fiber: 2.0 }, // Chana dal is used
    "galouti kebab (2 pcs)": { calories: 260, protein: 12, carbs: 8, fats: 20, fiber: 0.5 },
    "mutton biryani (mughlai, 1 bowl)": { calories: 650, protein: 30, carbs: 60, fats: 32, fiber: 2.0 },
    "chicken biryani (mughlai, 1 bowl)": { calories: 580, protein: 28, carbs: 60, fats: 24, fiber: 1.8 },
    "roomali roti": { calories: 150, protein: 4, carbs: 28, fats: 3, fiber: 0.8 },
    "sheermal": { calories: 300, protein: 6, carbs: 45, fats: 10, fiber: 1.0 },
    "warqi paratha": { calories: 250, protein: 5, carbs: 32, fats: 12, fiber: 1.5 },
  },

  "Maharashtrian Dishes": {
    "pav bhaji": { calories: 600, protein: 14, carbs: 70, fats: 28, fiber: 7.0 }, // Lots of veggies
    "misal pav": { calories: 580, protein: 18, carbs: 60, fats: 32, fiber: 8.5 }, // Sprouts = High Fiber
    "vada pav": { calories: 300, protein: 7, carbs: 45, fats: 12, fiber: 2.5 },
    poha: { calories: 270, protein: 5, carbs: 48, fats: 9, fiber: 2.5 },
    upma: { calories: 250, protein: 6, carbs: 40, fats: 9, fiber: 2.5 },
    thalipeeth: { calories: 240, protein: 6, carbs: 35, fats: 9, fiber: 4.5 }, // Multi-grain
    "sabudana khichdi": { calories: 480, protein: 4, carbs: 70, fats: 22, fiber: 1.0 }, // Low fiber
    "puran poli": { calories: 320, protein: 6, carbs: 60, fats: 8, fiber: 4.0 }, // Chana dal filling
    "kothimbir vadi": { calories: 180, protein: 6, carbs: 20, fats: 9, fiber: 3.0 },
    "zunka bhakri": { calories: 420, protein: 16, carbs: 65, fats: 12, fiber: 7.0 }, // Gram flour + Sorghum/Millet bread
    "bharli vangi": { calories: 250, protein: 4, carbs: 20, fats: 18, fiber: 5.5 }, // Brinjal
    "sol kadhi": { calories: 150, protein: 2, carbs: 12, fats: 11, fiber: 0.5 },
    modak: { calories: 100, protein: 1, carbs: 18, fats: 3, fiber: 0.5 },
    sheera: { calories: 350, protein: 4, carbs: 52, fats: 16, fiber: 1.5 },
    shrikhand: { calories: 300, protein: 8, carbs: 38, fats: 12, fiber: 0.0 },
    "aloo chi bhaji": { calories: 180, protein: 3, carbs: 28, fats: 7, fiber: 3.0 },
    "batata vada": { calories: 220, protein: 3, carbs: 25, fats: 12, fiber: 2.0 },
    "sabudana vada": { calories: 260, protein: 2, carbs: 32, fats: 14, fiber: 1.0 },
    "kanda poha": { calories: 270, protein: 5, carbs: 48, fats: 9, fiber: 2.5 },
  },

  Breads: {
    roti: { calories: 100, protein: 3, carbs: 18, fats: 2, fiber: 2.5 }, // Whole wheat
    chapati: { calories: 120, protein: 3, carbs: 20, fats: 3, fiber: 2.8 },
    phulka: { calories: 80, protein: 2.5, carbs: 16, fats: 0.5, fiber: 2.0 },
    "plain paratha": { calories: 240, protein: 5, carbs: 30, fats: 11, fiber: 3.0 },
    "aloo paratha": { calories: 320, protein: 8, carbs: 45, fats: 12, fiber: 4.5 },
    "paneer paratha": { calories: 360, protein: 14, carbs: 38, fats: 16, fiber: 3.5 },
    "gobi paratha": { calories: 290, protein: 7, carbs: 42, fats: 10, fiber: 5.0 },
    "methi thepla": { calories: 210, protein: 5, carbs: 28, fats: 9, fiber: 3.5 },
    naan: { calories: 280, protein: 8, carbs: 48, fats: 5, fiber: 1.5 }, // Refined flour
    "butter naan": { calories: 340, protein: 8, carbs: 48, fats: 12, fiber: 1.5 },
    "garlic naan": { calories: 350, protein: 8, carbs: 49, fats: 12, fiber: 1.5 },
    puri: { calories: 140, protein: 2, carbs: 16, fats: 8, fiber: 1.0 },
    bhatura: { calories: 280, protein: 6, carbs: 42, fats: 10, fiber: 1.2 },
    pav: { calories: 120, protein: 3, carbs: 22, fats: 2, fiber: 0.8 },
  },

  "Rice & Biryani": {
    "white rice (cooked, 100g)": { calories: 130, protein: 2.7, carbs: 28, fats: 0.3, fiber: 0.4 },
    "white rice (cooked, 150g)": { calories: 195, protein: 4.05, carbs: 42, fats: 0.45, fiber: 0.6 },
    "white rice (cooked, 200g)": { calories: 260, protein: 5.4, carbs: 56, fats: 0.6, fiber: 0.8 },
    "brown rice (cooked, 100g)": { calories: 111, protein: 2.6, carbs: 23, fats: 0.9, fiber: 1.8 },
    "brown rice (cooked, 150g)": { calories: 166, protein: 3.9, carbs: 34.5, fats: 1.35, fiber: 2.7 },
    "brown rice (cooked, 200g)": { calories: 222, protein: 5.2, carbs: 46, fats: 1.8, fiber: 3.6 },
    "jeera rice": { calories: 240, protein: 4, carbs: 42, fats: 6, fiber: 0.5 },
    "curd rice": { calories: 280, protein: 7, carbs: 35, fats: 12, fiber: 0.5 },
    "veg mix khichdi": { calories: 260, protein: 8, carbs: 42, fats: 6, fiber: 4.0 }, // Lentils + Rice + Veg
    "veg pulao": { calories: 250, protein: 5, carbs: 44, fats: 6, fiber: 3.0 },
    "chicken biryani": { calories: 600, protein: 30, carbs: 60, fats: 25, fiber: 2.0 },
    "mutton biryani": { calories: 650, protein: 32, carbs: 60, fats: 30, fiber: 2.0 },
    "veg biryani": { calories: 400, protein: 9, carbs: 55, fats: 14, fiber: 4.5 },
    "egg biryani": { calories: 450, protein: 15, carbs: 50, fats: 18, fiber: 2.0 },
    "hyderabadi biryani": { calories: 620, protein: 30, carbs: 62, fats: 26, fiber: 2.2 },
    "kolkata biryani": { calories: 580, protein: 26, carbs: 65, fats: 22, fiber: 2.5 }, // Potato adds fiber
    "malabar biryani": { calories: 600, protein: 28, carbs: 58, fats: 28, fiber: 2.0 },
    "paneer biryani": { calories: 480, protein: 18, carbs: 52, fats: 22, fiber: 3.0 },
    "soya biryani": { calories: 420, protein: 20, carbs: 50, fats: 14, fiber: 6.0 }, // Soya is high fiber
    "prawn biryani": { calories: 500, protein: 26, carbs: 52, fats: 20, fiber: 1.5 },
    "mushroom biryani": { calories: 380, protein: 10, carbs: 50, fats: 14, fiber: 3.5 },
    "tahari": { calories: 360, protein: 10, carbs: 55, fats: 12, fiber: 2.5 },
    "bisi bele bath": { calories: 380, protein: 9, carbs: 60, fats: 12, fiber: 5.0 },
    "fried rice": { calories: 350, protein: 6, carbs: 50, fats: 12, fiber: 2.0 },
    "lemon rice": { calories: 280, protein: 5, carbs: 45, fats: 9, fiber: 1.5 },
    "ghee rice": { calories: 350, protein: 4, carbs: 48, fats: 16, fiber: 0.5 },
  },

  "Curries(Veg)": {
    "dal tadka": { calories: 280, protein: 12, carbs: 32, fats: 12, fiber: 7.0 },
    "dal makhani": { calories: 420, protein: 14, carbs: 35, fats: 24, fiber: 8.0 },
    "dal fry": { calories: 240, protein: 11, carbs: 28, fats: 9, fiber: 6.5 },
    "chole": { calories: 320, protein: 14, carbs: 42, fats: 11, fiber: 10.0 }, // Very high fiber
    "rajma": { calories: 300, protein: 13, carbs: 40, fats: 9, fiber: 9.0 }, // Very high fiber
    "palak paneer": { calories: 360, protein: 19, carbs: 14, fats: 25, fiber: 4.5 },
    "paneer butter masala": { calories: 480, protein: 17, carbs: 22, fats: 36, fiber: 2.0 },
    "kadai paneer": { calories: 400, protein: 19, carbs: 16, fats: 30, fiber: 3.0 },
    "paneer bhurji": { calories: 300, protein: 22, carbs: 8, fats: 22, fiber: 1.0 },
    "aloo gobi": { calories: 220, protein: 5, carbs: 32, fats: 9, fiber: 4.0 },
    "bhindi fry": { calories: 200, protein: 4, carbs: 18, fats: 13, fiber: 3.5 },
    "baingan bharta": { calories: 180, protein: 4, carbs: 16, fats: 11, fiber: 5.5 },
    "sambar": { calories: 150, protein: 6, carbs: 25, fats: 4, fiber: 4.0 },
    "mix veg": { calories: 240, protein: 6, carbs: 20, fats: 15, fiber: 4.5 },
    "kadhi": { calories: 200, protein: 7, carbs: 20, fats: 11, fiber: 1.0 },
    "lauki chana dal": { calories: 190, protein: 9, carbs: 24, fats: 6, fiber: 5.0 },
    "matar mushroom": { calories: 220, protein: 8, carbs: 20, fats: 11, fiber: 4.0 },
    "bhindi masala": { calories: 210, protein: 5, carbs: 20, fats: 12, fiber: 4.0 },
    "aloo matar": { calories: 240, protein: 6, carbs: 28, fats: 10, fiber: 4.5 },
    "karela sabzi": { calories: 160, protein: 4, carbs: 14, fats: 10, fiber: 3.5 },
    "tinda sabzi": { calories: 130, protein: 3, carbs: 12, fats: 7, fiber: 2.5 },
    "chana masala": { calories: 300, protein: 14, carbs: 38, fats: 10, fiber: 9.0 },
  },

  "Non-Veg&Eggs": {
    "boiled egg": { calories: 78, protein: 6, carbs: 0.6, fats: 5, fiber: 0 },
    "egg whites (4)": { calories: 68, protein: 14, carbs: 1, fats: 0.2, fiber: 0 },
    "omelette (2 eggs)": { calories: 240, protein: 14, carbs: 2, fats: 18, fiber: 0.5 }, // Onions/chilies add negligible fiber
    "egg bhurji": { calories: 260, protein: 15, carbs: 4, fats: 20, fiber: 1.0 }, // Veggies add some
    "egg curry": { calories: 320, protein: 16, carbs: 12, fats: 22, fiber: 1.5 },
    "chicken curry": { calories: 380, protein: 28, carbs: 10, fats: 22, fiber: 1.5 },
    "butter chicken": { calories: 520, protein: 30, carbs: 16, fats: 38, fiber: 1.5 },
    "tandoori chicken (leg)": { calories: 300, protein: 30, carbs: 5, fats: 16, fiber: 0.5 },
    "chicken breast (100g)": { calories: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0 },
    "grilled chicken": { calories: 220, protein: 32, carbs: 0, fats: 9, fiber: 0 },
    "fish curry": { calories: 340, protein: 24, carbs: 10, fats: 22, fiber: 1.5 },
    "fish fry": { calories: 280, protein: 22, carbs: 10, fats: 18, fiber: 0.5 },
    "mutton curry": { calories: 500, protein: 30, carbs: 12, fats: 36, fiber: 1.5 },
    "prawn curry": { calories: 350, protein: 24, carbs: 10, fats: 20, fiber: 1.5 },
    "egg roll": { calories: 400, protein: 12, carbs: 40, fats: 20, fiber: 2.0 },
    "chicken roll": { calories: 450, protein: 22, carbs: 45, fats: 20, fiber: 2.0 },
    "chicken 65": { calories: 450, protein: 26, carbs: 20, fats: 28, fiber: 1.0 },
    "chicken tikka": { calories: 240, protein: 30, carbs: 5, fats: 10, fiber: 0.5 },
    "fish tikka": { calories: 230, protein: 26, carbs: 4, fats: 11, fiber: 0.5 },
    "crab curry": { calories: 350, protein: 24, carbs: 10, fats: 22, fiber: 1.5 },
  "kheema chicken": { calories: 400, protein: 30, carbs: 10, fats: 22, fiber: 1.8 },
  "kheema mutton": { calories: 480, protein: 28, carbs: 10, fats: 36, fiber: 2.0 },
  },

  "Breakfast&Snacks": {
    "poha": { calories: 270, protein: 5, carbs: 48, fats: 9, fiber: 2.0 },
    "upma": { calories: 250, protein: 6, carbs: 40, fats: 9, fiber: 2.5 }, // Veggies add fiber
    "idli": { calories: 60, protein: 2, carbs: 12, fats: 0.2, fiber: 0.5 }, // Processed rice/dal
    "dosa (plain)": { calories: 180, protein: 4, carbs: 30, fats: 5, fiber: 1.0 },
    "masala dosa": { calories: 380, protein: 8, carbs: 55, fats: 14, fiber: 3.5 }, // Potato filling adds fiber
    "vada": { calories: 160, protein: 4, carbs: 18, fats: 10, fiber: 1.5 }, // Urad dal
    "pav bhaji": { calories: 600, protein: 15, carbs: 70, fats: 25, fiber: 7.0 },
    "vada pav": { calories: 300, protein: 7, carbs: 45, fats: 12, fiber: 2.5 },
  "momos": { calories: 50, protein: 2, carbs: 8, fats: 1, fiber: 0.2 }, // Maida skin
  "oats (plain, 40g)": { calories: 150, protein: 5, carbs: 27, fats: 3, fiber: 4 },
  "oats with milk (40g oats + 200ml milk)": { calories: 220, protein: 9, carbs: 32, fats: 5, fiber: 4 },
  "oats with fruits & nuts (40g oats, 200ml milk, 20g mixed fruits, 10g nuts)": { calories: 270, protein: 10, carbs: 38, fats: 8, fiber: 5.5 },
  },

  "Gym / High Protein": {
    "whey protein scoop": { calories: 120, protein: 24, carbs: 3, fats: 2, fiber: 0.5 }, // May vary by brand
    "boiled chicken (150g)": { calories: 248, protein: 46, carbs: 0, fats: 5.4, fiber: 0 },
    "paneer (100g)": { calories: 265, protein: 18, carbs: 1.2, fats: 20, fiber: 0 },
    "tofu (100g)": { calories: 144, protein: 16, carbs: 3, fats: 8, fiber: 2.3 }, // Soya fiber
    "peanut butter (1 tbsp)": { calories: 95, protein: 4, carbs: 3, fats: 8, fiber: 1.0 },
    "sprouts salad": { calories: 150, protein: 10, carbs: 22, fats: 2, fiber: 6.0 },
    "protein bar": { calories: 210, protein: 20, carbs: 20, fats: 8, fiber: 5.0 }, // Often fortified with fiber
  },

  Fruits: {
    "apple": { calories: 95, protein: 0.5, carbs: 25, fats: 0.3, fiber: 4.4 },
    "apple slice": { calories: 12, protein: 0.06, carbs: 3, fats: 0.04, fiber: 0.5 },
    "banana": { calories: 105, protein: 1.3, carbs: 27, fats: 0.3, fiber: 3.1 },
    "banana slice": { calories: 5, protein: 0.06, carbs: 1.3, fats: 0.01, fiber: 0.1 },
    "orange": { calories: 62, protein: 1.2, carbs: 15, fats: 0.2, fiber: 3.1 },
    "orange wedge": { calories: 8, protein: 0.16, carbs: 2, fats: 0.03, fiber: 0.3 },
    "mango": { calories: 200, protein: 2.8, carbs: 50, fats: 1.2, fiber: 5.4 },
    "mango slice": { calories: 20, protein: 0.28, carbs: 5, fats: 0.12, fiber: 0.5 },
    "papaya": { calories: 43, protein: 0.5, carbs: 11, fats: 0.1, fiber: 1.7 },
    "papaya cube": { calories: 4, protein: 0.05, carbs: 1, fats: 0.01, fiber: 0.2 },
    "pomegranate": { calories: 83, protein: 1.7, carbs: 19, fats: 1.2, fiber: 4.0 },
    "pomegranate spoon": { calories: 12, protein: 0.25, carbs: 3, fats: 0.2, fiber: 0.6 },
    "guava": { calories: 68, protein: 2.6, carbs: 14, fats: 1, fiber: 5.4 },
    "guava slice": { calories: 7, protein: 0.26, carbs: 1.4, fats: 0.1, fiber: 0.5 },
    "grapes (10 pcs)": { calories: 35, protein: 0.3, carbs: 9, fats: 0.1, fiber: 0.4 },
    "watermelon (1 cup cubes)": { calories: 46, protein: 0.9, carbs: 12, fats: 0.2, fiber: 0.6 },
    "watermelon slice": { calories: 30, protein: 0.6, carbs: 8, fats: 0.1, fiber: 0.4 },
    "pear (1 pc)": { calories: 100, protein: 0.6, carbs: 27, fats: 0.2, fiber: 5.5 },
    "pineapple (1 slice)": { calories: 42, protein: 0.4, carbs: 11, fats: 0.1, fiber: 1.2 },
    "kiwi (1 pc)": { calories: 42, protein: 0.8, carbs: 10, fats: 0.4, fiber: 2.1 },
    "chikoo (1 pc)": { calories: 83, protein: 0.4, carbs: 20, fats: 1, fiber: 5.3 },
    "muskmelon (1 cup cubes)": { calories: 54, protein: 1.3, carbs: 13, fats: 0.3, fiber: 1.4 },
    "strawberry (5 pcs)": { calories: 20, protein: 0.4, carbs: 4.5, fats: 0.1, fiber: 1.5 },
    "blueberry (10 pcs)": { calories: 9, protein: 0.1, carbs: 2, fats: 0, fiber: 0.4 },
    "plum (1 pc)": { calories: 30, protein: 0.5, carbs: 7.5, fats: 0.2, fiber: 0.9 },
    "peach (1 pc)": { calories: 60, protein: 1, carbs: 15, fats: 0.4, fiber: 2.3 },
    "apricot (1 pc)": { calories: 17, protein: 0.5, carbs: 3.9, fats: 0.1, fiber: 0.7 },
    "lychee (5 pcs)": { calories: 30, protein: 0.3, carbs: 8, fats: 0.1, fiber: 0.7 },
    "custard apple (1 pc)": { calories: 94, protein: 2.1, carbs: 23, fats: 0.4, fiber: 4.4 },
    "pomegranate (1 pc)": { calories: 234, protein: 4.7, carbs: 53, fats: 3.3, fiber: 11.3 },
    "banana (small, 1 pc)": { calories: 90, protein: 1, carbs: 23, fats: 0.2, fiber: 2.6 },
    "apple (small, 1 pc)": { calories: 77, protein: 0.4, carbs: 21, fats: 0.2, fiber: 3.6 },
    "orange (small, 1 pc)": { calories: 45, protein: 0.9, carbs: 11, fats: 0.1, fiber: 2.3 },
    "sweet lime (mosambi, 1 pc)": { calories: 43, protein: 0.8, carbs: 9, fats: 0.2, fiber: 0.5 },
    "sweet lime (mosambi, 100g)": { calories: 43, protein: 0.8, carbs: 9, fats: 0.2, fiber: 0.5 },
  },

  "Dairy & Beverages": {
    "milk (toned)": { calories: 120, protein: 8, carbs: 12, fats: 4, fiber: 0 },
    "milk (full cream)": { calories: 150, protein: 8, carbs: 12, fats: 8, fiber: 0 },
    "curd/yogurt": { calories: 100, protein: 6, carbs: 8, fats: 6, fiber: 0 },
    "chai (with sugar)": { calories: 100, protein: 2, carbs: 14, fats: 3, fiber: 0 },
    "chai (without sugar)": { calories: 60, protein: 2, carbs: 6, fats: 3, fiber: 0 },
    "black coffee": { calories: 5, protein: 0, carbs: 0, fats: 0, fiber: 0 },
    "green tea": { calories: 2, protein: 0, carbs: 0, fats: 0, fiber: 0 },
    "buttermilk": { calories: 40, protein: 2, carbs: 4, fats: 1.5, fiber: 0 },
    "lassi": { calories: 200, protein: 7, carbs: 30, fats: 6, fiber: 0.5 }, // Fruit pulp might add trace fiber
    "lassi (with sugar)": { calories: 200, protein: 7, carbs: 30, fats: 6, fiber: 0.5 },
    "lassi (salted)": { calories: 120, protein: 6, carbs: 12, fats: 4, fiber: 0 },
    "paneer (50g)": { calories: 132, protein: 9, carbs: 0.6, fats: 10, fiber: 0 },
    "cheese": { calories: 113, protein: 7, carbs: 1, fats: 9, fiber: 0 },
    "flavored milk (chocolate, 200ml, with sugar)": { calories: 180, protein: 7, carbs: 28, fats: 5, fiber: 1.0 }, // Cocoa powder has fiber
    "flavored milk (chocolate, 200ml, without sugar)": { calories: 120, protein: 7, carbs: 14, fats: 5, fiber: 1.0 },
    "flavored milk (strawberry, 200ml, with sugar)": { calories: 160, protein: 6, carbs: 26, fats: 4, fiber: 0 },
    "flavored milk (strawberry, 200ml, without sugar)": { calories: 110, protein: 6, carbs: 13, fats: 4, fiber: 0 },
    "chaas": { calories: 40, protein: 2, carbs: 4, fats: 2, fiber: 0 },
    "cold coffee": { calories: 200, protein: 5, carbs: 30, fats: 7, fiber: 0 },
    "iced tea": { calories: 90, protein: 0, carbs: 23, fats: 0, fiber: 0 },
    "lemonade": { calories: 100, protein: 0, carbs: 26, fats: 0, fiber: 0.2 },
    "jaljeera": { calories: 40, protein: 0, carbs: 10, fats: 0, fiber: 0.5 },
    "aam panna": { calories: 90, protein: 0, carbs: 22, fats: 0, fiber: 1.0 },
    "sugarcane juice (200ml)": { calories: 180, protein: 0, carbs: 45, fats: 0, fiber: 0 },
    "coconut water (200ml)": { calories: 40, protein: 0.5, carbs: 10, fats: 0, fiber: 2.2 },
    "badam milk": { calories: 220, protein: 8, carbs: 25, fats: 10, fiber: 1.5 }, // Nuts add fiber
    "rose milk": { calories: 160, protein: 5, carbs: 25, fats: 5, fiber: 0 },
    "falooda": { calories: 350, protein: 8, carbs: 60, fats: 10, fiber: 3.0 }, // Sabja seeds + nuts
    "energy drink (250ml)": { calories: 110, protein: 0, carbs: 27, fats: 0, fiber: 0 },
    "cola (330ml)": { calories: 140, protein: 0, carbs: 35, fats: 0, fiber: 0 },
    "orange juice (200ml)": { calories: 90, protein: 1, carbs: 21, fats: 0, fiber: 0.4 }, // Low due to straining
    "apple juice (200ml)": { calories: 95, protein: 0, carbs: 24, fats: 0, fiber: 0.2 },
    "mango shake (200ml)": { calories: 220, protein: 5, carbs: 40, fats: 5, fiber: 1.5 },
    "banana shake (200ml)": { calories: 200, protein: 5, carbs: 35, fats: 5, fiber: 2.0 },
  },

  "Sweets & Desserts": {
    "gulab jamun (1 pc)": { calories: 150, protein: 2, carbs: 25, fats: 7, fiber: 0.2 },
    "rasgulla (1 pc)": { calories: 100, protein: 2, carbs: 22, fats: 1, fiber: 0 },
    "kheer (1 bowl)": { calories: 280, protein: 7, carbs: 38, fats: 12, fiber: 0.5 },
    "besan ladoo": { calories: 220, protein: 4, carbs: 28, fats: 12, fiber: 2.0 }, // Gram flour
    "kaju katli": { calories: 60, protein: 1, carbs: 8, fats: 3, fiber: 0.3 },
    "jalebi (100g)": { calories: 300, protein: 2, carbs: 55, fats: 12, fiber: 0.5 },
    "ice cream (1 scoop)": { calories: 200, protein: 4, carbs: 25, fats: 11, fiber: 0.5 },
    "chocolate bar (small)": { calories: 250, protein: 3, carbs: 30, fats: 14, fiber: 2.0 },
    "motichoor ladoo": { calories: 180, protein: 3, carbs: 28, fats: 8, fiber: 1.5 },
    "soan papdi (25g)": { calories: 130, protein: 2, carbs: 18, fats: 6, fiber: 0.5 },
    "mysore pak (1 pc)": { calories: 180, protein: 2, carbs: 20, fats: 10, fiber: 0.5 },
    "peda (1 pc)": { calories: 80, protein: 2, carbs: 12, fats: 3, fiber: 0 },
    "malpua (1 pc)": { calories: 200, protein: 3, carbs: 30, fats: 8, fiber: 0.5 },
    "rabri (1 bowl)": { calories: 350, protein: 8, carbs: 40, fats: 18, fiber: 0.5 },
    "sandesh (1 pc)": { calories: 90, protein: 2, carbs: 12, fats: 3, fiber: 0 },
    "cham cham (1 pc)": { calories: 150, protein: 3, carbs: 25, fats: 5, fiber: 0 },
    "shrikhand (1 bowl)": { calories: 300, protein: 8, carbs: 38, fats: 12, fiber: 0 },
    "rasmalai (1 pc)": { calories: 180, protein: 5, carbs: 24, fats: 8, fiber: 0.2 },
    "kalakand (1 pc)": { calories: 130, protein: 4, carbs: 15, fats: 6, fiber: 0 },
    "patisa (1 pc)": { calories: 130, protein: 2, carbs: 18, fats: 6, fiber: 0.5 },
    "anarsa (1 pc)": { calories: 120, protein: 1, carbs: 20, fats: 4, fiber: 0.2 },
    "imarti (1 pc)": { calories: 150, protein: 1, carbs: 30, fats: 4, fiber: 1.0 }, // Urad dal
    "balushahi (1 pc)": { calories: 220, protein: 3, carbs: 30, fats: 11, fiber: 0.5 },
    "gujiya (1 pc)": { calories: 200, protein: 3, carbs: 26, fats: 10, fiber: 1.0 },
    "modak (1 pc)": { calories: 100, protein: 1, carbs: 18, fats: 3, fiber: 0.5 },
    "kharvas (1 pc)": { calories: 80, protein: 3, carbs: 10, fats: 3, fiber: 0 },
    "shankarpali (5 pcs)": { calories: 150, protein: 2, carbs: 22, fats: 6, fiber: 0.5 },
    "karanji (1 pc)": { calories: 180, protein: 2, carbs: 22, fats: 10, fiber: 1.5 },
    "puran poli (1 pc)": { calories: 320, protein: 6, carbs: 60, fats: 8, fiber: 4.0 },
  },

  "Dry Fruits & Nuts": {
    "almonds (10 pcs)": { calories: 70, protein: 2.6, carbs: 2.5, fats: 6, fiber: 1.5 },
    "cashews (10 pcs)": { calories: 90, protein: 3, carbs: 5, fats: 7, fiber: 0.5 },
    "walnuts (5 halves)": { calories: 65, protein: 1.5, carbs: 1.2, fats: 6.5, fiber: 1.0 },
    "raisins (1 tbsp)": { calories: 30, protein: 0.3, carbs: 8, fats: 0, fiber: 0.5 },
    "dates (2 pcs)": { calories: 46, protein: 0.4, carbs: 12, fats: 0, fiber: 1.6 },
    "pistachios (10 pcs)": { calories: 40, protein: 1.5, carbs: 2, fats: 3.5, fiber: 1.0 },
    "figs dried (2 pcs)": { calories: 42, protein: 0.4, carbs: 11, fats: 0.1, fiber: 1.8 },
    "apricots dried (2 pcs)": { calories: 34, protein: 0.5, carbs: 8, fats: 0.1, fiber: 1.5 },
    "peanuts (1 tbsp)": { calories: 52, protein: 2.3, carbs: 1.7, fats: 4.5, fiber: 1.0 },
    "mixed nuts (1 tbsp)": { calories: 60, protein: 2, carbs: 2.5, fats: 5, fiber: 1.0 },
  },
};

// Flatten for search
export const FLATTENED_DB = {};
Object.values(FOOD_CATEGORIES).forEach((category) => {
  Object.assign(FLATTENED_DB, category);
});