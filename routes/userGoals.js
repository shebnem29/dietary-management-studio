const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
function calculateAge(dateStr) {
    const birthDate = new Date(dateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

router.patch("/weight", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { goal_weight } = req.body;

  if (!goal_weight || typeof goal_weight !== "number" || goal_weight <= 0) {
    return res.status(400).json({ message: "Invalid goal weight" });
  }

  try {
    // 1. Get current user weight
    const userResult = await db.query(
      "SELECT weight FROM users WHERE id = $1",
      [userId]
    );
    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentWeight = userResult.rows[0].weight;

    // 2. Determine goal type
    let goalType = "maintenance";
    if (goal_weight < currentWeight) goalType = "cut";
    else if (goal_weight > currentWeight) goalType = "bulk";

    // 3. Get goal_type_id from goal_types table
    const typeResult = await db.query(
      "SELECT id FROM goal_types WHERE name = $1",
      [goalType]
    );
    if (typeResult.rowCount === 0) {
      return res.status(400).json({ message: "Invalid goal type" });
    }

    const goal_type_id = typeResult.rows[0].id;

    // 4. Insert new goal record
    await db.query(
      `INSERT INTO user_goals (user_id, goal_weight, goal_type_id)
       VALUES ($1, $2, $3)`,
      [userId, goal_weight, goal_type_id]
    );

    res.json({ message: "Goal weight created", goalType });
  } catch (err) {
    console.error("Goal Weight Update Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/weight", authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await db.query(
            `SELECT goal_weight FROM user_goals WHERE user_id = $1`,
            [userId]
        );

        if (result.rowCount === 0 || result.rows[0].goal_weight == null) {
            return res.status(404).json({ message: "No goal weight found" });
        }

        res.json({ goal_weight: result.rows[0].goal_weight });
    } catch (err) {
        console.error("Fetch Goal Weight Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});
router.patch("/weekly-rate", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { weekly_rate_kg } = req.body;

  if (typeof weekly_rate_kg !== "number") {
    return res.status(400).json({ message: "Invalid weekly rate" });
  }

  try {
    // Fetch most recent goal and its goalType
    const result = await db.query(
      `SELECT g.id AS goal_id, g.weekly_rate_kg AS existing_rate, gt.name AS goalType
       FROM user_goals g
       JOIN goal_types gt ON g.goal_type_id = gt.id
       WHERE g.user_id = $1
       ORDER BY g.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User goal not found" });
    }

    const { goal_id, existing_rate, goaltype } = result.rows[0];

    // If unchanged, short-circuit
    if (weekly_rate_kg === existing_rate) {
      return res.json({ message: "Weekly rate unchanged", goalType: goaltype });
    }

    // Validate based on goal type
    const limits = {
      cut: { min: -1.0, max: -0.1 },
      bulk: { min: 0.1, max: 0.5 },
      maintenance: { min: 0, max: 0 },
    };

    const range = limits[goaltype];
    if (!range || weekly_rate_kg < range.min || weekly_rate_kg > range.max) {
      return res.status(400).json({ message: `Unrealistic weekly rate for ${goaltype} goal` });
    }

    // Update that specific goal
    await db.query(
      `UPDATE user_goals SET weekly_rate_kg = $1 WHERE id = $2`,
      [weekly_rate_kg, goal_id]
    );

    res.json({ message: "Weekly rate updated successfully", goalType: goaltype });
  } catch (err) {
    console.error("Weekly Rate Update Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/weekly-rate", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT u.weight, g.goal_weight, g.weekly_rate_kg, g.created_at, gt.name AS goalType
       FROM users u
       JOIN user_goals g ON u.id = g.user_id
       JOIN goal_types gt ON g.goal_type_id = gt.id
       WHERE u.id = $1
       ORDER BY g.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User or goal not found" });
    }

    const { weight, goal_weight, weekly_rate_kg, created_at, goaltype } = result.rows[0];

    res.json({
      goalType: goaltype, // already "cut", "bulk", or "maintenance"
      weekly_rate_kg,
      goal_weight,
      created_at,
    });
  } catch (err) {
    console.error("Weekly Rate Fetch Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/energy-summary", authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        // 1. Fetch user info
        const userResult = await db.query(
            `SELECT weight, height, birthday, sex, activity_level_id FROM users WHERE id = $1`,
            [userId]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ message: "User not found" });

        const { weight, height, birthday, sex, activity_level_id } = user;

        const age = calculateAge(birthday);
        const heightMeters = height / 100;
        const bmi = weight / (heightMeters * heightMeters);

        const bmr = sex === "male"
            ? 10 * weight + 6.25 * height - 5 * age + 5
            : 10 * weight + 6.25 * height - 5 * age - 161;

        const activityResult = await db.query(
            `SELECT multiplier FROM activity_levels WHERE id = $1`,
            [activity_level_id]
        );
        const multiplier = activityResult.rows[0]?.multiplier ?? 1.2;
        const tdee = bmr * multiplier;

        // 2. Fetch latest goal
        const goalResult = await db.query(
            `SELECT goal_weight, weekly_rate_kg, created_at FROM user_goals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );
        const goal = goalResult.rows[0];
        if (!goal) return res.status(404).json({ message: "User goal not found" });

        const { goal_weight, weekly_rate_kg = 0, created_at } = goal;

        const goalType = goal_weight < weight ? "cut" : goal_weight > weight ? "bulk" : "maintenance";
        const dailyCalChange = weekly_rate_kg * 7700 / 7;
        const energyTarget = tdee + dailyCalChange;
        const deficit = Math.round(energyTarget - tdee);

        // 3. Forecast date
        let forecastDate = null;
        if (goalType !== "maintenance" && weekly_rate_kg !== 0 && weight !== goal_weight) {
            const weeks = Math.abs((weight - goal_weight) / weekly_rate_kg);
            const forecast = new Date(created_at);
            forecast.setDate(forecast.getDate() + Math.round(weeks * 7));
            forecastDate = forecast.toDateString();
        }

        // 4. Macros using diet_presets
        const macroRes = await db.query(`SELECT * FROM diet_presets`);
        const macroOptions = macroRes.rows.map(opt => ({
            name: opt.name,
            protein: Math.round((energyTarget * opt.protein_ratio) / 4),
            fats: Math.round((energyTarget * opt.fat_ratio) / 9),
            carbs: Math.round((energyTarget * opt.carb_ratio) / 4),
        }));

        res.json({
            user: {
                sex,
                age,
                height,
                weight,
                bmi: parseFloat(bmi.toFixed(1))
            },
            bmr: Math.round(bmr),
            tdee: Math.round(tdee),
            energyTarget: Math.round(energyTarget),
            energyDeficit: deficit,
            goalType,
            weekly_rate_kg,
            goal_weight,
            forecastDate,
            macroOptions
        });
    } catch (err) {
        console.error("Error in /energy-summary:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/weight-goal-tracking", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { goal_weight, weekly_rate_kg } = req.body;

    if (
        !goal_weight || typeof goal_weight !== "number" || goal_weight <= 0 ||
        !weekly_rate_kg || typeof weekly_rate_kg !== "number" ||
        !goalType || !["cut", "bulk", "maintenance"].includes(goalType)
    ) {
        return res.status(400).json({ message: "Invalid goal data" });
    }

    try {
        await db.query(
            `INSERT INTO user_goals (user_id, goal_weight, weekly_rate_kg)
             VALUES ($1, $2, $3, $4)`,
            [userId, goal_weight, weekly_rate_kg]
        );

        res.status(201).json({ message: "New goal created" });
    } catch (err) {
        console.error("Goal Creation Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});
module.exports = router;
