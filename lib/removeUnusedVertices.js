/*jshint loopfunc: true */
'use strict';
var Cesium = require('cesium');

var defined = Cesium.defined;

var AccessorReader = require('./AccessorReader');
var createAccessorUsageTables = require('./createAccessorUsageTables');
var getAccessorByteStride = require('./getAccessorByteStride');
var uninterleaveAndPackBuffers = require('./uninterleaveAndPackBuffers');

module.exports = removeUnusedVertices;

/**
 * Removes attributes from indexed primitives in the glTF asset that are not used.
 *
 * The glTF asset must be initialized for the pipeline.
 *
 * @param {Object} gltf A javascript object containing a glTF asset.
 * @returns {Object} The glTF asset without unused vertices.
 *
 * @see addPipelineExtras
 * @see loadGltfUris
 * @see uninterleaveAndPackBuffers
 */
function removeUnusedVertices(gltf) {
    if (defined(gltf.accessors) && defined(gltf.buffers) && defined(gltf.bufferViews) && defined(gltf.meshes)) {
        uninterleaveAndPackBuffers(gltf);
        removeUnusedVerticesFromAccessors(gltf);
        uninterleaveAndPackBuffers(gltf);
    }
    return gltf;
}

function removeUnusedVerticesFromAccessors(gltf) {
    var accessors = gltf.accessors;
    var attributeAccessorId;
    var accessorUsageTables = createAccessorUsageTables(gltf);
    var numTables = accessorUsageTables.length;
    for (var i = 0; i < numTables; i++) {
        var table = accessorUsageTables[i];
        if (defined(table)) {
            var usage = table.usage;
            var usageLength = usage.length;
            var indexAccessorIds = table.indexAccessors;
            var attributeAccessorIds = table.attributeAccessors;
            var usedPortions = [];
            var usedStart = 0;
            var usedEnd = 0;
            var removed = 0;
            var chunk;
            for (var j = 0; j < usageLength; j++) {
                if (usage[j]) {
                    if (defined(chunk)) {
                        var amount = j - chunk;
                        for (var indexAccessorId in indexAccessorIds) {
                            if (indexAccessorIds.hasOwnProperty(indexAccessorId)) {
                                decrementIndicesPastIndex(gltf, accessors[indexAccessorId], j - removed - 1, amount);
                            }
                        }
                        removed += amount;
                        usedStart = j;
                        chunk = undefined;
                    }
                    usedEnd = j+1;
                } else if (!defined(chunk)) {
                    chunk = j;
                    usedPortions.push({
                        start: usedStart,
                        end: usedEnd
                    });
                }
            }
            if (!defined(chunk)) {
                usedPortions.push({
                    start: usedStart,
                    end: usedEnd
                });
            }
            for (attributeAccessorId in attributeAccessorIds) {
                if (attributeAccessorIds.hasOwnProperty(attributeAccessorId)) {
                    var accessor = accessors[attributeAccessorId];
                    packUsedPortions(gltf, accessor, usedPortions);
                }
            }
        }
    }
}

function decrementIndicesPastIndex(gltf, indexAccessor, index, amount) {
    var accessorReader = new AccessorReader(gltf, indexAccessor);
    var components = [];
    while(defined(accessorReader.read(components))) {
        var accessedIndex = components[0];
        if (accessedIndex > index) {
            components[0] = accessedIndex - amount;
            accessorReader.write(components);
        }
        accessorReader.next();
    }
}

function packUsedPortions(gltf, attributeAccessor, usedPortions) {
    var bufferViews = gltf.bufferViews;
    var buffers = gltf.buffers;
    // Adjust the attribute accessor data
    var accessor = attributeAccessor;
    var bufferViewId = accessor.bufferView;
    var bufferView = bufferViews[bufferViewId];
    var bufferId = bufferView.buffer;
    var buffer = buffers[bufferId];
    var source = buffer.extras._pipeline.source;
    var byteOffset = bufferView.byteOffset + accessor.byteOffset;
    var byteStride = getAccessorByteStride(accessor);
    var usedPortionsLength = usedPortions.length;
    var offset = 0;
    accessor.count = 0;
    for (var i = 0; i < usedPortionsLength; i++) {
        var usedPortion = usedPortions[i];
        source.copy(source, byteOffset + offset * byteStride,
            byteOffset + usedPortion.start * byteStride,
            byteOffset + usedPortion.end * byteStride);
        offset = usedPortion.end;
        accessor.count += usedPortion.end - usedPortion.start;
    }
}