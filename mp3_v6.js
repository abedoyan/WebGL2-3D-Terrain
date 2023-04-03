// constants to use throughout the program
const IlliniBlue = new Float32Array([0.075, 0.16, 0.292, 1])
const IlliniOrange = new Float32Array([1, 0.373, 0.02, 1])
const ArdaPurple = new Float32Array([0.8, 0, 1, 1])
const ArdaGreen = new Float32Array([0, 1, 0.1, 1])
const IdentityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])


/** Compile and link the vertex and fragment shaders */ 
function compileAndLinkGLSL(vs_source, fs_source) {
    // compile the vertex shader
    let vs = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vs, vs_source)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vs))
        throw Error("Vertex shader compilation failed")
    }

    // compile the fragment shader
    let fs = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fs, fs_source)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fs))
        throw Error("Fragment shader compilation failed")
    }
    
    // link the shaders in one program
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program))
        throw Error("Linking failed")
    }

    // return the program
    return program
}


/** Sends per-vertex data to the GPU and connects it to a VS input */
function supplyDataBuffer(data, program, vsIn, mode) {
    if (mode === undefined) mode = gl.STATIC_DRAW
    
    let buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    let f32 = new Float32Array(data.flat())
    gl.bufferData(gl.ARRAY_BUFFER, f32, mode)
    
    let loc = gl.getAttribLocation(program, vsIn)
    gl.vertexAttribPointer(loc, data[0].length, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(loc)
    
    return buf;
}


/** Creates a Vertex Array Object and puts into it all of the data in the given */
function setupGeometry(geom, program) {
    var triangleArray = gl.createVertexArray()
    gl.bindVertexArray(triangleArray)

    for(let name in geom.attributes) {
        let data = geom.attributes[name]
        supplyDataBuffer(data, program, name)
    }

    var indices = new Uint16Array(geom.triangles.flat())
    var indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    return {
        mode: gl.TRIANGLES,
        count: indices.length,
        type: gl.UNSIGNED_SHORT,
        vao: triangleArray
    }
}


/** Draws a sphere using the UV-sphere method */
function makeUVSphere(rings, slices) {
    var g = {
      "triangles": [],
      "attributes":
        {"position": []}
    };

    // calculate the vertices of the uv-sphere
    for (let i = 0; i <= rings; i += 1) {
        const ang1 = i * Math.PI / (rings-1)
  
        for (let j = 0; j <= slices; j += 1) {
            const ang2 = j * 2 * Math.PI / slices
    
            let x = Math.cos(ang2) * Math.sin(ang1)
            let y = Math.sin(ang2) * Math.sin(ang1)
            let z = Math.cos(ang1)

            g.attributes.position.push([x, y, z])
        }
    }
    
    // get the vertices to form the triangles
    for (let i = 0; i < rings-1; i += 1) {
        for (let j = 0; j < slices; j += 1) {
            let vertex1 = i * (slices + 1) + j
            let vertex2 = vertex1 + slices + 1
    
            g.triangles.push([vertex1, vertex2, vertex1 + 1])
            g.triangles.push([vertex2, vertex2 + 1, vertex1 + 1])
        }
    }
  
    return g
}


/** Draws a torus */
function makeTorus(innerRad, outerRad, rings, points) {
    var g = {
      "triangles": [],
      "attributes":
        {"position": []}
    }

    // calculate the vertices of the torus
    for (let i = 0; i <= points; i += 1) {
        const ang1 = i * 2 * Math.PI / points
  
        for (let j = 0; j <= rings; j += 1) {
            const ang2 = j * 2 * Math.PI / rings
  
            let x = (innerRad + outerRad * Math.cos(ang1)) * Math.cos(ang2)
            let y = (innerRad + outerRad * Math.cos(ang1)) * Math.sin(ang2)
            let z = outerRad * Math.sin(ang1)

            g.attributes.position.push([x, y, z])
        }
    }

    // get the vertices to form the triangles
    for (let i = 0; i < points; i += 1) {
        for (let j = 0; j < rings; j += 1) {
            let vertex1 = i * (rings + 1) + j
            let vertex2 = vertex1 + rings + 1
    
            g.triangles.push([vertex1, vertex2, vertex1 + 1])
            g.triangles.push([vertex2, vertex2 + 1, vertex1 + 1])
        }
    }
    
    return g
}

  

/** 
 * Draws a square NxN grid with z-values initially set to 0
 * To be used for the faulting terrain required and optional portions 
 */ 
function makeGrid(n) {
    var g =
    {"triangles": []
    ,"attributes":
        {"position": []}
    }

    for(let col=0; col<n; col+=1) {
        for(let row=0; row<n; row+=1) {
            let x = row/(n-1)*2 - 1
            let y = col/(n-1)*2 - 1
            g.attributes.position.push([x, y, 0])
        }
    }

    for(let i=0; i<n*n-n; i+=1) {
        g.triangles.push([i, i+1, i+n])
        g.triangles.push([i+n, i+1, i+n+1])

        if(i%n == n-2){
            i+=1
        }
    }
    return g
}


/** Generates terrain using the faulting method and rescales height */
function faulting(grid, faults) {
    let delta = 0.8
    let scale = 1
    let [xmin, xmax, zmin, zmax] = [0,0,0,0]

    for(let i=0; i<faults; i+=1){
        let p = ([Math.random()*2-1, Math.random()*2-1, 0])
        let ang = Math.random()*Math.PI*2
        let norm = [Math.cos(ang), Math.sin(ang), 0]

        for(let j = 0; j < grid.attributes.position.length; j+=1) {
            let b = grid.attributes.position[j]
            let dotProd = dot(sub(b, p), norm)

            if (dotProd < 0){
                grid.attributes.position[j][2] -= delta
            }
            else{
                grid.attributes.position[j][2] += delta
            }

            // keep track of min and max for x and z
            if (grid.attributes.position[j][0] < xmin){
                xmin = grid.attributes.position[j][0]
            }
            if (grid.attributes.position[j][0] > xmax){
                xmax = grid.attributes.position[j][0]
            }
            if (grid.attributes.position[j][2] < zmin){
                zmin = grid.attributes.position[j][2]
            }
            if (grid.attributes.position[j][2] > zmax){
                zmax = grid.attributes.position[j][2]
            }
        }
        delta = delta * scale
    }

    // fix vertical separation
    let h = (xmax - xmin)*(1/2)

    if (h != 0){
        for(let i = 0; i < grid.attributes.position.length; i+=1){
            let z = ((grid.attributes.position[i][2] - zmin)/(zmax - zmin))*h - (h/2)
            grid.attributes.position[i][2] = z
        }
    }

    return grid
}


/** Draw the required terrain with faulting and Lambert light source as default
 *  Includes checkboxes with options to add specular lighting and color
*/
function drawReq() {
    gl.clearColor(...IlliniBlue) // f(...[1,2,3]) means f(1,2,3)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(program1)

    gl.bindVertexArray(geom1.vao)
    
    let lightdir = normalize([1,1,1])
    let halfway = normalize(add(lightdir, [0,0,1]))

    // lambert light
    gl.uniform3fv(gl.getUniformLocation(program1, 'lam_lightdir'), lightdir)
    // blinn phong light
    gl.uniform3fv(gl.getUniformLocation(program1, 'bp_halfway'), halfway)
    // light color
    gl.uniform3fv(gl.getUniformLocation(program1, 'lightcolor'), [1,1,1])

    gl.uniform4fv(gl.getUniformLocation(program1, 'color'), IlliniOrange)
    gl.uniformMatrix4fv(gl.getUniformLocation(program1, 'mv'), false, m4mult(v,m))
    gl.uniformMatrix4fv(gl.getUniformLocation(program1, 'p'), false, p)
    gl.drawElements(geom1.mode, geom1.count, geom1.type, 0)
}


/** Draw the optional uv-sphere */
function drawUVSphere() {
    gl.clearColor(...IlliniBlue) // f(...[1,2,3]) means f(1,2,3)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(program4)

    gl.bindVertexArray(geom4.vao)

    let lightdir = normalize([1,1,1])
    let halfway = normalize(add(lightdir, [0,0,1]))

    // lambert light
    gl.uniform3fv(gl.getUniformLocation(program4, 'lam_lightdir'), lightdir)
    // blinn phong light
    gl.uniform3fv(gl.getUniformLocation(program4, 'bp_halfway'), halfway)
    // light color
    gl.uniform3fv(gl.getUniformLocation(program4, 'lightcolor'), [1,1,1])
    
    gl.uniform4fv(gl.getUniformLocation(program4, 'color'), ArdaGreen)
    gl.uniformMatrix4fv(gl.getUniformLocation(program4, 'mv'), false, m4mult(v,m))
    gl.uniformMatrix4fv(gl.getUniformLocation(program4, 'p'), false, p)
    gl.drawElements(geom4.mode, geom4.count, geom4.type, 0)
}


/** Draw the optional torus */
function drawTorus() {
    gl.clearColor(...IlliniBlue) // f(...[1,2,3]) means f(1,2,3)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(program5)

    gl.bindVertexArray(geom5.vao)

    let lightdir = normalize([1,1,-1])
    let halfway = normalize(add(lightdir, [0,0,-1]))

    // lambert light
    gl.uniform3fv(gl.getUniformLocation(program5, 'lam_lightdir'), lightdir)
    // blinn phong light
    gl.uniform3fv(gl.getUniformLocation(program5, 'bp_halfway'), halfway)
    // light color
    gl.uniform3fv(gl.getUniformLocation(program5, 'lightcolor'), [1,1,1])
    
    gl.uniform4fv(gl.getUniformLocation(program5, 'color'), ArdaPurple)
    gl.uniformMatrix4fv(gl.getUniformLocation(program5, 'mv'), false, m4mult(v2,m2))
    gl.uniformMatrix4fv(gl.getUniformLocation(program5, 'p'), false, p)
    gl.drawElements(geom5.mode, geom5.count, geom5.type, 0)
}


function addNormals(geom) {
    geom.attributes.normal = []

    for(let i=0; i<geom.attributes.position.length; i+=1) {
        geom.attributes.normal.push([0,0,0])
    }

    for(let i=0; i<geom.triangles.length; i+=1) {
        let tri = geom.triangles[i]
        let p0 = geom.attributes.position[tri[0]]
        let p1 = geom.attributes.position[tri[1]]
        let p2 = geom.attributes.position[tri[2]]
        let e1 = sub(p1,p0)
        let e2 = sub(p2,p0)
        let n = cross(e1,e2)
        geom.attributes.normal[tri[0]] = add(geom.attributes.normal[tri[0]], n)
        geom.attributes.normal[tri[1]] = add(geom.attributes.normal[tri[1]], n)
        geom.attributes.normal[tri[2]] = add(geom.attributes.normal[tri[2]], n)
    }

    for(let i=0; i<geom.attributes.position.length; i+=1) {
        geom.attributes.normal[i] = normalize(geom.attributes.normal[i])
    }
}


/** Compute any time-varying or animated aspects of the scene */
function timeStep(milliseconds) {
    let seconds = milliseconds / 1000;
    
    window.m = m4mul(m4scale(0.9,0.9,0.9), m4trans(0,0.5,0))
    window.m2 = m4rotX(seconds)

    window.v = m4view([Math.cos(seconds/2),3.5,2.5], [0,0,0], [0,0,1])
    window.v2 = m4view([Math.cos(seconds),2,3], [0,0,0], [0,0,1])

    if (type == "terrain_req"){
        drawReq()}
    else if (type == "uv_sphere"){
        drawUVSphere()}
    else if (type == "torus"){
        drawTorus()}

    window.pending = requestAnimationFrame(timeStep)
}


/** Resizes the canvas to completely fill the screen */
function fillScreen() {
    let canvas = document.querySelector('canvas')
    document.body.style.margin = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    canvas.style.width = ''
    canvas.style.height = ''
    // to do: update aspect ratio of projection matrix here
    if (window.gl) {
        gl.viewport(0,0, canvas.width, canvas.height)
        window.p = m4perspNegZ(1, 5, 1, canvas.width, canvas.height)
    }
}


/** Compile, link, other option-independent setup */
async function setup(event) {
    window.gl = document.querySelector('canvas').getContext('webgl2',
        // optional configuration object: see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
        {antialias: false, depth:true, preserveDrawingBuffer:true}
    )

    // create program for the terrain
    let vs1 = await fetch('vertexShader.glsl').then(res => res.text())
    let fs1 = await fetch('fragmentShader.glsl').then(res => res.text())
    window.program1 = compileAndLinkGLSL(vs1,fs1)

    // create program for the uv-sphere
    let vs4 = await fetch('vertexShader_UVSphere.glsl').then(res => res.text())
    let fs4 = await fetch('fragmentShader_UVSphere.glsl').then(res => res.text())
    window.program4 = compileAndLinkGLSL(vs4,fs4)

    // create program for the torus
    let vs5 = await fetch('vertexShader_Torus.glsl').then(res => res.text())
    let fs5 = await fetch('fragmentShader_Torus.glsl').then(res => res.text())
    window.program5 = compileAndLinkGLSL(vs5,fs5)

    // to do: more setup here
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
}


/**
 * Generate geometry, render the scene
 */
async function setupScene(scene, options) {
    console.log("To do: render",scene,"with options",options)

    if (scene == "terrain"){
        cancelAnimationFrame(window.pending)

        // get the size of grid and number of faults
        let n = options["resolution"]
        let f = options["slices"]

        if (options["shiny"] == true){
            gl.uniform1f(gl.getUniformLocation(program1, 'shiny'), 1.0)
        }
        else {
            gl.uniform1f(gl.getUniformLocation(program1, 'shiny'), 0.0)
        }

        if (options["color"] == true){
            gl.uniform1f(gl.getUniformLocation(program1, 'heightColor'), 1.0)
        }
        else {
            gl.uniform1f(gl.getUniformLocation(program1, 'heightColor'), 0.0)
        }

        // render the geometry
        let data = makeGrid(n)
        let faults = faulting(data, f)
        addNormals(faults)
        window.geom1 = setupGeometry(faults, program1)
        fillScreen()
        window.addEventListener('resize', fillScreen)
        window.type = "terrain_req"
        timeStep()
    }
    else if (scene == "uv_sphere"){
        cancelAnimationFrame(window.pending)

        // get the number of rings and slices
        let r = options["rings"]
        let s = options["slices"]

        let data = makeUVSphere(r, s)
        addNormals(data)
        window.geom4 = setupGeometry(data, program4)
        fillScreen()
        window.addEventListener('resize', fillScreen)
        window.type = "uv_sphere"
        timeStep()
    }
    else if (scene == "torus"){
        cancelAnimationFrame(window.pending)

        // get the ineer and outer radius and the number of rings and points per ring
        let innerRad = options["r1"]
        let outerRad = options["r2"]
        let rings = options["rings"]
        let points = options["points"]

        let data = makeTorus(innerRad, outerRad, rings, points)
        //let data = makeIcosphere()
        addNormals(data)
        window.geom5 = setupGeometry(data, program5)
        fillScreen()
        window.addEventListener('resize', fillScreen)
        window.type = "torus"
        timeStep()
    }
}

window.addEventListener('load',setup)
