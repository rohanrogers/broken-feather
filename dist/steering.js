const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
// Use the first index bone's screen-plane components. Dividing by palm scale, rather than
// the reconstructed finger length, avoids changing direction just because
// inferred finger depth/length changes. The fingertip and palm translation do not steer.
export function fingerSteering(points,worldPoints){
  const world=worldPoints?.length===21&&worldPoints.every(p=>['x','y','z'].every(a=>Number.isFinite(p[a])));
  let joints=world?worldPoints:points;
  let scale=world?(distance(joints[0],joints[9])+distance(joints[5],joints[17]))/2:(Math.hypot(points[0].x-points[9].x,points[0].y-points[9].y)+Math.hypot(points[5].x-points[17].x,points[5].y-points[17].y))/2;
  let length=world?distance(joints[5],joints[6]):Math.hypot(joints[6].x-joints[5].x,joints[6].y-joints[5].y),source=world?'world-proximal-xy':'image-proximal-xy';
  if(world&&(scale<.00001||length<scale*.12)){joints=points;scale=(Math.hypot(points[0].x-points[9].x,points[0].y-points[9].y)+Math.hypot(points[5].x-points[17].x,points[5].y-points[17].y))/2;length=Math.hypot(joints[6].x-joints[5].x,joints[6].y-joints[5].y);source='image-fallback-collapsed-world-bone';}
  const imageScale=(Math.hypot(points[0].x-points[9].x,points[0].y-points[9].y)+Math.hypot(points[5].x-points[17].x,points[5].y-points[17].y))/2;
  // Camera-plane pitch corroborates the reconstructed world Y, so a depth
  // fit changing the inferred joint height has less influence on the cursor.
  const projectedPitch=1.5*(points[6].y-points[5].y)/Math.max(imageScale,.00001);
  const imageDepthSupported=Number.isFinite(points[6].z)&&Number.isFinite(points[5].z)&&Math.abs(points[6].z-points[5].z)>imageScale*.08;
  const usable=Number.isFinite(scale)&&scale>.00001&&Number.isFinite(length)&&length<scale*1.2&&(source==='world-proximal-xy'||length>scale*.08||imageDepthSupported);
  return {usable,direction:{yaw:-3*(joints[6].x-joints[5].x)/Math.max(scale,.00001),pitch:source==='world-proximal-xy' ? .5*(3*(joints[6].y-joints[5].y)/Math.max(scale,.00001))+.5*projectedPitch : projectedPitch},extent:clamp(3*length/Math.max(scale,.00001),.6,1.6),source};
}
export function mapSteering(direction,neutral,extent=1.1,range=.5){
  const centralGain=.6;
  const magnitude=(d,span)=>centralGain*d+(.475-centralGain*span)*(d/span)**3;
  const spanFor=(centre,sign,maxSpan)=>clamp((extent-sign*centre)*.8,.28,maxSpan);
  const map=(value,centre,maxSpan)=>{
    const delta=value-centre,sign=Math.sign(delta),span=spanFor(centre,sign,maxSpan);
    return clamp(.5+sign*magnitude(Math.min(Math.abs(delta),span),span),.025,.975);
  };
  const x=map(direction.yaw,neutral.yaw,range*1.3);
  let y=map(direction.pitch,neutral.pitch,range);
  const up=neutral.pitch-direction.pitch,oldSpan=spanFor(neutral.pitch,-1,range),newSpan=Math.min(oldSpan,range*.72),inner=Math.min(range*.36,newSpan*.7);
  if(newSpan<oldSpan&&up>inner){
    // Preserve the fine-aiming curve exactly. A monotone Hermite segment adds
    // outer upward reach, joins with the old slope, and eases into the edge.
    const start=magnitude(inner,oldSpan),width=newSpan-inner,t=clamp((up-inner)/width,0,1);
    const slope=centralGain+3*(.475-centralGain*oldSpan)*inner**2/oldSpan**3;
    const h00=2*t**3-3*t**2+1,h10=t**3-2*t**2+t,h01=-2*t**3+3*t**2;
    y=.5-(h00*start+h10*width*slope+h01*.475);
  }
  return {x,y};
}
