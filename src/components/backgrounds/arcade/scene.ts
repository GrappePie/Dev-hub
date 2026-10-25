import {coastalEdges,laneHeading,turnDustStrength,drawTurnDust} from "./roadDetails";
import { drawArt, drawOcean, warmArcadeArt } from "./art";
import { clamp } from "../shared/utils";
import { trafficAt, type VehicleKind } from "./traffic";
import { buildRoad, type RoadPoint } from "./road";
import { drawConvertible } from "./convertible";
import type { Palette } from "../shared/types";

type Biome = "beach" | "desert" | "forest";
type RGB = readonly [number, number, number];
interface Region { kind: Biome; sky: RGB; haze: RGB; ground: RGB; alternate: RGB; ridge: RGB; distant: RGB }
const REGIONS: readonly Region[] = [
    { kind: "beach", sky: [0, 151, 238], haze: [164, 225, 239], ground: [238, 219, 176], alternate: [225, 202, 158], ridge: [67, 163, 133], distant: [104, 191, 172] },
    { kind: "desert", sky: [62, 151, 217], haze: [250, 218, 163], ground: [224, 163, 99], alternate: [211, 145, 86], ridge: [167, 85, 66], distant: [203, 128, 91] },
    { kind: "forest", sky: [58, 155, 217], haze: [186, 218, 192], ground: [91, 149, 66], alternate: [78, 134, 60], ridge: [38, 87, 77], distant: [85, 131, 112] },
];
const REGION_LENGTH = 520;
const noise = (x: number, z: number) => {
    const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return n - Math.floor(n);
};
const mod = (n: number, period: number) => ((n % period) + period) % period;
const mix = (a: RGB, b: RGB, f: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * f)) as unknown as RGB;
const css = (rgb: RGB) => `rgb(${rgb.join(",")})`;
const regionAt = (distance: number) => {
    const segment = Math.floor(distance / REGION_LENGTH);
    const phase = mod(distance, REGION_LENGTH) / REGION_LENGTH;
    const from = REGIONS[mod(segment, REGIONS.length)];
    const to = REGIONS[mod(segment + 1, REGIONS.length)];
    const blend = clamp((phase - 0.8) / 0.2, 0, 1);
    const f = blend * blend * (3 - 2 * blend);
    return { from, to, f, kind: f > 0.5 ? to.kind : from.kind };
};
const colorAt = (region: ReturnType<typeof regionAt>, key: "sky" | "haze" | "ground" | "alternate" | "ridge" | "distant") => mix(region.from[key], region.to[key], region.f);
const polygon = (ctx: CanvasRenderingContext2D, color: string, points: number[][]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)));
    ctx.closePath(); ctx.fill();
};

