#version 300 es

precision highp float;

uniform vec4 color;
uniform vec3 lam_lightdir;

uniform vec3 bp_halfway;
uniform vec3 lightcolor;

in vec3 fnormal;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(fnormal);
    float lambert = max(0.0, dot(lam_lightdir, normal));

    float blinnphong = pow(max(0.0, dot(bp_halfway, normal)), 400.0);
    fragColor = vec4(color.rgb * (lightcolor * lambert) + (lightcolor * blinnphong)*20.0, color.a);

}