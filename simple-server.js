const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('<h1>BlueOrion QMS is Online</h1>');
});

app.post('/test-save', (req, res) => {
    console.log("SUCCESS! Data received:", req.body);
    res.json({ status: "success" });
});

app.listen(PORT, () => {
    console.log(Server is running on http://localhost:${PORT});
});
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('<h1>BlueOrion QMS is Online</h1>');
});

// A simple test route
app.post('/test-save', (req, res) => {
    console.log("SUCCESS! Data received.");
    res.json({ status: "success" });
});

// Try to start the server and log any error
try {
    app.listen(PORT, () => {
        console.log(Server is running on http://localhost:${PORT});
    });
} catch (err) {
    console.error("CRITICAL ERROR:", err);
}