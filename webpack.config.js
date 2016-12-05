module.exports = {
    entry: './index.js',
    externals: {
        cesium: 'Cesium',
        fs: 'fs',
        jimp: 'jimp',
        yargs: 'yargs'
    },
    output: {
        filename: 'bundle.js',
        path: './dist'
    }
};