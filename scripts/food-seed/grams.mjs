/**
 * Gram (or ml) weight of each built-in serving in app/food-data.js, for the
 * per-100 g conversion. Servings already written in g/ml ("100g", "200ml") are
 * read from the name and aren't listed here.
 *
 * These are ESTIMATES for typical Indian portions (IFCT 2017 / USDA references,
 * common katori/plate sizes). They only matter when someone logs by weight; a
 * "1 bowl" log keeps exactly today's calories. Review docs/food-gram-weights.csv.
 *
 * [grams, confidence]  confidence: "high" (standard item) · "medium" · "low" (home dish, varies a lot)
 */
export const GRAMS = {
  // Bakery & Desserts
  "brownie (chocolate, 1 pc)": [60, "medium"], "cake (chocolate, 1 slice)": [80, "medium"], "cake (red velvet, 1 slice)": [90, "medium"],
  "cake (sponge, 1 slice)": [60, "medium"], "chocolate bar (small, 1 pc)": [45, "high"], "croissant (plain, 1 pc)": [60, "high"],
  "cupcake (vanilla, 1 pc)": [55, "medium"], "donut (chocolate, 1 pc)": [70, "medium"], "ice cream (cone, 1 pc)": [90, "medium"],
  "ice cream (scoop, 1 pc)": [70, "medium"], "muffin (blueberry, 1 pc)": [110, "medium"], "pancake (plain, 1 pc)": [70, "medium"],
  "waffle (plain, 1 pc)": [75, "medium"],
  // Beverages (ml)
  "aam panna (1 glass)": [250, "medium"], "badam milk (1 glass)": [250, "medium"], "black coffee (no sugar, 1 cup)": [150, "medium"],
  "buttermilk / chaas (1 glass)": [250, "medium"], "chai (with sugar, 1 cup)": [150, "medium"], "chai (without sugar, 1 cup)": [150, "medium"],
  "cold coffee (1 glass)": [250, "medium"], "falooda (1 glass)": [300, "medium"], "green tea (1 cup)": [200, "medium"],
  "iced tea (1 glass)": [250, "medium"], "jaljeera (1 glass)": [250, "medium"], "lassi (salted, 1 glass)": [250, "medium"],
  "lassi (sweet, 1 glass)": [250, "medium"], "lemonade (1 glass)": [250, "medium"],
  // Breads
  "bhatura (1 pc)": [80, "medium"], "bread (brown, 1 slice)": [30, "high"], "bread (garlic, 1 slice)": [40, "medium"],
  "bread (milk, 1 slice)": [30, "high"], "bread (multigrain, 1 slice)": [30, "high"], "bread (white, 1 slice)": [30, "high"],
  "bread (whole wheat, 1 slice)": [30, "high"], "naan (butter, 1 pc)": [100, "medium"], "naan (garlic, 1 pc)": [100, "medium"],
  "naan (plain, 1 pc)": [90, "medium"], "paratha (aloo, 1 pc)": [120, "medium"], "paratha (gobi, 1 pc)": [120, "medium"],
  "paratha (paneer, 1 pc)": [120, "medium"], "paratha (plain, 1 pc)": [70, "medium"], "paratha (warqi, 1 pc)": [80, "medium"],
  "pav (1 pc)": [40, "high"], "puri (1 pc)": [25, "medium"], "roomali roti (1 pc)": [50, "medium"], "roti (chapati, 1 pc)": [40, "high"],
  "roti (phulka, 1 pc)": [30, "high"], "roti (whole wheat, 1 pc)": [40, "high"], "sheermal (1 pc)": [90, "medium"],
  "thepla (methi, 1 pc)": [40, "medium"],
  // Dairy & Eggs
  "cheese (slice/cube, 1 pc)": [20, "high"], "egg (boiled, 1 pc)": [50, "high"], "egg (bhurji, 1 plate)": [150, "medium"],
  "egg (omelette, 2 eggs)": [120, "medium"], "egg whites (4 pcs)": [132, "high"],
  // Dry Fruits & Nuts
  "almonds (10 pcs)": [12, "high"], "apricots (dried, 2 pcs)": [16, "high"], "cashews (10 pcs)": [15, "high"],
  "dates (dried, 2 pcs)": [16, "medium"], "figs (dried, 2 pcs)": [16, "medium"], "mixed nuts (1 tbsp)": [9, "medium"],
  "peanuts (1 tbsp)": [9, "high"], "pistachios (10 pcs)": [7, "high"], "raisins (1 tbsp)": [9, "high"], "walnuts (5 halves)": [10, "high"],
  // Fast Food & Sandwiches
  "burger (cheese, 1 pc)": [150, "medium"], "burger (chicken, 1 pc)": [180, "medium"], "burger (veg, 1 pc)": [160, "medium"],
  "falafel wrap (1 pc)": [250, "medium"], "fish & chips (1 plate)": [350, "low"], "french fries (medium, 1 serving)": [117, "high"],
  "fried chicken (breast, 1 pc)": [160, "medium"], "fried chicken (drumstick, 1 pc)": [90, "medium"], "fried chicken (hot wings, 2 pcs)": [70, "medium"],
  "fried chicken (nuggets, 6 pcs)": [100, "high"], "hot dog (1 pc)": [100, "medium"], "hummus & pita (1 serving)": [150, "low"],
  "noodles (instant, 1 pack)": [70, "high"], "pasta (red sauce, 1 cup)": [220, "medium"], "pasta (white sauce, 1 cup)": [220, "medium"],
  "pizza (margherita, 1 slice)": [100, "medium"], "pizza (pepperoni, 1 slice)": [110, "medium"], "pizza (veggie, 1 slice)": [110, "medium"],
  "quesadilla (1 pc)": [180, "medium"], "salad (caesar, 1 bowl)": [200, "low"], "salad (greek, 1 bowl)": [200, "low"],
  "sandwich (bombay masala, 1 pc)": [180, "medium"], "sandwich (cheese chutney, 1 pc)": [120, "medium"], "sandwich (chicken, 1 pc)": [180, "medium"],
  "sandwich (club, 1 pc)": [250, "medium"], "sandwich (corn & cheese, 1 pc)": [170, "medium"], "sandwich (egg, 1 pc)": [150, "medium"],
  "sandwich (grilled cheese, 1 pc)": [130, "medium"], "sandwich (paneer, 1 pc)": [180, "medium"], "sandwich (tandoori chicken, 1 pc)": [200, "medium"],
  "sandwich (vegetable, 1 pc)": [150, "medium"], "shawarma roll (1 pc)": [250, "medium"], "sushi (6 pcs)": [180, "medium"], "tacos (2 pcs)": [200, "medium"],
  // Fruits
  "apple (medium, 1 pc)": [182, "high"], "apple (slice, 1 pc)": [20, "medium"], "apricot (1 pc)": [35, "high"], "avocado (half, 1 pc)": [100, "high"],
  "banana (medium, 1 pc)": [118, "high"], "banana (slice, 1 pc)": [8, "medium"], "blueberry (10 pcs)": [15, "high"], "chikoo / sapota (1 pc)": [100, "medium"],
  "cranberry (10 pcs)": [11, "high"], "currant (10 pcs)": [5, "medium"], "custard apple (1 pc)": [150, "medium"], "dates / khajur (fresh, 1 pc)": [10, "medium"],
  "fig (fresh, 1 pc)": [50, "high"], "gooseberry / amla (1 pc)": [30, "medium"], "grapes (black, 10 pcs)": [50, "high"], "grapes (green, 10 pcs)": [50, "high"],
  "guava (1 pc)": [100, "medium"], "guava (slice, 1 pc)": [20, "medium"], "jackfruit (1 cup)": [165, "high"], "kiwi (1 pc)": [75, "high"],
  "longan (10 pcs)": [32, "high"], "lychee (5 pcs)": [50, "high"], "mango (medium, 1 pc)": [200, "medium"], "mango (slice, 1 pc)": [30, "medium"],
  "mulberry (10 pcs)": [15, "medium"], "muskmelon (1 cup cubes)": [160, "high"], "nectarine (1 pc)": [140, "high"], "orange (medium, 1 pc)": [130, "high"],
  "orange (wedge, 1 pc)": [15, "medium"], "papaya (1 cup cubes)": [145, "high"], "papaya (cube, 1 pc)": [10, "medium"], "passion fruit (1 pc)": [18, "high"],
  "peach (1 pc)": [150, "high"], "pear (1 pc)": [178, "high"], "persimmon (1 pc)": [168, "high"], "pineapple (1 slice)": [85, "high"],
  "plum (1 pc)": [66, "high"], "pomegranate (medium, 1 pc)": [174, "medium"], "pomegranate (spoon, 1 tbsp)": [10, "medium"], "raspberry (10 pcs)": [20, "high"],
  "starfruit (1 pc)": [91, "high"], "strawberry (5 pcs)": [60, "high"], "sweet lime / mosambi (1 pc)": [150, "medium"], "watermelon (1 cup cubes)": [150, "high"],
  "watermelon (slice, 1 pc)": [280, "medium"],
  // Gym & Supplements
  "peanut butter (1 tbsp)": [16, "high"], "protein bar (1 pc)": [60, "medium"], "salad (sprouts, 1 bowl)": [150, "low"], "whey protein (1 scoop)": [30, "high"],
  // Indian Chinese
  "american chopsuey (veg, 1 plate)": [300, "low"], "chicken lollipop (4 pcs)": [160, "medium"], "chilli chicken (1 plate)": [250, "low"],
  "fried rice (chicken, 1 plate)": [300, "low"], "fried rice (egg, 1 plate)": [300, "low"], "fried rice (schezwan chicken, 1 plate)": [300, "low"],
  "fried rice (schezwan veg, 1 plate)": [300, "low"], "fried rice (veg, 1 plate)": [300, "low"], "manchurian (gobi dry, 8 pcs)": [160, "medium"],
  "manchurian (veg dry, 6 pcs)": [150, "medium"], "manchurian (veg gravy, 1 bowl)": [200, "low"], "noodles (hakka chicken, 1 plate)": [300, "low"],
  "noodles (hakka veg, 1 plate)": [300, "low"], "noodles (schezwan veg, 1 plate)": [300, "low"], "paneer chilli (1 plate)": [250, "low"],
  "soup (hot & sour chicken, 1 bowl)": [250, "medium"], "soup (hot & sour veg, 1 bowl)": [250, "medium"], "soup (sweet corn chicken, 1 bowl)": [250, "medium"],
  "soup (sweet corn veg, 1 bowl)": [250, "medium"], "spring rolls (chicken, 2 pcs)": [120, "medium"], "spring rolls (veg, 2 pcs)": [120, "medium"],
  // Indian Curries & Main (Veg)
  "aloo gobi (1 bowl)": [200, "low"],
  "aloo matar (1 bowl)": [200, "low"],
  "baingan bharta (1 bowl)": [200, "low"],
  "bharli vangi (1 bowl)": [200, "low"],
  "bhindi fry (1 bowl)": [150, "low"],
  "bhindi masala (1 bowl)": [200, "low"],
  "chana masala (1 bowl)": [200, "low"],
  "chole / chickpeas (1 bowl)": [200, "low"],
  "dal fry (1 bowl)": [200, "low"],
  "dal khichdi (1 bowl)": [250, "low"],
  "dal makhani (1 bowl)": [200, "low"],
  "dal tadka (1 bowl)": [200, "low"],
  "kadai paneer (1 bowl)": [200, "low"],
  "kadhi (1 bowl)": [200, "low"],
  "karela sabzi (1 bowl)": [150, "low"],
  "lauki chana dal (1 bowl)": [200, "low"],
  "matar mushroom (1 bowl)": [200, "low"],
  "mix veg (1 bowl)": [200, "low"],
  "palak paneer (1 bowl)": [200, "low"],
  "paneer bhurji (1 bowl)": [150, "low"],
  "paneer butter masala (1 bowl)": [200, "low"],
  "rajma / kidney beans (1 bowl)": [200, "low"],
  "sambar (1 bowl)": [200, "low"],
  "tinda sabzi (1 bowl)": [200, "low"],
  "paneer tikka (1 plate)": [200, "low"], "zunka bhakri (1 plate)": [250, "low"],
  // Snacks & Breakfast
  "aloo chi bhaji (1 bowl)": [150, "low"], "aloo tikki (2 pcs)": [140, "medium"], "batata vada (1 pc)": [70, "medium"], "bhel puri (1 plate)": [150, "low"],
  "chole bhature (1 plate)": [350, "low"], "corn chaat (1 bowl)": [150, "low"], "cutlet (veg, 2 pcs)": [120, "medium"], "dabeli (1 pc)": [120, "medium"],
  "dahi puri (6 pcs)": [180, "medium"], "dhokla (2 pcs)": [80, "medium"], "dosa (masala, 1 pc)": [200, "medium"], "dosa (moong dal, 1 pc)": [100, "medium"],
  "dosa (plain, 1 pc)": [90, "medium"], "idli (1 pc)": [40, "high"], "kachori (1 pc)": [60, "medium"], "kanda poha (1 bowl)": [150, "low"],
  "kothimbir vadi (1 plate)": [120, "low"], "mirchi bajji (2 pcs)": [100, "medium"], "misal pav (1 plate)": [350, "low"], "moong dal chilla (2 pcs)": [150, "medium"],
  "oats (with fruits & nuts, 1 bowl)": [250, "low"], "oats (with milk, 1 bowl)": [250, "low"], "pakora (4 pcs)": [80, "medium"], "pani puri (6 pcs)": [150, "medium"],
  "pav bhaji (1 plate)": [350, "low"], "poha (1 bowl)": [150, "low"], "ragda pattice (1 plate)": [300, "low"], "sabudana khichdi (1 bowl)": [200, "low"],
  "sabudana vada (1 pc)": [60, "medium"], "samosa (veg, 1 pc)": [100, "medium"], "samosa pav (1 pc)": [140, "medium"], "sev puri (6 pcs)": [150, "medium"],
  "sprouts chaat (1 bowl)": [150, "low"], "thalipeeth (1 pc)": [100, "medium"], "upma (rava, 1 bowl)": [200, "low"], "vada (urad dal, 1 pc)": [50, "medium"],
  "vada pav (1 pc)": [150, "medium"],
  // Meat & Seafood
  "butter chicken (1 bowl)": [200, "low"], "chicken 65 (1 plate)": [200, "low"], "chicken changezi (1 bowl)": [200, "low"], "chicken curry (1 bowl)": [200, "low"],
  "chicken korma (1 bowl)": [200, "low"], "chicken roll (1 pc)": [200, "medium"], "chicken tikka (4 pcs)": [160, "medium"], "crab curry (1 bowl)": [200, "low"],
  "egg roll (1 pc)": [180, "medium"], "fish curry (1 bowl)": [200, "low"], "fish fry (1 plate)": [150, "low"], "fish tikka (1 plate)": [180, "low"],
  "kebab (chicken reshmi, 2 pcs)": [100, "medium"], "kebab (chicken seekh, 2 pcs)": [100, "medium"], "kebab (galouti, 2 pcs)": [80, "medium"],
  "kebab (mutton seekh, 2 pcs)": [100, "medium"], "kebab (shami, 2 pcs)": [100, "medium"], "kheema (chicken, 1 bowl)": [200, "low"],
  "kheema (mutton, 1 bowl)": [200, "low"], "murgh musallam (1 serving)": [350, "low"], "mutton curry (1 bowl)": [200, "low"], "mutton korma (1 bowl)": [200, "low"],
  "mutton rogan josh (1 bowl)": [200, "low"], "nihari (1 bowl)": [250, "low"], "prawn curry (1 bowl)": [200, "low"], "tandoori chicken (leg, 1 pc)": [150, "medium"],
  "tikka (chicken malai, 4 pcs)": [160, "medium"],
  // Ramazan Specials
  "cutlet (chicken, 1 pc)": [80, "medium"], "dahi vada (2 pcs)": [200, "medium"], "fruit chaat (1 bowl)": [150, "low"], "haleem (mutton, 1 bowl)": [250, "low"],
  "kanji (mutton, 1 bowl)": [250, "low"], "kebab (chicken russian, 1 pc)": [90, "medium"], "ragda (1 bowl)": [200, "low"], "samosa (chicken, 1 pc)": [100, "medium"],
  "samosa (mutton, 1 pc)": [100, "medium"], "sheer khurma (1 bowl)": [150, "low"],
  // Rice & Biryani
  "biryani (chicken, 1 bowl)": [250, "low"], "biryani (egg, 1 bowl)": [250, "low"], "biryani (hyderabadi, 1 bowl)": [250, "low"], "biryani (kolkata, 1 bowl)": [250, "low"],
  "biryani (malabar, 1 bowl)": [250, "low"], "biryani (mushroom, 1 bowl)": [250, "low"], "biryani (mutton, 1 bowl)": [250, "low"], "biryani (paneer, 1 bowl)": [250, "low"],
  "biryani (prawn, 1 bowl)": [250, "low"], "biryani (soya, 1 bowl)": [250, "low"], "biryani (veg, 1 bowl)": [250, "low"], "bisi bele bath (1 bowl)": [250, "low"],
  "curd rice (1 bowl)": [200, "low"], "ghee rice (1 bowl)": [200, "low"], "jeera rice (1 bowl)": [200, "low"], "khichdi (veg mix, 1 bowl)": [250, "low"],
  "lemon rice (1 bowl)": [200, "low"], "pulao (chicken, 1 bowl)": [200, "low"], "pulao (veg, 1 bowl)": [200, "low"], "tahari (1 bowl)": [250, "low"],
  // Sweets (Indian)
  "anarsa (1 pc)": [30, "medium"], "balushahi (1 pc)": [50, "medium"], "cham cham (1 pc)": [50, "medium"], "gujiya (1 pc)": [50, "medium"],
  "gulab jamun (1 pc)": [50, "medium"], "imarti (1 pc)": [50, "medium"], "kaju katli (1 pc)": [15, "high"], "kalakand (1 pc)": [40, "medium"],
  "karanji (1 pc)": [40, "medium"], "kharvas (1 pc)": [50, "medium"], "kheer (1 bowl)": [150, "low"], "ladoo (besan, 1 pc)": [40, "medium"],
  "ladoo (motichoor, 1 pc)": [40, "medium"], "malpua (1 pc)": [60, "medium"], "modak (1 pc)": [50, "medium"], "mysore pak (1 pc)": [30, "medium"],
  "patisa (1 pc)": [30, "medium"], "peda (1 pc)": [30, "high"], "puran poli (1 pc)": [100, "medium"], "rabri (1 bowl)": [100, "low"],
  "rasgulla (1 pc)": [50, "medium"], "rasmalai (1 pc)": [70, "medium"], "sandesh (1 pc)": [40, "medium"], "shankarpali (5 pcs)": [25, "medium"],
  "sheera (1 bowl)": [150, "low"], "shrikhand (1 bowl)": [150, "low"],
  // Vegetables
  "beetroot (medium, 1 pc)": [82, "high"], "capsicum (medium, 1 pc)": [120, "high"], "carrot (medium, 1 pc)": [61, "high"], "corn (half cob, 1 pc)": [90, "medium"],
  "cucumber (medium, 1 pc)": [200, "high"], "garlic (5 cloves)": [15, "high"], "ginger (1 inch)": [10, "medium"], "onion (medium, 1 pc)": [110, "high"],
  "potato (medium, 1 pc)": [170, "high"], "radish (medium, 1 pc)": [150, "medium"], "tomato (medium, 1 pc)": [120, "high"], "turnip (medium, 1 pc)": [120, "high"],
};
