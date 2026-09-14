// Shaders ported from mont-fort.com (Sixty studio pipeline), reduced to the
// homepage hero state: uPage = 0, uTransition = 0, uChapter = 0, no mouse field.

const CUBE_UV = /* glsl */ `
vec3 inverseTransformDirection(vec3 dir, mat4 matrix) {
	return normalize((vec4(dir, 0.0) * matrix).xyz);
}

#define cubeUV_minMipLevel 4.0
#define cubeUV_minTileSize 16.0
float getFace(vec3 direction) {
	vec3 absDirection = abs(direction);
	float face = - 1.0;
	if (absDirection.x > absDirection.z) {
		if (absDirection.x > absDirection.y)
			face = direction.x > 0.0 ? 0.0 : 3.0;
		else
			face = direction.y > 0.0 ? 1.0 : 4.0;
	} else {
		if (absDirection.z > absDirection.y)
			face = direction.z > 0.0 ? 2.0 : 5.0;
		else
			face = direction.y > 0.0 ? 1.0 : 4.0;
	}
	return face;
}

vec2 getUV(vec3 direction, float face) {
	vec2 uv;
	if (face == 0.0) {
		uv = vec2(direction.z, direction.y) / abs(direction.x);
	} else if (face == 1.0) {
		uv = vec2(- direction.x, - direction.z) / abs(direction.y);
	} else if (face == 2.0) {
		uv = vec2(- direction.x, direction.y) / abs(direction.z);
	} else if (face == 3.0) {
		uv = vec2(- direction.z, direction.y) / abs(direction.x);
	} else if (face == 4.0) {
		uv = vec2(- direction.x, direction.z) / abs(direction.y);
	} else {
		uv = vec2(direction.x, direction.y) / abs(direction.z);
	}
	return 0.5 * (uv + 1.0);
}

vec3 bilinearCubeUV(sampler2D envMap, vec3 direction, float mipInt) {
	float face = getFace(direction);
	float filterInt = max(cubeUV_minMipLevel - mipInt, 0.0);
	mipInt = max(mipInt, cubeUV_minMipLevel);
	float faceSize = exp2(mipInt);
	highp vec2 uv = getUV(direction, face) * (faceSize - 2.0) + 1.0;
	if (face > 2.0) {
		uv.y += faceSize;
		face -= 3.0;
	}
	uv.x += face * faceSize;
	uv.x += filterInt * 3.0 * cubeUV_minTileSize;
	uv.y += 4.0 * (exp2(CUBEUV_MAX_MIP) - faceSize);
	uv.x *= CUBEUV_TEXEL_WIDTH;
	uv.y *= CUBEUV_TEXEL_HEIGHT;
	return texture2D(envMap, uv).rgb;
}

#define cubeUV_r0 1.0
#define cubeUV_m0 -2.0
#define cubeUV_r1 0.8
#define cubeUV_m1 -1.0
#define cubeUV_r4 0.4
#define cubeUV_m4 2.0
#define cubeUV_r5 0.305
#define cubeUV_m5 3.0
#define cubeUV_r6 0.21
#define cubeUV_m6 4.0

float roughnessToMip(float roughness) {
	float mip = 0.0;
	if (roughness >= cubeUV_r1) {
		mip = (cubeUV_r0 - roughness) * (cubeUV_m1 - cubeUV_m0) / (cubeUV_r0 - cubeUV_r1) + cubeUV_m0;
	} else if (roughness >= cubeUV_r4) {
		mip = (cubeUV_r1 - roughness) * (cubeUV_m4 - cubeUV_m1) / (cubeUV_r1 - cubeUV_r4) + cubeUV_m1;
	} else if (roughness >= cubeUV_r5) {
		mip = (cubeUV_r4 - roughness) * (cubeUV_m5 - cubeUV_m4) / (cubeUV_r4 - cubeUV_r5) + cubeUV_m4;
	} else if (roughness >= cubeUV_r6) {
		mip = (cubeUV_r5 - roughness) * (cubeUV_m6 - cubeUV_m5) / (cubeUV_r5 - cubeUV_r6) + cubeUV_m5;
	} else {
		mip = - 2.0 * log2(1.16 * roughness);
	}
	return mip;
}

vec4 textureCubeUV(sampler2D envMap, vec3 sampleDir, float roughness) {
	float mip = clamp(roughnessToMip(roughness), cubeUV_m0, CUBEUV_MAX_MIP);
	float mipF = fract(mip);
	float mipInt = floor(mip);
	vec3 color0 = bilinearCubeUV(envMap, sampleDir, mipInt);
	if((mipF == 0.0)) {
		return vec4(color0, 1.0);
	} else {
		vec3 color1 = bilinearCubeUV(envMap, sampleDir, (mipInt + 1.0));
		return vec4(mix(color0, color1, mipF), 1.0);
	}
}

vec3 getIBLIrradiance(const in vec3 normal, const in sampler2D envMap, const in float envMapIntensity, const in mat3 envMapRotation) {
	vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
	vec4 envMapColor = textureCubeUV(envMap, envMapRotation * worldNormal, 1.0);
	return PI * envMapColor.rgb * envMapIntensity;
}

vec3 getIBLRadiance(const in vec3 viewDir, const in vec3 normal, const in float roughness, const in sampler2D envMap, const in float envMapIntensity, const in mat3 envMapRotation) {
	vec3 reflectVec = reflect(- viewDir, normal);
	reflectVec = normalize(mix(reflectVec, normal, roughness * roughness));
	reflectVec = inverseTransformDirection(reflectVec, viewMatrix);
	vec4 envMapColor = textureCubeUV(envMap, envMapRotation * reflectVec, roughness);
	return envMapColor.rgb * envMapIntensity;
}
`;

