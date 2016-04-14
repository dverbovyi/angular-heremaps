/**
 * Created by Dmytro on 3/27/2016.
 */
var browserify = require('browserify'),
    gulp = require('gulp'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    stringify = require('stringify'),
    browserSync = require('browser-sync');

/* pathConfig*/
var entryPoint = './src/app.module.js',
    browserDir = './',
    jsWatchPath = './src/**/*.js',
    htmlWatchPath = './src/**/*.html';
/**/

gulp.task('build', function () {
    return browserify(entryPoint, {debug: true})
        .transform(stringify(['.tpl.html']))
        .bundle()
        .pipe(source('app.module.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/'))
        .pipe(browserSync.reload({stream: true}));
});

gulp.task('browser-sync', function () {
    const config = {
        server: {baseDir: browserDir}
    };

    return browserSync(config);
});

gulp.task('watch', function () {
    gulp.watch(jsWatchPath, ['build']);
    gulp.watch(htmlWatchPath, function () {
        return gulp.src('')
            .pipe(browserSync.reload({stream: true}))
    });
});

gulp.task('run', ['build', 'watch', 'browser-sync']);

gulp.task('default', ['js']);
