// Graph Data Structure for Smart Stadium Nav
// Maps all walkable paths, concourses, and amenities

export interface GraphNode {
    id: string;
    x: number;
    y: number;
    type: string;
    name: string;
    baseWait?: number;
    waitTime?: number;
    forecastWait?: number;
}

export const GraphNodes: Record<string, GraphNode> = {
    // ---- Concourse Path Intersections (Walkways) ----
    'C1': { id: 'C1', x: 20, y: 25, type: 'path', name: 'NW Concourse' },
    'C2': { id: 'C2', x: 50, y: 25, type: 'path', name: 'N Concourse' },
    'C3': { id: 'C3', x: 80, y: 25, type: 'path', name: 'NE Concourse' },
    'C4': { id: 'C4', x: 80, y: 50, type: 'path', name: 'E Concourse' },
    'C5': { id: 'C5', x: 80, y: 75, type: 'path', name: 'SE Concourse' },
    'C6': { id: 'C6', x: 50, y: 75, type: 'path', name: 'S Concourse' },
    'C7': { id: 'C7', x: 20, y: 75, type: 'path', name: 'SW Concourse' },
    'C8': { id: 'C8', x: 20, y: 50, type: 'path', name: 'W Concourse' },
    
    // User Start Location hook
    'USER': { id: 'USER', x: 50, y: 90, type: 'path', name: 'Your Location' },

    // ---- Amenities (Destinations) ----
    '1': { id: '1', x: 45, y: 15, type: 'restroom', name: 'Northgate Restrooms', baseWait: 5, waitTime: 5, forecastWait: 5 },
    '2': { id: '2', x: 90, y: 70, type: 'restroom', name: 'East Concourse Restrooms', baseWait: 15, waitTime: 15, forecastWait: 15 },
    '3': { id: '3', x: 55, y: 85, type: 'restroom', name: 'South End Restrooms', baseWait: 8, waitTime: 8, forecastWait: 8 },
    '4': { id: '4', x: 10, y: 50, type: 'food', name: 'Classic Burgers', baseWait: 20, waitTime: 20, forecastWait: 20 },
    '5': { id: '5', x: 85, y: 35, type: 'food', name: 'Beverages Gate C', baseWait: 2, waitTime: 2, forecastWait: 2 },
    '6': { id: '6', x: 50, y: 5, type: 'exit', name: 'Main Exit North', baseWait: 0, waitTime: 0, forecastWait: 0 },
    '7': { id: '7', x: 95, y: 50, type: 'exit', name: 'Gate B Exit', baseWait: 0, waitTime: 0, forecastWait: 0 }
};

// Connections [nodeA, nodeB]
export const GraphEdges: [string, string][] = [
    // Main Concourse Loop
    ['C1', 'C2'], ['C2', 'C3'], ['C3', 'C4'], ['C4', 'C5'],
    ['C5', 'C6'], ['C6', 'C7'], ['C7', 'C8'], ['C8', 'C1'],
    ['C2', 'C6'], // Center cut-through across the top of stands (fastest path if empty)
    
    // Connect User to nearby concourse
    ['USER', 'C6'],
    ['USER', '3'], // User is very close to south restrooms

    // Connect Amenities to Concourses
    ['1', 'C2'],
    ['2', 'C5'], ['2', 'C4'],
    ['3', 'C6'],
    ['4', 'C8'],
    ['5', 'C3'], ['5', 'C4'],
    ['6', 'C2'],
    ['7', 'C4']
];

export interface DijkstraResult {
    path: string[];
    totalCost: number;
}

