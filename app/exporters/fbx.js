import * as THREE from 'three';

// FBX 7.4 binary encoding: https://code.blender.org/2013/08/fbx-binary-file-format-specification/
const n = (name, props = [], children = []) => ({name, props, children});
const t = (type, value) => ({type, value});
const I = value => t('I', value), L = value => t('L', value);
const a = (name, type, value) => n(name, [t(type, value)]);
const p = (name, type, values, flags = '') => n('P', [name, type, '', flags, ...values]);
const ps = children => n('Properties70', [], children);
const named = (name, kind) => name + '\0\x01' + kind;
const ticks = seconds => Math.round(seconds * 46186158000);

function encodeProperty(input) {
  const {type, value} = input && typeof input === 'object' && 'type' in input
    ? input : {type: typeof input === 'string' ? 'S' : 'D', value: input};
  const isArray = ['d','f','i','l'].includes(type);
  const bytes = type === 'S' ? new TextEncoder().encode(value) : type === 'R' ? value : null;
  const width = ['d','l','D','L'].includes(type) ? 8 : 4;
  const out = new Uint8Array(bytes ? 5 + bytes.length : isArray ? 13 + value.length * width : 1 + width);
  const view = new DataView(out.buffer);
  out[0] = type.charCodeAt(0);
  if (bytes) { view.setUint32(1, bytes.length, true); out.set(bytes, 5); }
  else {
    const put = (offset, v) => {
      if (!Number.isFinite(Number(v))) throw new Error('FBX contains a non-finite number.');
      if (type.toLowerCase() === 'l') view.setBigInt64(offset, BigInt(Math.round(v)), true);
      else if (type.toLowerCase() === 'i') view.setInt32(offset, v, true);
      else if (type.toLowerCase() === 'f') view.setFloat32(offset, v, true);
      else view.setFloat64(offset, v, true);
    };
    if (isArray) {
      view.setUint32(1, value.length, true); view.setUint32(9, value.length * width, true);
      for (let i = 0; i < value.length; i++) put(13 + i * width, value[i]);
    } else put(1, value);
  }
  return out;
}

function encodeDocument(nodes) {
  const prepare = entry => {
    entry.nameBytes = new TextEncoder().encode(entry.name);
    entry.bytes = entry.props.map(encodeProperty);
    entry.propertySize = entry.bytes.reduce((sum, b) => sum + b.length, 0);
    entry.size = 13 + entry.nameBytes.length + entry.propertySize;
    for (const child of entry.children) { prepare(child); entry.size += child.size; }
    if (entry.children.length) entry.size += 13;
  };
  nodes.forEach(prepare);
  const end = 27 + nodes.reduce((sum, entry) => sum + entry.size, 0) + 13;
  const footerVersion = Math.ceil((end + 16) / 16) * 16 + 4;
  if (footerVersion + 140 >= 0xffffffff) throw new Error('This model exceeds the FBX 7.4 size limit.');
  const out = new Uint8Array(footerVersion + 140), view = new DataView(out.buffer);
  out.set(new TextEncoder().encode('Kaydara FBX Binary  \0\x1a\0'));
  view.setUint32(23, 7400, true);
  const write = (entry, start) => {
    view.setUint32(start, start + entry.size, true);
    view.setUint32(start + 4, entry.bytes.length, true);
    view.setUint32(start + 8, entry.propertySize, true);
    out[start + 12] = entry.nameBytes.length;
    let offset = start + 13;
    out.set(entry.nameBytes, offset); offset += entry.nameBytes.length;
    for (const bytes of entry.bytes) { out.set(bytes, offset); offset += bytes.length; }
    for (const child of entry.children) offset = write(child, offset);
    return start + entry.size;
  };
  let offset = 27;
  for (const entry of nodes) offset = write(entry, offset);
  out.set([0xfa,0xbc,0xab,0x09,0xd0,0xc8,0xd4,0x66,0xb1,0x76,0xfb,0x83,0x1c,0xf7,0x26,0x7e], end);
  view.setUint32(footerVersion, 7400, true);
  out.set([0xf8,0x5a,0x8c,0x6a,0xde,0xf5,0xd9,0x7e,0xec,0xe9,0x0c,0xe3,0x75,0x8f,0x29,0x0b], out.length - 16);
  return out.buffer;
}

