// USD conversion uses the pinned Three.js implementation with explicit texture checks.
import * as THREE from 'three';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { USDLoader } from './usd/USDLoader.js';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'three/addons/libs/fflate.module.js';

export function packUsdz(files) {
  const packed = {};
  let offset = 0;
  for (const [name, bytes] of Object.entries(files)) {
    const header = 30 + strToU8(name).length;
    const padding = (64 - (offset + header + 4) % 64) % 64;
    packed[name] = [bytes, {extra: {12345: new Uint8Array(padding)}}];
    offset += header + 4 + padding + bytes.length;
  }
  return zipSync(packed, {level: 0});
}

const slots = ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'];
async function readyTexture(texture) {
  const image = texture.image;
  if (image?.decode && !image.complete) await image.decode();
  if (!image || !(image.naturalWidth || image.width) || !(image.naturalHeight || image.height))
    throw new Error('A texture has no readable image. Load its image before converting.');
  if (texture.isCompressedTexture || texture.isDataTexture)
    throw new Error('Convert compressed/data textures to ordinary images before USD export.');
  // Check readback before making any downloadable archive.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  try { context.drawImage(image,0,0,1,1); context.getImageData(0,0,1,1); }
  catch { throw new Error('A texture cannot be read by the browser. Import a local copy of the image and try again.'); }
}

