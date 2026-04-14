require('dotenv').config();
const express = require('express');
const cors = require('cors');
const engine = require('./engine');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve the static frontend naturally natively via the Monorepo architecture
app.use(express.static(path.join(__dirname, '../client')));

// Serve shared algorithms if requested explicitly
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// ---------- API ROUTES ----------

// Long-polling / Standard Telemetry check
app.get('/api/stadium/status', (req, res) => {
    // Engine ticks automatically in the background now
    res.json({
        status: 'online',
        timestamp: Date.now(),
        nodes: engine.state.nodes || {},
        surgeState: engine.state.surgeModifiers
    });
});

// Full state endpoint for external debugging and tools
app.get('/api/stadium/full-state', (req, res) => {
    res.json(engine.state);
});

// Event Trigger APIs
app.post('/api/trigger/:eventType', (req, res) => {
    const eventParams = req.params.eventType.toUpperCase();
    
    // Explicit Validation
    if(!['GOAL', 'HALFTIME', 'END_MATCH'].includes(eventParams)) {
        return res.status(400).json({ error: 'Invalid Surge Event' });
    }

    const triggerResult = engine.triggerEvent(eventParams);
    console.log(`[${new Date().toISOString()}] EVENT: ${eventParams}`);
    res.json(triggerResult);
});

// Initialize continuous simulation loop (10Hz)
setInterval(() => {
    engine.tick();
}, 100);

app.listen(PORT, () => {
    console.log(`🚀 Smart Venue Node System Active on http://localhost:${PORT}`);
});
