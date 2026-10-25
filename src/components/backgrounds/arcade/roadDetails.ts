import type {RoadPoint} from "./road";
export const coastalEdges = (point:RoadPoint,world:number,unit:number) => {
    const bend=Math.sin(world*.02)*point.half*.045;
    const shore=point.x-point.half*1.64-Math.max(1,point.depth*6)+bend;
    const shallow=shore-Math.max(1,point.depth*12);
    const palm=point.x-point.half*1.18-Math.min(3*unit,point.half*.14);
    return {shore,shallow,palm};
};
export const laneHeading = (near:RoadPoint,ahead:RoadPoint,laneVelocity:number) => {
    // Once the lane change is visually complete, remove its banking component.
    // The remaining pose follows the road tangent, independent of lane position.
    const lateral=Math.abs(laneVelocity)<.025?0:laneVelocity*.85;
    const road=Math.atan2(ahead.x-near.x,Math.max(1,near.y-ahead.y))*.23;
    return Math.max(-.15,Math.min(.15,road+lateral));
};
export const turnDustStrength = (distance:number,playing:boolean) => {
    if(!playing)return 0;
    const curvature=-Math.sin(distance*.011)*2.8*.011*.011
        -Math.sin(distance*.025+.4)*.45*.025*.025;
    const amount=Math.max(0,Math.min(1,(Math.abs(curvature)/.00062-.32)/.68));
    return Math.sign(curvature)*amount;
};
export const drawTurnDust = (ctx:CanvasRenderingContext2D,cx:number,floor:number,width:number,t:number,turn:number,desert:boolean) => {
    if(Math.abs(turn)<.04)return;
    const strength=Math.abs(turn),unit=width/46;
    ctx.save();
    for(let wheel=0;wheel<2;wheel++)for(let i=0;i<12;i++){
        const age=((t*2.6+i*.117+wheel*.31)%1+1)%1;
        const drift=Math.sin(i*19.7+wheel*8)*unit*3;
        const x=cx+(wheel?1:-1)*(width*.47+unit*1.5+age*unit*5)+drift*age-turn*age*unit*4;
        const y=floor-unit*(1+age*8)+Math.sin(age*Math.PI)*unit;
        const size=Math.max(1,Math.round(unit*(1.4+age*2.8)*Math.sqrt(strength)));
        ctx.globalAlpha=strength*(1-age)*(1-age)*.8;
        ctx.fillStyle=desert?(i%2?"#dfc39a":"#c6a47c"):(i%2?"#c3beb2":"#a6a6a0");
        ctx.fillRect(Math.round(x),Math.round(y),size,size);
    }
    ctx.restore();
};
