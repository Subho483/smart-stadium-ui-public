"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const engine_1 = __importDefault(require("../server/engine"));
(0, globals_1.describe)('VirtualSurgeEngine Integration Tests', () => {
    (0, globals_1.beforeEach)(() => {
        // Reset state before each test
        engine_1.default.simState = 'normal';
        engine_1.default.surgeModifiers = {};
        engine_1.default.state.events = [];
    });
    (0, globals_1.test)('Initial deployment possesses 7 valid destination nodes', () => {
        (0, globals_1.expect)(engine_1.default.destinations.length).toBe(7);
        (0, globals_1.expect)(engine_1.default.state.destinations).toBeDefined();
    });
    (0, globals_1.test)('HALFTIME event correctly limits restroom surges tightly at structural caps', () => {
        // Trigger multiple back to back to ensure Math.min(50, ...) holds limit
        engine_1.default.triggerEvent('HALFTIME');
        engine_1.default.triggerEvent('HALFTIME');
        engine_1.default.triggerEvent('HALFTIME');
        (0, globals_1.expect)(engine_1.default.simState).toBe('halftime');
        const restroomNode = engine_1.default.destinations.find(n => n.type === 'restroom');
        // Because of Math.min(50, current + 25), 3 triggers shouldn't exceed 50.
        (0, globals_1.expect)(engine_1.default.surgeModifiers[restroomNode.id]).toBeLessThanOrEqual(50);
    });
    (0, globals_1.test)('Dynamic decay mechanically shrinks surges over forward time', () => {
        engine_1.default.triggerEvent('GOAL');
        const foodNode = engine_1.default.destinations.find(n => n.type === 'food');
        const initialSurge = engine_1.default.surgeModifiers[foodNode.id];
        (0, globals_1.expect)(initialSurge).toBeGreaterThan(0);
        // Run sequential topological ticks
        engine_1.default.tick();
        engine_1.default.tick();
        engine_1.default.tick();
        const decayedSurge = engine_1.default.surgeModifiers[foodNode.id];
        // After 3 ticks, wait penalty should drop incrementally by 0.5 rules 
        (0, globals_1.expect)(decayedSurge).toBeLessThan(initialSurge);
    });
    (0, globals_1.test)('END_MATCH immediately collapses non-exit queues', () => {
        engine_1.default.triggerEvent('GOAL'); // Spikes food
        engine_1.default.triggerEvent('END_MATCH'); // Sets peak, crushes food
        const foodNode = engine_1.default.destinations.find(n => n.type === 'food');
        (0, globals_1.expect)(engine_1.default.surgeModifiers[foodNode.id]).toBeLessThan(2); // Since 15 * 0.1 = 1.5
        const exitNode = engine_1.default.destinations.find(n => n.type === 'exit');
        (0, globals_1.expect)(engine_1.default.surgeModifiers[exitNode.id]).toBe(50); // Hardcoded panic 
    });
});
