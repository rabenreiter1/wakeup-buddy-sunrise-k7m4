// Shared with the approved lava study. No generated assets or per-ritual code.
// Balances colour contributions across soft transitions, to within sampling error.
export function createLavaField(colors) {
 const paletteColors=colors.slice(0,24),root={dataset:{}};
 let time=0;
      let fieldCount=0,fieldTime=-1,sites=new Float32Array(72),companions=new Float32Array(96),biases=new Float64Array(24);
      const sampleSide=40;
      function warp(u,v,t){
        let x=u-.5,y=v-.5;
        const a=.36*Math.sin(t*.31)+.2*Math.sin(t*.53),c=Math.cos(a),s=Math.sin(a),rx=c*x-s*y;
        y=s*x+c*y;x=rx;
        x+=.10*Math.sin(5.6*y+t*.71)+.045*Math.cos(8.1*y-t*.48);
        y+=.09*Math.sin(5.3*x-t*.59)+.04*Math.cos(7.3*x+t*.38);
        return [x,y];
      }
      function blobDistance(q,i){
        const a=((q[0]-sites[i*3])**2+(q[1]-sites[i*3+1])**2)*companions[i*4+2];
        const b=((q[0]-companions[i*4])**2+(q[1]-companions[i*4+1])**2)*companions[i*4+3];
        const nearest=Math.min(a,b),soft=.035;
        return nearest-soft*Math.log(Math.exp((nearest-a)/soft)+Math.exp((nearest-b)/soft));
      }
      // Balance the integrated colour weights, including their soft transitions.
      // Additive power-cell biases change area without imposing stripe geometry.
      function balanceField(){
        const n=paletteColors.length;
        if(fieldTime===time&&fieldCount===n)return;
        const fresh=fieldCount!==n;fieldCount=n;fieldTime=time;
        if(fresh)biases.fill(0);
        if(n===1){root.dataset.areaError='0';return;}
        const t=time*.85,temp=.04/Math.sqrt(n),m=sampleSide**2,k=n-1;
        for(let i=0;i<n;i++){
          const angle=i*2.39996323,r=.43*Math.sqrt((i+.5)/n),phase=i*1.719;
          sites[i*3]=r*Math.cos(angle)+.18*Math.sin(t*.57+phase);
          sites[i*3+1]=r*Math.sin(angle)+.17*Math.cos(t*.43+phase*1.7);
          const separation=.10+.32*(.5+.5*Math.sin(t*.63+phase)),direction=angle+1.6*Math.sin(t*.37+phase);
          companions[i*4]=sites[i*3]+separation*Math.cos(direction);
          companions[i*4+1]=sites[i*3+1]+separation*Math.sin(direction);
          companions[i*4+2]=.55+1.4*(.5+.5*Math.sin(t*.5+phase));
          companions[i*4+3]=.65+1.4*(.5+.5*Math.cos(t*.53+phase));
        }
        const distances=new Float64Array(m*n),weights=new Float64Array(n);
        for(let y=0;y<sampleSide;y++)for(let x=0;x<sampleSide;x++){
          const q=warp((x+.5)/sampleSide,(y+.5)/sampleSide,t),base=(y*sampleSide+x)*n;
          for(let i=0;i<n;i++)distances[base+i]=blobDistance(q,i);
        }
        let error=1,masses;
        for(let iteration=0;iteration<(fresh?50:12);iteration++){
          masses=new Float64Array(n);const jac=new Float64Array(k*k);
          for(let j=0;j<m;j++){
            const base=j*n;let peak=-Infinity,sum=0;
            for(let i=0;i<n;i++){weights[i]=(biases[i]-distances[base+i])/temp;peak=Math.max(peak,weights[i]);}
            for(let i=0;i<n;i++){weights[i]=Math.exp(weights[i]-peak);sum+=weights[i];}
            for(let i=0;i<n;i++){weights[i]/=sum;masses[i]+=weights[i]/m;}
            for(let i=0;i<k;i++)for(let l=0;l<k;l++)jac[i*k+l]+=weights[i]*((i===l?1:0)-weights[l])/(m*temp);
          }
          error=Math.max(...masses.map(v=>Math.abs(v-1/n)));
          if(error<.00003)break;
          const rhs=Float64Array.from(masses.slice(0,k),v=>1/n-v);
          // Small positive regularisation keeps an initially tiny region recoverable.
          for(let i=0;i<k;i++)jac[i*k+i]+=.00001;
          for(let p=0;p<k;p++){
            const pivot=jac[p*k+p];
            for(let r=p+1;r<k;r++){
              const f=jac[r*k+p]/pivot;
              for(let c=p;c<k;c++)jac[r*k+c]-=f*jac[p*k+c];
              rhs[r]-=f*rhs[p];
            }
          }
          const delta=new Float64Array(k);
          for(let r=k-1;r>=0;r--){let v=rhs[r];for(let c=r+1;c<k;c++)v-=jac[r*k+c]*delta[c];delta[r]=v/jac[r*k+r];}
          const scale=Math.min(1,.08/Math.max(.000001,...delta.map(Math.abs)));
          for(let i=0;i<k;i++)biases[i]+=delta[i]*scale;
        }
        for(let i=0;i<n;i++)sites[i*3+2]=biases[i];
        root.dataset.areaError=String(error);
        root.dataset.colourShares=JSON.stringify(Array.from(masses));
      }

 const rgb=paletteColors.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
 return {
  colors:paletteColors,sites,companions,
  get error(){return Number(root.dataset.areaError||0);},
  update(at){time=at;balanceField();},
  sample(u,v){
   if(rgb.length===1)return rgb[0];
   const q=warp(u,v,time*.85),temp=.04/Math.sqrt(rgb.length),weights=rgb.map((_,i)=>(biases[i]-blobDistance(q,i))/temp),peak=Math.max(...weights);
   let sum=0;for(let i=0;i<weights.length;i++){weights[i]=Math.exp(weights[i]-peak);sum+=weights[i];}
   return [0,1,2].map(c=>rgb.reduce((value,color,i)=>value+color[c]*weights[i]/sum,0));
  }
 };
}
      export const vertex='attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
      // Rounded surfaces use uniform-area coordinates, so both aspect ratios
      // preserve the same balanced field. Colours always form a convex mixture.
      export const fragment=`precision highp float; varying vec2 uv; uniform float clock; uniform int count; uniform sampler2D palette; uniform vec2 corner; uniform vec3 sites[24]; uniform vec4 companions[24];
      float capArea(float y,float rx,float ry){if(ry<.000001)return y;float s=clamp((y-ry)/ry,-1.,0.);return (1.-2.*rx)*y+rx*ry*(s*sqrt(max(0.,1.-s*s))+asin(s)+1.5707963268);}
      vec3 colour(float i){float n=float(count);if(i<0.)i+=n;else if(i>=n)i-=n;return texture2D(palette,vec2((i+.5)/n,.5)).rgb;}
      float blobDistance(vec2 q,vec2 primary,vec4 secondary){vec2 da=q-primary,db=q-secondary.xy;float a=dot(da,da)*secondary.z,b=dot(db,db)*secondary.w,nearest=min(a,b),soft=.035;return nearest-soft*log(exp((nearest-a)/soft)+exp((nearest-b)/soft));}
      void main(){
        if(count==1){gl_FragColor=vec4(colour(0.),1.);return;}
        vec2 p=vec2(uv.x,1.0-uv.y);float rx=corner.x,ry=corner.y;
        float total=1.-(4.-3.1415926536)*rx*ry;
        float edge=0.,area=0.;
        if(p.y<ry){float s=(p.y-ry)/ry;edge=rx*(1.-sqrt(max(0.,1.-s*s)));area=capArea(p.y,rx,ry);}
        else if(p.y>1.-ry){float s=(1.-p.y-ry)/ry;edge=rx*(1.-sqrt(max(0.,1.-s*s)));area=total-capArea(1.-p.y,rx,ry);}
        else{area=capArea(ry,rx,ry)+p.y-ry;}
        float u=(p.x-edge)/(1.-2.*edge),v=area/total,t=clock*.85;
        vec2 q=vec2(u-.5,v-.5);float a=.36*sin(t*.31)+.2*sin(t*.53),c=cos(a),s=sin(a);
        q=vec2(c*q.x-s*q.y,s*q.x+c*q.y);
        q.x+=.10*sin(5.6*q.y+t*.71)+.045*cos(8.1*q.y-t*.48);
        q.y+=.09*sin(5.3*q.x-t*.59)+.04*cos(7.3*q.x+t*.38);
        float temp=.04/sqrt(float(count)),peak=-1.e10;
        for(int i=0;i<24;i++){if(i>=count)break;float d=blobDistance(q,sites[i].xy,companions[i]);peak=max(peak,(sites[i].z-d)/temp);}
        vec3 color=vec3(0.);float sum=0.;
        for(int i=0;i<24;i++){if(i>=count)break;float d=blobDistance(q,sites[i].xy,companions[i]);float w=exp((sites[i].z-d)/temp-peak);color+=w*colour(float(i));sum+=w;}
        gl_FragColor=vec4(color/sum,1.);
      }`;
