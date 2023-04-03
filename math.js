// vector ops
const add = (x,y) => x.map((e,i)=>e+y[i])
const sub = (x,y) => x.map((e,i)=>e-y[i])
const mul = (x,s) => x.map(e=>e*s)
const div = (x,s) => x.map(e=>e/s)
const dot = (x,y) => x.map((e,i)=>e*y[i]).reduce((s,t)=>s+t)
const mag = (x) => Math.sqrt(dot(x,x))
const normalize = (x) => div(x,mag(x))
const cross = (x,y) => x.length == 2 ?
  x[0]*y[1]-x[1]*y[0] :
  x.map((e,i)=> x[(i+1)%3]*y[(i+2)%3] - x[(i+2)%3]*y[(i+1)%3])

// matrix ops
const m4row = (m,r) => new m.constructor(4).map((e,i)=>m[r+4*i])
const m4rowdot = (m,r,v) => m[r]*v[0] + m[r+4]*v[1] + m[r+8]*v[2] + m[r+12]*v[3]
const m4col = (m,c) => m.slice(c*4,(c+1)*4)
const m4transpose = (m) => m.map((e,i) => m[((i&3)<<2)+(i>>2)])
const m4mul = (...args) => args.reduce((m1,m2) => {
  if(m2.length == 4) return m2.map((e,i)=>m4rowdot(m1,i,m2)) // m*v
  if(m1.length == 4) return m1.map((e,i)=>m4rowdot(m2,i,m1)) // v*m
  let ans = new m1.constructor(16)
  for(let c=0; c<4; c+=1) for(let r=0; r<4; r+=1)
    ans[r+c*4] = m4rowdot(m1,r,m4col(m2,c))
  return ans // m*m
})

// graphics matrices
const m4trans = (dx,dy,dz) => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, dx,dy,dz,1])
const m4rotX = (ang) => { // around x axis
  let c = Math.cos(ang), s = Math.sin(ang);
  return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
}
const m4rotY = (ang) => { // around y axis
  let c = Math.cos(ang), s = Math.sin(ang);
  return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
}
const m4rotZ = (ang) => { // around z axis
  let c = Math.cos(ang), s = Math.sin(ang);
  return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
}
const m4fixAxes = (f, up) => { // f to -z, up to near +y
  f = normalize(f)
  let r = normalize(cross(f,up))
  let u = cross(r,f)
  return new Float32Array([
    r[0],u[0],-f[0],0,
    r[1],u[1],-f[1],0,
    r[2],u[2],-f[2],0,
    0,0,0,1
  ])
}

const m4scale = (sx,sy,sz) => new Float32Array([sx,0,0,0, 0,sy,0,0, 0,0,sz,0, 0,0,0,1])

const m4view = (eye, center, up) => m4mul(m4fixAxes(sub(center,eye), up), m4trans(-eye[0],-eye[1],-eye[2]))

const m4perspNegZ = (near, far, fovy, width, height) => {
  let sy = 1/Math.tan(fovy/2);
  let sx = sy*height/width;
  return new Float32Array([sx,0,0,0, 0,sy,0,0, 0,0,-(far+near)/(far-near),-1, 0,0,(2*far*near)/(near-far),0]);
}

// quaternion
const m4fromQ = (q) => { 
  let n = dot(q,q)
  let s = n ? 2/n : 0
  let xx = s*q[1]*q[1], xy = s*q[1]*q[2], xz = s*q[1]*q[3], xw = s*q[1]*q[0]
  let yy = s*q[2]*q[2], yz = s*q[2]*q[3], yw = s*q[2]*q[0]
  let zz = s*q[3]*q[3], zw = s*q[3]*q[0]
  return new Float32Array([
    1-yy-zz, xy+zw, xz-yw, 0,
    xy-zw, 1-xx-zz, yz+xw, 0,
    xz+yw, yz-xw, 1-xx-yy, 0,
    0,0,0,1,
  ])
}
const m4toQ = (m) => {
  let a00 = m[0], a11 = m[5], a22 = m[10]
  if (a00 + a11 + a22 > 0)
    return normalize([a00+a11+a22+1, m[6]-m[9], m[8]-m[2], m[1]-m[4]])
  if ((a00 > a11) && (a00 > a22))
    return normalize([m[6]-m[9], a00-a11-a22+1, m[1]+m[4], m[8]-m[2]])
  if (a11 > a22)
    return normalize([m[8]-m[2], m[1]+m[4], a11-a00-a22+1, m[6]+m[9]])
  return normalize([m[1]-m[4], m[2]+m[8], m[6]+m[9], a22-a00-a11+1])
}

