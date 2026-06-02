const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'ADMIN_DASHBOARD_LIVE.html'));
});

app.get('/qms-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'ADMIN_DASHBOARD_LIVE.html'));
});

app.post('/test-save', (req, res) => {
    console.log('SUCCESS! Data received:', req.body);
    res.json({ status: 'success' });
});

// Start Server
app.listen(PORT, () => {
   console.log(`Server is running on http://localhost:${PORT}`);
});