const PBR_COMMON = /* glsl */ `
#define PI 3.141592653589793
#define RECIPROCAL_PI 0.3183098861837907
#ifndef saturate
	#define saturate(a) clamp(a, 0.0, 1.0)
#endif

struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};

struct PBRMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
};

${CUBE_UV}

vec3 BRDF_Lambert(const in vec3 diffuseColor) {
	return RECIPROCAL_PI * diffuseColor;
}

void RE_IndirectDiffuse(const in vec3 irradiance, const in PBRMaterial pbrMaterial, inout ReflectedLight reflectedLight) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(pbrMaterial.diffuseColor);
}

vec2 DFGApprox(const in vec3 normal, const in vec3 viewDir, const in float roughness) {
	float dotNV = saturate(dot(normal, viewDir));
	const vec4 c0 = vec4(- 1, - 0.0275, - 0.572, 0.022);
	const vec4 c1 = vec4(1, 0.0425, 1.04, - 0.04);
	vec4 r = roughness * c0 + c1;
	float a004 = min(r.x * r.x, exp2(- 9.28 * dotNV)) * r.x + r.y;
	vec2 fab = vec2(- 1.04, 1.04) * a004 + r.zw;
	return fab;
}

void computeMultiscattering(const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter) {
	vec2 fab = DFGApprox(normal, viewDir, roughness);
	vec3 Fr = specularColor;
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + (1.0 - Fr) * 0.047619;
	vec3 Fms = FssEss * Favg / (1.0 - Ems * Favg);
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}

void RE_IndirectSpecular(const in vec3 radiance, const in vec3 irradiance, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in PBRMaterial pbrMaterial, inout ReflectedLight reflectedLight) {
	vec3 singleScattering = vec3(0.);
	vec3 multiScattering = vec3(0.);
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	computeMultiscattering(geometryNormal, geometryViewDir, pbrMaterial.specularColor, pbrMaterial.specularF90, pbrMaterial.roughness, singleScattering, multiScattering);
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = pbrMaterial.diffuseColor * (1. - max(max(totalScattering.r, totalScattering.g), totalScattering.b));
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}

float computeSpecularOcclusion(const in float dotNV, const in float ambientOcclusion, const in float roughness) {
	return saturate(pow(dotNV + ambientOcclusion, exp2(- 16.0 * roughness - 1.0)) - 1.0 + ambientOcclusion);
}

mat3 getTangentFrame(const in vec3 eyePos, const in vec3 surfaceNormal, const in vec2 uv) {
	vec3 posDx = dFdx(eyePos);
	vec3 posDy = dFdy(eyePos);
	vec2 uvDx = dFdx(uv);
	vec2 uvDy = dFdy(uv);
	uvDx = max(uvDx, vec2(1e-2));
	uvDy = max(uvDy, vec2(1e-2));
	uvDx = min(uvDx, vec2(1.));
	uvDy = min(uvDy, vec2(1.));
	vec3 N = surfaceNormal;
	vec3 q1perp = cross(posDy, N);
	vec3 q0perp = cross(N, posDx);
	vec3 T = q1perp * uvDx.x + q0perp * uvDy.x;
	vec3 B = q1perp * uvDx.y + q0perp * uvDy.y;
	float det = max(dot(T, T), dot(B, B));
	float scale = (det == 0.0) ? 0.0 : inversesqrt(det);
	return mat3(T * scale, B * scale, N);
}

float viewZToOrthographicDepth(const in float viewZ, const in float near, const in float far) {
	return (viewZ + near) / (near - far);
}
float perspectiveDepthToViewZ(const in float invClipZ, const in float near, const in float far) {
	return (near * far) / ((far - near) * invClipZ - far);
}
float computeDepth(float fragCoordZ, float near, float far) {
	float viewZ = perspectiveDepthToViewZ(fragCoordZ, near, far);
	return viewZToOrthographicDepth(viewZ, near, far);
}

vec2 dHdxy_fwd(sampler2D textureSampler, vec2 uv, float strength) {
	vec2 dSTdx = dFdx(vUv);
	vec2 dSTdy = dFdy(vUv);
	float Hll = strength * texture2D(textureSampler, uv).r;
	float dBx = strength * texture2D(textureSampler, uv + dSTdx).r - Hll;
	float dBy = strength * texture2D(textureSampler, uv + dSTdy).r - Hll;
	return vec2(dBx, dBy);
}

vec3 perturbNormalArb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy) {
	vec3 vSigmaX = dFdx(surf_pos.xyz);
	vec3 vSigmaY = dFdy(surf_pos.xyz);
	vec3 vN = surf_norm;
	vec3 R1 = cross(vSigmaY, vN);
	vec3 R2 = cross(vN, vSigmaX);
	float fDet = dot(vSigmaX, R1);
	vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
	return normalize(abs(fDet) * surf_norm - vGrad);
}

vec2 rotateUV(vec2 uv, vec2 mid, float rotation) {
	return vec2(cos(rotation) * (uv.x - mid.x) + sin(rotation) * (uv.y - mid.y) + mid.x, cos(rotation) * (uv.y - mid.y) - sin(rotation) * (uv.x - mid.x) + mid.y);
}
`;

/* ------------------------------------------------------------------ */
/* Mouse trail (ping-pong render target)                               */
/* ------------------------------------------------------------------ */