export async function createUsdPackage(meshes) {
  const root = new THREE.Group(), owned = [], materialCache = new Map(), warnings = new Set();
  let maxTextureSize = 1;
  const convertMaterial = async source => {
    if (materialCache.has(source)) return materialCache.get(source);
    if (!source || source.isShaderMaterial) throw new Error('Custom shader materials need baking to image textures before USD export.');
    const material = source.isMeshStandardMaterial ? source.clone() : new THREE.MeshStandardMaterial();
    owned.push(material);
    if (!source.isMeshStandardMaterial) {
      for (const key of [...slots,'opacity','transparent','alphaTest','side','vertexColors']) if(source[key] !== undefined) material[key]=source[key];
      if(source.color)material.color.copy(source.color);
      if(source.emissive)material.emissive.copy(source.emissive);
      material.roughness=source.roughness ?? .6; material.metalness=source.metalness ?? 0;
      warnings.add('Non-PBR materials were approximated with USD Preview Surface materials.');
    }
    if (material.vertexColors) throw new Error('Bake vertex colours into a texture before USD conversion; Preview Surface colour mixing is not supported yet.');
    for(const key of ['bumpMap','displacementMap','lightMap','clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap','transmissionMap','thicknessMap','specularColorMap','specularIntensityMap'])
      if(source[key]) throw new Error(key+' needs baking before USD export so its appearance is not silently lost.');
    if(source.transmission>0 || source.iridescence>0 || source.sheen>0)throw new Error('Transmission, iridescence and sheen need baking or simpler materials for this USD exporter.');
    if(material.map && material.alphaMap && (material.transparent || material.alphaTest>0))
      throw new Error('Merge the colour texture alpha and separate opacity map before USD export.');
    if(material.normalMap && material.normalMapType!==THREE.TangentSpaceNormalMap)throw new Error('USD export currently requires tangent-space normal maps.');
    for(const slot of slots) if(material[slot]){
      const texture=material[slot];
      if(texture.rotation || texture.center.x || texture.center.y || !texture.matrixAutoUpdate)
        throw new Error('Bake rotated or custom texture transforms before USD export. Offset and repeat are supported.');
      await readyTexture(texture);
      maxTextureSize=Math.max(maxTextureSize,texture.image.naturalWidth||texture.image.width,texture.image.naturalHeight||texture.image.height);
    }
    // Stock exporter only writes roughness/metallic maps with a unit factor.
    material.userData.bwsUsdFactors={roughness:material.roughness,metalness:material.metalness,opacity:material.opacity,normal:material.normalScale.toArray(),ao:material.aoMapIntensity,emissive:material.emissive.clone().multiplyScalar(material.emissiveIntensity).toArray()};
    if(material.roughnessMap)material.roughness=1;
    if(material.metalnessMap)material.metalness=1;
    materialCache.set(source,material);
    return material;
  };
  try {
    for(const source of meshes){
      if(!source?.isMesh || source.userData?.editorHelper)continue;
      source.updateWorldMatrix(true,false);
      let base=source.geometry.clone();owned.push(base);
      if(source.isSkinnedMesh || source.morphTargetInfluences?.some(value=>value!==0)){
        const pos=base.getAttribute('position'),point=new THREE.Vector3();
        for(let i=0;i<pos.count;i++){source.getVertexPosition(i,point);pos.setXYZ(i,point.x,point.y,point.z);}
        base.computeVertexNormals();base.morphAttributes={};
        warnings.add('Skinned and morphed meshes are exported in their current pose, without animation.');
      }
      const materials=Array.isArray(source.material)?source.material:[source.material];
      const count=base.index?.count??base.getAttribute('position')?.count??0;
      const groups=Array.isArray(source.material)?base.groups:[{start:0,count,materialIndex:0}];
      if(!groups.length)throw new Error('A multi-material mesh has no material groups.');
      for(let instance=0;instance<(source.isInstancedMesh?source.count:1);instance++){
        const transform=source.matrixWorld.clone();
        if(source.isInstancedMesh){const matrix=new THREE.Matrix4();source.getMatrixAt(instance,matrix);transform.multiply(matrix);}
        for(const group of groups){
          const start=Math.max(group.start,base.drawRange.start),end=Math.min(count,group.start+group.count,base.drawRange.start+base.drawRange.count);
          if(end<=start)continue;
          if(start%3 || (end-start)%3)throw new Error('A mesh has an incomplete triangle range.');
          const geometry=new THREE.BufferGeometry();owned.push(geometry);
          for(const [key,attribute]of Object.entries(base.attributes)){
            if(['skinIndex','skinWeight','tangent'].includes(key))continue;
            const values=new Float32Array((end-start)*attribute.itemSize);
            for(let i=start;i<end;i++)for(let k=0;k<attribute.itemSize;k++){
              const vertex=base.index?base.index.getX(i):i;
              values[(i-start)*attribute.itemSize+k]=attribute.getComponent(vertex,k);
            }
            geometry.setAttribute(key,new THREE.Float32BufferAttribute(values,attribute.itemSize));
          }
          geometry.applyMatrix4(transform);
          if(transform.determinant()<0){
            for(const attribute of Object.values(geometry.attributes))for(let i=0;i<attribute.count;i+=3)for(let k=0;k<attribute.itemSize;k++){
              const first=attribute.getComponent(i+1,k);attribute.setComponent(i+1,k,attribute.getComponent(i+2,k));attribute.setComponent(i+2,k,first);
            }
          }
          if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
          let material=await convertMaterial(materials[group.materialIndex]);
          for(const slot of slots)if(material[slot]&&!geometry.getAttribute('uv'+(material[slot].channel||'')))
            throw new Error('A textured mesh is missing the UV coordinates required by '+slot+'.');
          if(source.isInstancedMesh && source.instanceColor){
            material=material.clone();owned.push(material);
            const tint=new THREE.Color();source.getColorAt(instance,tint);material.color.multiply(tint);
          }
          const mesh=new THREE.Mesh(geometry,material);mesh.name=source.name;root.add(mesh);
        }
      }
    }
    if(!root.children.length)throw new Error('Select or create at least one mesh to export.');
    root.updateMatrixWorld(true);
    const files=unzipSync(await new USDZExporter().parseAsync(root,{includeAnchoringProperties:false,maxTextureSize}));
    let text=strFromU8(files['model.usda']);
    for(const material of new Set(root.children.map(mesh=>mesh.material))){
      const materialStart=text.indexOf('def Material "Material_'+material.id+'"');
      const nextMaterial=text.indexOf('\n\tdef Material',materialStart+1);
      const materialEnd=nextMaterial<0?text.lastIndexOf('\n}'):nextMaterial;
      const prefix=text.slice(0,materialStart),suffix=text.slice(materialEnd);
      text=text.slice(materialStart,materialEnd);
      const factors=material.userData.bwsUsdFactors;
      const adjust=(slot,role,scale,bias)=>{
        if(!material[slot])return;
        const marker='def Shader "Texture_'+material[slot].id+'_'+role+'"';
        const start=text.indexOf(marker),end=text.indexOf('\n\t\t}',start);
        if(start<0||end<0)throw new Error('USD texture shader was not emitted: '+slot);
        let block=text.slice(start,end);
        block=block.replace(/float4 inputs:scale = [^\n]+/g,'');
        block+='\n\t\t\tfloat4 inputs:scale = ('+scale.join(', ')+')';
        if(bias)block+='\n\t\t\tfloat4 inputs:bias = ('+bias.join(', ')+')';
        text=text.slice(0,start)+block+text.slice(end);
      };
      adjust('map','diffuse',[material.color.r,material.color.g,material.color.b,factors.opacity]);
      adjust('roughnessMap','roughness',[factors.roughness,factors.roughness,factors.roughness,1]);
      adjust('metalnessMap','metallic',[factors.metalness,factors.metalness,factors.metalness,1]);
      adjust('normalMap','normal',[2*factors.normal[0],2*factors.normal[1],2,1],[-factors.normal[0],-factors.normal[1],-1,0]);
      adjust('aoMap','occlusion',[factors.ao,factors.ao,factors.ao,1],[1-factors.ao,1-factors.ao,1-factors.ao,0]);
      adjust('emissiveMap','emissive',[...factors.emissive,1]);
      adjust('alphaMap','opacity',[factors.opacity,factors.opacity,factors.opacity,1]);
      if(material.alphaMap)text=text.replace('Texture_'+material.alphaMap.id+'_opacity.outputs:r','Texture_'+material.alphaMap.id+'_opacity.outputs:g');
      if(!material.emissiveMap && material.emissiveIntensity!==1)
        text=text.replace('color3f inputs:emissiveColor = ('+material.emissive.toArray().join(', ')+')','color3f inputs:emissiveColor = ('+factors.emissive.join(', ')+')');
      if(material.side===THREE.DoubleSide)for(const mesh of root.children.filter(mesh=>mesh.material===material)){
        const path='geometries/Geometry_'+mesh.geometry.id+'.usda';
        files[path]=strToU8(strFromU8(files[path]).replace('uniform token subdivisionScheme','uniform bool doubleSided = true\n\t\tuniform token subdivisionScheme'));
      }
      text=prefix+text+suffix;
    }
    files['model.usda']=strToU8(text);
    // Every referenced asset must be in the package before download.
    for(const [name,bytes]of Object.entries(files))if(/\.usda$/.test(name)){
      for(const match of strFromU8(bytes).matchAll(/@([^@]+)@/g)){
        const path=match[1].replace(/^\.\//,'');
        if(!files[path])throw new Error('USD package is missing '+path);
      }
    }
    return{files,archive:packUsdz(files),meshCount:root.children.length,textureCount:Object.keys(files).filter(name=>name.startsWith('textures/')).length,warnings:[...warnings]};
  } finally {for(const item of owned)item.dispose();}
}

export async function loadUsdFiles(selectedFiles, textureReplacements = new Map()) {
  const files=Array.from(selectedFiles);
  const main=files.find(file=>/\.(usd[azc]?|zip)$/i.test(file.name));
  if(!main)throw new Error('Choose a USD, USDC, USDA, USDZ or USD bundle.');
  const bytes=new Uint8Array(await main.arrayBuffer());
  const assets=Object.create(null);
  const normalize=name=>name.replaceAll('\\','/').replace(/^\.\//,'');
  if(/\.(usdz|zip)$/i.test(main.name)){
    for(const [name,data] of Object.entries(unzipSync(bytes)))assets[normalize(name)]=data;
  }else{
    assets[normalize(main.webkitRelativePath||main.name)]=bytes;
  }
  for(const file of files)if(file!==main){
    const name=normalize(file.webkitRelativePath||file.name);
    if(Object.hasOwn(assets,name))throw new Error('Duplicate USD companion filename: '+name);
    assets[name]=new Uint8Array(await file.arrayBuffer());
  }
  const rootName=Object.keys(assets).find(name=>/\.usd[ac]?$/i.test(name));
  if(!rootName)throw new Error('No USD scene was found in the package.');
  for(const [path,image] of textureReplacements){
    assets[path]=new Uint8Array(await image.arrayBuffer());
  }
  const ordered=Object.assign(Object.create(null),{[rootName]:assets[rootName]},assets);
  const manager=new THREE.LoadingManager(),failures=[];
  manager.onError=url=>failures.push(url);
  const loader=new USDLoader(manager);
  const root=await new Promise((resolve,reject)=>{
    loader.parse({usdFiles:ordered},'',resolve,reject);
  });
  if(failures.length)throw new Error('A USD texture could not be decoded. No model was imported. Use PNG, JPEG or another supported browser image format.');
  let count=0;root.traverse(mesh=>{if(mesh.isMesh)count++;});
  if(!count)throw new Error('The USD scene contains no supported meshes.');
  return{root,file:main};
}
