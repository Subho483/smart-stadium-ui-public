class VirtualSurgeEngine {
    constructor() {
        this.simState = 'normal';
        this.destinations = [
            { id: '1', type: 'restroom', baseWait: 5 },
            { id: '2', type: 'restroom', baseWait: 15 },
            { id: '3', type: 'restroom', baseWait: 8 },
            { id: '4', type: 'food', baseWait: 20 },
            { id: '5', type: 'food', baseWait: 2 },
            { id: '6', type: 'exit', baseWait: 0 },
            { id: '7', type: 'exit', baseWait: 0 }
        ];
        this.surgeModifiers = {};
        
        // Explicit unified global state tracking
        this.state = {
            destinations: this.destinations,
            surgeModifiers: this.surgeModifiers,
            tick: Date.now() / 1000,
            events: []
        };
    }

    triggerEvent(eventCode) {
        this.state.events.push({ code: eventCode, timestamp: new Date().toISOString() });
        
        switch(eventCode) {
            case 'GOAL':
                // Spike food zones heavily
                this.destinations.forEach(node => {
                    if(node.type === 'food') this.surgeModifiers[node.id] = Math.min(50, (this.surgeModifiers[node.id] || 0) + 15);
                });
                break;
            case 'HALFTIME':
                // Spike restrooms exponentially
                this.simState = 'halftime';
                this.destinations.forEach(node => {
                    if(node.type === 'restroom') this.surgeModifiers[node.id] = Math.min(50, (this.surgeModifiers[node.id] || 0) + 25);
                });
                break;
            case 'END_MATCH':
                this.simState = 'peak'; // Upgraded event state handler
                this.destinations.forEach(node => {
                    if(node.type === 'exit') {
                        // Exits become chaotic
                        this.surgeModifiers[node.id] = 50; 
                    } else {
                        // People leave food and bathrooms to leave stadium
                        this.surgeModifiers[node.id] = (this.surgeModifiers[node.id] || 0) * 0.1;
                    }
                });
                break;
        }
        return { success: true, event: eventCode };
    }

    tick() {
        this.state.tick = Date.now() / 1000; // Time-based simulation vs naive iterations
        const updates = {};
        
        // Decay active surges over time to simulate lines shrinking back to normal
        Object.keys(this.surgeModifiers).forEach(id => {
            if(this.surgeModifiers[id] > 0) {
                this.surgeModifiers[id] = Math.max(0, this.surgeModifiers[id] - 0.5); // Decay
            }
        });

        this.destinations.forEach(node => {
            if (node.type === 'exit' && !(node.id in this.surgeModifiers)) {
                updates[node.id] = { waitTime: 0, forecastWait: 0 };
                return;
            }

            let multiplier = 1.0;
            if (this.simState === 'halftime') multiplier = 1.5;
            if (this.simState === 'peak') multiplier = 2.0;

            const baseOscillation = Math.sin(this.state.tick + parseInt(node.id)) * 3;
            // Real-time offset forward for forecasting
            const futureOscillation = Math.sin((this.state.tick + 10) + parseInt(node.id)) * 3;
            
            const surge = this.surgeModifiers[node.id] || 0;

            const val = Math.max(1, Math.round((node.baseWait * multiplier) + baseOscillation + surge));
            // Forecast expects surge to decay somewhat
            const forecast = Math.max(1, Math.round((node.baseWait * multiplier) + futureOscillation + (surge * 0.8)));

            updates[node.id] = {
                waitTime: val,
                forecastWait: forecast
            };
        });

        // Update the central state snapshot mapping
        this.state.nodes = updates;
        return updates;
    }
}

module.exports = new VirtualSurgeEngine();
