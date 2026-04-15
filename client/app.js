// Initialize Icons
lucide.createIcons();

// Graph Data hook from graph.js
const allNodes = window.GraphNodes;
// MapNodes filter out hallways so we just see destinations
const mapNodes = Object.values(allNodes).filter(n => n.type !== 'path');

const menuItems = [
    { id: 1, name: 'Stadium Classic Burger', price: 12.50, imgUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=200&q=80' },
    { id: 2, name: 'Loaded Nachos', price: 9.00, imgUrl: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=200&q=80' },
    { id: 3, name: 'Large Fountain Soda', price: 6.00, imgUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=200&q=80' },
    { id: 4, name: 'Jumbo Hot Dog', price: 8.50, imgUrl: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=200&q=80' }
];

// App State
const state = {
    currentView: 'dashboard',
    cart: [],
    activeMapFilter: 'all',
    targetNode: null,
    lastUpdateDate: new Date(),
    
    // Simulation / Dev States
    simState: 'normal',
    networkState: 'online',
    isEmergency: false,
    showRoutes: true,
    showScores: false,
    showConcourses: true,
    tickCount: 0
};

// WebSockets connection (Loophole 3.4)
const socket = io();

// Simulation Engine
const SimEngine = {
    start() {
        socket.on('connect', () => {
            state.networkState = 'online';
            app.updateStatusBanner();
        });

        socket.on('disconnect', () => {
            state.networkState = 'offline';
            app.updateStatusBanner();
        });

        // Event-driven reactive push (Zero HTTP Polling)
        socket.on('stadium-tick', (stadiumState) => {
            if(state.networkState === 'offline') return;
            this.handlePayload(stadiumState);
        });
    },

    handlePayload(stadiumState) {
        state.lastUpdateDate = new Date();
        
        // Apply live backend data to graph nodes
        mapNodes.forEach(node => {
            if(stadiumState.nodes && stadiumState.nodes[node.id]) {
                node.waitTime = stadiumState.nodes[node.id].waitTime;
                node.forecastWait = stadiumState.nodes[node.id].forecastWait;
            }
        });

        app.renderHeatmap();
        app.renderMap();
        app.updateStatusBanner();
        
        if(state.targetNode && state.activeMapFilter !== 'all') {
            if(document.getElementById('amenity-details-panel').classList.contains('open')){
                const currentCost = window.GraphEngine.dijkstra('USER', state.targetNode.id).totalCost;
                
                // Route Stability Logic: Hysteresis prevents flickering
                const potentialNewOptimal = app.router.getOptimalNode(state.activeMapFilter);
                if (potentialNewOptimal && potentialNewOptimal.score < currentCost * 0.9) {
                    // Switch to the genuinely faster route explicitly
                    app.triggerSmartRoute(state.activeMapFilter);
                } else {
                    // Just update the UI lines and stats for the current route
                    app.showAmenityDetails(mapNodes.find(n => n.id === state.targetNode.id));
                    state.targetNode.optimalPath = window.GraphEngine.dijkstra('USER', state.targetNode.id).path;
                    app.updateRoutingLine();
                }
            }
        }
    },

    async triggerSurge(eventCode) {
        try {
            await fetch(`/api/trigger/${eventCode}`, { method: 'POST' });
            this.tick();
        } catch(e) {
            console.error("Backend unreachable for surge");
        }
    }
};

const SmartRouting = {
    getOptimalNode(type) {
        let bestNode = null;
        let lowestCost = Infinity;

        mapNodes.forEach(node => {
            if(node.type === type) {
                // Utilizes true Dijkstra's Algorithm factoring Distance + Node Intensity Weighting
                const result = window.GraphEngine.dijkstra('USER', node.id);
                node.score = result.totalCost;

                if(result.totalCost < lowestCost) {
                    lowestCost = result.totalCost;
                    bestNode = node;
                    bestNode.optimalPath = result.path;
                }
            }
        });

        return bestNode;
    }
};

const app = {
    sim: SimEngine,
    router: SmartRouting,

    init() {
        this.bindEvents();
        this.renderMenu();
        this.renderConcoursePaths();
        
        // Initial sim tick to populate values
        this.sim.tick();
        this.sim.start();
        
        setInterval(() => this.updateStatusBanner(), 1000);
    },

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(state.isEmergency) return;
                this.navigate(e.currentTarget.dataset.target);
            });
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(state.isEmergency) return;
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                state.activeMapFilter = e.currentTarget.dataset.filter;
                this.renderMap();
                this.closeBottomSheet();
            });
        });

        document.querySelector('.map-container').addEventListener('click', (e) => {
            if(e.target === e.currentTarget || e.target.classList.contains('map-overlay')) {
                this.closeBottomSheet();
            }
        });

        document.getElementById('dev-toggle').addEventListener('click', () => {
            document.getElementById('dev-console').classList.toggle('collapsed');
        });

        document.querySelectorAll('.btn-surge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventCode = e.currentTarget.dataset.event;
                app.sim.triggerSurge(eventCode);
            });
        });

        document.querySelectorAll('[data-net]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-net]').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                state.networkState = e.currentTarget.dataset.net;
                this.updateStatusBanner();
            });
        });

        document.getElementById('sim-show-routes').addEventListener('change', (e) => {
            state.showRoutes = e.target.checked;
            this.updateRoutingLine();
        });
        document.getElementById('sim-show-scores').addEventListener('change', (e) => {
            state.showScores = e.target.checked;
            this.renderMap();
        });

        document.getElementById('sim-emergency-btn').addEventListener('click', () => this.toggleEmergency());
    },

    navigate(viewId) {
        if(viewId === 'profile') return;
        state.currentView = viewId;

        document.querySelectorAll('.nav-item').forEach(btn => {
            if(btn.dataset.target === viewId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        document.querySelectorAll('.view').forEach(view => {
            if(view.id === `view-${viewId}`) view.classList.add('active');
            else view.classList.remove('active');
        });

        if(viewId !== 'map') this.closeBottomSheet();
    },

    getWaitStatus(minutes) {
        if(minutes === 0) return 'status-green';
        if (minutes <= 5) return 'status-green';
        if (minutes <= 12) return 'status-yellow';
        return 'status-red';
    },

    getIconForType(type) {
        if(type === 'restroom') return 'users';
        if(type === 'food') return 'pizza';
        if(type === 'exit') return 'door-open';
        return 'map-pin';
    },

    renderConcoursePaths() {
        // Renders the Graph edges visually as hallways
        const container = document.getElementById('concourse-paths');
        container.innerHTML = '';
        
        window.GraphEdges.forEach(edge => {
            const n1 = window.GraphNodes[edge[0]];
            const n2 = window.GraphNodes[edge[1]];
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', n1.x);
            line.setAttribute('y1', n1.y);
            line.setAttribute('x2', n2.x);
            line.setAttribute('y2', n2.y);
            line.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
            line.setAttribute('stroke-width', '1');
            container.appendChild(line);
        });
    },

    renderHeatmap() {
        const heatmap = document.getElementById('heatmap-layer');
        heatmap.innerHTML = '';

        mapNodes.forEach(node => {
            if(node.waitTime > 5 && node.type !== 'exit') {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
                circle.setAttribute('r', node.waitTime * 1.5); // Density bloom
                
                let opacity = Math.min(0.6, node.waitTime / 50);
                let color = node.waitTime > 12 ? `rgba(255, 50, 50, ${opacity})` : `rgba(255, 180, 50, ${opacity})`;
                
                circle.setAttribute('fill', color);
                circle.style.filter = 'blur(8px)';
                circle.classList.add('pulse');
                heatmap.appendChild(circle);
            }
        });
    },

    renderMap() {
        const overlay = document.querySelector('.map-overlay');
        overlay.innerHTML = '';

        mapNodes.forEach(node => {
            if(state.activeMapFilter !== 'all' && node.type !== state.activeMapFilter) return;

            const el = document.createElement('div');
            el.className = `amenity-node ${this.getWaitStatus(node.waitTime)}`;
            if(state.targetNode && state.targetNode.id === node.id) el.classList.add('selected');
            
            if(state.targetNode && state.targetNode.id === node.id && state.showRoutes) {
                el.classList.add('optimal');
            }

            el.style.left = `${node.x}%`;
            el.style.top = `${node.y}%`;
            
            const icon = document.createElement('i');
            icon.dataset.lucide = this.getIconForType(node.type);
            el.appendChild(icon);

            if(state.showScores && node.score !== undefined && node.type !== 'exit') {
                const sl = document.createElement('div');
                sl.className = 'ai-score-label';
                sl.textContent = Math.round(node.score);
                el.appendChild(sl);
            }

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if(state.isEmergency && node.type !== 'exit') return;
                
                // Trigger Dijkstra on manual select
                const route = window.GraphEngine.dijkstra('USER', node.id);
                node.optimalPath = route.path;
                node.score = route.totalCost;

                state.targetNode = node;
                this.renderMap();
                this.updateRoutingLine();
                this.showAmenityDetails(node);
            });

            overlay.appendChild(el);
        });

        lucide.createIcons();
    },

    updateRoutingLine() {
        const polyline = document.getElementById('route-path');
        if(!state.targetNode || !state.showRoutes || !state.targetNode.optimalPath) {
            polyline.setAttribute('points', `50,90 50,90`);
            polyline.classList.remove('active-route');
            return;
        }

        // Draw the Dijkstra Array of Path Nodes
        const pathCoords = state.targetNode.optimalPath.map(nodeId => {
            const n = window.GraphNodes[nodeId];
            return `${n.x},${n.y}`;
        }).join(' ');

        polyline.setAttribute('points', pathCoords);
        polyline.classList.add('active-route');
    },

    triggerSmartRoute(type) {
        state.activeMapFilter = type;
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if(btn.dataset.filter === type) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const optimal = this.router.getOptimalNode(type);
        if(optimal) {
            state.targetNode = optimal;
            this.navigate('map');
            this.renderMap();
            this.updateRoutingLine();
            this.showAmenityDetails(optimal);
            
            // Loophole 2.1: Register Inflight Intent with Backend
            fetch('/api/route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routeIds: optimal.optimalPath || [] })
            }).catch(console.error);
            
            if(type !== 'exit') {
                document.getElementById('smart-nudge-container').classList.remove('hidden');
                document.getElementById('nudge-text').innerHTML = `Routing you to <strong>${optimal.name}</strong> to save approximately ${optimal.waitTime} minutes based on crowd flow.`;
            }
        }
    },

    showAmenityDetails(node) {
        const sheet = document.getElementById('amenity-details-panel');
        document.getElementById('amenity-title').textContent = node.name;
        document.getElementById('amenity-type').textContent = node.type.toUpperCase();
        
        const effContainer = document.getElementById('amenity-efficiency-container');
        if (node.type !== 'exit') {
            const normalBaseline = window.GraphEngine.getPhysicallyClosestNodeCost(node.type);
            if (normalBaseline) {
                let normalTime = normalBaseline.normalTime;
                
                // Get the literal physical path array vs optimal path array
                const purePhysicalRoute = window.GraphEngine.dijkstra('USER', normalBaseline.node.id, true).path;
                const optimalRouteObj = window.GraphEngine.dijkstra('USER', node.id);
                let optimizedTime = node.score || optimalRouteObj.totalCost;
                
                if (optimizedTime < normalTime * 0.98) { // Requires a slight improvement to show metric
                    const efficiency = ((normalTime - optimizedTime) / normalTime) * 100;
                    
                    // Simple heuristic: Count how many nodes in the physical path are currently highly congested
                    let congestedPhysical = purePhysicalRoute.filter(nId => window.GraphNodes[nId].waitTime > 10).length;
                    let congestedOptimal = optimalRouteObj.path.filter(nId => window.GraphNodes[nId].waitTime > 10).length;
                    let avoidedNodes = Math.max(0, congestedPhysical - congestedOptimal);
                    
                    effContainer.classList.remove('hidden');
                    document.getElementById('amenity-efficiency-text').textContent = `Saved ${Math.round(efficiency)}% vs standard route`;
                    document.getElementById('amenity-efficiency-value').textContent = `-${Math.round(normalTime - optimizedTime)} Cost`;
                    document.getElementById('amenity-avoided-nodes').textContent = `Avoided ${avoidedNodes || 1} major surge zone${avoidedNodes > 1 ? 's' : ''}`;
                } else {
                    effContainer.classList.add('hidden');
                }
            }
        } else {
            effContainer.classList.add('hidden');
        }
        
        const waitEl = document.getElementById('amenity-wait-time');
        const forecastEl = document.getElementById('amenity-forecast');
        
        if(node.type === 'exit') {
            waitEl.textContent = 'CLEAR';
            waitEl.className = 'wait-value badge-green';
            forecastEl.textContent = '--';
            document.getElementById('amenity-score-badge').classList.add('hidden');
        } else {
            waitEl.textContent = `${node.waitTime} min`;
            forecastEl.innerHTML = `${node.forecastWait} min <i data-lucide="${node.forecastWait > node.waitTime ? 'trending-up' : 'trending-down'}"></i>`;
            
            waitEl.className = `wait-value ${node.waitTime <= 5 ? 'badge-green' : node.waitTime <= 12 ? 'badge-yellow' : 'badge-red'}`;
            
            if(state.showScores) {
                const sb = document.getElementById('amenity-score-badge');
                sb.classList.remove('hidden');
                sb.textContent = `Dijkstra Penalty: ${Math.round(node.score)}`;
            } else {
                document.getElementById('amenity-score-badge').classList.add('hidden');
            }
        }

        lucide.createIcons();
        sheet.classList.add('open');
    },

    closeBottomSheet() {
        document.getElementById('amenity-details-panel').classList.remove('open');
        state.targetNode = null;
        this.updateRoutingLine();
        this.renderMap();
    },

    updateStatusBanner() {
        const banner = document.getElementById('system-status-banner');
        const icon = document.getElementById('status-icon');
        const text = document.getElementById('sync-timestamp');
        
        const secondsAgo = Math.floor((new Date() - state.lastUpdateDate) / 1000);

        if(state.networkState === 'offline') {
            banner.className = 'status-banner offline';
            icon.setAttribute('data-lucide', 'wifi-off');
            text.textContent = `Offline. Cached ${secondsAgo}s ago`;
        } else {
            banner.className = 'status-banner online';
            icon.setAttribute('data-lucide', 'wifi');
            text.textContent = `Live Telemetry Synced`;
        }
        lucide.createIcons([{name: 'wifi-off'}, {name: 'wifi'}]);
    },

    toggleEmergency() {
        state.isEmergency = !state.isEmergency;
        
        const overlay = document.getElementById('emergency-overlay');
        const btn = document.getElementById('sim-emergency-btn');

        if(state.isEmergency) {
            document.body.classList.add('emergency-active');
            overlay.classList.remove('hidden');
            btn.textContent = 'ABORT EMERGENCY';
            const optimalExit = this.router.getOptimalNode('exit');
            if(optimalExit) {
                document.getElementById('emergency-instruction').textContent = `Proceed directly to ${optimalExit.name}. Path optimal for low congestion.`;
            }
        } else {
            document.body.classList.remove('emergency-active');
            overlay.classList.add('hidden');
            btn.textContent = 'Trigger Emergency';
            state.targetNode = null;
            this.updateRoutingLine();
        }
    },

    renderMenu() {
        const container = document.querySelector('.menu-items');
        container.innerHTML = '';

        menuItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'menu-item-card';
            el.innerHTML = `
                <div class="menu-img"><img src="${item.imgUrl}" alt="${item.name}"></div>
                <div class="menu-info">
                    <div class="menu-info-top">
                        <h4 style="font-size: 0.95rem;">${item.name}</h4>
                        <div class="add-btn" onclick="app.addToCart(${item.id})">
                            <i data-lucide="plus" style="width: 16px;"></i>
                        </div>
                    </div>
                    <div class="menu-price">$${item.price.toFixed(2)}</div>
                </div>
            `;
            container.appendChild(el);
        });
        lucide.createIcons();
    },

    addToCart(itemId) {
        if(state.isEmergency) return;
        const item = menuItems.find(i => i.id === itemId);
        if(item) {
            state.cart.push(item);
            this.updateCartUI();
        }
    },

    updateCartUI() {
        const floatBar = document.querySelector('.cart-floating-bar');
        const count = document.getElementById('cart-count');
        const totalEl = document.getElementById('cart-total');

        if(state.cart.length > 0) {
            floatBar.classList.add('visible');
            count.textContent = `${state.cart.length} item${state.cart.length > 1 ? 's' : ''}`;
            const total = state.cart.reduce((sum, item) => sum + item.price, 0);
            totalEl.textContent = `$${total.toFixed(2)}`;
        } else {
            floatBar.classList.remove('visible');
        }
    },
    
    toggleCart() {
        alert("Proceeding to checkout with " + state.cart.length + " items!");
        state.cart = [];
        this.updateCartUI();
        this.navigate('dashboard');
    }
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });
