#version 460 core
#define EPSILON 0.001f
#define BIG 100000.0f
#define MAX_RAY_DEPTH 5

const int MATERIAL_DIFFUSE = 1;
const int MATERIAL_MIRROR = 2;
const int MATERIAL_GLASS = 3;

out vec4 FragColor;
in vec3 glPosition;

struct SSphere
{
	vec3 Center;
	float Radius;
	int MaterialIdx;
};

struct STriangle
{
	vec3 v1, v2, v3;
	int MaterialIdx;
};

struct SCamera
{
	vec3 Position;
	vec3 View;
	vec3 Up;
	vec3 Side;
	vec2 Scale;
};

struct SRay
{
	vec3 Origin;
	vec3 Direction;
};

struct SLight
{
	vec3 Position;
};

struct SMaterial
{
	vec3 Color;
	vec4 LightCoeffs;
	float ReflectionCoef; /* korf otrajenia */
	float RefractionCoef; /* koef prilomleinia, prozrachnosti */
	float IndexOfRefraction; /* koef prilomlenia */
	int MaterialType;
};

struct SIntersection
{
	float Time;
	vec3 Point;
	vec3 Normal;
	
	vec3 Color;
	vec4 LightCoeffs;
	float ReflectionCoef;
	float RefractionCoef;
	float IndexOfRefraction;
	int MaterialType;
};

struct STracingRay
{
	SRay ray;
	float contribution;
	int depth;
};


STracingRay stack[32];
int stackSize = 0;

bool isEmpty()
{
	return stackSize == 0;
}

void pushRay(STracingRay r)
{
	if (stackSize < 32)
	{
		stack[stackSize] = r;
		stackSize = stackSize + 1;
	}
}

STracingRay popRay(){
	stackSize = stackSize - 1;
	return stack[stackSize];
}

SCamera uCamera;
SLight light;
STriangle triangles[12];
SSphere spheres[5];
SMaterial materials[5];


SRay GenerateRay ( SCamera cam )
{
	vec2 screenCoords = glPosition.xy * cam.Scale;
	vec3 direction = cam.View + cam.Side * screenCoords.x + cam.Up * screenCoords.y;
	return SRay ( cam.Position, normalize(direction) );
}

