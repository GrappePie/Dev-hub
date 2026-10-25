import { describe, expect, it } from "vitest";
import { trafficAt } from "./traffic";

describe("arcade traffic", () => {
    it("keeps a clear lane at every overtake, across a complete repeated traffic cycle", () => {
        for (let distance = 0; distance < 1760; distance += 0.1) {
            const frame = trafficAt(distance);
            expect(Math.abs(frame.playerLane)).toBeLessThanOrEqual(1);
            for (const vehicle of frame.vehicles) {
                if (vehicle.z < 4) expect(Math.abs(frame.playerLane - vehicle.lane)).toBeGreaterThan(0.9);
            }
        }
    });
    it("preserves continuous steering across wave boundaries and includes all six vehicle types", () => {
        const kinds = new Set<string>();
        for (let distance = 0; distance < 500; distance++) {
            const before = trafficAt(distance - 0.001);
            const after = trafficAt(distance + 0.001);
            expect(Math.abs(after.playerLane - before.playerLane)).toBeLessThan(0.001);
            after.vehicles.forEach(vehicle => kinds.add(vehicle.kind));
        }
        expect(kinds.size).toBe(6);
    });
});
