// app/food-data.js

export const FOOD_CATEGORIES = {
  "Bread Slices": {
    "white bread slice": { calories: 70, protein: 2, carbs: 13, fats: 1 },
    "brown bread slice": { calories: 60, protein: 2, carbs: 11, fats: 1 },
    "multigrain bread slice": {
      calories: 65,
      protein: 2.5,
      carbs: 12,
      fats: 1,
    },
    "whole wheat bread slice": {
      calories: 60,
      protein: 2.5,
      carbs: 11,
      fats: 1,
    },
    "milk bread slice": { calories: 75, protein: 2, carbs: 14, fats: 1.5 },
    "garlic bread slice": { calories: 90, protein: 2, carbs: 13, fats: 4 },
  },

  "More Indian Foods": {
    "chicken pulao": { calories: 350, protein: 16, carbs: 45, fats: 10 },
    "veg cutlet (2 pcs)": { calories: 180, protein: 4, carbs: 28, fats: 6 },
    "paneer tikka": { calories: 220, protein: 14, carbs: 8, fats: 14 },
    "dal khichdi": { calories: 220, protein: 7, carbs: 38, fats: 4 },
    "methi paratha": { calories: 180, protein: 5, carbs: 28, fats: 6 },
    "palak paratha": { calories: 170, protein: 5, carbs: 27, fats: 5 },
    "moong dal dosa": { calories: 120, protein: 6, carbs: 18, fats: 2 },
    "rava upma": { calories: 210, protein: 5, carbs: 36, fats: 6 },
    "corn chaat": { calories: 150, protein: 4, carbs: 28, fats: 2 },
    "sprouts chaat": { calories: 120, protein: 7, carbs: 18, fats: 1 },
    "mutton curry": { calories: 320, protein: 20, carbs: 8, fats: 20 },
    "paneer bhurji": { calories: 180, protein: 12, carbs: 6, fats: 12 },
    "bhindi masala": { calories: 120, protein: 3, carbs: 10, fats: 7 },
  },
  Sandwiches: {
    "vegetable sandwich": { calories: 180, protein: 5, carbs: 32, fats: 4 }, // 2 slices, veggies
    "grilled cheese sandwich": {
      calories: 320,
      protein: 10,
      carbs: 30,
      fats: 18,
    }, // 2 slices, cheese, butter
    "egg sandwich": { calories: 250, protein: 12, carbs: 28, fats: 8 }, // 2 slices, boiled egg
    "chicken sandwich": { calories: 280, protein: 18, carbs: 30, fats: 7 }, // 2 slices, chicken
    "paneer sandwich": { calories: 260, protein: 12, carbs: 28, fats: 10 }, // 2 slices, paneer
    "club sandwich": { calories: 400, protein: 18, carbs: 38, fats: 18 }, // 3 slices, chicken, egg, veggies
    "cheese chutney sandwich": {
      calories: 220,
      protein: 7,
      carbs: 28,
      fats: 9,
    }, // 2 slices, cheese, chutney
    "bombay masala sandwich": {
      calories: 350,
      protein: 8,
      carbs: 50,
      fats: 12,
    }, // 3 slices, potato, veggies
    "tandoori chicken sandwich": {
      calories: 320,
      protein: 20,
      carbs: 32,
      fats: 10,
    }, // 2 slices, tandoori chicken
    "corn & cheese sandwich": {
      calories: 270,
      protein: 8,
      carbs: 34,
      fats: 10,
    }, // 2 slices, corn, cheese
  },

  "Indian Snacks": {
    "pani puri (6 pcs)": { calories: 150, protein: 2, carbs: 28, fats: 4 },
    "sev puri (6 pcs)": { calories: 220, protein: 4, carbs: 32, fats: 10 },
    "dahi puri (6 pcs)": { calories: 180, protein: 5, carbs: 30, fats: 6 },
    "bhel puri (1 plate)": { calories: 180, protein: 4, carbs: 36, fats: 4 },
    "ragda pattice": { calories: 320, protein: 10, carbs: 50, fats: 8 },
    "samosa (1 pc)": { calories: 130, protein: 3, carbs: 18, fats: 6 },
    "kachori (1 pc)": { calories: 180, protein: 4, carbs: 22, fats: 8 },
    dabeli: { calories: 220, protein: 5, carbs: 32, fats: 8 },
    "vada pav": { calories: 290, protein: 6, carbs: 42, fats: 12 },
    "batata vada": { calories: 180, protein: 3, carbs: 22, fats: 10 },
    "dhokla (2 pcs)": { calories: 80, protein: 3, carbs: 10, fats: 3 },
    "pakora (4 pcs)": { calories: 220, protein: 6, carbs: 24, fats: 12 },
    "aloo tikki (2 pcs)": { calories: 160, protein: 4, carbs: 28, fats: 6 },
    "chole bhature": { calories: 450, protein: 12, carbs: 60, fats: 18 },
    "samosa pav": { calories: 320, protein: 7, carbs: 48, fats: 12 },
    "mirchi bajji (2 pcs)": { calories: 120, protein: 2, carbs: 16, fats: 6 },
    "moong dal chilla (2 pcs)": {
      calories: 180,
      protein: 8,
      carbs: 24,
      fats: 4,
    },
  },
  "Indian-Chinese Cuisine": {
    "veg manchurian (dry, 6 pcs)": {
      calories: 280,
      protein: 6,
      carbs: 32,
      fats: 14,
    },
    "veg manchurian (gravy, 1 bowl)": {
      calories: 320,
      protein: 7,
      carbs: 36,
      fats: 16,
    },
    "gobi manchurian (dry, 8 pcs)": {
      calories: 300,
      protein: 6,
      carbs: 34,
      fats: 16,
    },
    "paneer chilli (1 plate)": {
      calories: 400,
      protein: 16,
      carbs: 28,
      fats: 24,
    },
    "chilli chicken (1 plate)": {
      calories: 450,
      protein: 28,
      carbs: 22,
      fats: 26,
    },
    "chicken lollipop (4 pcs)": {
      calories: 320,
      protein: 18,
      carbs: 12,
      fats: 20,
    },
    "hakka noodles (veg, 1 plate)": {
      calories: 420,
      protein: 10,
      carbs: 60,
      fats: 14,
    },
    "hakka noodles (chicken, 1 plate)": {
      calories: 480,
      protein: 18,
      carbs: 62,
      fats: 16,
    },
    "schezwan noodles (veg, 1 plate)": {
      calories: 460,
      protein: 10,
      carbs: 66,
      fats: 16,
    },
    "fried rice (veg, 1 plate)": {
      calories: 350,
      protein: 8,
      carbs: 54,
      fats: 10,
    },
    "fried rice (egg, 1 plate)": {
      calories: 400,
      protein: 14,
      carbs: 54,
      fats: 13,
    },
    "fried rice (chicken, 1 plate)": {
      calories: 420,
      protein: 18,
      carbs: 54,
      fats: 14,
    },
    "american chopsuey (veg, 1 plate)": {
      calories: 520,
      protein: 10,
      carbs: 80,
      fats: 18,
    },
    "spring rolls (veg, 2 pcs)": {
      calories: 180,
      protein: 4,
      carbs: 24,
      fats: 8,
    },
    "spring rolls (chicken, 2 pcs)": {
      calories: 210,
      protein: 8,
      carbs: 22,
      fats: 10,
    },
    "hot & sour soup (veg, 1 bowl)": {
      calories: 90,
      protein: 3,
      carbs: 14,
      fats: 2,
    },
    "hot & sour soup (chicken, 1 bowl)": {
      calories: 110,
      protein: 7,
      carbs: 14,
      fats: 3,
    },
    "sweet corn soup (veg, 1 bowl)": {
      calories: 120,
      protein: 3,
      carbs: 22,
      fats: 2,
    },
    "sweet corn soup (chicken, 1 bowl)": {
      calories: 140,
      protein: 8,
      carbs: 22,
      fats: 3,
    },
    "schezwan fried rice (veg, 1 plate)": {
      calories: 400,
      protein: 8,
      carbs: 60,
      fats: 12,
    },
    "schezwan fried rice (chicken, 1 plate)": {
      calories: 450,
      protein: 16,
      carbs: 60,
      fats: 14,
    },
  },
  "Mughlai Cuisine": {
    "chicken seekh kebab (2 pcs)": {
      calories: 220,
      protein: 18,
      carbs: 4,
      fats: 14,
    },
    "mutton seekh kebab (2 pcs)": {
      calories: 260,
      protein: 16,
      carbs: 4,
      fats: 20,
    },
    "chicken reshmi kebab (2 pcs)": {
      calories: 210,
      protein: 20,
      carbs: 3,
      fats: 12,
    },
    "chicken malai tikka (4 pcs)": {
      calories: 320,
      protein: 28,
      carbs: 4,
      fats: 20,
    },
    "murgh musallam (1 serving)": {
      calories: 450,
      protein: 32,
      carbs: 8,
      fats: 32,
    },
    "mutton rogan josh (1 bowl)": {
      calories: 420,
      protein: 22,
      carbs: 8,
      fats: 32,
    },
    "chicken korma (1 bowl)": {
      calories: 400,
      protein: 20,
      carbs: 10,
      fats: 30,
    },
    "mutton korma (1 bowl)": {
      calories: 480,
      protein: 22,
      carbs: 10,
      fats: 38,
    },
    "nihari (1 bowl)": { calories: 350, protein: 18, carbs: 6, fats: 26 },
    "chicken changezi (1 bowl)": {
      calories: 390,
      protein: 22,
      carbs: 8,
      fats: 28,
    },
    "shami kebab (2 pcs)": { calories: 180, protein: 12, carbs: 8, fats: 10 },
    "galouti kebab (2 pcs)": { calories: 200, protein: 10, carbs: 6, fats: 16 },
    "mutton biryani (mughlai, 1 bowl)": {
      calories: 600,
      protein: 28,
      carbs: 55,
      fats: 28,
    },
    "chicken biryani (mughlai, 1 bowl)": {
      calories: 520,
      protein: 26,
      carbs: 55,
      fats: 20,
    },
    "roomali roti": { calories: 120, protein: 3, carbs: 22, fats: 2 },
    sheermal: { calories: 250, protein: 5, carbs: 40, fats: 8 },
    "warqi paratha": { calories: 180, protein: 4, carbs: 28, fats: 6 },
  },
  "Maharashtrian Dishes": {
    "pav bhaji": { calories: 600, protein: 12, carbs: 70, fats: 28 }, // High butter/oil content
    "misal pav": { calories: 550, protein: 16, carbs: 55, fats: 30 }, // High due to farsan/oil (tarri)
    "vada pav": { calories: 290, protein: 6, carbs: 42, fats: 12 },
    poha: { calories: 270, protein: 5, carbs: 48, fats: 9 }, // With peanuts
    upma: { calories: 250, protein: 6, carbs: 40, fats: 9 },
    thalipeeth: { calories: 220, protein: 6, carbs: 32, fats: 8 },
    "sabudana khichdi": { calories: 450, protein: 4, carbs: 65, fats: 20 }, // Very high carb/fat (peanuts+ghee)
    "puran poli": { calories: 290, protein: 6, carbs: 55, fats: 7 },
    "kothimbir vadi": { calories: 160, protein: 5, carbs: 18, fats: 8 }, // 2-3 pieces
    "zunka bhakri": { calories: 380, protein: 14, carbs: 60, fats: 10 },
    "bharli vangi": { calories: 220, protein: 4, carbs: 18, fats: 16 },
    "sol kadhi": { calories: 140, protein: 2, carbs: 12, fats: 10 }, // Coconut milk base is calorie dense
    modak: { calories: 90, protein: 1, carbs: 16, fats: 3 }, // Steamed
    sheera: { calories: 320, protein: 4, carbs: 48, fats: 14 },
    shrikhand: { calories: 280, protein: 7, carbs: 35, fats: 12 },
    "aloo chi bhaji": { calories: 160, protein: 3, carbs: 25, fats: 6 },
    "batata vada": { calories: 180, protein: 3, carbs: 22, fats: 10 },
    "sabudana vada": { calories: 220, protein: 2, carbs: 28, fats: 12 },

    "kanda poha": { calories: 270, protein: 5, carbs: 48, fats: 9 },
  },
  Breads: {
    roti: { calories: 100, protein: 3, carbs: 18, fats: 2 }, // Medium size
    chapati: { calories: 120, protein: 3, carbs: 20, fats: 4 }, // With ghee/oil
    phulka: { calories: 80, protein: 2.5, carbs: 16, fats: 0.5 },
    "plain paratha": { calories: 240, protein: 5, carbs: 28, fats: 12 },
    "aloo paratha": { calories: 340, protein: 8, carbs: 48, fats: 14 },
    "paneer paratha": { calories: 380, protein: 14, carbs: 38, fats: 18 },
    "gobi paratha": { calories: 290, protein: 6, carbs: 40, fats: 12 },
    "methi thepla": { calories: 210, protein: 5, carbs: 28, fats: 9 },
    naan: { calories: 260, protein: 9, carbs: 45, fats: 5 },
    "butter naan": { calories: 320, protein: 9, carbs: 45, fats: 12 },
    "garlic naan": { calories: 330, protein: 9, carbs: 46, fats: 12 },
    puri: { calories: 140, protein: 2, carbs: 16, fats: 8 },
    bhatura: { calories: 300, protein: 7, carbs: 45, fats: 14 },
    pav: { calories: 80, protein: 2, carbs: 15, fats: 1 }, // 1 Laadi Pav
  },

  "Rice & Biryani": {
    "white rice (cooked, 100g)": {
      calories: 130,
      protein: 2.7,
      carbs: 28,
      fats: 0.3,
    },
    "white rice (cooked, 150g)": {
      calories: 195,
      protein: 4.05,
      carbs: 42,
      fats: 0.45,
    },
    "white rice (cooked, 200g)": {
      calories: 260,
      protein: 5.4,
      carbs: 56,
      fats: 0.6,
    },
    "brown rice (cooked, 100g)": {
      calories: 111,
      protein: 2.6,
      carbs: 23,
      fats: 0.9,
    },
    "brown rice (cooked, 150g)": {
      calories: 166,
      protein: 3.9,
      carbs: 34.5,
      fats: 1.35,
    },
    "brown rice (cooked, 200g)": {
      calories: 222,
      protein: 5.2,
      carbs: 46,
      fats: 1.8,
    },
    "jeera rice": { calories: 220, protein: 4, carbs: 38, fats: 6 },
    "curd rice": { calories: 280, protein: 7, carbs: 35, fats: 12 },
    "veg mix khichdi": { calories: 240, protein: 8, carbs: 38, fats: 6 },
    "veg pulao": { calories: 230, protein: 5, carbs: 40, fats: 6 },
    "chicken biryani": { calories: 550, protein: 28, carbs: 55, fats: 22 }, // Standard bowl
    "mutton biryani": { calories: 600, protein: 30, carbs: 55, fats: 28 },
    "veg biryani": { calories: 350, protein: 8, carbs: 50, fats: 12 },
    "egg biryani": { calories: 400, protein: 14, carbs: 45, fats: 16 },
    "hyderabadi biryani": { calories: 580, protein: 28, carbs: 58, fats: 24 },
    "kolkata biryani": { calories: 520, protein: 24, carbs: 60, fats: 18 }, // Includes potato
    "malabar biryani": { calories: 560, protein: 26, carbs: 55, fats: 25 },
    "paneer biryani": { calories: 420, protein: 16, carbs: 48, fats: 18 },
    "soya biryani": { calories: 380, protein: 18, carbs: 46, fats: 12 },
    "prawn biryani": { calories: 450, protein: 24, carbs: 47, fats: 16 },
    "mushroom biryani": { calories: 320, protein: 10, carbs: 44, fats: 10 },
    tahari: { calories: 330, protein: 9, carbs: 50, fats: 10 },
    "bisi bele bath": { calories: 350, protein: 8, carbs: 55, fats: 10 },
    "fried rice": { calories: 300, protein: 6, carbs: 45, fats: 10 },
    "lemon rice": { calories: 250, protein: 5, carbs: 40, fats: 8 },
    "ghee rice": { calories: 320, protein: 4, carbs: 45, fats: 14 },
  },

  "Curries(Veg)": {
    "dal tadka": { calories: 260, protein: 11, carbs: 28, fats: 12 },
    "dal makhani": { calories: 380, protein: 12, carbs: 32, fats: 22 },
    "dal fry": { calories: 220, protein: 10, carbs: 25, fats: 8 },
    chole: { calories: 300, protein: 12, carbs: 40, fats: 10 },
    rajma: { calories: 280, protein: 12, carbs: 38, fats: 8 },
    "palak paneer": { calories: 340, protein: 18, carbs: 12, fats: 24 },
    "paneer butter masala": { calories: 450, protein: 16, carbs: 20, fats: 35 },
    "kadai paneer": { calories: 380, protein: 18, carbs: 14, fats: 28 },
    "paneer bhurji": { calories: 280, protein: 20, carbs: 8, fats: 20 },
    "aloo gobi": { calories: 190, protein: 4, carbs: 28, fats: 8 },
    "bhindi fry": { calories: 180, protein: 4, carbs: 16, fats: 12 },
    "baingan bharta": { calories: 160, protein: 3, carbs: 14, fats: 10 },
    sambar: { calories: 130, protein: 5, carbs: 22, fats: 3 },
    "mix veg": { calories: 210, protein: 5, carbs: 18, fats: 14 },
    kadhi: { calories: 180, protein: 6, carbs: 18, fats: 10 },
    "lauki chana dal": { calories: 170, protein: 8, carbs: 22, fats: 5 },
    "matar mushroom": { calories: 200, protein: 7, carbs: 18, fats: 10 },
    "bhindi masala": { calories: 190, protein: 4, carbs: 18, fats: 11 },
    "aloo matar": { calories: 210, protein: 5, carbs: 25, fats: 9 },
    "karela sabzi": { calories: 140, protein: 3, carbs: 12, fats: 9 },
    "tinda sabzi": { calories: 110, protein: 2, carbs: 10, fats: 6 },
    "chana masala": { calories: 280, protein: 13, carbs: 35, fats: 9 },
  },

  "Non-Veg&Eggs": {
    "boiled egg": { calories: 78, protein: 6, carbs: 0.6, fats: 5 },
    "egg whites (4)": { calories: 68, protein: 14, carbs: 1, fats: 0.2 },
    "omelette (2 eggs)": { calories: 210, protein: 13, carbs: 2, fats: 16 }, // Includes oil
    "egg bhurji": { calories: 240, protein: 14, carbs: 4, fats: 18 },
    "egg curry": { calories: 280, protein: 14, carbs: 10, fats: 20 },

    "chicken curry": { calories: 330, protein: 25, carbs: 8, fats: 20 },
    "butter chicken": { calories: 490, protein: 28, carbs: 14, fats: 35 },
    "tandoori chicken (leg)": {
      calories: 280,
      protein: 28,
      carbs: 4,
      fats: 14,
    },
    "chicken breast (100g)": {
      calories: 165,
      protein: 31,
      carbs: 0,
      fats: 3.6,
    }, // Cooked
    "grilled chicken": { calories: 200, protein: 30, carbs: 0, fats: 8 },
    "fish curry": { calories: 300, protein: 22, carbs: 8, fats: 20 },
    "fish fry": { calories: 250, protein: 20, carbs: 8, fats: 15 },
    "mutton curry": { calories: 450, protein: 28, carbs: 10, fats: 32 },
    "prawn curry": { calories: 320, protein: 20, carbs: 8, fats: 18 },
    "egg roll": { calories: 350, protein: 10, carbs: 35, fats: 18 },
    "chicken roll": { calories: 400, protein: 20, carbs: 38, fats: 18 },
    "chicken 65": { calories: 420, protein: 24, carbs: 18, fats: 26 },
    "chicken tikka": { calories: 220, protein: 28, carbs: 4, fats: 8 },
    "fish tikka": { calories: 210, protein: 24, carbs: 3, fats: 9 },
    "crab curry": { calories: 320, protein: 22, carbs: 8, fats: 20 },
    keema: { calories: 420, protein: 26, carbs: 6, fats: 32 },
  },

  "Breakfast&Snacks": {
    poha: { calories: 270, protein: 5, carbs: 48, fats: 9 },
    upma: { calories: 250, protein: 6, carbs: 40, fats: 9 },
    idli: { calories: 60, protein: 2, carbs: 12, fats: 0.2 }, // 1 Piece
    "dosa (plain)": { calories: 180, protein: 4, carbs: 30, fats: 5 },
    "masala dosa": { calories: 380, protein: 8, carbs: 55, fats: 14 },
    vada: { calories: 160, protein: 4, carbs: 18, fats: 10 }, // Medu vada

    "pav bhaji": { calories: 600, protein: 15, carbs: 70, fats: 25 },
    "vada pav": { calories: 290, protein: 6, carbs: 42, fats: 12 },

    momos: { calories: 40, protein: 2, carbs: 6, fats: 1 },
  },

  "Gym / High Protein": {
    "whey protein scoop": { calories: 120, protein: 24, carbs: 3, fats: 2 },
    "boiled chicken (150g)": {
      calories: 248,
      protein: 46,
      carbs: 0,
      fats: 5.4,
    }, // Cooked weight
    "paneer (100g)": { calories: 265, protein: 18, carbs: 1.2, fats: 20 },
    "tofu (100g)": { calories: 144, protein: 16, carbs: 3, fats: 8 }, // Firm tofu
    "peanut butter (1 tbsp)": { calories: 95, protein: 4, carbs: 3, fats: 8 },
    "sprouts salad": { calories: 150, protein: 10, carbs: 22, fats: 2 },
    "protein bar": { calories: 210, protein: 10, carbs: 26, fats: 8 }, // Typical 50g bar
  },

  Fruits: {
    apple: { calories: 95, protein: 0.5, carbs: 25, fats: 0.3 },
    "apple slice": { calories: 12, protein: 0.06, carbs: 3, fats: 0.04 },
    banana: { calories: 105, protein: 1.3, carbs: 27, fats: 0.3 },
    "banana slice": { calories: 5, protein: 0.06, carbs: 1.3, fats: 0.01 },
    orange: { calories: 62, protein: 1.2, carbs: 15, fats: 0.2 },
    "orange wedge": { calories: 8, protein: 0.16, carbs: 2, fats: 0.03 },
    mango: { calories: 200, protein: 2.8, carbs: 50, fats: 1.2 },
    "mango slice": { calories: 20, protein: 0.28, carbs: 5, fats: 0.12 },
    papaya: { calories: 43, protein: 0.5, carbs: 11, fats: 0.1 },
    "papaya cube": { calories: 4, protein: 0.05, carbs: 1, fats: 0.01 },
    pomegranate: { calories: 83, protein: 1.7, carbs: 19, fats: 1.2 },
    "pomegranate spoon": { calories: 12, protein: 0.25, carbs: 3, fats: 0.2 },
    guava: { calories: 68, protein: 2.6, carbs: 14, fats: 1 },
    "guava slice": { calories: 7, protein: 0.26, carbs: 1.4, fats: 0.1 },
  },

  "Dairy & Beverages": {
    "milk (toned)": { calories: 120, protein: 8, carbs: 12, fats: 4 }, // 250ml
    "milk (full cream)": { calories: 150, protein: 8, carbs: 12, fats: 8 }, // 250ml
    "curd/yogurt": { calories: 100, protein: 6, carbs: 8, fats: 6 },
    "chai (with sugar)": { calories: 100, protein: 2, carbs: 14, fats: 3 },
    "chai (without sugar)": { calories: 60, protein: 2, carbs: 6, fats: 3 },
    "black coffee": { calories: 5, protein: 0, carbs: 0, fats: 0 },
    "green tea": { calories: 2, protein: 0, carbs: 0, fats: 0 },
    buttermilk: { calories: 40, protein: 2, carbs: 4, fats: 1.5 },
    lassi: { calories: 180, protein: 6, carbs: 28, fats: 5 }, // 250ml, sweet
    "lassi (with sugar)": { calories: 180, protein: 6, carbs: 28, fats: 5 },
    "lassi (salted)": { calories: 120, protein: 6, carbs: 12, fats: 4 }, // 250ml
    "paneer (50g)": { calories: 132, protein: 9, carbs: 0.6, fats: 10 },
    cheese: { calories: 113, protein: 7, carbs: 1, fats: 9 }, // 1 slice (20g)
    "flavored milk (chocolate, 200ml, with sugar)": {
      calories: 160,
      protein: 6,
      carbs: 26,
      fats: 4,
    },
    "flavored milk (chocolate, 200ml, without sugar)": {
      calories: 110,
      protein: 6,
      carbs: 14,
      fats: 4,
    },
    "flavored milk (strawberry, 200ml, with sugar)": {
      calories: 150,
      protein: 6,
      carbs: 24,
      fats: 4,
    },
    "flavored milk (strawberry, 200ml, without sugar)": {
      calories: 105,
      protein: 6,
      carbs: 12,
      fats: 4,
    },
    chaas: { calories: 35, protein: 2, carbs: 4, fats: 1 }, // 200ml, spiced buttermilk
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

  "Dry Fruits & Nuts": {
    "almonds (10 pcs)": { calories: 70, protein: 2.6, carbs: 2.5, fats: 6 },
    "cashews (10 pcs)": { calories: 90, protein: 3, carbs: 5, fats: 7 },
    "walnuts (5 halves)": { calories: 65, protein: 1.5, carbs: 1.2, fats: 6.5 },
    "raisins (1 tbsp)": { calories: 30, protein: 0.3, carbs: 8, fats: 0 },
    "dates (2 pcs)": { calories: 46, protein: 0.4, carbs: 12, fats: 0 },
    "pistachios (10 pcs)": { calories: 40, protein: 1.5, carbs: 2, fats: 3.5 },
    "figs dried (2 pcs)": { calories: 42, protein: 0.4, carbs: 11, fats: 0.1 },
    "apricots dried (2 pcs)": {
      calories: 34,
      protein: 0.5,
      carbs: 8,
      fats: 0.1,
    },
    "peanuts (1 tbsp)": { calories: 52, protein: 2.3, carbs: 1.7, fats: 4.5 },
    "mixed nuts (1 tbsp)": { calories: 60, protein: 2, carbs: 2.5, fats: 5 },
  },
};

// Flatten for search
export const FLATTENED_DB = {};
Object.values(FOOD_CATEGORIES).forEach((category) => {
  Object.assign(FLATTENED_DB, category);
});