void initializeSceneConfiguration(out STriangle triangles_out[12], out SSphere spheres_out[5])
{
	float wallSize = 8.0f;
	
	/* front */
	triangles_out[0].v1 = vec3(-wallSize,  wallSize,  wallSize);
	triangles_out[0].v2 = vec3( wallSize,  wallSize,  wallSize);
	triangles_out[0].v3 = vec3(-wallSize, -wallSize,  wallSize);
	triangles_out[0].MaterialIdx = 2;
	triangles_out[1].v1 = vec3( wallSize, -wallSize,  wallSize);
	triangles_out[1].v2 = vec3( wallSize,  wallSize,  wallSize);
	triangles_out[1].v3 = vec3(-wallSize, -wallSize,  wallSize);
	triangles_out[1].MaterialIdx = 2;

	/* back */
	triangles_out[2].v1 = vec3(-wallSize,  wallSize,  -wallSize);
	triangles_out[2].v2 = vec3( wallSize,  wallSize,  -wallSize);
	triangles_out[2].v3 = vec3(-wallSize, -wallSize,  -wallSize);
	triangles_out[2].MaterialIdx = 2;
	triangles_out[3].v1 = vec3( wallSize, -wallSize,  -wallSize);
	triangles_out[3].v2 = vec3( wallSize,  wallSize,  -wallSize);
	triangles_out[3].v3 = vec3(-wallSize, -wallSize,  -wallSize);
	triangles_out[3].MaterialIdx = 2;

	/* right */
	triangles_out[4].v1 = vec3(-wallSize,  wallSize, -wallSize);
	triangles_out[4].v2 = vec3(-wallSize,  wallSize,  wallSize);
	triangles_out[4].v3 = vec3(-wallSize, -wallSize, -wallSize);
	triangles_out[4].MaterialIdx = 2; 
	triangles_out[5].v1 = vec3(-wallSize, -wallSize,  wallSize);
	triangles_out[5].v2 = vec3(-wallSize,  wallSize,  wallSize);
	triangles_out[5].v3 = vec3(-wallSize, -wallSize, -wallSize);
	triangles_out[5].MaterialIdx = 2;

	/* left */
	triangles_out[6].v1 = vec3( wallSize,  wallSize,  wallSize);
	triangles_out[6].v2 = vec3( wallSize,  wallSize, -wallSize);
	triangles_out[6].v3 = vec3( wallSize, -wallSize,  wallSize);
	triangles_out[6].MaterialIdx = 2;
	triangles_out[7].v1 = vec3( wallSize, -wallSize, -wallSize);
	triangles_out[7].v2 = vec3( wallSize,  wallSize, -wallSize);
	triangles_out[7].v3 = vec3( wallSize, -wallSize,  wallSize);
	triangles_out[7].MaterialIdx = 2;

	/* bottom */
	triangles_out[8].v1 = vec3(-wallSize, -wallSize,  wallSize);
	triangles_out[8].v2 = vec3( wallSize, -wallSize,  wallSize);
	triangles_out[8].v3 = vec3(-wallSize, -wallSize, -wallSize);
	triangles_out[8].MaterialIdx = 4;
	triangles_out[9].v1 = vec3( wallSize, -wallSize, -wallSize);
	triangles_out[9].v2 = vec3( wallSize, -wallSize,  wallSize);
	triangles_out[9].v3 = vec3(-wallSize, -wallSize, -wallSize);
	triangles_out[9].MaterialIdx = 4;

	/* top */
	triangles_out[10].v1 = vec3(-wallSize,  wallSize, -wallSize);
	triangles_out[10].v2 = vec3( wallSize,  wallSize, -wallSize);
	triangles_out[10].v3 = vec3(-wallSize,  wallSize,  wallSize);
	triangles_out[10].MaterialIdx = 1;
	triangles_out[11].v1 = vec3( wallSize,  wallSize,  wallSize);
	triangles_out[11].v2 = vec3( wallSize,  wallSize, -wallSize);
	triangles_out[11].v3 = vec3(-wallSize,  wallSize,  wallSize);
	triangles_out[11].MaterialIdx = 1;

	spheres_out[0].Center = vec3(0.0f, -wallSize + 1.5f, 6.0f);
	spheres_out[0].Radius = 1.5f;
	spheres_out[0].MaterialIdx = 0;

	spheres_out[1].Center = vec3(3.0f, -wallSize + 3.0f, 7.0f);
	spheres_out[1].Radius = 2.0f;
	spheres_out[1].MaterialIdx = 2;
	
	spheres_out[2].Center = vec3(-3.0f, -wallSize + 5.0f, 5.0f);
	spheres_out[2].Radius = 2.5f;
	spheres_out[2].MaterialIdx = 3;

	spheres_out[3].Center = vec3(3.0f, -wallSize + 8.0f, 5.0f);
	spheres_out[3].Radius = 1.0f;
	spheres_out[3].MaterialIdx = 4;

	spheres_out[4].Center = vec3(-1.5f, -wallSize + 10.0f, 7.0f);
	spheres_out[4].Radius = 2.0f;
	spheres_out[4].MaterialIdx = 2;
}

void initializeLightAndMaterials(out SLight light_out, out SMaterial materials_out[5])
{
	light_out.Position = vec3(0.0f, 4.0f, -3.0f);

	materials_out[0].Color = vec3(0.9f, 0.2f, 0.2f);
	materials_out[0].LightCoeffs = vec4(0.2f, 0.7f, 0.4f, 32.0f); /* ambient, diffuse, specular, shininess */
	materials_out[0].ReflectionCoef = 0.1f;
	materials_out[0].RefractionCoef = 0.0f;
	materials_out[0].IndexOfRefraction = 1.0f;
	materials_out[0].MaterialType = MATERIAL_DIFFUSE;

	materials_out[1].Color = vec3(0.5f, 0.5f, 0.8f);
	materials_out[1].LightCoeffs = vec4(0.2f, 0.8f, 0.1f, 10.0f);
	materials_out[1].ReflectionCoef = 0.0f;
	materials_out[1].RefractionCoef = 0.0f;
	materials_out[1].IndexOfRefraction = 1.0f;
	materials_out[1].MaterialType = MATERIAL_DIFFUSE;
	
	materials_out[2].Color = vec3(0.85f, 0.85f, 0.9f);
	materials_out[2].LightCoeffs = vec4(0.05f, 0.1f, 0.8f, 1024.0f);
	materials_out[2].ReflectionCoef = 0.85f;
	materials_out[2].RefractionCoef = 0.0f;
	materials_out[2].IndexOfRefraction = 1.0f;
	materials_out[2].MaterialType = MATERIAL_MIRROR;

	materials_out[3].Color = vec3(0.95f, 0.98f, 1.0f);
	materials_out[3].LightCoeffs = vec4(0.0f, 0.0f, 0.9f, 256.0f);
	materials_out[3].ReflectionCoef = 0.05f;
	materials_out[3].RefractionCoef = 0.95f;
	materials_out[3].IndexOfRefraction = 1.52f;
	materials_out[3].MaterialType = MATERIAL_GLASS;

	materials_out[4].Color = vec3(1.0f, 1.0f, 1.0f);
	materials_out[4].LightCoeffs = vec4(0.2f, 0.8f, 0.3f, 16.0f);
	materials_out[4].ReflectionCoef = 0.05f;
	materials_out[4].RefractionCoef = 0.0f;
	materials_out[4].IndexOfRefraction = 1.0f;
	materials_out[4].MaterialType = MATERIAL_DIFFUSE;
}

