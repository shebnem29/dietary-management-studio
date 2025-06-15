const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const deletedUsersStack = [];
function linearSearch(users, key, field) {
  const lowerTerm = term.toLowerCase();
  return array.filter(item => item[key]?.toLowerCase().includes(lowerTerm));
}
// PATCH /api/users/update-profile
router.patch("/update-profile", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { sex, height, weight, birthday, activity_level_id, physiological_state } = req.body;

  const validOptions = ["male", "female"];
  const validStates = ["none", "pregnant", "breastfeeding", "menopause"];

  if (sex && !validOptions.includes(sex)) {
    return res.status(400).json({ message: "Invalid sex option" });
  }

  if (physiological_state && !validStates.includes(physiological_state)) {
    return res.status(400).json({ message: "Invalid physiological state" });
  }

  if (height && (typeof height !== "number" || height <= 0)) {
    return res.status(400).json({ message: "Invalid height value" });
  }

  if (weight && (typeof weight !== "number" || weight <= 0)) {
    return res.status(400).json({ message: "Invalid weight value" });
  }

  if (birthday) {
    const date = new Date(birthday);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: "Invalid birthday value" });
    }
  }
  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (sex) {
      fields.push(`sex = $${i++}`);
      values.push(sex);
    }
    if (height) {
      fields.push(`height = $${i++}`);
      values.push(height);
    }
    if (weight) {
      fields.push(`weight = $${i++}`);
      values.push(weight);
    }
    if (birthday) {
      fields.push(`birthday = $${i++}`);
      values.push(birthday);
    }
    if (activity_level_id) {
      fields.push(`activity_level_id = $${i++}`);
      values.push(activity_level_id);
    }
    if (physiological_state) {
      fields.push(`physiological_state = $${i++}`);
      values.push(physiological_state);
    }
    if (fields.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(", ")} WHERE id = $${i}`;
    await db.query(query, values);

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/me", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT sex, height, weight, birthday, activity_level_id FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Calculate age from birthday
    const birthDate = new Date(user.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    res.json({
      sex: user.sex,
      height: user.height,
      weight: user.weight,
      age: age,
      activity_level_id: user.activity_level_id,
    });
  } catch (err) {
    console.error("Fetch User Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/", authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: "Only super admins can view all users" });
  }

  try {
    const result = await db.query(
      "SELECT id, name, email, verified FROM users"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch all users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.put("/:id", authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: "Only super admins can update users" });
  }

  const { id } = req.params;
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required" });
  }

  try {
    const result = await db.query(
      "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id",
      [name, email, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.delete("/:id", authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: "Only super admins can delete users" });
  }

  const { id } = req.params;

  try {
    const result = await db.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Push the deleted user onto the stack
    deletedUsersStack.push(result.rows[0]);

    res.json({ message: "User deleted successfully", undoAvailable: true });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/undo-delete", authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: "Only super admins can undo deletions" });
  }

  if (deletedUsersStack.length === 0) {
    return res.status(400).json({ message: "Nothing to undo" });
  }

  const user = deletedUsersStack.pop(); // LIFO

  try {
    await db.query(`
      INSERT INTO users (id, name, email, password, verified, birthday, height, weight, sex, physiological_state, activity_level_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      user.id, user.name, user.email, user.password, user.verified,
      user.birthday, user.height, user.weight, user.sex,
      user.physiological_state, user.activity_level_id
    ]);

    res.json({ message: "User restored successfully", user });
  } catch (err) {
    console.error("Undo delete error:", err);
    res.status(500).json({ message: "Failed to restore user" });
  }
});


// GET /api/users/search?name=John&email=gmail
router.get('/search', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: 'Only super admins can search users' });
  }

  const { name = '', email = '' } = req.query;

  if (!name && !email) {
    return res.status(400).json({ message: 'Provide name or email to search' });
  }

  // Case-insensitive linear search with partial match
  function linearSearch(array, term, key) {
    const lowerTerm = term.toLowerCase();
    return array.filter(item => item[key]?.toLowerCase().includes(lowerTerm));
  }

  try {
    const result = await db.query(
      'SELECT id, name, email, verified FROM users'
    );
    const users = result.rows;

    let matches = [];

    if (name) {
      matches = [...matches, ...linearSearch(users, name, 'name')];
    }

    if (email) {
      matches = [...matches, ...linearSearch(users, email, 'email')];
    }

    // Remove duplicates by user id
    const uniqueMatches = Array.from(new Map(matches.map(u => [u.id, u])).values());

    if (uniqueMatches.length === 0) {
      return res.status(404).json({ message: 'No matching users found' });
    }

    res.json(uniqueMatches);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/filter', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: 'Only super admins can filter users' });
  }

  const {
    verified, sex, activity_level_id, physiological_state,
    minWeight, maxWeight, minHeight, maxHeight
  } = req.query;

  try {
    const result = await db.query('SELECT * FROM users');
    let users = result.rows;

    if (verified === 'true') users = users.filter(u => u.verified === true);
    if (verified === 'false') users = users.filter(u => u.verified === false);

    if (sex) users = users.filter(u => u.sex === sex);
    if (activity_level_id) users = users.filter(u => u.activity_level_id == activity_level_id);
    if (physiological_state) users = users.filter(u => u.physiological_state === physiological_state);

    if (minWeight) users = users.filter(u => u.weight >= parseFloat(minWeight));
    if (maxWeight) users = users.filter(u => u.weight <= parseFloat(maxWeight));
    if (minHeight) users = users.filter(u => u.height >= parseFloat(minHeight));
    if (maxHeight) users = users.filter(u => u.height <= parseFloat(maxHeight));

    res.json(users);
  } catch (err) {
    console.error('Filter users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/users-with-goals', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id AS user_id,
        u.name,
        u.email,
        g.id AS goal_id,
        g.goal_weight,
        g.created_at,
        g.weekly_rate_kg,
        g.active,
        g.name AS goal_type_name
      FROM users u
      LEFT JOIN LATERAL (
        SELECT 
          ug.*,
          gt.name
        FROM user_goals ug
        LEFT JOIN goal_types gt ON ug.goal_type_id = gt.id
        WHERE ug.user_id = u.id
        ORDER BY ug.active DESC, ug.created_at DESC
        LIMIT 1
      ) g ON true
      ORDER BY u.id;
    `);

    const usersWithGoals = result.rows.map(row => ({
      id: row.user_id,
      name: row.name,
      email: row.email,
      goal: row.goal_id
        ? {
            goal_weight: row.goal_weight,
            created_at: row.created_at,
            weekly_rate_kg: row.weekly_rate_kg,
            goal_type_name: row.goal_type_name,
            active: row.active,
          }
        : null,
    }));

    res.json(usersWithGoals);
  } catch (err) {
    console.error('Error fetching users with goals:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/:id/goals-history', async (req, res) => {
  const userId = req.params.id;

  try {
    const result = await db.query(
      `
      SELECT 
        ug.id AS goal_id,
        ug.goal_weight,
        ug.created_at,
        ug.weekly_rate_kg,
        ug.active,
        gt.name AS goal_type_name
      FROM user_goals ug
      LEFT JOIN goal_types gt ON ug.goal_type_id = gt.id
      WHERE ug.user_id = $1
      ORDER BY ug.created_at DESC;
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching goal history for user', userId, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
module.exports = router;
