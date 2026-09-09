export type RunState={seed:number; floor:number; battery:number; curse:number; score:number; status:'playing'|'won'|'lost'};
export const createRun=(seed:number):RunState=>({seed,floor:3,battery:100,curse:0,score:0,status:'playing'});