const palm = (ctx: CanvasRenderingContext2D, x: number, y: number, u: number, wind: number) => {
    if(drawArt(ctx,"nature",0,x,y,{height:28*u,wind,anchorX:.34}))return;
    // Curved, ringed trunk and narrow drooping leaflets, all rasterized on the scene grid.
    const trunkRows = Math.max(1, Math.round(19*u));
    for (let row = 0; row < trunkRows; row++) {
        const f = row/trunkRows, bend = 3*u*f*f;
        const width = Math.max(1,(2.5-f*1.3)*u);
        const tx = Math.round(x+bend-u), ty = Math.round(y-row-1);
        ctx.fillStyle = "#705841"; ctx.fillRect(tx,ty,Math.ceil(width),1);
        ctx.fillStyle = row % Math.max(2,Math.round(2*u)) === 0 ? "#e5c697" : "#ba9870";
        ctx.fillRect(tx,ty,Math.max(1,Math.ceil(width*.55)),1);
    }
    const crown = x + 3*u, top = y - 19*u;
    const fronds = [[-13,3],[-12,-3],[-8,-7],[-2,-9],[5,-8],[11,-4],[14,2],[8,7],[-7,7]];
    for (const [dx,dy] of fronds) {
        for (let i = 1; i < 20; i++) {
            const f = i / 20, arch = Math.sin(f * Math.PI);
            const px = crown + (dx*f + wind*f*f)*u;
            const py = top + (dy*f - arch*4)*u;
            const leaf = Math.sin(f * Math.PI) * 3.4;
            ctx.fillStyle = i % 3 ? "#246832" : "#1c502e";
            ctx.fillRect(Math.round(px),Math.round(py),Math.max(1,u),Math.max(1,u));
            if (i % 2 === 0) {
                ctx.fillStyle = i % 4 ? "#3e8c34" : "#66aa3e";
                polygon(ctx, ctx.fillStyle, [[px,py],[px-Math.sign(dx)*leaf*u,py+leaf*u],[px+u,py+u]]);
            }
        }
    }
    ctx.fillStyle = "#626132"; ctx.fillRect(Math.round(crown-u),Math.round(top),Math.max(1,2*u),Math.max(1,2*u));
};
const cloud = (ctx: CanvasRenderingContext2D, x: number, y: number, u: number, seed: number) => {
    if(drawArt(ctx,"scenery",seed%3,x,y+12*u,{height:27*u,width:66*u}))return;
    const lobes = [[-20,8,9,5],[-11,3,10,9],[0,-2,13,13],[13,4,11,8],[23,9,9,5]];
    for (const [dx,dy,baseRx,baseRy] of lobes) {
        const rx = Math.round(baseRx * (0.85 + noise(seed,dx)*0.35));
        const ry = Math.round(baseRy * (0.8 + noise(seed,dy)*0.5));
        for (let row = -ry; row <= ry; row++) {
            const half = Math.round(rx * Math.sqrt(Math.max(0,1-row*row/(ry*ry))));
            ctx.fillStyle = row > ry*.55 ? "#c2d4df" : row > ry*.2 ? "#e4e5e1" : row < -ry*.35 ? "#ffffff" : "#f8f5ed";
            ctx.fillRect(Math.round(x+(dx-half)*u),Math.round(y+(dy+row)*u),Math.max(1,(half*2+1)*u),Math.ceil(u)+1);
            if (row > ry*.2 && (row+seed)%3===0) {
                ctx.fillStyle = "#d2dee3";
                ctx.fillRect(Math.round(x+(dx-half+2)*u),Math.round(y+(dy+row)*u),Math.max(1,2*u),Math.max(1,u));
            }
        }
    }
};
const trafficSprite = (ctx: CanvasRenderingContext2D, cx: number, floor: number, u: number, kind: VehicleKind, color: number) => {
    const frameIndex:Record<VehicleKind,number>={coupe:0,hatchback:1,van:2,truck:3,motorbike:4,minibus:5};
    const vehicleHeight=kind==="truck"?34:kind==="van"||kind==="minibus"?29:kind==="motorbike"?27:21;
    if(drawArt(ctx,"traffic",frameIndex[kind],cx,floor,{height:vehicleHeight*u,width:(kind==="motorbike"?17:32)*u}))return;
    const paints = ["#e7cf83","#4988ac","#e4e7df","#8eaf78","#9b799f"];
    const x=cx-16*u,y=floor;
    const rect=(c:string,dx:number,dy:number,w:number,h:number)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x+dx*u),Math.round(y+dy*u),Math.max(1,w*u),Math.max(1,h*u));};
    if(kind==="motorbike") {
        rect("#1c2630",14,-8,5,9); rect("#a5b6ba",14,-3,1,3);
        rect("#333b4d",12,-17,10,10); rect("#e7b16f",14,-21,6,5);
        rect(paints[color],13,-23,8,6); rect("#273f56",13,-20,8,2);
        rect("#d36445",12,-7,10,3);rect("#ffbc74",15,-6,4,1);return;
    }
    const tall=kind==="truck"||kind==="van";
    rect("#343b42",0,-1,32,3);rect("#1d2530",1,-7,4,8);rect("#1d2530",27,-7,4,8);
    if(kind==="truck") {
        rect("#565b66",2,-33,28,30);rect("#e2dfce",3,-32,26,25);rect("#b4bdbe",4,-31,24,23);
        rect("#edf0e1",5,-30,10,21);rect("#d5dcce",17,-30,10,21);
        rect("#687885",15,-30,1,23);rect("#6d767c",13,-17,1,3);rect("#6d767c",18,-17,1,3);
        rect("#67717c",3,-7,26,3);
    } else {
        const roof=tall?-28:kind==="hatchback"?-22:-18;
        polygon(ctx,paints[color],[[x+3*u,y-5*u],[x+3*u,y-13*u],[x+7*u,y+roof*u],[x+25*u,y+roof*u],[x+29*u,y-13*u],[x+29*u,y-5*u]]);
        rect("#2e4a60",7,roof+2,18,tall?9:6);rect("#97bcc8",8,roof+3,16,2);
        rect(paints[color],3,-12,26,8);rect("#ecede2",5,-11,22,1);
        rect("#50606a",4,-5,24,2);rect("#c1c7c2",14,-7,5,2);
    }
    rect("#eb7555",3,-6,6,2);rect("#eb7555",23,-6,6,2);rect("#ffcc83",4,-6,4,1);rect("#ffcc83",24,-6,4,1);
    rect("#b1b7ae",4,-2,24,1);
};
const pine = (ctx: CanvasRenderingContext2D, x: number, y: number, u: number, variant: number) => {
    if(drawArt(ctx,"nature",1,x,y,{height:27*u,wind:Math.sin(variant*9)*0.3}))return;
    ctx.fillStyle = "#795c42"; ctx.fillRect(x - u, y - 9 * u, 2 * u, 9 * u);
    for (let i = 0; i < 4; i++) {
        const tip = y - (23 - i * 4) * u;
        const half = (4 + i * 2) * u;
        polygon(ctx, i % 2 ? "#245d46" : "#2d7450", [[x, tip], [x - half, tip + 10 * u], [x + half, tip + 10 * u]]);
        polygon(ctx, variant > 0.5 ? "#47925b" : "#398353", [[x, tip], [x - half, tip + 10 * u], [x - u, tip + 8 * u]]);
    }
};
const cactus = (ctx: CanvasRenderingContext2D, x: number, y: number, u: number, variant: number) => {
    if(drawArt(ctx,"nature",3,x,y,{height:21*u,flip:variant>.5}))return;
    ctx.fillStyle = "#47744b";
    ctx.fillRect(x - 2 * u, y - 17 * u, 4 * u, 17 * u);
    ctx.fillRect(x - u, y - 18 * u, 2 * u, u);
    ctx.fillRect(x - 7 * u, y - 11 * u, 6 * u, 3 * u);
    ctx.fillRect(x - 7 * u, y - 15 * u, 2 * u, 5 * u);
    if (variant > 0.3) { ctx.fillRect(x + u, y - 8 * u, 6 * u, 3 * u); ctx.fillRect(x + 5 * u, y - 13 * u, 2 * u, 7 * u); }
    ctx.fillStyle = "#83a764"; ctx.fillRect(x - u, y - 16 * u, u, 15 * u);
    ctx.fillStyle = "#b5c181"; ctx.fillRect(x - u, y - 14 * u, u, u);
};
const car = (ctx: CanvasRenderingContext2D, cx: number, floor: number, u: number, t: number, playing: boolean, bend: number) => {
    const x = Math.round(cx) - 22 * u;
    const y = Math.round(floor) - (playing && Math.sin(t * 14) > 0.7 ? u : 0);
    const rect = (c: string, dx: number, dy: number, w: number, h: number) => { ctx.fillStyle = c; ctx.fillRect(x + dx * u, y + dy * u, w * u, h * u); };
    rect("#3e4147", -1, -1, 46, 3); rect("#262c35", 2, -2, 40, 4);
    rect("#181b25", 0, -8, 5, 9); rect("#181b25", 39, -8, 5, 9);
    rect("#494855", 1, -7, 1, 6); rect("#494855", 42, -7, 1, 6);
    rect("#911e35", 4, -13, 36, 9);
    polygon(ctx, "#db3440", [[x + 4*u, y - 12*u], [x + 9*u, y - 20*u], [x + 35*u, y - 20*u], [x + 40*u, y - 12*u]]);
    rect("#1e2b3b", 9, -19, 26, 8); // open cabin
    rect("#7299aa", 10, -19, 24, 2); rect("#b5d9d8", 11, -19, 22, 1);
    rect("#383644", 11, -15, 9, 5); rect("#383644", 25, -15, 9, 5); // seats
    const head = Math.round(clamp(bend * 2, -1, 1));
    rect("#78503d", 13 + head, -23, 5, 5); rect("#553b32", 13 + head, -23, 5, 2);
    rect("#efb780", 14 + head, -20, 4, 3); rect("#4c88b0", 12, -17, 8, 4);
    rect("#e4b62f", 27 + head, -23, 6, 7); rect("#ffe276", 28 + head, -23, 3, 5);
    rect("#edc58b", 27 + head, -19, 4, 3); rect("#ed6e69", 25, -16, 8, 3);
    rect("#f25250", 3, -13, 38, 3); rect("#ff9b7a", 4, -13, 36, 1);
    rect("#b91e34", 1, -10, 42, 7); rect("#eb3c42", 2, -10, 40, 3);
    rect("#ff7c67", 3, -10, 38, 1); rect("#6a2332", 2, -6, 40, 3);
    rect("#ffb345", 3, -6, 4, 2); rect("#e85248", 7, -6, 7, 2);
    rect("#e85248", 30, -6, 7, 2); rect("#ffb345", 37, -6, 4, 2);
    rect("#232c38", 14, -6, 16, 2); rect("#e7dfc7", 19, -5, 7, 3);
    rect("#54616c", 4, -2, 36, 1); rect("#181c25", 7, -1, 4, 1); rect("#181c25", 33, -1, 4, 1);
    rect("#e64c48", -1, -14, 5, 2); rect("#e64c48", 40, -14, 5, 2); // mirrors
};

