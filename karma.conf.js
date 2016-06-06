/**
 * Created by Dmytro on 4/26/2016.
 */
var istanbul = require('browserify-istanbul');

module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['browserify', 'jasmine'],

        files: [
            './node_modules/angular/angular.js',
            './src/*.js',
            './tests/*.js'
        ],

        preprocessors: {
            './src/*.js': ['browserify'],
            './tests/*.js': ['browserify']
        },

        browserify: {
            debug: true,
            transform: ['browserify-istanbul']
        },

        colors: true,
        logLevel: config.LOG_INFO,

        reporters: ['mocha', 'progress', 'coverage'],

        coverageReporter: {
            reporters: [{
                type: 'lcov',
                dir: 'coverage/'
            }, {
                type: 'text-summary'
            }]
        },

        browsers: ['PhantomJS'],
        // browsers: ['Chrome'],

        autoWatch: false,
        singleRun: true
    });
};