export const mouseVertex = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position, 1.0);
}
`;

export const mouseFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uMouse, uMouseVelocity;
uniform sampler2D tNoise, tLast;

varying vec2 vUv;

const float propagationFactor = .15;
const float remananceFactor = 0.99;
const float velocityFactor = .005;

void main() {
	vec2 uv = vUv;
	vec2 mouseUv = (uMouse * .5) + .5;
	vec2 velocityOffset = uMouseVelocity * velocityFactor;

	float distFromMouse = length(uv - mouseUv);

	float circle = smoothstep(.05, 0., distFromMouse);
	float smoothcircle = smoothstep(.1, 0., distFromMouse);
	float smoothercircle = smoothstep(.15, 0., distFromMouse);

	float noise = texture2D(tNoise, uv * .5 + uTime * .01).r * 2. - 1.;

	vec4 remanance = vec4(0.);
	remanance += texture2D(tLast, vUv + vec2(noise * propagationFactor, 0.) - velocityOffset) * .25;
	remanance += texture2D(tLast, vUv + vec2(-noise * propagationFactor, 0.) - velocityOffset) * .25;
	remanance += texture2D(tLast, vUv + vec2(0., noise * propagationFactor) - velocityOffset) * .25;
	remanance += texture2D(tLast, vUv + vec2(0., -noise * propagationFactor) - velocityOffset) * .25;
	remanance.b *= .99;

	vec4 color = vec4(0.);
	color.r = 1. * circle;
	color.g = .4 * smoothcircle;
	color.b = .07 * smoothercircle;

	color += remanance * remananceFactor;
	color.a = 1.;

	gl_FragColor = color;
}
`;

/* ------------------------------------------------------------------ */
/* Mountain                                                            */
/* ------------------------------------------------------------------ */

export const mountainVertex = /* glsl */ `
precision highp float;

uniform mat3 uMap2Transform;

varying vec2 vUv, vMap2Uv;
varying vec3 vNormal, vWorldNormal, vViewPosition, vWorldPosition, vPosition;

void main() {
	vUv = uv;
	vMap2Uv = (uMap2Transform * vec3(uv, 1.)).xy;
	vNormal = normalize(normalMatrix * normal);
	vWorldNormal = normalize(mat3(modelMatrix) * normal);

	vec3 transformed = position;
	vPosition = transformed;

	vec4 mvPosition = modelMatrix * vec4(transformed, 1.);
	vWorldPosition = mvPosition.xyz;
	mvPosition = viewMatrix * mvPosition;
	vViewPosition = -mvPosition.xyz;

	gl_Position = projectionMatrix * mvPosition;
}
`;

export const mountainFragment = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uMetalness, uRoughness;
uniform vec3 uAmbient;
uniform float uAmbientIntensity;

uniform sampler2D tMap2, tMixMap, tArmMap, tRockNormal, tNoise, tPerlin, tMouse;
uniform sampler2D tEnvMap;
// USE_SOURCE_MAPS: albedo / normal / roughness come from the asset's own PBR
// textures (glTF convention, sampled at vUv). Snow is then a slope + accumulation
// mask layered over the asset's rock instead of a painted mix map.
#ifdef USE_SOURCE_MAPS
uniform sampler2D tSrcDiffuse, tSrcNormal, tSrcMR;
uniform float uSrcNormalScale, uSnowCoverage, uSteepRock;
#endif
uniform mat3 uEnvMapRotation;
uniform float uEnvMapIntensity;

uniform vec2 uResolution;
uniform vec3 uLightColor;
uniform float uFogNear, uFogFar, uFog, uTime;

// Relighting: the lightmap is baked for one view; we subtract its fitted
// directional term and add the same term with a light that turns with the camera.
// With NO_LIGHTMAP the same term (uLightBase + uLightK · N·L) is the whole shading.
uniform vec3 uBakedLightDir, uLightDir;
uniform float uLightK, uLightBase;
// uSideOnly = 1: lightmap / mix map were authored for the hero side only — the
// back gets a slope-based snow mask and planar rock mapping. 0: use authored
// textures all around. With NO_MIXMAP the slope mask is used everywhere.
uniform vec2 uPivot, uFrontDir;
uniform float uSideOnly;

varying vec2 vUv, vMap2Uv;
varying vec3 vNormal, vWorldNormal, vViewPosition, vWorldPosition, vPosition;

${PBR_COMMON}

