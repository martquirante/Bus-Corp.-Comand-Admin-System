# Bus Marker Behavior

The blue aircon bus images represent one bus model with multiple angles/states.

Primary assets:

- `map-only-blue-bus.png`
- `bus-blue-aircon-idle.png`
- `bus-blue-aircon-front-left.png`
- `bus-blue-aircon-rear-left.png`
- `bus-blue-aircon-rear-perspective.png`
- `bus-blue-aircon-side-rear.png`
- `bus-blue-aircon-top-rear.png`

## Visual Rules

| State | Asset | Treatment |
| --- | --- | --- |
| moving | `map-only-blue-bus.png` | route-map marker with heading rotation |
| fast | `map-only-blue-bus.png` | subtle shimmer and slightly larger scale |
| stopped/idle | `bus-blue-aircon-idle.png` | front-visible parked marker |
| loading passengers | `bus-blue-aircon-front-left.png` | future boarding indicator hook |
| turning left/right | `map-only-blue-bus.png` | heading plus status turn rotation |
| SOS/emergency | selected state asset | professional pulse ring |
| offline | `bus-blue-aircon-idle.png` | dimmed marker and offline badge |
| unknown | `bus-blue-aircon-front-left.png` | conservative idle-like view |

CSS uses `perspective`, `rotateX`, `rotateY`, `rotateZ`, `scale`, `drop-shadow`, and transitions. Animations respect the global reduced-motion media query.
