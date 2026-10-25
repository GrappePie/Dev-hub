export type Lane = -1 | 0 | 1;
export type VehicleKind = "coupe" | "hatchback" | "van" | "truck" | "motorbike" | "minibus";
const PERIOD = 44;
const LANES: Lane[] = [-1, 0, 1];
const KINDS: VehicleKind[] = ["coupe", "van", "hatchback", "motorbike", "truck", "minibus"];
const wrap = (n: number, size: number) => ((n % size) + size) % size;
const safeLane = (event: number): Lane => ([-1, 0, 1, 0] as Lane[])[wrap(event, 4)];
export const trafficAt = (distance: number) => {
    const event = Math.floor(distance / PERIOD);
    const phase = wrap(distance, PERIOD);
    // Move only after the previous wave has passed, while the next is distant.
    const blend = Math.min(1, phase / 14);
    const ease = blend * blend * (3 - 2 * blend);
    const playerLane = safeLane(event - 1) + (safeLane(event) - safeLane(event - 1)) * ease;
    const steering = phase < 14 ? (safeLane(event) - safeLane(event - 1)) * 6 * blend * (1 - blend) / 14 : 0;
    const vehicles: { id: number; lane: Lane; z: number; kind: VehicleKind; color: number }[] = [];
    for (let ahead = 0; ahead < 3; ahead++) {
        const wave = event + ahead;
        const remaining = (PERIOD * (ahead + 1) - phase) / PERIOD;
        const z = 0.5 + 43.5 * remaining * remaining;
        if (z < 0.65) continue;
        LANES.filter(lane => lane !== safeLane(wave)).forEach((lane, index) => {
            // Occasional solo vehicles and a longitudinal offset avoid artificial
            // two-car walls; the chosen passing lane stays clear throughout.
            if (index === 1 && wrap(wave, 3) === 1) return;
            const vehicleZ = z - index * 0.8;
            if (vehicleZ < 0.65) return;
            const id = wave * 2 + index;
            vehicles.push({ id, lane, z: vehicleZ, kind: KINDS[wrap(wave + index * 3, KINDS.length)], color: wrap(id * 3, 5) });
        });
    }
    return { playerLane, steering, vehicles };
};
