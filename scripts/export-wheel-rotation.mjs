import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {balancedWheelFrames} from '../src/components/backgrounds/arcade/wheelAnimation.ts';
import {perspectiveWheelFrames,wheelViews} from '../src/components/backgrounds/arcade/wheelPerspective.ts';

// Decode source artwork only; all animation and projection use the same renderer
// as the preview. No image-processing dependencies are needed by the web app.
const decoded=JSON.parse(execFileSync('python',['-c',`
from PIL import Image
import base64,json
side=Image.open('src/assets/arcade-wheel-isolated-v1.png').convert('RGBA')
atlas=Image.open('src/assets/arcade-wheel-angles-v1.png').convert('RGBA')
cw,ch=atlas.width//4,atlas.height//2
tread=atlas.crop((cw*3+3,3,cw*4-3,ch-3))
tread=tread.crop(tread.getchannel('A').getbbox())
w,h=tread.size
tread=tread.crop((int(w*.12),int(h*.24),int(w*.88),int(h*.76)))
def data(im):return dict(width=im.width,height=im.height,data=base64.b64encode(im.tobytes()).decode())
print(json.dumps(dict(side=data(side),tread=data(tread))))
`],{maxBuffer:20*1024*1024}).toString());
const texture=value=>({width:value.width,height:value.height,pixels:new Uint8ClampedArray(Buffer.from(value.data,'base64'))});
const input=texture(decoded.side),tread=texture(decoded.tread),size=160;
const side={width:size,height:size,pixels:balancedWheelFrames(input.pixels,input.width,input.height,size)[0]};
const rows=wheelViews.map((yaw,row)=>perspectiveWheelFrames(side,tread,yaw,size,row>=4?-1:1));
for(const frames of rows)for(const frame of frames)for(let p=3;p<frame.length;p+=4){
    if(frame[p]!==frames[0][p])throw new Error('Wheel silhouette changed between frames');
}
const width=size*8,height=size*8,pixels=Buffer.alloc(width*height*4);
rows.forEach((frames,row)=>frames.forEach((frame,column)=>{
    for(let y=0;y<size;y++)pixels.set(frame.subarray(y*size*4,(y+1)*size*4),((row*size+y)*width+column*size)*4);
}));
const crc32=buffer=>{
    let crc=0xffffffff;
    for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    return (crc^0xffffffff)>>>0;
};
const chunk=(type,data)=>{
    const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);
};
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
const scanlines=Buffer.alloc((width*4+1)*height);
for(let y=0;y<height;y++)pixels.copy(scanlines,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]);
writeFileSync('src/assets/arcade-wheel-rotation-v1.png',png);
const names=['side-left','three-quarter-left','near-rear-left','rear-left','side-right','three-quarter-right','near-rear-right','rear-right'];
writeFileSync('scripts/wheel-rotation-v1.json',JSON.stringify({asset:'src/assets/arcade-wheel-rotation-v1.png',cell:{width:size,height:size},columns:8,rows:8,framesPerView:8,frameDurationMs:100,pivot:[80,80],rotationStepDegrees:45,views:names.map((name,row)=>({name,row,yawDegrees:wheelViews[row],rotationDirection:row>=4?-1:1})),validation:'Every cel in each view has identical alpha coverage. Complete tire rotation, fixed cylinder geometry. Integrated with convertible using fixed per-wheel occlusion masks.'},null,2)+'\n');
console.log(`Exported ${rows.length*8} cels, ${width}x${height}; invariant silhouette verified; PNG ${readFileSync('src/assets/arcade-wheel-rotation-v1.png').length} bytes.`);
