const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello, FlyRank!' });
});

app.get('/about', (req, res) => {
  res.json({
    name: 'Your Name',
    track: 'Backend AI Engineering',
    assignment: 'BE-01',
    week: 1,
    status: 'Learning Express.js'
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
