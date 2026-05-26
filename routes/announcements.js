const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');

// 1. GET: Fetch the current active announcement for everyone's dashboard
router.get('/active', async (req, res) => {
    try {
        const activeAnnouncement = await Announcement.findOne({
            where: { isActive: true },
            order: [['createdAt', 'DESC']] // Grabs the latest one published
        });
        res.json(activeAnnouncement || { text: "", image: "" });
    } catch (error) {
        res.status(500).json({ error: "Failed to read database records" });
    }
});

// 2. POST: Save a new announcement and automatically archive old ones
router.post('/', async (req, res) => {
    try {
        const { text, image } = req.body;

        // Archive previous announcements so only the new one displays active
        await Announcement.update({ isActive: false }, { where: { isActive: true } });

        // Save the new entry to PostgreSQL
        const newAnnouncement = await Announcement.create({
            text: text,
            image: image,
            isActive: true
        });

        res.status(201).json(newAnnouncement);
    } catch (error) {
        res.status(500).json({ error: "Failed to write to live database" });
    }
});

// 3. POST: Clear the board across all live office systems
router.post('/clear', async (req, res) => {
    try {
        await Announcement.update({ isActive: false }, { where: { isActive: true } });
        res.json({ message: "Board successfully cleared across agency network" });
    } catch (error) {
        res.status(500).json({ error: "Failed to modify records" });
    }
});

module.exports = router;
