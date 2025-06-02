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
        await db.query(
            "INSERT INTO user_goals (user_id, goal_weight) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET goal_weight = EXCLUDED.goal_weight",
            [userId, goal_weight]
        );

        res.json({ message: "Goal weight updated successfully" });
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
        // Get current and goal weight
        const userResult = await db.query(
            `SELECT u.weight, g.goal_weight, g.weekly_rate_kg
       FROM users u
       JOIN user_goals g ON u.id = g.user_id
       WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: "User or goal not found" });
        }

        const { weight, goal_weight, weekly_rate_kg: existingRate } = userResult.rows[0];

        // Determine goal type
        let goalType = "maintenance";
        if (goal_weight < weight) goalType = "cut";
        else if (goal_weight > weight) goalType = "bulk";

        // Allow unchanged rate to pass without error
        if (weekly_rate_kg === existingRate) {
            return res.json({ message: "Weekly rate unchanged", goalType });
        }

        // Validate rate based on goal type
        // Validate realistic physical limits
        if (
            (goalType === "cut" && (weekly_rate_kg < -1 || weekly_rate_kg > -0.1)) ||
            (goalType === "bulk" && (weekly_rate_kg < 0.1 || weekly_rate_kg > 0.5)) ||
            (goalType === "maintenance" && weekly_rate_kg !== 0)
        ) {
            return res.status(400).json({ message: `Unrealistic weekly rate for ${goalType} goal` });
        }


        // Save to DB
        await db.query(
            `UPDATE user_goals SET weekly_rate_kg = $1 WHERE user_id = $2`,
            [weekly_rate_kg, userId]
        );

        res.json({ message: "Weekly rate updated successfully", goalType });
    } catch (err) {
        console.error("Weekly Rate Update Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/weekly-rate", authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const userResult = await db.query(
            `SELECT u.weight, g.goal_weight, g.weekly_rate_kg, g.created_at
       FROM users u
       JOIN user_goals g ON u.id = g.user_id
       WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: "User or goal not found" });
        }

        const { weight, goal_weight, weekly_rate_kg, created_at } = userResult.rows[0];

        let goalType = "maintenance";
        if (goal_weight < weight) goalType = "cut";
        else if (goal_weight > weight) goalType = "bulk";

        res.json({ goalType, weekly_rate_kg, goal_weight, created_at });
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

        // 2. Fetch goal info
        const goalResult = await db.query(
            `SELECT goal_weight, weekly_rate_kg, created_at FROM user_goals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );
        const goal = goalResult.rows[0];
        if (!goal) return res.status(404).json({ message: "User goal not found" });

        const { weight, height, birthday, sex, activity_level_id } = user;
        const { weekly_rate_kg, created_at, goal_weight } = goal;
        const age = calculateAge(birthday); // ✅ compute age

        if (!age || isNaN(age)) {
            return res.status(400).json({ message: "Invalid birthday or age" });
        }
        const heightMeters = height / 100;
        const bmr = sex === "male"
            ? 10 * weight + 6.25 * height - 5 * age + 5
            : 10 * weight + 6.25 * height - 5 * age - 161;

        const activityResult = await db.query(
            `SELECT multiplier FROM activity_levels WHERE id = $1`,
            [activity_level_id]
        );
        const multiplier = activityResult.rows[0]?.multiplier ?? 1.2;
        const tdee = bmr * multiplier;

        const dailyCalChange = (weekly_rate_kg || 0) * 7700 / 7;
        const energyTarget = tdee + dailyCalChange;
        const deficit = Math.round(energyTarget - tdee);

        res.json({
           
            bmr: Math.round(bmr),
            tdee: Math.round(tdee),
            energyTarget: Math.round(energyTarget),
            energyDeficit: Math.round(deficit),
            goalType: goal_weight < weight ? "cut" : goal_weight > weight ? "bulk" : "maintenance",
        });
    } catch (err) {
        console.error("Error in /energy-summary:", err);
        res.status(500).json({ message: "Server error" });
    }
});
router.post("/weight-goal-tracking", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { goal_weight, weekly_rate_kg, goalType } = req.body;

    if (
        !goal_weight || typeof goal_weight !== "number" || goal_weight <= 0 ||
        !weekly_rate_kg || typeof weekly_rate_kg !== "number" ||
        !goalType || !["cut", "bulk", "maintenance"].includes(goalType)
    ) {
        return res.status(400).json({ message: "Invalid goal data" });
    }

    try {
        await db.query(
            `INSERT INTO user_goals (user_id, goal_weight, weekly_rate_kg, goalType)
             VALUES ($1, $2, $3, $4)`,
            [userId, goal_weight, weekly_rate_kg, goalType]
        );

        res.status(201).json({ message: "New goal created" });
    } catch (err) {
        console.error("Goal Creation Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});
module.exports = router;
