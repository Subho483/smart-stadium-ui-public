import express from 'express';
import cors from 'cors';
import engine from './engine';
import path from 'path';
import { Server } from 'socket.io';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const PORT = process.env.PORT || 4000;

// Security: Rate Limiting (Loophole 5.4)
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests generated from this IP, please try again later'
});

app.use(cors());
app.use(express.json());
app.use(limiter);

// Serve static frontend
// When compiled, __dirname = dist/server, so go two levels up to reach project root
const projectRoot = path.join(__dirname, '../../');
app.use(express.static(path.join(projectRoot, 'client')));
app.use('/shared', express.static(path.join(projectRoot, 'shared')));

// ---------- HEALTH CHECK (for Render) ----------
app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// ---------- API ROUTES ----------

// Legacy Fallback Telemetry (mostly replaced by WebSockets)
app.get('/api/stadium/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: Date.now(),
        nodes: engine.state.nodes || {},
        surgeState: engine.state.surgeModifiers
    });
});

// Structural Debug
app.get('/api/stadium/full-state', (req, res) => {
    res.json(engine.state);
});

// Event Trigger APIs
app.post('/api/trigger/:eventType', (req, res) => {
    const eventParams = req.params.eventType.toUpperCase();
    if(!['GOAL', 'HALFTIME', 'END_MATCH'].includes(eventParams)) {
        return res.status(400).json({ error: 'Invalid Surge Event' });
    }
    const triggerResult = engine.triggerEvent(eventParams);
    console.log(`[${new Date().toISOString()}] EVENT: ${eventParams}`);
    res.json(triggerResult);
});

// Loophole 2.1: Multi-Agent Inflight Route Predictor API
app.post('/api/route', (req, res) => {
    const { routeIds } = req.body;
    if (Array.isArray(routeIds)) {
        engine.registerInflightLoad(routeIds);
    }
    res.json({ success: true });
});

// ---------- WEBSOCKET PUSH (Loophole 3.4) ----------
io.on('connection', (socket) => {
    // Push immediate state on connect
    socket.emit('stadium-tick', engine.state);
});

// Continuous simulation 10Hz Broadcast Loop
setInterval(() => {
    engine.tick();
    // Blast updates strictly over WebSocket rather than waiting for HTTP pull
    io.emit('stadium-tick', engine.state);
}, 100);

httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Smart Venue Node System Active on port ${PORT}`);
});