void main() {
	vec2 sUv = gl_FragCoord.xy / uResolution;
	vec2 smallNoise = texture2D(tNoise, vUv * 45.).rg - .5;
	vec2 bigNoise = texture2D(tNoise, vUv * 5.).rg - .5;
	float mouse = clamp(texture2D(tMouse, sUv + 0.1 * bigNoise).r, 0., 1.);

	vec4 diffuseColor = vec4(uColor, 1.);
	vec3 normal = normalize(vNormal);

	/* Base colour: snow constant, rock texture remapped, blended by mix map */
	vec4 baseColorMapSample = vec4(.98, .98, 1., 1.);
	vec3 wN = normalize(vWorldNormal);
	float frontWeight = mix(1., smoothstep(-0.2, 0.6, dot(normalize(vWorldPosition.xz - uPivot), uFrontDir)), uSideOnly);

	/* Rock: authored UVs on the hero side, planar world mapping on the back (the
	   authored UVs stretch into streaks there) */
	vec2 backRockUv = vec2(vWorldPosition.x + vWorldPosition.z, vWorldPosition.y) * 0.12;
	vec4 secondColorMapSample = texture2D(tMap2, mix(backRockUv, vMap2Uv, frontWeight));
	secondColorMapSample.rgb = mix(vec3(0.36, 0.47, 0.52), vec3(1.), secondColorMapSample.r);

	/* Snow / rock mask */
	float slopeSnow = smoothstep(0.5, 0.85, wN.y + 0.25 * (texture2D(tNoise, vUv * 12.).r - .5) + 0.1 * (texture2D(tPerlin, vUv * 3.).r - .5));
	slopeSnow *= mix(1., 0.5, smoothstep(10., 35., vPosition.y));
	#if defined(USE_SOURCE_MAPS)
	/* Source albedo is the rock. Snow: upward-facing surfaces (+ noise), boosted where
	   the source albedo is already bright (accumulation zones), removed on steep faces. */
	vec4 srcDiffuse = texture2D(tSrcDiffuse, vUv);
	float srcLum = dot(srcDiffuse.rgb, vec3(0.2126, 0.7152, 0.0722));
	float steep = smoothstep(0.8, 0.45, wN.y);
	float upward = smoothstep(0.55 - 0.15 * uSnowCoverage, 0.9 - 0.1 * uSnowCoverage, wN.y + 0.2 * (texture2D(tNoise, vUv * 12.).r - .5) + 0.08 * (texture2D(tPerlin, vUv * 3.).r - .5));
	float accumulation = smoothstep(0.3, 0.6, srcLum) * (1. - steep);
	vec4 mixMapSample = vec4(clamp(upward + 0.6 * accumulation * uSnowCoverage, 0., 1.));
	/* Steep walls: pull the source albedo toward exposed rock (tiled GD2 rock detail) */
	float rockDetail = 0.7 + 0.6 * texture2D(tMap2, vUv * 6.).r;
	vec3 rockAlbedo = mix(srcDiffuse.rgb, srcDiffuse.rgb * mix(1., 0.45, steep) * rockDetail, uSteepRock);
	secondColorMapSample = vec4(rockAlbedo, 1.);
	baseColorMapSample = mix(secondColorMapSample, baseColorMapSample, mixMapSample.r);
	#elif defined(NO_MIXMAP)
	vec4 mixMapSample = vec4(slopeSnow);
	baseColorMapSample = mix(1.3 * secondColorMapSample, baseColorMapSample, mixMapSample.r);
	#else
	vec4 mixMapSample = texture2D(tMixMap, vec2(vUv.x, 1. - vUv.y) + 0.002 * smallNoise);
	mixMapSample.r = mix(slopeSnow, mixMapSample.r, frontWeight);
	baseColorMapSample = mix(1.3 * secondColorMapSample, baseColorMapSample, mixMapSample.r);
	#endif
	diffuseColor *= baseColorMapSample;

	/* Baked lightmap (or its analytic stand-in) */
	#ifdef NO_LIGHTMAP
	vec4 armSample = vec4(uLightBase + uLightK * dot(wN, uBakedLightDir));
	#else
	vec4 armSample = texture2D(tArmMap, vec2(vUv.x, 1. - vUv.y) + 0.005 * (texture2D(tNoise, vUv * 80.).rg - .5));
	#endif
	armSample.rgb += uLightK * (dot(wN, uLightDir) - dot(wN, uBakedLightDir));
	armSample.rgb = max(armSample.rgb, 0.);
	armSample *= 3.;
	armSample += smoothstep(0.2, 0.7, armSample) * .3;
	armSample.rgb = mix(vec3(0.36, 0.47, 0.52), vec3(1.), smoothstep(0.2, .9, armSample.r));

	float roughness = clamp(uRoughness, 0.04, 1.0);
	float metallic = clamp(uMetalness, 0.04, 1.0);

	vec3 nonPerturbatedNormal = vNormal;

	/* Rock normal */
	mat3 tbn2 = getTangentFrame(-vViewPosition, normal, vUv);
	#ifdef USE_SOURCE_MAPS
	vec3 nTex2 = texture2D(tSrcNormal, vUv).rgb * 2. - 1.;
	nTex2.xy *= uSrcNormalScale * (1. - 0.6 * mixMapSample.r);
	normal = normalize(tbn2 * nTex2);
	roughness = mix(clamp(texture2D(tSrcMR, vUv).g, 0.04, 1.0), roughness, mixMapSample.r);
	#else
	vec3 nTex2 = texture2D(tRockNormal, vUv * 30.).rgb * 2. - 1.;
	nTex2.xy *= 2. * (1. - mixMapSample.r);
	normal = normalize(tbn2 * nTex2);
	#endif

	/* Windy snow */
	vec2 windUv = rotateUV(vUv, vec2(1., 7.), 2.7);
	windUv *= vec2(1., 7.);
	vec3 windySnow = texture2D(tPerlin, windUv + vec2(0.03 * uTime, 0.)).rgb;
	windySnow = smoothstep(.5, 1., windySnow);
	float snowCloud = texture2D(tNoise, vec2(.8, .3) * windUv + vec2(0.02 * uTime, -0.02 * uTime)).r;
	windySnow *= .2 * mouse + smoothstep(.45, 1., snowCloud);
	#ifdef USE_SOURCE_MAPS
	windySnow *= mixMapSample.r; // drifting snow only over snow, rock stays exposed
	#endif
	diffuseColor.rgb += 1.1 * windySnow;

	normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(tPerlin, vUv * 10., 2. * smoothstep(.7, .4, snowCloud)));

	diffuseColor.rgb *= armSample.rgb;

	/* PBR */
	ReflectedLight reflectedLight = ReflectedLight(vec3(0.), vec3(0.), vec3(0.), vec3(0.));
	PBRMaterial pbrMaterial = PBRMaterial(vec3(0.), 0., vec3(0.), 0.);
	pbrMaterial.diffuseColor = diffuseColor.rgb * (1. - metallic);

	vec3 dxy = max(abs(dFdx(nonPerturbatedNormal)), abs(dFdy(nonPerturbatedNormal)));
	float geometryRoughness = max(max(dxy.x, dxy.y), dxy.z);
	pbrMaterial.roughness = max(roughness, 0.0525);
	pbrMaterial.roughness += geometryRoughness;
	pbrMaterial.roughness = min(pbrMaterial.roughness, 1.0);
	pbrMaterial.specularColor = mix(vec3(0.04), diffuseColor.xyz, metallic);
	pbrMaterial.specularF90 = 1.;

	vec3 geometryNormal = normal;
	vec3 geometryViewDir = normalize(vViewPosition);

	vec3 irradiance = uAmbient * uAmbientIntensity;
	vec3 iblIrradiance = getIBLIrradiance(geometryNormal, tEnvMap, uEnvMapIntensity, uEnvMapRotation);
	vec3 radiance = getIBLRadiance(geometryViewDir, geometryNormal, pbrMaterial.roughness, tEnvMap, uEnvMapIntensity, uEnvMapRotation);

	RE_IndirectDiffuse(irradiance, pbrMaterial, reflectedLight);
	RE_IndirectSpecular(radiance, iblIrradiance, geometryNormal, geometryViewDir, pbrMaterial, reflectedLight);

	float occlusion = armSample.r;
	float dotNV = saturate(dot(geometryNormal, geometryViewDir));
	reflectedLight.indirectSpecular *= computeSpecularOcclusion(dotNV, occlusion, pbrMaterial.roughness);

	vec3 outgoingLight = reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular;

	/* Fog toward the light colour */
	float depth = computeDepth(gl_FragCoord.z, uFogNear, uFogFar);
	depth = smoothstep(0.01, .3, depth) * uFog;
	outgoingLight = mix(outgoingLight, uLightColor, depth);

	gl_FragColor = vec4(outgoingLight, 1.);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
}
`;

/* ------------------------------------------------------------------ */
/* Homepage peaks (small mountains around)                             */
/* ------------------------------------------------------------------ */

export const peaksVertex = /* glsl */ `
precision highp float;

