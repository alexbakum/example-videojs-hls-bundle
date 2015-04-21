var vjs = require('video.js');
var pkcs7 = require('pkcs7');
global.pkcs7 = pkcs7;
require('../../node_modules/videojs-contrib-media-sources/src/videojs-media-sources.js');
require('../../node_modules/videojs-contrib-hls/src/videojs-hls.js');
require('../../node_modules/videojs-contrib-hls/src/stream.js');
require('../../node_modules/videojs-contrib-hls/src/flv-tag.js');
require('../../node_modules/videojs-contrib-hls/src/exp-golomb.js');
require('../../node_modules/videojs-contrib-hls/src/h264-stream.js');
require('../../node_modules/videojs-contrib-hls/src/aac-stream.js');
require('../../node_modules/videojs-contrib-hls/src/metadata-stream.js');
require('../../node_modules/videojs-contrib-hls/src/segment-parser.js');
require('../../node_modules/videojs-contrib-hls/src/m3u8/m3u8-parser.js');
require('../../node_modules/videojs-contrib-hls/src/xhr.js');
require('../../node_modules/videojs-contrib-hls/src/playlist-loader.js');
require('../../node_modules/videojs-contrib-hls/src/decrypter.js');

module.exports = vjs;