// interpolation
const lerp = (t,p0,p1) => add(mul(p0,1-t), mul(p1,t))
const lbez = (t, ...p) => {
  while(p.length > 1) p = p.slice(1).map((e,i) => lerp(t,p[i],e))
  return p[0]
}
const bezcut = (t, ...p) => {
  let front = [], back = []
  while(p.length > 0) {
    front.push(p[0])
    back.unshift(p[p.length-1])
    p = p.slice(1).map((e,i) => lerp(t,p[i],e))
  }
  return [front, back]
}
const slerp = (t,q0,q1) => {
  let d = dot(q0,q1)
  if (d > 0.9999) return normalize(lerp(t,q0,q1))
  let o = Math.acos(d), den = Math.sin(o)
  return add(mul(q0, Math.sin((1-t)*o)/den), mul(q1, Math.sin(t*o)/den))
}
const qlerp = (t,q0,q1) => {
  let d = dot(q0,q1)
  if (d < 0) { q1 = mul(q1,-1); d = -d; }
  if (d > 0.9999) return normalize(lerp(t,q0,q1))
  let o = Math.acos(d), den = Math.sin(o)
  return add(mul(q0, Math.sin((1-t)*o)/den), mul(q1, Math.sin(t*o)/den))
}
const sbez = (t, ...p) => {
  while(p.length > 1) p = p.slice(1).map((e,i) => slerp(t,p[i],e))
  return p[0]
}
const qbez = (t, ...p) => {
  while(p.length > 1) p = p.slice(1).map((e,i) => qlerp(t,p[i],e))
  return p[0]
}



/*
 * A set of helpful matrix functions for WebGL.
 * There are other more featureful libraries out there;
 * this is designed to be readable and not use any fancy Javascript.
 * It only supports 4x4 matrices.
 * It puts all its functions (even the helpers) in the global scope.
 * 
 * WebGL wants all matrices to be provided flattened in a Float32Array
 * and presented in column-major order, which makes them look transposed
 * when viewed in the Javascript code.
 * 
 * This file is released into the public domain. It may contain errors,
 * as I wrote it in one sitting with very little testing.
 * 
 * Public Contents:
 * 
 * - m4mult(any, number, of, matrices)
 * - m4transpose(m)
 * - m4ident()
 * - m4translate(x,y,z)
 * - m4scale(scale) and m4scale(x,y,z)
 * - m4perspPosZ(near, far, fovy, width, height)
 * - m4perspNegZ(near, far, fovy, width, height)
 * - m4rotX(ang), m4rotY(ang), m4rotZ(ang)
 * - m4rotAxis(axis, ang)
 * - m4rotAtoB(a,b)
 * - m4view(eye, center, up)
 * 
 * There are also various private helper functions you may use at your own risk.
 */


/** Helper function to normalize a (prefix of a) vector */
function m4normalized_(vec, len) {
  vec = Array.from(vec)
  if (len && len < vec.length) vec = vec.slice(0,len)
  let mag = Math.sqrt(vec.map(x=>x*x).reduce((x,y)=>x+y))
  return vec.map(x=>x/mag)
}
/** Helper function to normalize a (prefix of a) vector and return the old lenth */
function m4normalized2_(vec, len) {
  vec = Array.from(vec)
  if (len && len < vec.length) vec = vec.slice(0,len)
  let mag = Math.sqrt(vec.map(x=>x*x).reduce((x,y)=>x+y))
  return [vec.map(x=>x/mag), mag]
}
/** Helper function to find the cross product of two 3-vectors */
function m4cross_(x,y) {
  return [x[1]*y[2]-x[2]*y[1], x[2]*y[0]-x[0]*y[2], x[0]*y[1]-x[1]*y[0]]
}
/** Helper function to dot product (a prefix of) two vectors */
function m4dot_(x,y,len) {
  len = len ? Math.min(x.length, y.length, len) : Math.min(x.length, y.length)
  return Array.from(x).slice(0,len).map((v,i)=>v*y[i]).reduce((a,b)=>a+b)
}
/** Helper function to find the difference of (a prefix of) two vectors */
function m4sub_(x,y,len) {
  len = len ? Math.min(x.length, y.length, len) : Math.min(x.length, y.length)
  return Array.from(x).slice(0,len).map((v,i)=>v-y[i])
}

