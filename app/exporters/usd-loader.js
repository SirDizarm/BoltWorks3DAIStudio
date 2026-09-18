// Adapted from Three.js r165 USDZLoader (MIT); see three-LICENSE.txt.
import {
	BufferAttribute,
	BufferGeometry,
	ClampToEdgeWrapping,
	FileLoader,
	Group,
	NoColorSpace,
	Loader,
	Mesh,
	MeshPhysicalMaterial,
	MirroredRepeatWrapping,
	RepeatWrapping,
	SRGBColorSpace,
	TextureLoader,
	Object3D,
	Vector2
} from 'three';

import * as fflate from 'three/addons/libs/fflate.module.js';

class USDAParser {

	parse( text ) {

		const data = {};

		const lines = text.split( '\n' );

		let string = null;
		let target = data;

		const stack = [ data ];

		// debugger;

		for ( const line of lines ) {

			// console.log( line );

			if ( line.includes( '=' ) ) {

				const assignment = line.split( '=' );

				const lhs = assignment[ 0 ].trim();
				const rhs = assignment[ 1 ].trim();

				if ( rhs.endsWith( '{' ) ) {

					const group = {};
					stack.push( group );

					target[ lhs ] = group;
					target = group;

				} else {

					target[ lhs ] = rhs;

				}

			} else if ( line.endsWith( '{' ) ) {

				const group = target[ string ] || {};
				stack.push( group );

				target[ string ] = group;
				target = group;

			} else if ( line.endsWith( '}' ) ) {

				stack.pop();

				if ( stack.length === 0 ) continue;

				target = stack[ stack.length - 1 ];

			} else if ( line.endsWith( '(' ) ) {

				const meta = {};
				stack.push( meta );

				string = line.split( '(' )[ 0 ].trim() || string;

				target[ string ] = meta;
				target = meta;

			} else if ( line.endsWith( ')' ) ) {

				stack.pop();

				target = stack[ stack.length - 1 ];

			} else {

				string = line.trim();

			}

		}

		return data;

	}

}

class USDZLoader extends Loader {

	constructor( manager ) {

		super( manager );

	}

