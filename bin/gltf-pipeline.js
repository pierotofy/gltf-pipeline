#!/usr/bin/env node
'use strict';
var Cesium = require('cesium');
var path = require('path');

var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;

var Pipeline = require('../lib/Pipeline');

var processFileToDisk = Pipeline.processFileToDisk;

var argv = require('yargs')
    .usage('Usage: $0 -i inputPath -o outputPath')
    .example('$0 -i ./specs/data/boxTexturedUnoptimized/CesiumTexturedBoxTest.gltf -o output.gltf')
    .help('h')
    .alias('h', 'help')
    .options({
        'input': {
            alias: 'i',
            demand: true,
            describe: 'input=PATH, Read unoptimized glTF from the specified file.',
            group: 'Options:', // make sure 'Options:' is listed first
            normalize: true,
            type: 'string'
        },
        'output': {
            alias: 'o',
            describe: 'output=PATH, Write optimized glTF to the specified file.',
            normalize: true,
            type: 'string'
        },
        'binary': {
            alias: 'b',
            describe: 'Write binary glTF file using KHR_binary_glTF extension.',
            type: 'boolean'
        },
        'separate': {
            alias: 's',
            describe: 'Write separate geometry/animation data files, shader files, and textures instead of embedding them in the glTF asset.',
            type: 'boolean'
        },
        'separateImage': {
            alias: 't',
            describe: 'Write out separate textures, but embeds geometry/animation data files and shader files in the glTF asset.',
            type: 'boolean'
        },
        'quantize': {
            alias: 'q',
            describe: 'Quantize the attributes of this glTF asset using the WEB3D_quantized_attributes extension.',
            type: 'boolean'
        },
        'encodeNormals': {
            alias: 'n',
            describe: 'Oct-encode the normals of this glTF asset.',
            type: 'boolean'
        },
        'compressTextureCoordinates': {
            alias: 'c',
            describe: 'Compress the testure coordinates of this glTF asset.',
            type: 'boolean'
        },
        'cesium': {
            describe: 'Optimize the glTF for Cesium by using the sun as a default light source.',
            type: 'boolean'
        },
        'ao.enable': {
            describe: 'Bake ambient occlusion (to vertex data by default). If other `ao` flags are enabled, this is implicitly true.',
            group: 'Options: Ambient Occlusion',
            type: 'boolean'
        },
        'ao.toTexture': {
            describe: 'Bake AO to existing diffuse textures instead of vertices. Does not modify shaders.',
            group: 'Options: Ambient Occlusion',
            type: 'boolean'
        },
        'ao.groundPlane': {
            describe: 'Simulate a ground plane at the lowest point of the model when baking AO.',
            group: 'Options: Ambient Occlusion',
            type: 'boolean'
        },
        'ao.ambientShadowContribution': {
            default: 0.5,
            describe: 'Amount of AO to show when blending shader computed lighting and AO. 1.0 is full AO, 0.5 is a 50/50 blend.',
            group: 'Options: Ambient Occlusion',
            nargs: 1,
            type: 'number'
        },
        'ao.quality': {
            choices: ['high', 'medium', 'low'],
            default: 'low',
            describe: 'Quality to use when baking AO. Valid settings are high, medium, and low.',
            group: 'Options: Ambient Occlusion',
            nargs: 1,
            type: 'string'
        },
        'mc.enable': {
            describe: 'Existing primitive materials will be replaced using the KHR_materials_common extension.',
            group: 'Options: Materials Common',
            type: 'boolean'
        },
        'mc.materialType': {
            choices: ['blinn', 'phong', 'lambert', 'constant'],
            default: 'blinn',
            describe: 'The material type to use for KHR_materials_common.',
            group: 'Options: Materials Common',
            nargs: 1,
            type: 'string'
        },
        'mc.lightType': {
            choices: ['directional', 'point', 'spot', 'ambient'],
            default: 'directional',
            describe: 'The light type to use for KHR_materials common.',
            group: 'Options: Materials Common',
            nargs: 1,
            type: 'string'
        },
        'mc.ambient': {
            describe: 'RGBA value for ambient light reflected from the surface of the object.',
            group: 'Options: Materials Common'
        },
        'mc.diffuse': {
            describe: 'RGBA value or texture ID defining the amount of light diffusely reflected from the surface of the object',
            group: 'Options: Materials Common'
        },
        'mc.doubleSided': {
            describe: 'Declares whether backface culling should be disabled for this visual.',
            group: 'Options: Materials Common',
            type: 'boolean'
        },
        'mc.emission': {
            describe: 'RGBA value or texture ID for light emitted by the surface of the object.',
            group: 'Options: Materials Common'
        },
        'mc.specular': {
            describe: 'RGBA value or texture ID defining the color of light specularly reflected from the surface of the object.',
            group: 'Options: Materials Common'
        },
        'mc.shininess': {
            describe: 'Defines the specularity or roughness of the specular reflection lobe of the object.',
            group: 'Options: Materials Common',
            type: 'number'
        },
        'mc.transparency': {
            describe: 'Declares the amount of transparency as an opacity value between 0.0 and 1.0',
            group: 'Options: Materials Common',
            type: 'number'
        },
        'mc.transparent': {
            describe: 'Declares whether the visual should be rendered using alpha blending.',
            group: 'Options: Materials Common',
            type: 'boolean'
        }
    })
    .argv;

// If any raw ao parameters were specified, ao is enabled
var nargs = process.argv.length;
for (var i = 0; i < nargs; i++) {
    var arg = process.argv[i];
    if (arg.indexOf('ao') >= 0) {
        argv.ao.enable = true;
    }
}

/*
 * yargs puts our dot-notated boolean arguments into an array for some reason
 * This can be removed once: https://github.com/yargs/yargs/issues/617 is resolved
 */
var aoOptions = argv.ao;
for (var option in aoOptions) {
    if (aoOptions.hasOwnProperty(option)) {
        var value = aoOptions[option];
        if (Array.isArray(value)) {
            aoOptions[option] = value[value.length - 1];
        }
    }
}

console.log(argv.ao);

var gltfPath = argv.i;
var outputPath = argv.o;

if (!defined(outputPath)) {
    var outputFileExtension;
    if (argv.b) {
        outputFileExtension = '.glb';
    } else {
        outputFileExtension = '.gltf';
    }
    var fileExtension = path.extname(gltfPath);
    var fileName = path.basename(gltfPath, fileExtension);
    var filePath = path.dirname(gltfPath);
    // Default output.  For example, path/asset.gltf becomes path/asset-optimized.gltf
    outputPath = path.join(filePath, fileName + '-optimized' + outputFileExtension);
}

var options = {
    binary : argv.b,
    embed : !argv.s,
    embedImage : !argv.t,
    quantize : argv.q,
    encodeNormals : argv.n,
    compressTextureCoordinates : argv.c,
    aoOptions : argv.ao,
    mcOptions : argv.mc,
    optimizeForCesium : argv.cesium
};

console.time('optimize');
// Node automatically waits for all promises to terminate
processFileToDisk(gltfPath, outputPath, options)
    .then(function() {
        console.timeEnd('optimize');
    });
