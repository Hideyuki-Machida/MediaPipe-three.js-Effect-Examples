varying vec2 vUv;

uniform sampler2D imgTex;

void main() {
	vec3 img_color = texture2D( imgTex, vUv ).rgb;

	gl_FragColor = vec4( img_color, 1.0 );
}
