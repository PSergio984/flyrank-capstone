-- Stage 4: the five queries from the assignment, run manually against tasks.db
-- (any SQLite viewer works — DB Browser for SQLite is recommended)

-- List every task:
SELECT * FROM tasks;

-- Show only completed tasks:
SELECT * FROM tasks WHERE done = 1;

-- Count all tasks:
SELECT COUNT(*) FROM tasks;

-- Mark every task as completed:
UPDATE tasks SET done = 1;

-- Delete all completed tasks:
DELETE FROM tasks WHERE done = 1;
