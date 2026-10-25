export interface RoadPoint { z: number; x: number; y: number; half: number; depth: number }
const heightAt = (s: number) => Math.sin(s * 0.038) * 4.5 + Math.sin(s * 0.013) * 8;
const slopeAt = (s: number) => Math.cos(s * 0.038) * 4.5 * 0.038 + Math.cos(s * 0.013) * 8 * 0.013;
export const buildRoad = (w: number, h: number, distance: number, lane: number, camera: {x: number; y: number}) => {
    const slope = slopeAt(distance);
    const horizon = Math.round(h * (0.53 + slope * 0.17 + camera.y * 0.008));
    const playerZ = 2 / 0.92;
    const curve = (z: number) => ((Math.sin((distance + z) * 0.011) - Math.sin(distance * 0.011)) * 2.8
        + (Math.sin((distance + z) * 0.025 + 0.4) - Math.sin(distance * 0.025 + 0.4)) * 0.45) * w;
    const center = w * (0.5 + camera.x * 0.012) - lane * w * 0.52 * 0.92 * 2/3 * 0.82 - curve(playerZ) * 0.92;
    const baseHeight = heightAt(distance);
    const project = (z: number): RoadPoint => {
        const depth = 2/z;
        // Remove the local tangent: the chase camera pitches with the road,
        // while distant changes in elevation still form actual crests and dips.
        const relativeHeight = heightAt(distance + z) - baseHeight - slope * z;
        return { z, depth, x: Math.round(center + curve(z)*depth),
            y: Math.round(horizon + depth*(h-horizon) - relativeHeight*h*0.55/z),
            half: Math.round(w*0.52*depth) };
    };
    const points: RoadPoint[] = [];
    for(let z=0.85; z<210; z+=0.055+z*0.035) points.push(project(z));
    let skyline = h;
    const bands: {near: RoadPoint; far: RoadPoint; clip: number}[] = [];
    for(let i=0;i<points.length-1;i++) {
        const near=points[i], far=points[i+1];
        skyline=Math.min(skyline,near.y);
        if(far.y < skyline && far.y < near.y) bands.push({near,far,clip:skyline});
    }
    const clipAt = (z: number) => {
        let clip=h;
        for(const point of points) { if(point.z >= z) break; clip=Math.min(clip,point.y); }
        return clip;
    };
    return {horizon, playerZ, project, points, bands, clipAt};
};