bool IntersectSphere (SSphere sphere, SRay ray, float startTime, float endTime, out float time_out )
{
	vec3 oc = ray.Origin - sphere.Center;
	float a = dot(ray.Direction, ray.Direction );
	float b_half = dot(oc, ray.Direction);
	float c = dot(oc, oc) - sphere.Radius * sphere.Radius;
	float discriminant = b_half * b_half - a * c;

	if (discriminant < 0.0) {
		return false;
	} else {
		float sqrt_discriminant = sqrt(discriminant);
		float t1 = (-b_half - sqrt_discriminant) / a;
		float t2 = (-b_half + sqrt_discriminant) / a;
		
		time_out = BIG;
		bool found = false;

		if (t1 > startTime && t1 < endTime) {
			time_out = t1;
			found = true;
		}
		if (t2 > startTime && t2 < endTime && t2 < time_out) {
			time_out = t2;
			found = true;
		}
		return found;
	}
}

bool IntersectTriangle (SRay ray, vec3 v0, vec3 v1, vec3 v2, float startTime, float endTime, out float time_out )
{
	time_out = -1.0f;
	vec3 edge1 = v1 - v0;
	vec3 edge2 = v2 - v0;
	vec3 pvec = cross(ray.Direction, edge2);
	float det = dot(edge1, pvec);

	if (abs(det) < EPSILON) return false;

	float invDet = 1.0 / det;
	vec3 tvec = ray.Origin - v0;
	float u = dot(tvec, pvec) * invDet;

	if (u < 0.0 || u > 1.0) return false;

	vec3 qvec = cross(tvec, edge1);
	float v = dot(ray.Direction, qvec) * invDet;

	if (v < 0.0 || u + v > 1.0) return false;

	float t = dot(edge2, qvec) * invDet;
	
	if (t > startTime && t < endTime) {
        time_out = t;
        return true;
    }
	return false;
}

bool FindClosestIntersection(SRay ray, SSphere spheres_in[5], STriangle triangles_in[12], SMaterial materials_in[5], float startTime, float endTime, inout SIntersection intersect_out)
{
	bool foundIntersection = false;
	intersect_out.Time = endTime;

	for(int i = 0; i < 5; ++i)
	{
		float currentTime;
		if(IntersectSphere(spheres_in[i], ray, startTime, intersect_out.Time, currentTime ))
		{
			foundIntersection = true;
			intersect_out.Time = currentTime;
			intersect_out.Point = ray.Origin + ray.Direction * currentTime;
			intersect_out.Normal = normalize ( intersect_out.Point - spheres_in[i].Center );
			
			SMaterial currentMaterial = materials_in[spheres_in[i].MaterialIdx];
			intersect_out.Color = currentMaterial.Color;
			intersect_out.LightCoeffs = currentMaterial.LightCoeffs;
			intersect_out.ReflectionCoef = currentMaterial.ReflectionCoef;
			intersect_out.RefractionCoef = currentMaterial.RefractionCoef;
			intersect_out.IndexOfRefraction = currentMaterial.IndexOfRefraction;
			intersect_out.MaterialType = currentMaterial.MaterialType;
		}
	}

	for(int i = 0; i < 12; ++i)
	{
		float currentTime;
		if(IntersectTriangle(ray, triangles_in[i].v1, triangles_in[i].v2, triangles_in[i].v3, startTime, intersect_out.Time, currentTime))
		{
			foundIntersection = true;
			intersect_out.Time = currentTime;
			intersect_out.Point = ray.Origin + ray.Direction * currentTime;
			vec3 e1 = triangles_in[i].v2 - triangles_in[i].v1;
			vec3 e2 = triangles_in[i].v3 - triangles_in[i].v1;
			intersect_out.Normal = normalize(cross(e1, e2));
            if (dot(intersect_out.Normal, ray.Direction) > 0.0f) {
                intersect_out.Normal = -intersect_out.Normal;
            }

			SMaterial currentMaterial = materials_in[triangles_in[i].MaterialIdx];
			intersect_out.Color = currentMaterial.Color;
			intersect_out.LightCoeffs = currentMaterial.LightCoeffs;
			intersect_out.ReflectionCoef = currentMaterial.ReflectionCoef;
			intersect_out.RefractionCoef = currentMaterial.RefractionCoef;
			intersect_out.IndexOfRefraction = currentMaterial.IndexOfRefraction;
			intersect_out.MaterialType = currentMaterial.MaterialType;
		}
	}
	return foundIntersection;
}

