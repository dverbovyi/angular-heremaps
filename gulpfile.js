/**
 * Created by Dmytro on 3/27/2016.
 */
var browserify = require('browserify'),
    gulp = require('gulp'),
    source = require('vinyl-source-stream'),
    minify = require('gulp-minify'),
    buffer = require('vinyl-buffer'),
    config = require('./package.json'),
    argv = require('yargs').argv,
    browserSync = require("browser-sync").create();

/* pathConfig*/
var entryPoint = './src/index.js',
    browserDir = './',
    jsWatchPath = './src/**/*.js';
/**/

gulp.task('browser-sync', function () {
    browserSync.init({
        server: {
            baseDir: browserDir
        }
    });
});

gulp.task('build', function () {
    return browserify(entryPoint, { debug: true })
        .bundle()
        .pipe(source('angular-heremaps.js'))
        .pipe(buffer())
        .pipe(minify({
            ext: {
                min: '.min.js'
            },
        }))
        .pipe(gulp.dest('./dist/'))
        .pipe(browserSync.reload({ stream: true }));
});

gulp.task('serve', ['build', 'browser-sync'], function () {
    gulp.watch(jsWatchPath, ['build']).on('change', browserSync.reload);
    gulp.watch("index.html").on('change', browserSync.reload);
})

gulp.task('default', ['build']);
