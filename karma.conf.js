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
            './node_modules/angular-mocks/angular-mocks.js',
            './src/index.js',
            './src/providers/markers/markers.module.js',
            './src/providers/markers/marker.js',
            './src/providers/markers/default.marker.js',
            './src/providers/markers/dom.marker.js',
            './src/providers/markers/svg.marker.js',
            './src/providers/markers/markers.service.js',
            './src/providers/components/components.module.js',
            './src/providers/components/events/events.js',
            './src/providers/components/events/infobubble.js',
            './src/providers/components/ui/ui.js',
            './src/heremaps.directive.js',
            './src/providers/mapconfig.provider.js',
            './src/providers/api.service.js',
            './src/providers/maputils.service.js',
            './src//providers/consts.js',
            './tests/**/*.js'
        ],

        preprocessors: {
            './src/index.js': ['browserify'],
            './src/providers/markers/markers.module.js':  ['browserify'],
            './src/providers/components/components.module.js':  ['browserify']
        },

        browserify: {
            debug: true,
            transform: ['browserify-istanbul']
        },

        colors: true,
        logLevel: config.LOG_INFO,
        
        plugins : [
            'karma-browserify',
            'karma-jasmine',
            'karma-mocha-reporter',
            'karma-phantomjs-launcher',
            'karma-chrome-launcher',
            'karma-coverage'
        ],

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
