var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var gutil = require('gulp-util');
var path = require('path');

gulp.task('js:videojs-bundle', function () {
    browserify('./src/videojs.hls/index.js', {})
        .bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source('videojs.hls.bundle.js'))
        .pipe(gulp.dest('./dist/js'));
});
gulp.task('js:copy-videojs-vtt.js', function() {
    gulp.src(path.dirname(require.resolve('video.js')) + '/../../node_modules/vtt.js/dist/vtt.min.js')
        .pipe(gulp.dest('dist/js'));
});
gulp.task('js', ['js:videojs-bundle', 'js:copy-videojs-vtt.js']);

gulp.task('css:copy-videojs.min.css', function() {
    gulp.src(path.dirname(require.resolve('video.js')) + '/video-js.min.css')
        .pipe(gulp.dest('dist/css'));
});
gulp.task('css', ['css:copy-videojs.min.css']);

gulp.task('fonts:copy-videojs-font', function() {
    gulp.src(path.dirname(require.resolve('video.js')) + '/font/**')
        .pipe(gulp.dest('dist/css/font'));
});
gulp.task('fonts', ['fonts:copy-videojs-font']);

gulp.task('swf:copy-videojs-swf', function() {
    gulp.src('node_modules/videojs-swf/dist/*.swf')
        .pipe(gulp.dest('dist/swf'));
});
gulp.task('swf', ['swf:copy-videojs-swf']);

gulp.task('default', ['js', 'fonts', 'css', 'swf']);