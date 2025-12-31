import { NextResponse } from "next/server";
import { FLATTENED_DB } from "../../food-data"; // Import the shared data

export async function POST(request) {
  try {
    const { query } = await request.json();
    const lowerQuery = query.toLowerCase();

    let foundKey = null;
    let multiplier = 1;

    // 1. EXTRACT QUANTITY
    const numberMatch = lowerQuery.match(/(\d+)/);
    if (numberMatch) {
      multiplier = parseInt(numberMatch[0]);
    }

    // 2. FIND FOOD ITEM
    const dbKeys = Object.keys(FLATTENED_DB);
    // Sort so longer names match first
    dbKeys.sort((a, b) => b.length - a.length);

    for (const key of dbKeys) {
      if (lowerQuery.includes(key)) {
        foundKey = key;
        break;
      }
    }

    if (!foundKey) {
      return NextResponse.json(
        { error: "Food not found in database" },
        { status: 404 }
      );
    }

    const foodData = FLATTENED_DB[foundKey];

    // 3. RETURN DATA SAFELY
    return NextResponse.json({
      id: crypto.randomUUID(),
      name: query,
      calories: Number(Math.round(foodData.calories * multiplier)) || 0,
      protein: Number(Math.round(foodData.protein * multiplier)) || 0,
      carbs: Number(Math.round(foodData.carbs * multiplier)) || 0,
      fats: Number(Math.round(foodData.fats * multiplier)) || 0,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
