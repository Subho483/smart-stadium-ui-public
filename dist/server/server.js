"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const engine_1 = __importDefault(require("./engine"));
const path_1 = __importDefault(require("path"));
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, { cors: { origin: '*' } });
const PORT = process.env.PORT || 4000;
// Security: Rate Limiting (Loophole 5.4)
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests generated from this IP, please try again later'
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(limiter);
// Serve static frontend
app.use(express_1.default.static(path_1.default.join(__dirname, '../client')));
app.use('/shared', express_1.default.static(path_1.default.join(__dirname, '../shared')));
// ---------- API ROUTES ----------
// Legacy Fallback Telemetry (mostly replaced by WebSockets)
app.get('/api/stadium/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: Date.now(),
        nodes: engine_1.default.state.nodes || {},
        surgeState: engine_1.default.state.surgeModifiers
    });
});
// Structural Debug
app.get('/api/stadium/full-state', (req, res) => {
    res.json(engine_1.default.state);
});
// Event Trigger APIs
app.post('/api/trigger/:eventType', (req, res) => {
    const eventParams = req.params.eventType.toUpperCase();
    if (!['GOAL', 'HALFTIME', 'END_MATCH'].includes(eventParams)) {
        return res.status(400).json({ error: 'Invalid Surge Event' });
    }
    const triggerResult = engine_1.default.triggerEvent(eventParams);
    console.log(`[${new Date().toISOString()}] EVENT: ${eventParams}`);
    res.json(triggerResult);
});
// Loophole 2.1: Multi-Agent Inflight Route Predictor API
app.post('/api/route', (req, res) => {
    const { routeIds } = req.body;
    if (Array.isArray(routeIds)) {
        engine_1.default.registerInflightLoad(routeIds);
    }
    res.json({ success: true });
});
// ---------- WEBSOCKET PUSH (Loophole 3.4) ----------
io.on('connection', (socket) => {
    // Push immediate state on connect
    socket.emit('stadium-tick', engine_1.default.state);
});
// Continuous simulation 10Hz Broadcast Loop
setInterval(() => {
    engine_1.default.tick();
    // Blast updates strictly over WebSocket rather than waiting for HTTP pull
    io.emit('stadium-tick', engine_1.default.state);
}, 100);
httpServer.listen(PORT, () => {
    console.log(`🚀 Smart Venue Node System Active on port ${PORT}`);
});