	load( url, onLoad, onProgress, onError ) {

		const scope = this;

		const loader = new FileLoader( scope.manager );
		loader.setPath( scope.path );
		loader.setResponseType( 'arraybuffer' );
		loader.setRequestHeader( scope.requestHeader );
		loader.setWithCredentials( scope.withCredentials );
		loader.load( url, function ( text ) {

			try {

				onLoad( scope.parse( text ) );

			} catch ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );

			}

		}, onProgress, onError );

	}

	parse( buffer ) {

		const parser = new USDAParser();
        const manager = this.manager;
        const objectUrls = this.objectUrls = [];

		function parseAssets( zip ) {

			const data = {};
			const loader = new FileLoader();
			loader.setResponseType( 'arraybuffer' );

			for ( const filename in zip ) {

				if ( /\.(png|jpe?g|webp|bmp|gif)$/i.test(filename) ) {

					const extension=filename.split('.').pop().toLowerCase();
                    const blob = new Blob([zip[filename]],{type:'image/'+({jpg:'jpeg'}[extension]||extension)});
					data[ filename ] = URL.createObjectURL( blob );
                    objectUrls.push(data[filename]);

				}

				if ( filename.endsWith( 'usd' ) || filename.endsWith( 'usda' ) ) {

					if ( isCrateFile( zip[ filename ] ) ) {

						console.warn( 'THREE.USDZLoader: Crate files (.usdc or binary .usd) are not supported.' );
						continue;

					}

					const text = fflate.strFromU8( zip[ filename ] );
					data[ filename ] = parser.parse( text );

				}

			}

			return data;

		}

		function isCrateFile( buffer ) {

			// Check if this a crate file. First 7 bytes of a crate file are "PXR-USDC".
			const fileHeader = buffer.slice( 0, 7 );
			const crateHeader = new Uint8Array( [ 0x50, 0x58, 0x52, 0x2D, 0x55, 0x53, 0x44, 0x43 ] );

			// If this is not a crate file, we assume it is a plain USDA file.
			return fileHeader.every( ( value, index ) => value === crateHeader[ index ] );

		}

		function findUSD( zip ) {

			if ( zip.length < 1 ) return undefined;

			const firstFileName = Object.keys( zip )[ 0 ];
			let isCrate = false;

			// As per the USD specification, the first entry in the zip archive is used as the main file ("UsdStage").
			// ASCII files can end in either .usda or .usd.
			// See https://openusd.org/release/spec_usdz.html#layout
			if ( firstFileName.endsWith( 'usda' ) ) return zip[ firstFileName ];

			if ( firstFileName.endsWith( 'usdc' ) ) {

				isCrate = true;

			} else if ( firstFileName.endsWith( 'usd' ) ) {

				// If this is not a crate file, we assume it is a plain USDA file.
				if ( ! isCrateFile( zip[ firstFileName ] ) ) {

					return zip[ firstFileName ];

				} else {

					isCrate = true;

				}

			}

			if ( isCrate ) {

				console.warn( 'THREE.USDZLoader: Crate files (.usdc or binary .usd) are not supported.' );

			}

			return undefined;

		}

		const zip = fflate.unzipSync( new Uint8Array( buffer ) );

		// console.log( zip );

		const assets = parseAssets( zip );

		// console.log( assets )

		const file = findUSD( zip );

		if ( file === undefined ) {

			console.warn( 'THREE.USDZLoader: No usda file found.' );

			return new Group();

		}


		// Parse file

		const text = fflate.strFromU8( file );
		const root = parser.parse( text );

		// Build scene

		function findMeshGeometry( data ) {

			if ( ! data ) return undefined;

			if ( 'prepend references' in data ) {

				const reference = data[ 'prepend references' ];
				const parts = reference.split( '@' );
				const path = parts[ 1 ].replace( /^.\//, '' );
				const id = parts[ 2 ].replace( /^<\//, '' ).replace( />$/, '' );

				return findGeometry( assets[ path ], id );

			}

			return data.__bwsDirectMesh ? findGeometry(data) : undefined;

		}

		function findGeometry( data, id ) {

			if ( ! data ) return undefined;

			if ( id !== undefined ) {

				const def = `def Mesh "${id}"`;

				if ( def in data ) {

					return data[ def ];

				}

			}

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( 'def Mesh' ) ) {

					// Move points to Mesh

					if ( 'point3f[] points' in data ) {

						object[ 'point3f[] points' ] = data[ 'point3f[] points' ];

					}

					// Move st to Mesh

					if ( 'texCoord2f[] primvars:st' in data ) {

						object[ 'texCoord2f[] primvars:st' ] = data[ 'texCoord2f[] primvars:st' ];

					}

					// Move st indices to Mesh

					if ( 'int[] primvars:st:indices' in data ) {

						object[ 'int[] primvars:st:indices' ] = data[ 'int[] primvars:st:indices' ];

					}

					return object;

				}


				if ( typeof object === 'object' ) {

					const geometry = findGeometry( object );

					if ( geometry ) return geometry;

				}

			}

		}

		function buildGeometry( data ) {

			if ( ! data ) return undefined;

			let geometry = new BufferGeometry();

			if ( 'int[] faceVertexIndices' in data ) {

				const indices = JSON.parse( data[ 'int[] faceVertexIndices' ] );
				geometry.setIndex( indices );

			}

			if ( 'point3f[] points' in data ) {

				const positions = JSON.parse( data[ 'point3f[] points' ].replace( /[()]*/g, '' ) );
				const attribute = new BufferAttribute( new Float32Array( positions ), 3 );
				geometry.setAttribute( 'position', attribute );

			}

			if ( 'normal3f[] normals' in data ) {

				const normals = JSON.parse( data[ 'normal3f[] normals' ].replace( /[()]*/g, '' ) );
				const attribute = new BufferAttribute( new Float32Array( normals ), 3 );
				geometry.setAttribute( 'normal', attribute );

			} else {

				geometry.computeVertexNormals();

			}

			if ( 'float2[] primvars:st' in data ) {

				data[ 'texCoord2f[] primvars:st' ] = data[ 'float2[] primvars:st' ];

			}

			if ( 'texCoord2f[] primvars:st' in data ) {

				const uvs = JSON.parse( data[ 'texCoord2f[] primvars:st' ].replace( /[()]*/g, '' ) );
				const attribute = new BufferAttribute( new Float32Array( uvs ), 2 );

				if ( 'int[] primvars:st:indices' in data ) {

					geometry = geometry.toNonIndexed();

					const indices = JSON.parse( data[ 'int[] primvars:st:indices' ] );
					geometry.setAttribute( 'uv', toFlatBufferAttribute( attribute, indices ) );

				} else {

					geometry.setAttribute( 'uv', attribute );

				}

			}

			return geometry;

		}

		function toFlatBufferAttribute( attribute, indices ) {

			const array = attribute.array;
			const itemSize = attribute.itemSize;

			const array2 = new array.constructor( indices.length * itemSize );

			let index = 0, index2 = 0;

			for ( let i = 0, l = indices.length; i < l; i ++ ) {

				index = indices[ i ] * itemSize;

				for ( let j = 0; j < itemSize; j ++ ) {

					array2[ index2 ++ ] = array[ index ++ ];

				}

			}

			return new BufferAttribute( array2, itemSize );

		}

		function findMeshMaterial( data ) {

			if ( ! data ) return undefined;

			if ( 'rel material:binding' in data ) {

				const reference = data[ 'rel material:binding' ];
				const id = reference.replace( /^<\//, '' ).replace( />$/, '' );
				const parts = id.split( '/' );

				return findMaterial( root, ` "${ parts[ 1 ] }"` );

			}

			return findMaterial( data );

		}

		function findMaterial( data, id = '' ) {

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( 'def Material' + id ) ) {

					return object;

				}

				if ( typeof object === 'object' ) {

					const material = findMaterial( object, id );

					if ( material ) return material;

				}

			}

		}

		function setTextureParams( map, data_value ) {

			// rotation, scale and translation

			if ( data_value[ 'float inputs:rotation' ] ) {

				map.rotation = parseFloat(data_value['float inputs:rotation']) * Math.PI / 180;

			}

			if ( data_value[ 'float2 inputs:scale' ] ) {

				map.repeat = new Vector2().fromArray( JSON.parse( '[' + data_value[ 'float2 inputs:scale' ].replace( /[()]*/g, '' ) + ']' ) );

			}

			if ( data_value[ 'float2 inputs:translation' ] ) {

				map.offset = new Vector2().fromArray( JSON.parse( '[' + data_value[ 'float2 inputs:translation' ].replace( /[()]*/g, '' ) + ']' ) );

			}

		}

		function buildMaterial( data ) {

			const material = new MeshPhysicalMaterial();

			if ( data !== undefined ) {

				if ( 'def Shader "PreviewSurface"' in data ) {

					const surface = data[ 'def Shader "PreviewSurface"' ];
                    if(surface['float inputs:opacity'])material.opacity=parseFloat(surface['float inputs:opacity']);
                    if(surface['float inputs:opacityThreshold'])material.alphaTest=parseFloat(surface['float inputs:opacityThreshold']);
                    if(surface['float inputs:opacity.connect']){
                      const connection=surface['float inputs:opacity.connect'];
                      const sampler=findTexture(root,/(\w+).output/.exec(connection)[1]);
                      if(connection.split('.outputs:')[0] !== surface['color3f inputs:diffuseColor.connect']?.split('.outputs:')[0]) {
                        material.alphaMap=buildTexture(sampler,'scalar',/\.outputs:([rgba])/.exec(connection)?.[1]||'a');
                        material.alphaMap.colorSpace=NoColorSpace;
                      }
                      material.opacity=1;
                    }
                    material.transparent=!!surface['float inputs:opacity.connect']||material.opacity<1;

					if ( 'color3f inputs:diffuseColor.connect' in surface ) {

						const path = surface[ 'color3f inputs:diffuseColor.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.map = buildTexture( sampler );
						material.map.colorSpace = SRGBColorSpace;

						if ( 'def Shader "Transform2d_diffuse"' in data ) {

							setTextureParams( material.map, data[ 'def Shader "Transform2d_diffuse"' ] );

						}

					} else if ( 'color3f inputs:diffuseColor' in surface ) {

						const color = surface[ 'color3f inputs:diffuseColor' ].replace( /[()]*/g, '' );
						material.color.fromArray( JSON.parse( '[' + color + ']' ) );

					}

					if ( 'color3f inputs:emissiveColor.connect' in surface ) {

						const path = surface[ 'color3f inputs:emissiveColor.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.emissiveMap = buildTexture( sampler );
						material.emissiveMap.colorSpace = SRGBColorSpace;
						material.emissive.set( 0xffffff );

						if ( 'def Shader "Transform2d_emissive"' in data ) {

							setTextureParams( material.emissiveMap, data[ 'def Shader "Transform2d_emissive"' ] );

						}

					} else if ( 'color3f inputs:emissiveColor' in surface ) {

						const color = surface[ 'color3f inputs:emissiveColor' ].replace( /[()]*/g, '' );
						material.emissive.fromArray( JSON.parse( '[' + color + ']' ) );

					}

					if ( 'normal3f inputs:normal.connect' in surface ) {

						const path = surface[ 'normal3f inputs:normal.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.normalMap = buildTexture(sampler, 'normal', 'r');
						material.normalMap.colorSpace = NoColorSpace;
                        if(sampler['float4 inputs:scale']){const factor=JSON.parse('['+sampler['float4 inputs:scale'].replace(/[()]/g,'')+']');material.normalScale.set(factor[0]/2,factor[1]/2);}

						if ( 'def Shader "Transform2d_normal"' in data ) {

							setTextureParams( material.normalMap, data[ 'def Shader "Transform2d_normal"' ] );

						}

					}

					if ( 'float inputs:roughness.connect' in surface ) {

						const path = surface[ 'float inputs:roughness.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.roughness = 1.0;
						material.roughnessMap = buildTexture(sampler, 'scalar', 'g');
						material.roughnessMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_roughness"' in data ) {

							setTextureParams( material.roughnessMap, data[ 'def Shader "Transform2d_roughness"' ] );

						}

					} else if ( 'float inputs:roughness' in surface ) {

						material.roughness = parseFloat( surface[ 'float inputs:roughness' ] );

					}

					if ( 'float inputs:metallic.connect' in surface ) {

						const path = surface[ 'float inputs:metallic.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.metalness = 1.0;
						material.metalnessMap = buildTexture(sampler, 'scalar', 'b');
						material.metalnessMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_metallic"' in data ) {

							setTextureParams( material.metalnessMap, data[ 'def Shader "Transform2d_metallic"' ] );

						}

					} else if ( 'float inputs:metallic' in surface ) {

						material.metalness = parseFloat( surface[ 'float inputs:metallic' ] );

					}

					if ( 'float inputs:clearcoat.connect' in surface ) {

						const path = surface[ 'float inputs:clearcoat.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.clearcoat = 1.0;
						material.clearcoatMap = buildTexture(sampler, 'scalar', 'r');
						material.clearcoatMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_clearcoat"' in data ) {

							setTextureParams( material.clearcoatMap, data[ 'def Shader "Transform2d_clearcoat"' ] );

						}

					} else if ( 'float inputs:clearcoat' in surface ) {

						material.clearcoat = parseFloat( surface[ 'float inputs:clearcoat' ] );

					}

					if ( 'float inputs:clearcoatRoughness.connect' in surface ) {

						const path = surface[ 'float inputs:clearcoatRoughness.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.clearcoatRoughness = 1.0;
						material.clearcoatRoughnessMap = buildTexture(sampler, 'scalar', 'g');
						material.clearcoatRoughnessMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_clearcoatRoughness"' in data ) {

							setTextureParams( material.clearcoatRoughnessMap, data[ 'def Shader "Transform2d_clearcoatRoughness"' ] );

						}

					} else if ( 'float inputs:clearcoatRoughness' in surface ) {

						material.clearcoatRoughness = parseFloat( surface[ 'float inputs:clearcoatRoughness' ] );

					}

					if ( 'float inputs:ior' in surface ) {

						material.ior = parseFloat( surface[ 'float inputs:ior' ] );

					}

					if ( 'float inputs:occlusion.connect' in surface ) {

						const path = surface[ 'float inputs:occlusion.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.aoMap = buildTexture(sampler, 'scalar', 'r');
						material.aoMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_occlusion"' in data ) {

							setTextureParams( material.aoMap, data[ 'def Shader "Transform2d_occlusion"' ] );

						}

					}

				}

				if ( 'def Shader "diffuseColor_texture"' in data ) {

					const sampler = data[ 'def Shader "diffuseColor_texture"' ];

					material.map = buildTexture( sampler );
					material.map.colorSpace = SRGBColorSpace;

				}

				if ( 'def Shader "normal_texture"' in data ) {

					const sampler = data[ 'def Shader "normal_texture"' ];

					material.normalMap = buildTexture(sampler, 'normal', 'r');
					material.normalMap.colorSpace = NoColorSpace;

				}

			}

			return material;

		}

		function findTexture( data, id ) {

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( `def Shader "${ id }"` ) ) {

					return object;

				}

				if ( typeof object === 'object' ) {

					const texture = findTexture( object, id );

					if ( texture ) return texture;

				}

			}

		}

		function buildTexture(data, role = 'color', channel = 'r') {
      if(!data || !data['asset inputs:file'])throw new Error('USD material has an unresolved texture.');
      const path=data['asset inputs:file'].replace(/@/g,'').replace(/^\.\//,'');
      if(!assets[path])throw new Error('Missing USD texture: '+path);
      const tuple=(key,fallback)=>data[key]?JSON.parse('['+data[key].replace(/[()]/g,'')+']'):fallback;
      const scale=tuple('float4 inputs:scale',[1,1,1,1]),bias=tuple('float4 inputs:bias',[0,0,0,0]);
      const texture=new TextureLoader(manager).load(assets[path],loaded=>{
        try{
          if(role==='normal')return;
          const canvas=document.createElement('canvas'),image=loaded.image;
          canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
          const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),bytes=pixels.data;
          const selected={r:0,g:1,b:2,a:3}[channel]??0;
          const srgb=role==='color'&&data['token inputs:sourceColorSpace']!=='"raw"';
          const linear=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
          const gamma=v=>v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055;
          for(let i=0;i<bytes.length;i+=4){
            if(role==='scalar'){
              const value=Math.max(0,Math.min(1,bytes[i+selected]/255*scale[selected]+bias[selected]))*255;
              bytes[i]=bytes[i+1]=bytes[i+2]=value;bytes[i+3]=255;
            }else for(let k=0;k<4;k++){
              let v=bytes[i+k]/255;if(srgb&&k<3)v=linear(v);
              v=v*scale[k]+bias[k];if(srgb&&k<3)v=gamma(Math.max(0,v));
              bytes[i+k]=Math.max(0,Math.min(1,v))*255;
            }
          }
          ctx.putImageData(pixels,0,0);loaded.image=canvas;loaded.needsUpdate=true;
        }catch(error){manager.itemError(path);}
      });
      const wrapping={'"clamp"':ClampToEdgeWrapping,'"mirror"':MirroredRepeatWrapping,'"repeat"':RepeatWrapping};
      texture.wrapS=wrapping[data['token inputs:wrapS']]??RepeatWrapping;
      texture.wrapT=wrapping[data['token inputs:wrapT']]??RepeatWrapping;
      return texture;
    }

    function buildObject( data ) {

			const geometry = buildGeometry( findMeshGeometry( data ) );
			const material = buildMaterial( findMeshMaterial( data ) );

			const mesh = geometry ? new Mesh( geometry, material ) : new Object3D();
            const geometryData=findMeshGeometry(data);
            if(geometryData?.['uniform bool doubleSided']==='true')material.side=2;

			if ( 'matrix4d xformOp:transform' in data ) {

				const array = JSON.parse( '[' + data[ 'matrix4d xformOp:transform' ].replace( /[()]*/g, '' ) + ']' );

				mesh.matrix.fromArray( array );
				mesh.matrix.decompose( mesh.position, mesh.quaternion, mesh.scale );

			}

			return mesh;

		}

		function buildHierarchy( data, group ) {

			for ( const name in data ) {

				if ( name.startsWith( 'def Scope' ) ) {

					buildHierarchy( data[ name ], group );

				} else if ( name.startsWith( 'def Xform' ) || name.startsWith('def Mesh') ) {

					const mesh = buildObject(name.startsWith('def Mesh') ? {...data[name], __bwsDirectMesh:true, 'rel material:binding':data[name]['rel material:binding'] || data['rel material:binding'], [name]:data[name]} : data[name]);

					if ( /def Xform "(\w+)"/.test( name ) ) {

						mesh.name = /def Xform "(\w+)"/.exec( name )[ 1 ];

					}

					group.add( mesh );

					buildHierarchy( data[ name ], mesh );

				}

			}

		}

		const group = new Group();

		buildHierarchy( root, group );

		return group;

	}

}

export { USDZLoader };
