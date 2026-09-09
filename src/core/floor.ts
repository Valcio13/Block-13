import { SeededRng } from './rng';
export type Floor = { width:number; height:number; tiles:boolean[][]; start:[number,number]; key:[number,number]; exit:[number,number] };
export function generateFloor(seed:number, floor:number): Floor {
  const rng=new SeededRng(seed ^ ((floor+1)*0x9e3779b9)); const width=21, height=15;
  const tiles=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x>0&&y>0&&x<width-1&&y<height-1));
  for(let i=0;i<34+floor*7;i++) tiles[1+rng.int(height-2)][1+rng.int(width-2)]=false;
  const start:[number,number]=[1,1], key:[number,number]=[width-2,1], exit:[number,number]=[width-2,height-2];
  for (const [x,y] of [start,key,exit]) tiles[y][x]=true;
  return {width,height,tiles,start,key,exit};
}
