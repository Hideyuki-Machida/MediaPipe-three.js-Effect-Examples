varying vec2 vUv;

uniform sampler2D maskTex;
uniform sampler2D imgTex;

void main() {
	float alpha = texture2D( maskTex, vUv ).r;
	vec3 img_color = texture2D( imgTex, vUv ).rgb;

	//gl_FragColor = vec4( img_color, alpha / 0.5 );
	gl_FragColor = vec4( img_color, alpha );
}
