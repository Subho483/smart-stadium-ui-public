# System Flowcharts: Smart Stadium AI

This document visualizes the architectural flow and decision-making logic of the Smart Stadium Routing Engine.

## 1. System Data Flow
This diagram illustrates how data travels between the User, the Frontend UI, and the Backend Simulation Engine.

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Frontend UI (Vanilla JS)
    participant Server as Express Server (Node.js)
    participant Engine as AI Surge Engine (Simulation)

    User->>Frontend: Selects Destination
    Frontend->>Frontend: Executes Dijkstra (Client-side)
    Frontend->>Server: POST /api/route (Registers Intent)
    Server->>Engine: Increments Inflight Load
    Note over Server,Engine: Engine calculates wait times
    loop Real-time Sync
        Engine-->>Server: Generates Node Status Tick
        Server-->>Frontend: WebSocket: 'stadium-tick'
        Frontend->>User: Updates Heatmap & Route
    end
```

## 2. Routing Decision Logic (Dijkstra + Density)
This flowchart shows how the engine determines the "Optimal Path" by balancing physical distance against crowd load.

```mermaid
graph TD
    A[Start: User Requests Route] --> B{Destination Type?}
    B -->|Restroom| C[Filter Restroom Nodes]
    B -->|Food| D[Filter Food Nodes]
    B -->|Exit| E[Filter Exit Nodes]
    
    C --> F[Calculate Physical Distance]
    D --> F
    E --> F
    
    F --> G[Fetch Current Wait Times]
    G --> H[Check Forecast & Inflight Intent]
    
    H --> I[Apply Quadratic Penalty: Cost = Dist + Wait^2]
    I --> J[Run Dijkstra Algorithm]
    
    J --> K{Is Optimal Node Congested?}
    K -->|Yes| L[Reroute to Next Best Node]
    K -->|No| M[Return Optimal Path JSON]
    
    L --> M
    M --> N[Visualise Polyline on Canvas]
    N --> End[Finish]
```

## 3. Surge Event Lifecycle
How the system reacts to a stadium-wide event like a "Goal" or "Halftime."

```mermaid
stateDiagram-v2
    [*] --> Normal: Base Wait Times
    Normal --> SurgeEvent: Event Triggered (e.g. HALFTIME)
    state SurgeEvent {
        [*] --> InjectLoad: Increase Surge Modifiers
        InjectLoad --> ScaleWaitTimes: Apply Multipliers
        ScaleWaitTimes --> ForecastGrowth: Calculate Inflight Impact
    }
    SurgeEvent --> Recovery: Natural Decay (-0.5 per tick)
    Recovery --> Normal: Return to Base State
```
