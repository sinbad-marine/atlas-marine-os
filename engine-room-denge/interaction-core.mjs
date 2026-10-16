// Pure visual-size state. This module neither knows nor changes camera/telemetry.
export const CLICK_SERIES_MS = 450;
export const DRAG_THRESHOLD_PX = 6;
export function normalSize() { return {mode:'normal',scale:1,position:[0,0,0],snapshot:null}; }
export function sizeCommand(state,command,fitScale=1) {
  if(command==='restore') return state.snapshot
    ? {...state.snapshot,position:[...state.snapshot.position],snapshot:null}
    : state;
  if(command!=='inspect'&&command!=='point') throw new RangeError('Unknown size command');
  if(!Number.isFinite(fitScale)||fitScale<=0) throw new RangeError('Invalid fit scale');
  const snapshot=state.snapshot||{mode:state.mode,scale:state.scale,position:[...state.position]};
  return {mode:command,scale:command==='inspect'?fitScale:state.scale,position:[...state.position],snapshot};
}
export class ClickSeries {
  constructor(resolve,{schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}) {this.resolve=resolve;this.schedule=schedule;this.cancel=cancel;this.count=0;this.timer=null;}
  push(){this.count++;if(this.timer!==null)this.cancel(this.timer);if(this.count===4)this.flush();else this.timer=this.schedule(()=>this.flush(),CLICK_SERIES_MS);}
  flush(){if(!this.count)return;if(this.timer!==null)this.cancel(this.timer);const count=this.count;this.count=0;this.timer=null;this.resolve(count);}
  clear(){if(this.timer!==null)this.cancel(this.timer);this.count=0;this.timer=null;}
}
export function isDrag(from,to){return Math.hypot(to.x-from.x,to.y-from.y)>DRAG_THRESHOLD_PX;}