vec3 CalculatePhongShading (SIntersection hitData, SLight sceneLight, vec3 viewDirection, float shadowFactor)
{
	vec3 N = hitData.Normal;
	vec3 L = normalize ( sceneLight.Position - hitData.Point );
	vec3 V = viewDirection;

	vec3 ambient = hitData.LightCoeffs.x * hitData.Color;

	float NdotL = max(dot(N, L), 0.0f);
	vec3 diffuse = hitData.LightCoeffs.y * NdotL * hitData.Color * shadowFactor;

	vec3 R = reflect(-L, N);
	float RdotV = max(dot(R, V), 0.0f);
	vec3 specular = vec3(0.0f);
	if (shadowFactor > 0.0f) {
        specular = hitData.LightCoeffs.z * pow(RdotV, hitData.LightCoeffs.w) * vec3(1.0f);
    }
	
	return ambient + diffuse + specular;
}

float CalculateShadowFactor(SLight sceneLight, SIntersection hitData, SSphere spheres_in[5], STriangle triangles_in[12], SMaterial materials_in[5])
{
	vec3 shadowRayOrigin = hitData.Point + hitData.Normal * EPSILON * 10.0f; 
	vec3 shadowRayDirection = normalize(sceneLight.Position - hitData.Point);
	float distanceToLight = distance(sceneLight.Position, hitData.Point);

	SIntersection shadowIntersect;
	if(FindClosestIntersection(SRay(shadowRayOrigin, shadowRayDirection), spheres_in, triangles_in, materials_in, EPSILON, distanceToLight - EPSILON, shadowIntersect))
	{
		return 0.1f;
	}
	return 1.0f;
}

