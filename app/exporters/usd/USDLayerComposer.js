// Static layer/reference composition for packaged USD scenes. Not a full OpenUSD engine.
export function composeUsdLayers(rootName, assets) {
  const cache=new Map(),warnings=new Set();
  const normalize=path=>{const parts=[];for(const bit of path.replaceAll('\\','/').split('/')){if(!bit||bit==='.')continue;if(bit==='..'&&parts.length&&parts.at(-1)!=='..')parts.pop();else parts.push(bit);}return parts.join('/');};
  const resolve=(file,path)=>normalize(file.slice(0,file.lastIndexOf('/')+1)+path);
  const contains=(path,root)=>path===root||path.startsWith(root+'/')||path.startsWith(root+'.');
  const merge=(out,path,spec)=>{const old=out[path];out[path]={...old,...spec,fields:{...old?.fields,...spec.fields}};};
  function layer(name,stack=[]){
    if(stack.includes(name)||stack.length>64)throw new Error('Circular or excessively deep USD reference: '+name);
    if(cache.has(name))return cache.get(name);
    const data=assets[name];if(!data?.specsByPath)throw new Error('Missing USD layer: '+name+'. Import the complete ZIP or USDZ.');
    const source=data.specsByPath,out=Object.create(null),chain=[...stack,name];
    const metadata=source['/']?.fields||{};
    const subs=metadata.subLayers||[];
    for(let i=subs.length-1;i>=0;i--){
      const file=resolve(name,String(subs[i]).replace(/^@|@$/g,''));
      for(const [path,spec]of Object.entries(layer(file,chain)))merge(out,path,spec);
      const offset=metadata.subLayerOffsets?.[i];if(offset&&(offset[0]!==0||offset[1]!==1))warnings.add('Layer time offsets are not preserved in this static import.');
    }
    // Weaker referenced opinions are merged before the layer's local overrides.
    for(const [mount,spec]of Object.entries(source)){
      const raw=spec.fields.references;
      if(!raw)continue;
      const refs=[];
      for(const value of Array.isArray(raw)?raw:[raw]){
        if(typeof value==='string')for(const m of value.matchAll(/@([^@]*)@(?:<([^>]+)>)?/g))refs.push({assetPath:m[1],primPath:m[2]||''});
        else if(value&&typeof value==='object')refs.push(value);
      }
      for(const ref of refs.toReversed()){
        if(!ref.assetPath)throw new Error('Internal USD references are not supported by this package importer.');
        const file=resolve(name,ref.assetPath);
        if(!assets[file]?.specsByPath){warnings.add('Missing external layer omitted: '+file);continue;}
        const referenced=layer(file,chain);
        const prim=ref.primPath||('/'+(referenced['/']?.fields.defaultPrim||''));
        if(prim==='/'||!referenced[prim])throw new Error('USD reference has no valid target/defaultPrim: '+file);
        const remap=value=>typeof value==='string'&&contains(value,prim)?mount+value.slice(prim.length):value;
        for(const [path,child]of Object.entries(referenced))if(contains(path,prim)){
          const fields={...child.fields};
          for(const key of ['targetPaths','connectionPaths'])if(Array.isArray(fields[key]))fields[key]=fields[key].map(remap);
          merge(out,remap(path),{...child,fields});
        }
        if(ref.offset||ref.scale&&ref.scale!==1)warnings.add('Reference time offsets are not preserved in this static import.');
      }
    }
    for(const [path,spec]of Object.entries(source)){
      const fields={...spec.fields};delete fields.references;delete fields.subLayers;delete fields.subLayerOffsets;
      if(fields.typeName==='asset'&&typeof fields.default==='string'&&fields.default)fields.default=resolve(name,fields.default.replace(/^@|@$/g,''));
      merge(out,path,{...spec,fields});
    }
    cache.set(name,out);return out;
  }
  return {specsByPath:layer(rootName),warnings:[...warnings]};
}
