const express = require('express');
const config = require('./config');
const chatRoutes = require('./api/routes/chatRoutes');
const db = require('./database/database');
const cors = require('cors'); // <-- ADD THIS LINE

const app = express();

app.use(cors()); // <-- AND ADD THIS LINE
app.use(express.json());

app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => {
  res.send('AI Support Bot API is running.');
});

app.listen(config.port, () => {
  console.log(`Server is running on http://localhost:${config.port}`);
});