uniform mat3 uNormalMapTransform;

varying vec2 vUv, vNormalMapUv;
varying vec3 vNormal, vViewPosition, vPosition;

void main() {
	vUv = uv;
	vNormalMapUv = (uNormalMapTransform * vec3(uv, 1.)).xy;
	vNormal = normalize(normalMatrix * normal);

	vec3 transformed = position;
	vPosition = transformed;

	vec4 mvPosition = modelMatrix * vec4(transformed, 1.);
	mvPosition = viewMatrix * mvPosition;
	vViewPosition = -mvPosition.xyz;

	gl_Position = projectionMatrix * mvPosition;
}
`;

export const peaksFragment = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uOpacity, uMetalness, uRoughness;
uniform vec3 uAmbient;
uniform float uAmbientIntensity;

uniform sampler2D tMap, tNormalMap, tNoise, tPerlin, tMouse;
uniform vec2 uNormalScale;
uniform sampler2D tEnvMap;
uniform mat3 uEnvMapRotation;
uniform float uEnvMapIntensity;

uniform vec2 uResolution;
uniform vec3 uLightColor;
uniform float uFogNear, uFogFar, uFog, uTime;

varying vec2 vUv, vNormalMapUv;
varying vec3 vNormal, vViewPosition, vPosition;

${PBR_COMMON}

void main() {
	vec4 diffuseColor = vec4(uColor, uOpacity);
	diffuseColor *= texture2D(tMap, vUv);

	/* Windy snow */
	vec2 sUv = gl_FragCoord.xy / uResolution;
	float mouse = clamp(texture2D(tMouse, sUv).r, 0., 1.);
	vec3 windySnow = texture2D(tPerlin, vec2(1., 7.) * vUv + vec2(- .07 * uTime, 0.)).rgb;
	windySnow = smoothstep(.6, .8, windySnow);
	windySnow *= .3 * mouse + smoothstep(.5, 1., texture2D(tNoise, vec2(1., 1.5) * vUv + vec2(-.05 * uTime, 0.)).rgb);
	diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.), windySnow);

	float roughness = clamp(uRoughness, 0.04, 1.0);
	float metallic = clamp(uMetalness, 0.04, 1.0);

	vec3 nonPerturbatedNormal = vNormal;
	float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
	vec3 normal = normalize(vNormal);

	mat3 tbn = getTangentFrame(-vViewPosition, normal, vNormalMapUv);
	vec3 nTex = texture2D(tNormalMap, vNormalMapUv).rgb * 2. - 1.;
	nTex.xy *= uNormalScale;
	normal = normalize(tbn * nTex);

	normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(tPerlin, 6. * vUv, 2.));

	ReflectedLight reflectedLight = ReflectedLight(vec3(0.), vec3(0.), vec3(0.), vec3(0.));
	PBRMaterial pbrMaterial = PBRMaterial(vec3(0.), 0., vec3(0.), 0.);
	pbrMaterial.diffuseColor = diffuseColor.rgb * (1. - metallic);

	vec3 dxy = max(abs(dFdx(nonPerturbatedNormal)), abs(dFdy(nonPerturbatedNormal)));
	float geometryRoughness = max(max(dxy.x, dxy.y), dxy.z);
	pbrMaterial.roughness = max(roughness, 0.0525);
	pbrMaterial.roughness += geometryRoughness;
	pbrMaterial.roughness = min(pbrMaterial.roughness, 1.0);
	pbrMaterial.specularColor = mix(vec3(0.04), diffuseColor.xyz, metallic);
	pbrMaterial.specularF90 = 1.;

	vec3 geometryNormal = normal;
	vec3 geometryViewDir = normalize(vViewPosition);

	vec3 irradiance = uAmbient * uAmbientIntensity;
	vec3 iblIrradiance = getIBLIrradiance(geometryNormal, tEnvMap, uEnvMapIntensity, uEnvMapRotation);
	vec3 radiance = getIBLRadiance(geometryViewDir, geometryNormal, pbrMaterial.roughness, tEnvMap, uEnvMapIntensity, uEnvMapRotation);

	RE_IndirectDiffuse(irradiance, pbrMaterial, reflectedLight);
	RE_IndirectSpecular(radiance, iblIrradiance, geometryNormal, geometryViewDir, pbrMaterial, reflectedLight);

	vec3 outgoingLight = reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular;

	float depth = computeDepth(gl_FragCoord.z, uFogNear, uFogFar);
	depth = smoothstep(0.01, .6, depth) * uFog;
	outgoingLight = mix(outgoingLight, uLightColor, depth);

	diffuseColor.a *= smoothstep(-.8, 1., vPosition.y);

	gl_FragColor = vec4(outgoingLight, diffuseColor.a);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
}
`;