export function exportBinaryFbx(roots, {animations = [], textureDataUrl = () => null} = {}) {
  let nextId = 1000, meshCount = 0, clipCount = 0;
  const objects = [], links = [], warnings = new Set(), models = new Map(), materials = new Map();
  const add = (kind, name, subtype, children) => {
    const key = nextId++;
    objects.push(n(kind, [L(key), named(name, kind), subtype], children));
    return key;
  };
  const link = (child, parent, channel) => links.push(n('C', channel
    ? ['OP', L(child), L(parent), channel] : ['OO', L(child), L(parent)]));
  const visit = object => {
    if (object.userData?.editorHelper || models.has(object)) return;
    models.set(object, nextId++); object.children.forEach(visit);
  };
  roots.forEach(root => { root.updateWorldMatrix(true, true); visit(root); });
  for (const object of [...models.keys()]) if (object.isSkinnedMesh) {
    for (const bone of object.skeleton.bones) {
      const chain = []; let current = bone;
      while (current && !current.isScene && !models.has(current)) { chain.push(current); current = current.parent; }
      for (const ancestor of chain.reverse()) { ancestor.updateWorldMatrix(true, true); visit(ancestor); }
    }
  }
  const materialId = material => {
    if (materials.has(material)) return materials.get(material);
    const color = (material?.color || new THREE.Color(1,1,1)).clone().convertLinearToSRGB();
    const key = add('Material', material?.name || 'Material', '', [
      n('Version',[I(102)]),n('ShadingModel',['phong']),n('MultiLayer',[I(0)]),
      ps([p('DiffuseColor','Color',color.toArray()),p('DiffuseFactor','Number',[1]),
        p('Opacity','Number',[material?.opacity ?? 1]),p('TransparencyFactor','Number',[1-(material?.opacity ?? 1)]),
        p('Shininess','Number',[material?.shininess ?? (1-(material?.roughness ?? .6))*100])])
    ]);
    materials.set(material,key);
    if (material?.map) {
      const url = textureDataUrl(material.map);
      if (url?.startsWith('data:')) {
        const comma = url.indexOf(','), header = url.slice(0,comma);
        const decoded = /;base64/i.test(header) ? atob(url.slice(comma+1)) : decodeURIComponent(url.slice(comma+1));
        const bytes = Uint8Array.from(decoded,ch=>ch.charCodeAt(0));
        const extension = /image\/jpe?g/i.test(header) ? 'jpg' : /image\/webp/i.test(header) ? 'webp' : 'png';
        const filename = 'texture-' + key + '.' + extension;
        const video = add('Video',filename,'Clip',[n('Type',['Clip']),n('Filename',[filename]),n('RelativeFilename',[filename]),n('Content',[t('R',bytes)])]);
        const texture = add('Texture',filename,'',[n('Type',['TextureVideoClip']),n('Version',[I(202)]),n('TextureName',[filename]),n('Media',[named(filename,'Video')]),n('FileName',[filename]),n('RelativeFilename',[filename]),n('ModelUVTranslation',material.map.offset.toArray()),n('ModelUVScaling',material.map.repeat.toArray()),n('Texture_Alpha_Source',['None']),n('Cropping',[I(0),I(0),I(0),I(0)])]);
        link(video,texture);link(texture,key,'DiffuseColor');
        if (material.map.rotation) warnings.add('Texture rotation is not exported.');
      } else warnings.add('Some colour textures could not be embedded.');
    }
    if (material?.normalMap || material?.roughnessMap || material?.metalnessMap || material?.emissiveMap || material?.alphaMap)
      warnings.add('Additional PBR maps are not exported; colour textures and basic materials are included.');
    return key;
  };
  for (const [object,modelId] of models) {
    const matrix = models.has(object.parent) ? object.matrix : object.matrixWorld;
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
    matrix.decompose(position,quaternion,scale);
    const rotation = new THREE.Euler().setFromQuaternion(quaternion,'ZYX');
    objects.push(n('Model',[L(modelId),named(object.name || 'Object'+modelId,'Model'),object.isMesh?'Mesh':object.isBone?'LimbNode':'Null'],[
      n('Version',[I(232)]),ps([p('Lcl Translation','Lcl Translation',position.toArray(),'A'),
        p('Lcl Rotation','Lcl Rotation',[rotation.x,rotation.y,rotation.z].map(THREE.MathUtils.radToDeg),'A'),
        p('Lcl Scaling','Lcl Scaling',scale.toArray(),'A'),p('RotationOrder','enum',[I(0)]),
        p('InheritType','enum',[I(1)]),p('Visibility','Visibility',[object.visible?1:0])]),
      n('Shading',[I(1)]),n('Culling',['CullingOff'])
    ]));
    link(modelId,models.get(object.parent)||0);
    if (object.isBone) link(add('NodeAttribute',object.name||'Bone','LimbNode',[n('TypeFlags',['Skeleton']),ps([p('Size','double',[1])])]),modelId);
    if (!object.isMesh) continue;
    if (object.isInstancedMesh) throw new Error('Realize instanced meshes before FBX export.');
    const geometry=object.geometry,positionAttribute=geometry.getAttribute('position');
    if (!positionAttribute) throw new Error('A mesh has no positions.');
    if (Object.keys(geometry.morphAttributes).length) warnings.add('Morph targets and their animation are not exported.');
    const index=geometry.index,count=index?.count??positionAttribute.count;
    if(count%3) throw new Error('FBX export needs triangulated meshes.');
    const vertices=[],polygonIndices=[],normals=[],uvs=[],colors=[],faceMaterials=[];
    const normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),color=geometry.getAttribute('color');
    for(let i=0;i<positionAttribute.count;i++) vertices.push(positionAttribute.getX(i),positionAttribute.getY(i),positionAttribute.getZ(i));
    const meshMaterials=Array.isArray(object.material)?object.material:[object.material];
    let faceMaterialIndex=0;
    meshMaterials.forEach(material=>link(materialId(material),modelId));
    for(let i=0;i<count;i++){
      const v=index?index.getX(i):i;
      if(i%3===0){const group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count);faceMaterialIndex=Array.isArray(object.material)?Math.min(meshMaterials.length-1,Math.max(0,group?.materialIndex||0)):0;faceMaterials.push(faceMaterialIndex);}
      polygonIndices.push(i%3===2?-v-1:v);
      if(normal)normals.push(normal.getX(v),normal.getY(v),normal.getZ(v));
      if(uv)uvs.push(uv.getX(v),meshMaterials[faceMaterialIndex]?.map?.flipY===false?1-uv.getY(v):uv.getY(v));
      if(color){const rgb=new THREE.Color(color.getX(v),color.getY(v),color.getZ(v)).convertLinearToSRGB();colors.push(rgb.r,rgb.g,rgb.b,color.itemSize>3?color.getW(v):1);}
    }
    const elements=[];
    const layer=(kind,mapping,data,reference='Direct')=>elements.push(n(kind,[I(0)],[n('Version',[I(101)]),n('Name',['']),n('MappingInformationType',[mapping]),n('ReferenceInformationType',[reference]),data]));
    if(normal)layer('LayerElementNormal','ByPolygonVertex',a('Normals','d',normals));
    if(uv)layer('LayerElementUV','ByPolygonVertex',a('UV','d',uvs));
    if(color)layer('LayerElementColor','ByPolygonVertex',a('Colors','d',colors));
    layer('LayerElementMaterial','ByPolygon',a('Materials','i',faceMaterials),'IndexToDirect');
    const geometryId=add('Geometry',object.name||'Mesh','Mesh',[n('GeometryVersion',[I(124)]),a('Vertices','d',vertices),a('PolygonVertexIndex','i',polygonIndices),...elements,
      n('Layer',[I(0)],[n('Version',[I(100)]),...elements.map(element=>n('LayerElement',[],[n('Type',[element.name]),n('TypedIndex',[I(0)])]))])]);
    link(geometryId,modelId);meshCount++;
    if(object.isSkinnedMesh){
      const si=geometry.getAttribute('skinIndex'),sw=geometry.getAttribute('skinWeight');
      if(!si||!sw)throw new Error('Skin weights are missing.');
      const skin=add('Deformer',object.name||'Skin','Skin',[n('Version',[I(101)]),n('Link_DeformAcuracy',[50])]);link(skin,geometryId);
      const poseNodes=[n('PoseNode',[],[n('Node',[L(modelId)]),a('Matrix','d',object.bindMatrix.elements)])];
      object.skeleton.bones.forEach((bone,boneIndex)=>{
        const vertexIds=[],weights=[];
        for(let v=0;v<positionAttribute.count;v++)for(let slot=0;slot<si.itemSize;slot++){
          const weight=sw.getComponent(v,slot);
          if(si.getComponent(v,slot)===boneIndex&&weight>0){vertexIds.push(v);weights.push(weight);}
        }
        const bindWorld=object.skeleton.boneInverses[boneIndex].clone().invert();
        const cluster=add('Deformer',bone.name||'Cluster','Cluster',[n('Version',[I(100)]),n('UserData',['','']),a('Indexes','i',vertexIds),a('Weights','d',weights),a('Transform','d',bindWorld.clone().invert().multiply(object.bindMatrix).elements),a('TransformLink','d',bindWorld.elements)]);
        link(cluster,skin);link(models.get(bone),cluster);
        poseNodes.push(n('PoseNode',[],[n('Node',[L(models.get(bone))]),a('Matrix','d',bindWorld.elements)]));
      });
      add('Pose',object.name||'BindPose','BindPose',[n('Type',['BindPose']),n('Version',[I(100)]),n('NbPoseNodes',[I(poseNodes.length)]),...poseNodes]);
    }
  }
  if(!meshCount)throw new Error('FBX export needs at least one mesh.');
  const findTarget=track=>{
    const binding=THREE.PropertyBinding.parseTrackName(track.name);
    for(const root of roots){
      let target=THREE.PropertyBinding.findNode(root,binding.nodeName);
      if(binding.objectName==='bones')target=target?.skeleton?.getBoneByName(binding.objectIndex);
      if(models.has(target))return{target,channel:binding.propertyName};
    }
    return{};
  };
  for(const clip of [...new Set(animations)]){
    const tracks=[];
    for(const track of clip.tracks){
      const{target,channel}=findTarget(track);
      if(target&&['position','quaternion','scale'].includes(channel)&&track.times.length)tracks.push({track,target,channel});
      else warnings.add('Some animation channels could not be exported; position, rotation and scale are supported.');
    }
    if(!tracks.length)continue;
    clipCount++;
    const stack=add('AnimationStack',clip.name||'Take'+clipCount,'',[ps([p('LocalStart','KTime',[L(0)]),p('LocalStop','KTime',[L(ticks(clip.duration))]),p('ReferenceStart','KTime',[L(0)]),p('ReferenceStop','KTime',[L(ticks(clip.duration))])])]);
    const layer=add('AnimationLayer','BaseLayer','',[ps([])]);link(layer,stack);
    for(const{track,target,channel}of tracks){
      const kind=channel==='position'?'T':channel==='scale'?'S':'R';
      const channelName=channel==='position'?'Lcl Translation':channel==='scale'?'Lcl Scaling':'Lcl Rotation';
      const times=channel==='quaternion'?[...new Set([...track.times,...Array.from({length:Math.ceil(clip.duration*30)+1},(_,i)=>Math.min(clip.duration,i/30))])].sort((a,b)=>a-b):Array.from(track.times);
      const values=[[],[],[]],interpolant=track.createInterpolant();
      for(const time of times){
        const sample=interpolant.evaluate(time);
        const value=channel==='quaternion'?new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(sample),'ZYX').toArray().slice(0,3).map(THREE.MathUtils.radToDeg):Array.from(sample);
        value.forEach((v,axis)=>{if(channel==='quaternion'&&values[axis].length)v+=360*Math.round((values[axis].at(-1)-v)/360);values[axis].push(v);});
      }
      const curveNode=add('AnimationCurveNode',kind,'',[ps(['X','Y','Z'].map((axis,i)=>p('d|'+axis,'Number',[values[i][0]],'A')))]);link(curveNode,layer);link(curveNode,models.get(target),channelName);
      ['X','Y','Z'].forEach((axis,i)=>{
        const curve=add('AnimationCurve',kind+axis,'',[n('Default',[values[i][0]]),n('KeyVer',[I(4008)]),a('KeyTime','l',times.map(ticks)),a('KeyValueFloat','f',values[i]),a('KeyAttrFlags','i',[track.getInterpolation()===THREE.InterpolateDiscrete?2:4]),a('KeyAttrDataFloat','f',[0,0,0,0]),a('KeyAttrRefCount','i',[times.length])]);
        link(curve,curveNode,'d|'+axis);
      });
    }
  }
  const counts=new Map();objects.forEach(entry=>counts.set(entry.name,(counts.get(entry.name)||0)+1));
  const now=new Date(),dateParts=[now.getFullYear(),now.getMonth()+1,now.getDate(),now.getHours(),now.getMinutes(),now.getSeconds(),now.getMilliseconds()];
  const document=[
    n('FBXHeaderExtension',[],[n('FBXHeaderVersion',[I(1003)]),n('FBXVersion',[I(7400)]),n('EncryptionType',[I(0)]),n('CreationTimeStamp',[],[n('Version',[I(1000)]),...['Year','Month','Day','Hour','Minute','Second','Millisecond'].map((part,i)=>n(part,[I(dateParts[i])]))]),n('Creator',['BoltWorks 3D AI Studio'])]),
    n('GlobalSettings',[],[n('Version',[I(1000)]),ps([p('UpAxis','int',[I(1)]),p('UpAxisSign','int',[I(1)]),p('FrontAxis','int',[I(2)]),p('FrontAxisSign','int',[I(1)]),p('CoordAxis','int',[I(0)]),p('CoordAxisSign','int',[I(1)]),p('UnitScaleFactor','double',[100]),p('OriginalUnitScaleFactor','double',[100]),p('TimeMode','enum',[I(6)])])]),
    n('Documents',[],[n('Count',[I(1)]),n('Document',[L(1),'Scene','Scene'],[ps([]),n('RootNode',[L(0)])])]),n('References'),
    n('Definitions',[],[n('Version',[I(100)]),n('Count',[I(objects.length)]),...Array.from(counts,([kind,count])=>n('ObjectType',[kind],[n('Count',[I(count)])]))]),
    n('Objects',[],objects),n('Connections',[],links),n('Takes',[],[n('Current',[''])])
  ];
  return{buffer:encodeDocument(document),warnings:[...warnings],meshCount,clipCount};
}
