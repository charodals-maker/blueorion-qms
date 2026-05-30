const express = require('express');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send('<h1>BlueOrion QMS is Online</h1>');
});

app.post('/test-save', (req, res) => {
    console.log("SUCCESS! Data received:", req.body);
    res.json({ status: "success" });
});

// Start Server
app.listen(PORT, () => {
   console.log("Server is running on http://localhost:3000");
});