/* ------------------------------------------------------------------ */
/* Clouds (instanced planes)                                           */
/* ------------------------------------------------------------------ */

export const cloudVertex = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying float vSeed, vRatio;
varying vec3 vNormal;

void main() {
	vUv = uv;

	vec4 mvPosition = vec4(position, 1.0);
	vNormal = normalize(normalMatrix * normal);
	mvPosition = instanceMatrix * mvPosition;

	vSeed = (instanceMatrix[3][0] + instanceMatrix[3][1] + instanceMatrix[3][2]);
	vRatio = instanceMatrix[1][1] / instanceMatrix[0][0];
	gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
}
`;

export const cloudFragment = /* glsl */ `
precision highp float;

uniform float uTime, uRatio;
uniform vec2 uSize, uResolution;
uniform sampler2D tPerlin, tNoise, tMouse;
varying float vSeed, vRatio;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
	vec2 ratioedUv = vec2(5., vRatio) * (vUv + vSeed * .1);
	vec2 resizedUv = uSize * ratioedUv;

	vec2 sUv = gl_FragCoord.xy / uResolution;
	float mouse = clamp(texture2D(tMouse, sUv + .1 * (texture2D(tNoise, 0.4 * resizedUv).g - .5)).r, 0., 1.);

	float time = uTime * .5 / uSize.x;
	float strength = 1.;
	vec2 dUv = vUv;
	dUv *= 1. + .03 * mouse;
	dUv += .05 * mouse;
	dUv.y += .3 * strength * (texture2D(tNoise, resizedUv * .2 + vec2(-0.004, -0.02) * time).r - .5);
	dUv.y -= .5 * strength * (texture2D(tNoise, resizedUv * .08 + vec2(0.005, 0.01) * time).r - .5);
	dUv.y *= 1. + 0.1 * strength * (texture2D(tPerlin, resizedUv * .5 - 0.01 * time).r - .5);

	float smoothness = smoothstep(.4, .7, texture2D(tNoise, resizedUv * .08 + vec2(-0.08, -0.04) * time).r);

	float clouds = smoothstep(.9 - .1 * smoothness, .7, dUv.y);
	clouds *= smoothstep(0., .2, dUv.y - .2 * smoothstep(.4, 1., dUv.x));

	float alpha = clouds * smoothstep(1., .9, vUv.y) * smoothstep(0., .1, vUv.y) * smoothstep(0., .1, vUv.x) * smoothstep(1., 0.9, vUv.x);
	alpha += smoothstep(0.2, .3, vUv.y) * smoothstep(0.7, .6, vUv.y) * smoothstep(0.2, .3, vUv.x) * smoothstep(.9, 0.8, vUv.x);
	alpha = min(1., alpha);

	float cloudDarkness = smoothstep(.4, 1., dUv.y) + smoothstep(.4, 0., dUv.y);
	vec3 color = mix(vec3(0.82, 0.86, 0.88), 1.1 * vec3(0.961, 0.969, 0.976), cloudDarkness);

	gl_FragColor = vec4(color, alpha);
}
`;

/* ------------------------------------------------------------------ */
/* Sky (cylinder around the camera)                                    */
/* ------------------------------------------------------------------ */

export const skyVertex = /* glsl */ `
precision highp float;

varying vec2 vUv;

void main() {
	vUv = uv;
	vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.);
	gl_Position = projectionMatrix * mvPosition;
	gl_Position.z = gl_Position.w;
}
`;

export const skyFragment = /* glsl */ `
precision highp float;

uniform sampler2D tNoise;
uniform vec3 uLightColor, uDarkColor;
uniform vec2 uResolution;
uniform float uTime;

varying vec2 vUv;

#include <common>

void main() {
	vec2 dUv = vUv;
	vec2 sUv = gl_FragCoord.xy / uResolution;
	dUv.x += 0.01 * uTime;

	vec2 aUv = vUv + vec2(-0.004 * uTime, 0.002 * uTime);
	float noise = texture2D(tNoise, dUv).r * texture2D(tNoise, aUv).r;

	vec2 dsUv = sUv + 0.5 * (noise - .25);
	float value = length(dsUv - .5) * sUv.y;

	float simpleClouds = texture2D(tNoise, vUv * 2. + vec2(-0.001 * uTime, 0.)).g;

	value = 1. - value;
	value += 0.5 * simpleClouds;

	vec3 color = mix(uDarkColor, uLightColor + .08, clamp(value, 0., 1.));

	vec2 uv = vUv * vec2(6., -8.);
	float basic2Noise = texture2D(tNoise, uv * 2.5 * vec2(2., 1.)).r;

	/* Cloud rows in the sky */
	float count = 4.;
	vec2 fUv = uv + vec2(0.005 * uTime, 0.);
	vec2 cUv = vec2(uv.x, uv.y * (count));
	cUv.y -= 2.;
	float offset = 1.5 * (smoothstep(0.7 + .2 * texture2D(tNoise, uv * 4.).r, 1., fract(cUv.y)) + floor(cUv.y));

	float cloudShape = (-.01 * abs(sin(uv.x * 50. + offset)) - 0.03 * abs(sin(uv.x * 15. + offset)) - 0.02 * abs(sin(fUv.x * 17. + offset))) * count;
	cUv.y += cloudShape;

	cUv *= 1. + .3 * (texture2D(tNoise, fUv * .3).rg - .5);
	cUv.y += 1. * (texture2D(tNoise, fUv * .4).r - .5);
	cUv.y -= .05 * count * texture2D(tNoise, fUv * 4.).r;

	float cloudRows = fract(cUv.y);
	cloudRows += smoothstep(0.5, 0., cloudRows);

	vec2 sCUv = uv + vec2(.01 * uTime) + .2 * texture2D(tNoise, uv * 1.).r + .05 * vec2(basic2Noise);
	float smallCloudsNoise = texture2D(tNoise, sCUv * 0.1).r;
	float offsetSmallCloudsNoise = texture2D(tNoise, sCUv * 0.1 + vec2(0., -.01)).r;
	vec2 smallClouds = vec2(smoothstep(.5, .62, offsetSmallCloudsNoise), smoothstep(.46, .5, smallCloudsNoise));

	float clouds = mix(cloudRows, smallClouds.r, smallClouds.g);
	clouds = clamp(clouds, 0., 1.);

	vec3 darkColor = vec3(0.737, 0.773, 0.8);
	vec3 cloudySkyColor = mix(darkColor, vec3(0.961, 0.969, 0.976), clouds);

	color = mix(color, cloudySkyColor, .5 * .3);

	gl_FragColor = vec4(color, 1.);
}
`;

/* ------------------------------------------------------------------ */
/* Night sky (same cylinder; everything computed from the view ray)    */
/* ------------------------------------------------------------------ */

export const nightSkyVertex = /* glsl */ `
precision highp float;