// Graph Engine handling Dijkstra's Algorithm
export const GraphEngine = {
    getDistance(n1: GraphNode, n2: GraphNode): number {
        return Math.sqrt(Math.pow(n2.x - n1.x, 2) + Math.pow(n2.y - n1.y, 2));
    },

    // Advanced Formula: Cost = Physical Distance + (CrowdDensity^2 * Weight) + (PredictedSurge * SurgeFactor)
    getCost(edgeStart: string, edgeCurrent: string, targetNodeId: string, ignoreWait: boolean = false): number {
        let n1 = GraphNodes[edgeStart];
        let n2 = GraphNodes[edgeCurrent];
        
        if (!n1 || !n2) return Infinity;

        let distWeight = this.getDistance(n1, n2);
        
        let waitPenalty = 0;
        let surgePenalty = 0;
        
        if (!ignoreWait && n2.waitTime !== undefined) {
            // Quadratic penalty: Small wait times have minimal effect, massive wait times (density) spike the cost exponentially
            const squaredDensity = Math.pow(n2.waitTime, 2);
            
            // Apply different weight distributions based on destination vs passthrough
            if (edgeCurrent === targetNodeId) {
                waitPenalty = squaredDensity * 0.8; // High weight for the ending destination wait
            } else {
                waitPenalty = squaredDensity * 0.3; // Noticeable penalty for just passing through a crowded node
            }
            
            // Factor in predictive surge if available from engine
            if (n2.forecastWait !== undefined && n2.forecastWait > n2.waitTime) {
                surgePenalty = (n2.forecastWait - n2.waitTime) * 5.0; // SurgeFactor multiplier
            }
        }

        return distWeight + waitPenalty + surgePenalty;
    },

    // Returns array of node IDs for the optimal path
    dijkstra(startId: string, endId: string, ignoreWait: boolean = false): DijkstraResult {
        const distances: Record<string, number> = {};
        const prev: Record<string, string | null> = {};
        const pq = new Set(Object.keys(GraphNodes));

        // Initialize
        for(let node of pq) {
            distances[node] = Infinity;
            prev[node] = null;
        }
        distances[startId] = 0;

        while(pq.size > 0) {
            // Extract Min
            let minNode: string | null = null;
            for(let node of pq) {
                if(minNode === null || distances[node] < distances[minNode]) {
                    minNode = node;
                }
            }

            if(minNode === null || distances[minNode] === Infinity) break;
            if(minNode === endId) break; // Found shortest path

            pq.delete(minNode);

            // Get neighbors
            const neighbors = this.getNeighbors(minNode);
            for(let neighbor of neighbors) {
                if(!pq.has(neighbor)) continue;

                let altCost = distances[minNode] + this.getCost(minNode, neighbor, endId, ignoreWait);
                if(altCost < distances[neighbor]) {
                    distances[neighbor] = altCost;
                    prev[neighbor] = minNode;
                }
            }
        }

        // Reconstruct path
        const path: string[] = [];
        let u: string | null = endId;
        if(prev[u] !== null || u === startId) {
            while(u !== null) {
                path.unshift(u);
                u = prev[u];
            }
        }
        return { path, totalCost: distances[endId] };
    },

    getNeighbors(nodeId: string): string[] {
        const neighbors: string[] = [];
        GraphEdges.forEach(edge => {
            if(edge[0] === nodeId) neighbors.push(edge[1]);
            if(edge[1] === nodeId) neighbors.push(edge[0]);
        });
        return neighbors;
    },

    getPhysicallyClosestNodeCost(type: string): { node: GraphNode, normalTime: number } | null {
        let bestNode: GraphNode | null = null;
        let lowestDistance = Infinity;

        // Find the node of requested type with smallest physical distance
        Object.values(GraphNodes).filter(n => n.type === type).forEach(node => {
            const tempResult = this.dijkstra('USER', node.id, true); // Ignore crowd, find physical shortest
            if (tempResult.totalCost < lowestDistance) {
                lowestDistance = tempResult.totalCost;
                bestNode = node;
            }
        });
        
        if (!bestNode) return null;
        // Return the actual experiential baseline if they blindly walked to the closest physical node
        return { node: bestNode, normalTime: this.dijkstra('USER', bestNode.id, false).totalCost };
    }
};

// Global Window mapping for Front-End (if executing in Browser context)
if (typeof window !== 'undefined') {
    (window as any).GraphNodes = GraphNodes;
    (window as any).GraphEdges = GraphEdges;
    (window as any).GraphEngine = GraphEngine;
}
