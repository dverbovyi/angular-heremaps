/**
 * Created by Dmytro on 3/27/2016.
 */
var browserify = require('browserify'),
    gulp = require('gulp'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    config = require('./package.json');

/* pathConfig*/
var entryPoint = './src/index.js',
    jsWatchPath = './src/**/*.js';
/**/

gulp.task('build', function () {
    return browserify(entryPoint, {debug: true})
        .bundle()
        .pipe(source('angular-heremaps.js'))
        .pipe(buffer())
        .pipe(gulp.dest('./dist/'))
});

gulp.task('watch', function () {
    gulp.watch(jsWatchPath, ['build']);
});

gulp.task('run', ['build']);

gulp.task('default', ['build']);