varying vec3 vViewDir;

void main() {
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
	vViewDir = mvPosition.xyz;
	gl_Position = projectionMatrix * mvPosition;
	gl_Position.z = gl_Position.w;
}
`;

export const nightSkyFragment = /* glsl */ `
precision highp float;

uniform sampler2D tNoise;
uniform float uTime, uPixelAngle;
uniform vec3 uSkyTopColor, uSkyHorizonColor, uHorizonGlowColor, uStarColor, uDustColor, uSummitGlowColor;
uniform float uGradientPower, uHorizonGlow;
uniform float uStarDensity, uStarBrightness, uStarSize, uStarClustering, uTwinkleStrength, uTwinkleSpeed;
uniform float uStarFadeFraction, uStarFadeSpeed; // slow appear / disappear of a subset of stars
uniform float uDustStrength, uDustBandWidth;
uniform vec3 uDustBandNormal, uSummitDir;
uniform float uSummitGlowStrength, uSummitGlowLift;
uniform vec2 uSummitGlowRadius;
// Broad irregular atmospheric lift, anchored to a fixed sky direction (world space)
uniform vec3 uAtmoGlowDir, uAtmoGlowColor;
uniform float uAtmoGlowStrength, uAtmoGlowRadius, uAtmoGlowNoiseAmount, uAtmoGlowNoiseScale;
#ifdef USE_SKY_PHOTO
uniform sampler2D tPhoto;
uniform float uPhotoBlend, uPhotoExposure, uPhotoFade;
uniform vec4 uPhotoMap; // x: azimuth span (rad), y: azimuth offset (rad), z: elevation min (rad), w: elevation max (rad)
#endif

varying vec3 vViewDir;

#define PI 3.14159265
#define TAU 6.2831853

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

/* azimuth / elevation mapping of a world direction (u: 0..1 around, v: 0..1 pole to pole) */
vec2 skyUv(vec3 d) {
	return vec2(atan(d.z, d.x) / TAU + 0.5, asin(clamp(d.y, -1., 1.)) / PI + 0.5);
}
vec3 dirFromUv(vec2 uv) {
	float az = (uv.x - 0.5) * TAU;
	float el = (uv.y - 0.5) * PI;
	float c = cos(el);
	return vec3(c * cos(az), sin(el), c * sin(az));
}

/*
 * Star field: one hashed layer on an azimuth x elevation grid (3x3 cell search).
 * Population per cell is modulated by a low-frequency "cluster" field so the
 * sky has dense and empty regions. Each star gets a class from its hash:
 *   ~88 % pinpoints (sub-pixel, dim), ~10 % medium, ~2 % bright; only the top
 *   ~0.3 % get a faint wide halo and a slow twinkle.
 * Distance is the spherical chord, so stars stay round at every elevation.
 */
float starField(vec3 d, vec2 uv, float clusterMod) {
	vec2 cells = vec2(400., 200.);
	vec2 p = uv * cells;
	vec2 cell = floor(p);
	float cosEl = cos((uv.y - 0.5) * PI);
	float density = 0.5 * uStarDensity * clusterMod * cosEl;
	float px = uPixelAngle * uStarSize;
	float acc = 0.;
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			vec2 c = cell + vec2(float(i), float(j));
			vec2 cw = vec2(mod(c.x, cells.x), c.y);
			float h = hash21(cw);
			if (h > density) continue;
			vec2 jitter = vec2(hash21(cw + 17.3), hash21(cw + 41.7));
			vec3 sd = dirFromUv((c + jitter) / cells);
			float ang = length(d - sd);
			float k = hash21(cw + 7.7);              // star class + brightness
			float r, I;
			/* a subset of stars slowly breathes in and out of existence (not the bright class) */
			float fadeSel = hash21(cw + 91.3);
			float life = 1.;
			if (fadeSel < uStarFadeFraction && k < 0.98) {
				float ph = TAU * hash21(cw + 23.9);
				float rate = uStarFadeSpeed * (0.5 + hash21(cw + 57.1));
				life = smoothstep(-0.35, 0.55, sin(uTime * rate + ph));
			}
			if (k < 0.88) {                           // pinpoints
				r = px * 0.55;
				I = 0.10 + 0.25 * (k / 0.88);
			} else if (k < 0.98) {                    // medium
				r = px * 0.8;
				I = 0.45 + 0.3 * ((k - 0.88) / 0.10);
			} else {                                  // bright
				r = px * 1.15;
				I = 0.9;
				float tw = 1. - uTwinkleStrength * 0.5 * (0.5 + 0.5 * sin(uTime * uTwinkleSpeed * (0.7 + 1.3 * hash21(cw + 3.1)) + TAU * h));
				I *= tw;
				if (k > 0.997) acc += 0.06 * exp(-(ang * ang) / (px * px * 16.)) * tw; // faint wide halo, a handful in the whole sky
			}
			acc += I * life * exp(-(ang * ang) / (r * r));
		}
	}
	return acc;
}

