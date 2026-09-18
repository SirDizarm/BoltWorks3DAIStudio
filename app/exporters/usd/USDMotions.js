import { USDComposer } from './USDComposer.js';
export function collectUsdMotions(assets,root) {
  const bones=new Map();root.traverse(node=>{if(node.isBone){const list=bones.get(node.name)||[];list.push(node);bones.set(node.name,list);}});
  const clips=[],warnings=[];
  for(const [file,data]of Object.entries(assets)){
    if(!data?.specsByPath||!/(^|\/)motions\//i.test(file))continue;
    const paths=Object.entries(data.specsByPath).filter(([,s])=>s.fields.typeName==='SkelAnimation').map(([p])=>p);
    if(!paths.length)continue;
    const builder=new USDComposer();builder.specsByPath=data.specsByPath;
    const meta=data.specsByPath['/']?.fields||{};builder.fps=meta.timeCodesPerSecond||meta.framesPerSecond||24;builder._buildIndexes();
    for(const path of paths){
      const clip=builder._buildAnimationClip(path);if(!clip)continue;
      const missing=clip.tracks.some(track=>{const name=track.name.slice(0,track.name.lastIndexOf('.'));return bones.get(name)?.length!==1;});
      if(missing){warnings.push('Motion skipped because its joints do not uniquely match the imported rig: '+file);continue;}
      let start=Infinity;for(const track of clip.tracks)if(track.times.length)start=Math.min(start,track.times[0]);
      for(const track of clip.tracks){const dot=track.name.lastIndexOf('.');track.name=bones.get(track.name.slice(0,dot))[0].uuid+track.name.slice(dot);if(Number.isFinite(start))for(let i=0;i<track.times.length;i++)track.times[i]-=start;}
      clip.resetDuration();clip.name=file.split('/').pop().replace(/\.usd[ac]?$/i,'')+(paths.length>1?' / '+path.split('/').pop():'');
      clip.userData={usdMotion:true,fps:builder.fps,source:file};clips.push(clip);
      if(data.specsByPath[path+'.blendShapeWeights'])warnings.push('Facial blend-shape animation is not imported: '+clip.name);
    }
  }
  return {clips,warnings};
}
