#version 300 es

precision highp float;

uniform vec4 color;
uniform vec3 lam_lightdir;
uniform vec3 bp_halfway;
uniform vec3 lightcolor;
uniform float shiny;
uniform float heightColor;

in vec3 fnormal;
in float fposition;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(fnormal);
    float lambert = max(0.0, dot(lam_lightdir, normal));
    float blinnphong = pow(max(0.0, dot(bp_halfway, normal)), 200.0);

    // height-based color
    float z = fposition + 0.5; 
    vec4 multiColor = vec4(max(0.0, 1.0 - abs(z - 0.5) * 4.0),
                       max(0.0, 1.0 - abs(z - 0.75) * 4.0),
                       max(0.0, 1.0 - abs(z - 0.25) * 4.0),
                       1.0);
    
    // determine if color should be height-based or not
    vec4 fcolor = heightColor == 1.0 ? multiColor : color;

    // lighting options
    vec4 difFragColor = vec4(fcolor.rgb * (lightcolor * lambert), fcolor.a);
    vec4 specFragColor = vec4(fcolor.rgb * (lightcolor * lambert) + (lightcolor * blinnphong)*5.0, fcolor.a);
    
    // determine which lighting to use
    fragColor = shiny == 1.0 ? specFragColor : difFragColor;
}