void main() {
	/* View ray in world space (independent of the cylinder's own rotation) */
	vec3 v = normalize(vViewDir);
	vec3 d = normalize(vec3(dot(viewMatrix[0].xyz, v), dot(viewMatrix[1].xyz, v), dot(viewMatrix[2].xyz, v)));
	vec2 duv = skyUv(d);

	/* Gradient: near-black zenith, deep cold blue horizon, thin haze at the horizon line */
	float t = pow(smoothstep(-0.06, 0.55, d.y), uGradientPower);
	vec3 color = mix(uSkyHorizonColor, uSkyTopColor, t);
	color += uHorizonGlowColor * uHorizonGlow * exp(-max(d.y, 0.) * 12.) * smoothstep(-0.25, 0.0, d.y);

	/* Photographic plate under the procedural sky */
	float procScale = 1.;
	#ifdef USE_SKY_PHOTO
	{
		float az = atan(d.z, d.x) - uPhotoMap.y;
		az = az - TAU * floor(az / TAU + 0.5);            // wrap to -PI..PI around the offset
		float el = asin(clamp(d.y, -1., 1.));
		vec2 puv = vec2(az / uPhotoMap.x + 0.5, (el - uPhotoMap.z) / (uPhotoMap.w - uPhotoMap.z));
		vec3 photo = texture2D(tPhoto, puv).rgb * uPhotoExposure;
		float inside = smoothstep(-0.02, 0.08, puv.y) * smoothstep(1.02, 0.9, puv.y);
		color = mix(color, photo, uPhotoBlend * inside);
		procScale = 1. - uPhotoFade * uPhotoBlend * inside;
	}
	#endif

	/* Low-frequency dust band (monochrome, very faint) — also drives star clustering */
	float band = abs(dot(d, uDustBandNormal));
	float dustMask = smoothstep(uDustBandWidth, uDustBandWidth * 0.1, band);
	float lf = texture2D(tNoise, duv * vec2(2.5, 1.25) + 0.13).r;
	float mf = texture2D(tNoise, duv * vec2(7., 3.5) + 0.41).g;
	float dust = dustMask * smoothstep(0.3, 0.85, lf * 0.65 + mf * 0.35) * uDustStrength;
	color += uDustColor * dust * 0.035 * procScale;

	/* Star clustering field: dense and sparse regions, denser inside the dust band */
	float cl = texture2D(tNoise, duv * vec2(4., 2.) + 0.77).r;
	float clusterMod = mix(1., mix(0.25, 1.7, smoothstep(0.3, 0.8, cl)) * (1. + 0.7 * dustMask), uStarClustering);

	float stars = starField(d, duv, clusterMod);
	color += uStarColor * stars * uStarBrightness * procScale;

	/* Broad cold back-glow around the summit direction (elliptical, faint) */
	vec3 g = normalize(uSummitDir + vec3(0., uSummitGlowLift, 0.));
	vec2 gUv = skyUv(g);
	float dAz = duv.x - gUv.x;
	dAz = (dAz - floor(dAz + 0.5)) * TAU * cos((duv.y - 0.5) * PI);
	float dEl = (duv.y - gUv.y) * PI;
	float q = dAz * dAz / (uSummitGlowRadius.x * uSummitGlowRadius.x) + dEl * dEl / (uSummitGlowRadius.y * uSummitGlowRadius.y);
	float glow = exp(-q) * 0.6 + exp(-q * 0.25) * 0.4;   // core + wide skirt, no visible ring
	color += uSummitGlowColor * glow * 0.14 * uSummitGlowStrength;

	/* Broad atmospheric lift: two overlapping soft radial fields around a fixed sky
	   direction, radius and intensity warped by low-frequency noise so no circle
	   can be read. Faded out below the horizon so the horizon band is not lifted. */
	vec2 aUv = skyUv(uAtmoGlowDir);
	float cosElA = cos((duv.y - 0.5) * PI);
	float aAz = duv.x - aUv.x;
	aAz = (aAz - floor(aAz + 0.5)) * TAU * cosElA;
	float aEl = (duv.y - aUv.y) * PI;
	float an1 = texture2D(tNoise, duv * vec2(uAtmoGlowNoiseScale, uAtmoGlowNoiseScale * 0.5) + 0.23).r - 0.5;
	float an2 = texture2D(tNoise, duv * vec2(uAtmoGlowNoiseScale * 2.3, uAtmoGlowNoiseScale * 1.15) + 0.61).g - 0.5;
	float aNoise = an1 * 0.7 + an2 * 0.3;
	float R1 = uAtmoGlowRadius * (1. + 2. * uAtmoGlowNoiseAmount * aNoise);
	float R2 = uAtmoGlowRadius * 1.7 * (1. - 1.4 * uAtmoGlowNoiseAmount * aNoise);
	float r1 = length(vec2(aAz, aEl * 1.35)) / R1;
	float r2 = length(vec2(aAz + 0.14 * uAtmoGlowRadius * 3., (aEl - 0.09 * uAtmoGlowRadius * 3.) * 1.2)) / R2;
	float lift = exp(-r1 * r1) + 0.55 * exp(-r2 * r2);
	lift *= 1. + 1.5 * uAtmoGlowNoiseAmount * aNoise;
	lift *= smoothstep(-0.06, 0.05, d.y);
	color += uAtmoGlowColor * max(lift, 0.) * 0.10 * uAtmoGlowStrength;

	gl_FragColor = vec4(color, 1.);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
	gl_FragColor.rgb += (hash21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.; // dither the dark gradient
}
`;
