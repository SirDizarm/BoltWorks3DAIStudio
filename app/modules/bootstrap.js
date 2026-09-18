import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { createMeshFactory } from "./meshes/factory.js";

import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { exportBinaryFbx } from "./exporters/fbx.js";

import { createUsdPackage, loadUsdFiles } from "./exporters/usd.js";
import * as usdZip from "three/addons/libs/fflate.module.js";
