import { describe, test, expect, beforeEach } from '@jest/globals';
import engine from '../server/engine';

describe('VirtualSurgeEngine Integration Tests', () => {

    beforeEach(() => {
        // Reset state before each test
        engine.simState = 'normal';
        engine.surgeModifiers = {};
        engine.state.events = [];
    });

    test('Initial deployment possesses 7 valid destination nodes', () => {
        expect(engine.destinations.length).toBe(7);
        expect(engine.state.destinations).toBeDefined();
    });

    test('HALFTIME event correctly limits restroom surges tightly at structural caps', () => {
        // Trigger multiple back to back to ensure Math.min(50, ...) holds limit
        engine.triggerEvent('HALFTIME');
        engine.triggerEvent('HALFTIME');
        engine.triggerEvent('HALFTIME');

        expect(engine.simState).toBe('halftime');
        
        const restroomNode = engine.destinations.find(n => n.type === 'restroom');
        // Because of Math.min(50, current + 25), 3 triggers shouldn't exceed 50.
        expect(engine.surgeModifiers[restroomNode.id]).toBeLessThanOrEqual(50);
    });

    test('Dynamic decay mechanically shrinks surges over forward time', () => {
        engine.triggerEvent('GOAL');
        const foodNode = engine.destinations.find(n => n.type === 'food');
        
        const initialSurge = engine.surgeModifiers[foodNode.id];
        expect(initialSurge).toBeGreaterThan(0);

        // Run sequential topological ticks
        engine.tick();
        engine.tick();
        engine.tick();

        const decayedSurge = engine.surgeModifiers[foodNode.id];
        // After 3 ticks, wait penalty should drop incrementally by 0.5 rules 
        expect(decayedSurge).toBeLessThan(initialSurge);
    });

    test('END_MATCH immediately collapses non-exit queues', () => {
        engine.triggerEvent('GOAL'); // Spikes food
        engine.triggerEvent('END_MATCH'); // Sets peak, crushes food

        const foodNode = engine.destinations.find(n => n.type === 'food');
        expect(engine.surgeModifiers[foodNode.id]).toBeLessThan(2); // Since 15 * 0.1 = 1.5
        
        const exitNode = engine.destinations.find(n => n.type === 'exit');
        expect(engine.surgeModifiers[exitNode.id]).toBe(50); // Hardcoded panic 
    });

});
