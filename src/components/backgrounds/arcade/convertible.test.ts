import {afterEach,describe,expect,it,vi} from "vitest";
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("independent convertible layers",()=>{
    it("changes wheel and hair cels while body, characters and axle placement stay rigid",async()=>{
        vi.resetModules();
        class LoadedImage {
            width=300;height=200;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
            url="";set src(value:string){this.url=value;this.onload?.();}
        }
        vi.stubGlobal("Image",LoadedImage);
        const loader={drawImage:vi.fn(),clearRect:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray(300*200*4)}),
            createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:vi.fn()};
        vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(loader as unknown as CanvasRenderingContext2D);
        const ctx={drawImage:vi.fn(),save:vi.fn(),restore:vi.fn(),translate:vi.fn(),scale:vi.fn(),beginPath:vi.fn(),rect:vi.fn(),ellipse:vi.fn(),clip:vi.fn(),fillRect:vi.fn()};
        const {drawConvertible}=await import("./convertible");
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,0,true);
        const first=ctx.drawImage.mock.calls.map(args=>[...args]);
        const anchor=[...ctx.translate.mock.calls[1]];
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,.25,true);
        const second=ctx.drawImage.mock.calls;
        expect(first).toHaveLength(6);
        expect(second[0][0]).not.toBe(first[0][0]); // independent wheel cel
        expect(second[1]).toEqual(first[1]); // rigid body
        expect(second[2]).toEqual(first[2]); // driver
        expect(second[3]).toEqual(first[3]); // passenger
        expect(second[4][0]).toBe(first[4][0]);
        expect(second[4].slice(5)).toEqual(first[4].slice(5)); // fixed hair root
        expect(second[4][1]).not.toBe(first[4][1]);
        expect(second[5]).toEqual(first[5]); // attached crown is pixel-identical
        for(let frame=0;frame<8;frame++){
            ctx.drawImage.mockClear();ctx.translate.mockClear();
            drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,(frame+.1)/9,true);
            expect(ctx.drawImage.mock.calls[1]).toEqual(first[1]);
            expect(ctx.drawImage.mock.calls[5]).toEqual(first[5]);
            expect(ctx.translate.mock.calls[1]).toEqual(anchor);
        }
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,-.08,0,true);
        const sideImage=ctx.drawImage.mock.calls[4][0];
        expect(sideImage).not.toBe(first[4][0]); // distinct rear-view atlas
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,.08,0,true);
        expect(ctx.drawImage.mock.calls[4][0]).toBe(sideImage);
        expect(ctx.scale).toHaveBeenCalledWith(-1,1);
        const mounted=loader.drawImage.mock.calls.filter(args=>String((args[0] as LoadedImage)?.url).includes("wheel-rotation"));
        expect(mounted).toHaveLength(64); // eight cels for all eight physical mounts
        expect(new Set(mounted.map(args=>Number(args[2])/160))).toEqual(new Set([2,3,6,7]));
        for(const args of mounted){
            expect(args[3]).toBe(160);expect(args[4]).toBe(160);
            expect(args[7]).toBe(args[8]); // uniform scale, never stretch a tire
        }
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,10,true,{},3.8);
        const movingWheel=ctx.drawImage.mock.calls[0][0];
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,11,false,{},3.8);
        expect(ctx.drawImage.mock.calls[0][0]).toBe(movingWheel); // pause never resets distance phase
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,12,false,{},4.6);
        expect(ctx.drawImage.mock.calls[0][0]).not.toBe(movingWheel); // continues rolling while coasting
    });
});
