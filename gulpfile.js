/**
 * Created by Dmytro on 3/27/2016.
 */
var browserify = require('browserify'),
    gulp = require('gulp'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    stringify = require('stringify'),
    config = require('./package.json');

/* pathConfig*/
var entryPoint = config["source-folder"] + '/' + config.main,
    jsWatchPath = config["source-folder"] + '**/*.js';
/**/

gulp.task('build', function () {
    return browserify(entryPoint, {debug: true})
        .bundle()
        .pipe(source('angular-heremaps.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/'))
});

gulp.task('watch', function () {
    gulp.watch(jsWatchPath, ['build']);
});

gulp.task('run', ['build', 'watch']);

gulp.task('default', ['build']);
