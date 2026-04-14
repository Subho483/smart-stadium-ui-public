export interface StadiumNode {
    id: string;
    type: 'restroom' | 'food' | 'exit' | 'path';
    baseWait: number;
    capacity: number;
    serviceRate: number; // people served per second
    currentLoad: number;
    inflightLoad: number; // planned routing to here
}

export interface StadiumEvent {
    code: string;
    timestamp: string;
}

export interface NodeState {
    waitTime: number;
    forecastWait: number;
}

export interface StadiumState {
    destinations: StadiumNode[];
    surgeModifiers: Record<string, number>;
    tick: number;
    events: StadiumEvent[];
    nodes?: Record<string, NodeState>;
}

class VirtualSurgeEngine {
    public simState: 'normal' | 'halftime' | 'peak' = 'normal';
    public destinations: StadiumNode[];
    public surgeModifiers: Record<string, number> = {};
    public state: StadiumState;

    constructor() {
        this.destinations = [
            { id: '1', type: 'restroom', baseWait: 5, capacity: 50, serviceRate: 2, currentLoad: 0, inflightLoad: 0 },
            { id: '2', type: 'restroom', baseWait: 15, capacity: 80, serviceRate: 3, currentLoad: 0, inflightLoad: 0 },
            { id: '3', type: 'restroom', baseWait: 8, capacity: 30, serviceRate: 1.5, currentLoad: 0, inflightLoad: 0 },
            { id: '4', type: 'food', baseWait: 20, capacity: 100, serviceRate: 5, currentLoad: 0, inflightLoad: 0 },
            { id: '5', type: 'food', baseWait: 2, capacity: 40, serviceRate: 2, currentLoad: 0, inflightLoad: 0 },
            { id: '6', type: 'exit', baseWait: 0, capacity: 500, serviceRate: 50, currentLoad: 0, inflightLoad: 0 },
            { id: '7', type: 'exit', baseWait: 0, capacity: 300, serviceRate: 30, currentLoad: 0, inflightLoad: 0 }
        ];

        this.state = {
            destinations: this.destinations,
            surgeModifiers: this.surgeModifiers,
            tick: Date.now() / 1000,
            events: []
        };
    }

    triggerEvent(eventCode: string) {
        this.state.events.push({ code: eventCode, timestamp: new Date().toISOString() });
        
        switch(eventCode) {
            case 'GOAL':
                this.destinations.forEach(node => {
                    if(node.type === 'food') this.surgeModifiers[node.id] = Math.min(50, (this.surgeModifiers[node.id] || 0) + 15);
                });
                break;
            case 'HALFTIME':
                this.simState = 'halftime';
                this.destinations.forEach(node => {
                    if(node.type === 'restroom') this.surgeModifiers[node.id] = Math.min(50, (this.surgeModifiers[node.id] || 0) + 25);
                });
                break;
            case 'END_MATCH':
                this.simState = 'peak'; 
                this.destinations.forEach(node => {
                    if(node.type === 'exit') {
                        this.surgeModifiers[node.id] = 50; 
                    } else {
                        // People evacuate amenities
                        this.surgeModifiers[node.id] = (this.surgeModifiers[node.id] || 0) * 0.1;
                    }
                });
                break;
        }
        return { success: true, event: eventCode };
    }

    registerInflightLoad(routeIds: string[]) {
        // Multi-Agent Intent Tracking (Loophole 2.1)
        routeIds.forEach(id => {
            const node = this.destinations.find(n => n.id === id);
            if(node) node.inflightLoad += 1; 
        });
    }

    tick(): Record<string, NodeState> {
        this.state.tick = Date.now() / 1000; 
        const updates: Record<string, NodeState> = {};
        
        Object.keys(this.surgeModifiers).forEach(id => {
            if(this.surgeModifiers[id] > 0) {
                this.surgeModifiers[id] = Math.max(0, this.surgeModifiers[id] - 0.5); 
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

            const surge = this.surgeModifiers[node.id] || 0;
            
            // Loophole 1.2: Capacity Constraint & Loophole 2.1: Inflight Load
            const effectiveLoad = node.baseWait + surge + (node.inflightLoad * 0.2); 
            
            // Loophole 1.3: Service Rate Attrition Mechanism
            const capacityPenalty = effectiveLoad > node.capacity ? (effectiveLoad - node.capacity) * 0.5 : 0;
            
            const val = Math.max(1, Math.round((effectiveLoad * multiplier) + capacityPenalty));
            
            // Forecast extrapolates inflight load maturing into actual load
            const forecast = Math.max(1, Math.round(val + (node.inflightLoad * 0.5) - (node.serviceRate * 0.5)));

            // Decay inflight load dynamically as they "arrive"
            node.inflightLoad = Math.max(0, node.inflightLoad - node.serviceRate * 0.2);

            updates[node.id] = {
                waitTime: val,
                forecastWait: forecast
            };
        });

        this.state.nodes = updates;
        return updates;
    }
}

const engineInstance = new VirtualSurgeEngine();
export default engineInstance;
