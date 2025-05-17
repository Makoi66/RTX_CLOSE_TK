#version 460 core

in vec3 vPosition;
out vec3 glPosition;

void main (void)
{
	gl_Position = vec4(vPosition.xy, 0.1, 1.0);
	glPosition = vPosition;
}