/**
* Multiply two matrices. Helper function; generally call m4mult instead.
*/
function m4mult_(m1,m2) {
  let ans = new Float32Array(16)
  for(let outRow = 0; outRow < 4; outRow += 1) {
      for(let outCol = 0; outCol < 4; outCol += 1) {
          for(let i = 0; i < 4; i += 1) {
              ans[outRow+outCol*4] += m1[outRow+i*4] * m2[i+outCol*4]
          }
      }
  }
  return ans
}
/**
* Multiplies any number of matrices and returns the result.
* Call as m4mult(A, B, C, D) to evaluate $A B C D$.
*/
function m4mult() {
  if (arguments.length == 1) return arguments[0]
  return Array.prototype.reduce.apply(arguments, [m4mult_])
}


/**
* Creates and returns a new identity matrix
*/
function m4ident() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

/**
* Creates and returns a new translation matrix
* 
* See <https://cs418.cs.illinois.edu/website/text/math2.html#translation>
*/
function m4translate(x,y,z) {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
}


/**
* Creates and returns a new perspective projection matrix
* where "forward" is the +z axis.
* 
* - `m4perspPosZ(near, far)` assumes 90° FoV in X and Y
* - `m4perspPosZ(near, far, PI/4, 16/9)` has FoV in Y and 16:9 aspect ratio
* - `m4perspPosZ(near, far, PI/3, 16, 9)` has FoV in Y and 16:9 aspect ratio
* 
* See <https://cs418.cs.illinois.edu/website/text/math2.html#division>
*/
function m4perspPosZ(near, far, fovy, width, height) {
  if (fovy === undefined) {
      var sx = 1, sy = 1;
  } else {
      let aspect = (height === undefined) ? width : width / height
      var sy = 1/Math.tan(fovy/2);
      var sx = sy/aspect;
  }
  return new Float32Array([sx,0,0,0, 0,sy,0,0, 0,0,1, 0,0,(far+near)/(far-near),(2*far*near)/(near-far),0]);
}


/** Helper function for rotations */
function m4rotAxis_(r,c,s) {
  omc = 1-c
  let xy = r[0]*r[1]*omc, yz = r[1]*r[2]*omc, zx = r[2]*r[0]*omc
  return new Float32Array([
      r[0]*r[0]*omc + c, xy + r[2]*s, zx - r[1]*s, 0,
      xy - r[2]*s, r[1]*r[1]*omc + c, yz + r[0]*s, 0,
      zx + r[1]*s, yz - r[0]*s, r[2]*r[2]*omc + c, 0,
      0,0,0,1]);
}

/**
* Creates and returns a new axis + angle rotation.
* 
* See <https://cs418.cs.illinois.edu/website/text/math2.html#rotation>
*/
function m4rotAxis(axis, ang) {
  let r = m4normalized_(axis, 3)
  let c = Math.cos(ang), s = Math.sin(ang);
  return m4rotAxis_(r,c,s)
}
/**
* Creates and returns a rotation that results in a pointing towards b
* 
* See <https://cs418.cs.illinois.edu/website/text/math2.html#rotation>
*/
function m4rotAtoB(a,b) {
  a = m4normalized_(a,3)
  b = m4normalized_(b,3)
  let [r, s] = m4normalized2_(m4cross_(a,b))
  let c = m4dot_(a,b)
  return m4rotAxis_(r,c,s)
}

/**
* A helper to display a matrix as four rows of values
*/
function m4pretty_(m) {
  for(let i=0; i<4; i+=1) {
      console.log(m[0+i],m[4+i],m[8+i],m[12+i])
  }
}