void main(void)
{
	vec3 camPos = vec3(0.0f, 0.5f, -6.0f);
	vec3 camLookAt = vec3(0.0f, -0.5f, 0.0f);
	uCamera.Position = camPos;
	uCamera.View = normalize(camLookAt - uCamera.Position);
	vec3 approxUp = vec3(0.0f, 1.0f, 0.0f);
	uCamera.Side = normalize(cross(uCamera.View, approxUp));
	uCamera.Up = normalize(cross(uCamera.Side, uCamera.View));
	
	float aspectRatio = 2.0; /* sootnoshenie storon */
	float fieldOfViewY_degrees = 50.0;
	float scaleY = tan(radians(fieldOfViewY_degrees * 0.5f));
	float scaleX = scaleY * aspectRatio;
	uCamera.Scale = vec2(scaleX, scaleY);

	initializeLightAndMaterials(light, materials);
	initializeSceneConfiguration(triangles, spheres);
	
	vec3 finalColor = vec3(0.0f, 0.0f, 0.0f);
    SRay primaryRay = GenerateRay(uCamera);

	STracingRay initialTraceRay;
	initialTraceRay.ray = primaryRay;
	initialTraceRay.contribution = 1.0f;
	initialTraceRay.depth = 0;
	pushRay(initialTraceRay);

	while(!isEmpty())
	{
		STracingRay currentTraceRay = popRay();
		SRay currentRay = currentTraceRay.ray;
		
		SIntersection intersectionData;
		if (FindClosestIntersection(currentRay, spheres, triangles, materials, EPSILON, BIG, intersectionData))
		{
			vec3 viewDir = normalize(uCamera.Position - intersectionData.Point);

			switch(intersectionData.MaterialType)
			{
				case MATERIAL_DIFFUSE:
				{
					float shadow = CalculateShadowFactor(light, intersectionData, spheres, triangles, materials);
					finalColor += currentTraceRay.contribution * CalculatePhongShading(intersectionData, light, viewDir, shadow);
					break;
				}
				case MATERIAL_MIRROR:
				{
                    if (intersectionData.LightCoeffs.x > 0.0 || intersectionData.LightCoeffs.y > 0.0 || intersectionData.LightCoeffs.z > 0.0) {
                        float shadowMirrorSurface = CalculateShadowFactor(light, intersectionData, spheres, triangles, materials);
                        finalColor += currentTraceRay.contribution * (1.0f - intersectionData.ReflectionCoef) * CalculatePhongShading(intersectionData, light, viewDir, shadowMirrorSurface);
                    }

					if(currentTraceRay.depth < MAX_RAY_DEPTH && intersectionData.ReflectionCoef > EPSILON) {
						vec3 reflectDirection = reflect(currentRay.Direction, intersectionData.Normal);
						vec3 reflectOrigin = intersectionData.Point + intersectionData.Normal * EPSILON * 10.0f;
						
						STracingRay reflectedTRay;
						reflectedTRay.ray = SRay(reflectOrigin, reflectDirection);
						reflectedTRay.contribution = currentTraceRay.contribution * intersectionData.ReflectionCoef;
						reflectedTRay.depth = currentTraceRay.depth + 1;

						pushRay(reflectedTRay);
					}
					break;
				}
				case MATERIAL_GLASS:
				{
					if(currentTraceRay.depth < MAX_RAY_DEPTH) {
						vec3 I = currentRay.Direction;
						vec3 N_geo = intersectionData.Normal;

						if (intersectionData.ReflectionCoef > EPSILON) {
							vec3 reflectDir = reflect(I, N_geo);
							vec3 reflectOrigin = intersectionData.Point + N_geo * EPSILON * 10.0f;
							
							STracingRay reflectTRay;
							reflectTRay.ray = SRay(reflectOrigin, reflectDir);
							reflectTRay.contribution = currentTraceRay.contribution * intersectionData.ReflectionCoef;
							reflectTRay.depth = currentTraceRay.depth + 1;
							pushRay(reflectTRay);
						}
						
						if (intersectionData.RefractionCoef > EPSILON) {
							vec3 N_refr = N_geo;
							float eta_ratio;

							bool entering = dot(I, N_geo) < 0.0f;
							if (entering) {
								eta_ratio = 1.0f / intersectionData.IndexOfRefraction;
							} else {
								eta_ratio = intersectionData.IndexOfRefraction / 1.0f;
								N_refr = -N_geo;
							}

							vec3 refractDir = refract(I, N_refr, eta_ratio);

							if (dot(refractDir, refractDir) < EPSILON * EPSILON) { 
                                if (intersectionData.ReflectionCoef < 1.0f - EPSILON) {
                                     vec3 reflectDirTIR = reflect(I, N_geo);
                                     vec3 tirOrigin = intersectionData.Point + N_geo * EPSILON * 10.0f;

                                     STracingRay tirTRay;
                                     tirTRay.ray = SRay(tirOrigin, reflectDirTIR);
                                     tirTRay.contribution = currentTraceRay.contribution * intersectionData.RefractionCoef; 
                                     tirTRay.depth = currentTraceRay.depth + 1;
                                     pushRay(tirTRay);
                                }
							} else {
								vec3 refractOrigin;
                                if(entering) refractOrigin = intersectionData.Point - N_geo * EPSILON * 10.0f; 
                                else refractOrigin = intersectionData.Point + N_geo * EPSILON * 10.0f;

								STracingRay refractTRay;
                                refractTRay.ray = SRay(refractOrigin, refractDir);
								refractTRay.contribution = currentTraceRay.contribution * intersectionData.RefractionCoef;
								refractTRay.depth = currentTraceRay.depth + 1;
								pushRay(refractTRay);
							}
						}
					}
					break;
				}
			} 
		} else {
			}
	} 
	
	FragColor = vec4 (clamp(finalColor, 0.0, 1.0), 1.0);
}