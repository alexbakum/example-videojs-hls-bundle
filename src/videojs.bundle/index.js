var vtt = require('vtt.js');
global.WebVTT = vtt.WebVTT;
global.VTTCue = vtt.VTTCue;
global.VTTRegion = vtt.VTTRegion;
global.pkcs7 = require('pkcs7'); // required for hls plugin
global.videojs = require('videojs/video-js');
global.Hls = require('hls.js/src/hls.js');

// persistent volume
require('videojs-persistvolume');
// Google Analytics
require('videojs-ga');
// hls playback
require('contrib/media-sources');
require('contrib/hls/videojs-hls');
require('contrib/hls/stream');
require('contrib/hls/flv-tag');
require('contrib/hls/exp-golomb');
require('contrib/hls/h264-extradata');
require('contrib/hls/h264-stream');
require('contrib/hls/aac-stream');
require('contrib/hls/metadata-stream');
require('contrib/hls/segment-parser');
require('contrib/hls/m3u8/m3u8-parser');
require('contrib/hls/xhr');
require('contrib/hls/playlist');
require('contrib/hls/playlist-loader');
require('contrib/hls/decrypter');
require('videojs/videojs-hlsjs.js');

// Google IMA
require('videojs-ima');

