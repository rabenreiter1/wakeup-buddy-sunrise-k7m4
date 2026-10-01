// Interruptible, critically damped settling. Dragging itself never uses easing.
export const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export function spring({from,to,velocity=0,update}){
 let frame,stopped=false,resolve;const finished=new Promise(r=>resolve=r);
 const finish=completed=>{if(stopped)return;stopped=true;cancelAnimationFrame(frame);resolve(completed);};
 if(reducedMotion()||Math.abs(from-to)<.1&&Math.abs(velocity)<.01){update(to,0);finish(true);return {finished,cancel:()=>finish(false)};}
 const start=performance.now(),distance=from-to,omega=24;
 // Arrive without overshooting the page edge, even after a fast flick.
 const initialVelocity=distance>0?Math.max(-omega*distance,velocity*1000):distance<0?Math.min(-omega*distance,velocity*1000):0;
 const b=initialVelocity+omega*distance;
 const tick=now=>{if(stopped)return;const t=(now-start)/1000,decay=Math.exp(-omega*t),value=to+(distance+b*t)*decay,speed=(b-omega*(distance+b*t))*decay;
  if(t>.8||Math.abs(value-to)<.25&&Math.abs(speed)<5){update(to,0);finish(true);return;}
  update(value,speed/1000);frame=requestAnimationFrame(tick);
 };frame=requestAnimationFrame(tick);return {finished,cancel:()=>finish(false)};
}
export function sample(gesture,value,time=performance.now()){
 const dt=time-gesture.sampleTime;
 if(dt>0){gesture.velocity=dt>100?0:(value-gesture.sampleValue)/dt;gesture.sampleValue=value;gesture.sampleTime=time;}
}
export function releaseVelocity(gesture){return performance.now()-gesture.sampleTime>100?0:Math.max(-2,Math.min(2,gesture.velocity||0));}