// A low-resolution surface makes every contour a real pixel edge, even after
// perspective projection. WeakMap keeps independent previews/players isolated.
const surfaces = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>();
export const drawArcadeGrid = (
    output: CanvasRenderingContext2D, displayWidth: number, displayHeight: number,
    t: number, _progressNorm: number, _volumeNorm: number, isPlaying: boolean,
    _palette: Palette, travel?: number, camera = { x: 0, y: 0 },
): void => {
    let surface = surfaces.get(output);
    if (!surface) { surface = document.createElement("canvas"); surfaces.set(output, surface); }
    const scale = Math.max(2, Math.floor(Math.min(displayWidth, displayHeight) / 240));
    const w = Math.ceil(displayWidth / scale), h = Math.ceil(displayHeight / scale);
    if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
    // A tall viewport reveals more road; it must not enlarge roadside sprites.
    // Tie their projection scale to the available width on portrait screens.
    const sceneryHeight = Math.min(h, w * 0.85);
    const ctx = surface.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    warmArcadeArt();
    const distance = (travel ?? t * (isPlaying ? 0.3 : 0.08)) * 40;
    const region = regionAt(distance);
    const traffic = trafficAt(distance);
    const route = buildRoad(w, h, distance, traffic.playerLane, camera);
    const {horizon, playerZ, project: roadAt} = route;
    const sky = colorAt(region, "sky"), haze = colorAt(region, "haze");
    for (let band = 0; band < 10; band++) {
        ctx.fillStyle = css(mix(sky, haze, band / 55));
        ctx.fillRect(0, Math.floor(horizon * band / 10), w, Math.ceil(horizon / 10) + 1);
    }
    // Cloud banks have fixed seeded silhouettes and a slow parallax drift.
    for (let i = 0; i < 4; i++) {
        const x = Math.round(mod(noise(i, 3) * (w + 100) - distance * 0.01, w + 100) - 50);
        const y = Math.round(horizon * (0.72 + noise(i, 4) * 0.14));
        const u = Math.max(0.7, w / (i % 2 ? 175 : 220));
        cloud(ctx, x, y, u, i);
    }
    // Generated horizon panoramas crossfade with each biome, in two parallax layers.
    const panorama=(kind:Biome,alpha:number)=>{
        if(alpha<=0)return true;
        const frame={beach:3,desert:4,forest:5}[kind];
        const mountainHeight=sceneryHeight*(kind==="beach"?.13:kind==="desert"?.21:.29);
        const drift=Math.sin(distance*.0015)*w*.05;
        ctx.save();ctx.globalAlpha*=alpha*.32;
        drawArt(ctx,"scenery",frame,w*.5-drift*.4,horizon+2,{height:mountainHeight*.85,width:w*1.65});
        ctx.restore();ctx.save();ctx.globalAlpha*=alpha;
        const ready=drawArt(ctx,"scenery",frame,w*.5+drift,horizon+3,{height:mountainHeight,width:w*1.15});
        ctx.restore();return ready;
    };
    const horizonsReady=panorama(region.from.kind,1-region.f)&&panorama(region.to.kind,region.f);
    if(!horizonsReady){
    // Layered, solid scenery silhouettes, with geometry blended at biome seams.
    for (let layer = 0; layer < 2; layer++) {
        const points = [[0, horizon + 2]];
        for (let x = 0; x <= w + 3; x += 3) {
            const phase = x / w * 14 + distance * (layer ? 0.001 : 0.0005);
            const profile = (kind: Biome) => kind === "beach" ? 2 + Math.sin(phase) * 2
                : kind === "desert" ? (Math.floor(Math.sin(phase) * 3) + 4) * h * 0.012
                : (Math.sin(phase) * 0.5 + Math.sin(phase * 2.1) * 0.25 + 0.8) * h * 0.12;
            const elevation = profile(region.from.kind) * (1 - region.f) + profile(region.to.kind) * region.f;
            points.push([x, horizon - elevation * (layer ? 0.65 : 1)]);
        }
        points.push([w + 3, horizon + 2]);
        polygon(ctx, css(colorAt(region, layer ? "ridge" : "distant")), points);
    }
    }
    // Ground strips are actual projected world segments, not flat scanlines.
    // The nearest crest clips every farther strip and all roadside objects.
    const groundTop = Math.min(horizon,...route.points.map(point=>point.y));
    ctx.fillStyle=css(colorAt(region,"ground"));
    ctx.fillRect(0,groundTop,w,h-groundTop);
    const strip = (near: RoadPoint, far: RoadPoint, left: number, right: number, color: string) =>
        polygon(ctx,color,[[near.x+near.half*left,near.y],[far.x+far.half*left,far.y],
            [far.x+far.half*right,far.y],[near.x+near.half*right,near.y]]);
    for(const {near,far,clip} of [...route.bands].reverse()) {
        const z=(near.z+far.z)/2;
        const localRegion=regionAt(distance+z);
        const stripe=Math.floor((distance+z)/3)%2===0;
        ctx.save();ctx.beginPath();ctx.rect(0,0,w,Math.max(0,clip));ctx.clip();
        ctx.fillStyle=css(colorAt(localRegion,stripe?"ground":"alternate"));
        ctx.fillRect(0,far.y,w,Math.max(1,near.y-far.y));
        const coast=(localRegion.from.kind==="beach"?1-localRegion.f:0)+(localRegion.to.kind==="beach"?localRegion.f:0);
        if(coast>0.02) {
            const coastNear=coastalEdges(near,distance+near.z,0),coastFar=coastalEdges(far,distance+far.z,0);
            const shoreNear=coastNear.shore,shoreFar=coastFar.shore;
            polygon(ctx,css(mix(colorAt(localRegion,"ground"),stripe?[45,171,191]:[63,186,197],coast)),
                [[0,near.y],[0,far.y],[shoreFar,far.y],[shoreNear,near.y]]);
            ctx.save();ctx.beginPath();ctx.moveTo(0,near.y);ctx.lineTo(0,far.y);
            ctx.lineTo(shoreFar,far.y);ctx.lineTo(shoreNear,near.y);ctx.closePath();ctx.clip();
            ctx.globalAlpha*=coast*.72;drawOcean(ctx,w,h,t);ctx.restore();
            polygon(ctx,css(mix(colorAt(localRegion,"ground"),[110,208,207],coast)),
                [[coastNear.shallow,near.y],[coastFar.shallow,far.y],[shoreFar,far.y],[shoreNear,near.y]]);
            const foam=Math.sin(t*1.6+z*.2)*near.depth*1.2;
            polygon(ctx,css(mix(colorAt(localRegion,"ground"),[228,245,224],coast)),
                [[shoreNear+foam,near.y],[shoreFar+foam,far.y],[shoreFar+far.depth*3+foam,far.y],[shoreNear+near.depth*3+foam,near.y]]);
        }
        strip(near,far,-1.065,1.065,stripe?"#f2e9d5":"#c34b42");
        strip(near,far,-1,1,stripe?"#777c85":"#737982");
        strip(near,far,-0.99,-0.98,"#ecebdc");strip(near,far,0.98,0.99,"#ecebdc");
        if(Math.floor((distance+z)/2.5)%3!==0) {
            for(const lane of [-1/3,1/3]) strip(near,far,lane-0.006,lane+0.006,"#ecebdc");
        }
        ctx.restore();
    }
    // Secondary groves and rock fields occupy the spaces beyond roadside props.
    // They are world-anchored and crest-clipped just like the foreground.
    const groveSpacing=7,groveOffset=mod(distance,groveSpacing);
    for(let i=24;i>=0;i--){
        const z=12+i*groveSpacing-groveOffset;if(z<4)continue;
        const point=roadAt(z),world=Math.floor(distance/groveSpacing)+i;
        const r=regionAt(distance+z);
        const biome=noise(world,41)<r.f?r.to.kind:r.from.kind;
        const u=Math.max(1/24,Math.round(24*sceneryHeight*.04/z)/24);
        ctx.save();ctx.beginPath();ctx.rect(0,0,w,Math.max(0,route.clipAt(z)));ctx.clip();
        for(const side of [-1,1])for(let cluster=0;cluster<3;cluster++){
            if(biome==="beach"&&side<0)continue;
            const x=point.x+side*(point.half*(1.7+cluster*.8+noise(world,cluster)*.4));
            if(x < -u*15 || x > w+u*15)continue;
            const phase=t*.8+world+cluster;
            if(biome==="forest")drawArt(ctx,"nature",(world+cluster)%3===0?2:1,x,point.y,{height:(21+noise(world,cluster)*7)*u,wind:Math.sin(phase)*.35});
            else if(biome==="desert")drawArt(ctx,"nature",(world+cluster)%3===0?3:5,x,point.y,{height:((world+cluster)%3===0?17:7)*u,flip:side<0});
            else drawArt(ctx,"nature",(world+cluster)%5===0?7:4,x,point.y,{height:((world+cluster)%5===0?15:6)*u});
        }
        ctx.restore();
    }
    // World-anchored props: type and variation never change randomly per frame.
    const spacing = 5;
    const offset = mod(distance, spacing);
    for (let i = 19; i >= 0; i--) {
        const z = 2 + i * spacing - offset;
        if (z < 1.2) continue;
        const pos = roadAt(z);
        const world = Math.floor(distance / spacing) + i;
        const localRegion = regionAt(distance + z);
        const kind = noise(world, 21) < localRegion.f ? localRegion.to.kind : localRegion.from.kind;
        const u = Math.max(1 / 24, Math.round(24 * sceneryHeight * 0.055 / z) / 24);
        for (const side of [-1, 1]) {
            const x = Math.round(kind==="beach"&&side<0
                ?coastalEdges(pos,distance+z,u).palm
                :pos.x+side*(pos.half*1.2+3*u));
            if (x < -u * 13 || x > w + u * 13 || pos.y > h + 24 * u) continue;
            ctx.save();ctx.beginPath();ctx.rect(0,0,w,Math.max(0,route.clipAt(z)));ctx.clip();
            ctx.fillStyle = "rgba(38,53,49,0.23)";
            ctx.fillRect(Math.round(x-4*u),Math.round(pos.y),Math.max(1,12*u),Math.max(1,u));
            if (world % 7 === 0 && side === 1) {
                const sx=x-4*u, sy=pos.y;
                ctx.fillStyle="#8d948c";ctx.fillRect(Math.round(sx),Math.round(sy-12*u),Math.max(1,u),Math.max(1,12*u));
                ctx.fillStyle="#b93f36";ctx.fillRect(Math.round(sx-4*u),Math.round(sy-20*u),Math.max(1,9*u),Math.max(1,9*u));
                ctx.fillStyle="#f9f3dd";ctx.fillRect(Math.round(sx-3*u),Math.round(sy-19*u),Math.max(1,7*u),Math.max(1,7*u));
                polygon(ctx,"#bd4037",[[sx-2*u,sy-17*u],[sx+u,sy-17*u],[sx+u,sy-19*u],[sx+3*u,sy-15*u],[sx+u,sy-13*u],[sx+u,sy-15*u],[sx-2*u,sy-15*u]]);
            }
            if (kind === "beach") {
                if(world%11===0&&side===1) {
                    if(!drawArt(ctx,"nature",7,x+side*4*u,pos.y,{height:21*u}))palm(ctx,x,pos.y,u,Math.sin(t*1.4+world)*.5);
                }else palm(ctx,x,pos.y,u,Math.sin(t*1.4+world)*.5);
                if(world%3===0)drawArt(ctx,"nature",4,x+(side<0?2:8)*u,pos.y,{height:7*u,wind:Math.sin(t+world)*.3});
            }else if(kind==="forest") {
                if(world%3===0) {
                    if(!drawArt(ctx,"nature",2,x,pos.y,{height:26*u,wind:Math.sin(t+world)*.5}))pine(ctx,x,pos.y,u,noise(world,side));
                }else pine(ctx,x,pos.y,u,noise(world,side));
                if(world%4===0)drawArt(ctx,"nature",6,x+side*7*u,pos.y,{height:5*u,wind:Math.sin(t+world)*.3});
            }else if(world%3!==0)cactus(ctx,x,pos.y,u,noise(world,side));
            else if(!drawArt(ctx,"nature",5,x,pos.y,{height:9*u,flip:side<0})){
                polygon(ctx,"#aa7357",[[x-5*u,pos.y],[x-4*u,pos.y-4*u],[x+2*u,pos.y-5*u],[x+6*u,pos.y]]);
            }
            ctx.restore();
        }
    }
    const near = roadAt(playerZ);
    const unit = Math.max(1, Math.floor(Math.min(w / 140, h / 85)));
    const entities: { z: number; draw: () => void }[] = traffic.vehicles.map(vehicle => ({
        z: vehicle.z,
        draw: () => {
            const pos = roadAt(vehicle.z);
            ctx.save();ctx.beginPath();ctx.rect(0,0,w,Math.max(0,route.clipAt(vehicle.z)));ctx.clip();
            trafficSprite(ctx, pos.x + vehicle.lane * pos.half * 2/3, pos.y,
                unit * playerZ / vehicle.z * (vehicle.kind==="motorbike"?.92:1.14), vehicle.kind, vehicle.color);
            ctx.restore();
        },
    }));
    entities.push({ z: playerZ, draw: () => {
        const x = near.x + traffic.playerLane * near.half * 2/3;
        const heading=laneHeading(near,roadAt(playerZ+1.2),traffic.steering,traffic.playerLane);
        const playerScale=.9,playerWidth=unit*46*playerScale;
        drawTurnDust(ctx,x,near.y,playerWidth,t,turnDustStrength(distance,isPlaying),region.kind==="desert");
        if (!drawConvertible(ctx, x, near.y, playerWidth, heading, t, isPlaying,{},distance)) {
            car(ctx, x, near.y, unit*playerScale, t, isPlaying, heading * 8);
        }
    }});
    entities.sort((a,b) => b.z-a.z).forEach(entity => entity.draw());
    output.imageSmoothingEnabled = false;
    output.drawImage(surface, 0, 0, w * scale, h * scale);
};
