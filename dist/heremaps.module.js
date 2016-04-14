(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = function($q, Config, UtilsService){
    var version = Config.apiVersion,
        API_VERSION = {
            V: parseInt(version),
            SUB: version
        }, 
        CONFIG = {
            BASE: "http://js.api.here.com/v",
            CORE: "mapsjs-core.js",
            SERVICE: "mapsjs-service.js",
            UI: {
                src: "mapsjs-ui.js",
                href: "mapsjs-ui.css"
            },
            PANO: "mapsjs-pano.js",
            EVENTS: "mapsjs-mapevents.js"
        }, 
        head = document.getElementsByTagName('head')[0];
    
    return {
        loadApiCore: loadApiCore,
        loadUIModule: loadUIModule,
        loadPanoModule: loadPanoModule,
        loadEventsModule: loadEventsModule
    };
    
    //#region PUBLIC 
    function loadApiCore(){
        return _getLoader(CONFIG.CORE)
                .then(function(){
                    return _getLoader(CONFIG.SERVICE);
                });
    }
    
    function loadUIModule(){
        var link = UtilsService.createLinkTag({
            rel: 'stylesheet',
            type: 'text/css',
            href: _getURL(CONFIG.UI.href),
            id: CONFIG.UI.href
        });

        link && head.appendChild(link);
                
        return _getLoader(CONFIG.UI.src);
    }
    
    function loadPanoModule(){
        return _getLoader(CONFIG.PANO);
    }
    
    function loadEventsModule(){
        return _getLoader(CONFIG.EVENTS);
    }
    //#endregion PUBLIC


    //#region PRIVATE
    function _getURL(sourceName){
        return [
                CONFIG.BASE,
                API_VERSION.V,
                "/",
                API_VERSION.SUB,
                "/",
                sourceName
            ].join("");
    }
    
    function _getLoader(sourceName){
        var src = _getURL(sourceName),
            coreScript = UtilsService.createScriptTag({
                src: src,
                id: sourceName
            });

        return $q(function(resolve, reject){
            if(!coreScript) {
                resolve();
                return true;
            }
            head.appendChild(coreScript);

            coreScript.onload = resolve;
            coreScript.onerror = reject;
        });
    }
};
},{}],2:[function(require,module,exports){
module.exports = function() {
    var options = {};
    var DEFAULT_API_VERSION = "3.0";

    this.$get = function(){
        return {
            app_id: options.app_id,
            app_code: options.app_code,
            apiVersion: options.apiVersion || DEFAULT_API_VERSION,
            useHTTPS: true
        }
    };

    this.setOptions = function(opts){
        options = opts;
    };
};
},{}],3:[function(require,module,exports){
module.exports = {
    "UPDATE_MAP_RESIZE_TIMEOUT": 500,
    "DEFAULT_MAP_SIZE": {
        HEIGHT: 480,
        WIDTH: 640
    }
}
},{}],4:[function(require,module,exports){
module.exports = function($rootScope, $timeout){
    return {
        throttle: throttle,
        createScriptTag: createScriptTag,
        createLinkTag: createLinkTag,
        runScopeDigestIfNeed: runScopeDigestIfNeed
    };
    
    
    function throttle(fn, period){
        var timeout = null;
        
        return function(){
            if($timeout)
                $timeout.cancel(timeout);
                
            timeout = $timeout(fn, period);
        }
    }
    
    function runScopeDigestIfNeed(scope, cb) {
        if (scope.$root && scope.$root.$$phase !== '$apply' && scope.$root.$$phase !== '$digest') {
            scope.$digest(cb || angular.noop);
            return true;
        }
        return false;
    }
    
    function createScriptTag(attrs){
        if(attrs.id && document.getElementById(attrs.id))
            return false;

        var script = document.createElement('script');
        script.type = 'text/javascript';

        _setAttrs(script, attrs);

        return script;
    }

    function createLinkTag(attrs) {
        if(attrs.id && document.getElementById(attrs.id))
            return false;

        var link = document.createElement('link');

        _setAttrs(link, attrs);

        return link;
    }

    function _setAttrs(el, attrs) {
        if(!el || !attrs)
            throw new Error('Missed attributes');

        for(var key in attrs) {
            if(!attrs.hasOwnProperty(key))
                continue;

            el[key] = attrs[key];
        }
    }
};
},{}],5:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function(
    $rootScope,
    $window,
    $timeout,
    Config,
    APIService,
    UtilsService,
    CONSTS) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': width, 'height': height}\"></div>",
        replace: true,
        controller: function($scope, $element, $attrs) {
            $scope.modules = {
                controls: !!$attrs.$attr.controls,
                pano: !!$attrs.$attr.pano,
                events: !!$attrs.$attr.events
            };

            APIService.loadApiCore().then(_apiReady);

            _setMapSize();

            $window.addEventListener('resize', UtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT));

            function _apiReady() {
                if ($element.html())
                    $element.empty();

                $scope.platform = new H.service.Platform(Config);
                
                $scope.layers = $scope.platform.createDefaultLayers();
                

                $scope.map = new H.Map($element[0], $scope.layers.normal.map, {
                        zoom: 10,
                        center: new H.geo.Point(52.5, 13.4)
                        // engineType: H.Map.EngineType.PANORAMA
                    });

                _loadModules();
                
            }
            
            function _loadModules(){
                if($scope.modules.controls) {
                    APIService.loadUIModule().then(function(){
                        _uiModuleReady();
                    });
                }
                
                if($scope.modules.pano) {
                    APIService.loadPanoModule().then(function(){
                        _panoModuleReady();
                    });
                }
                
                if($scope.modules.events) {
                    APIService.loadEventsModule().then(function(){
                        _eventsModuleReady();
                    });
                }
                
            }
            
            function _uiModuleReady(){
                $scope.uiComponent = H.ui.UI.createDefault($scope.map, $scope.layers);
            }
            
            function _panoModuleReady(){
                console.log('pano ready')
                $scope.platform.configure(H.map.render.panorama.RenderEngine);
                
            }
            
            function _eventsModuleReady(){
                console.log('events ready')
                var mapEvents = new H.mapevents.MapEvents($scope.map);
                
                $scope.map.addEventListener('tap', function(evt) {
                    console.log(evt.type, evt.currentPointer.type); 
                });
                
                $scope.map.addEventListener('dragstart', function(evt){
                    console.log(evt.type, evt.currentPointer.type);
                })
                
                 $scope.map.addEventListener('drag', function(evt) {
                    console.log(evt.type, evt.currentPointer.type); 
                });
                
                var behavior = new H.mapevents.Behavior(mapEvents);
                
            }

            function _resizeHandler() {
                _setMapSize();
                $scope.map.getViewPort().resize();
            }

            function _setMapSize() {
                var height = $window.innerHeight || CONSTS.DEFAULT_MAP_SIZE.HEIGHT,
                    width = $window.innerWidth || CONSTS.DEFAULT_MAP_SIZE.WIDTH;

                $scope.height = height + 'px';
                $scope.width = width + 'px';
                
                UtilsService.runScopeDigestIfNeed($scope);
            }

        },
        link: function(scope) { }
    }
};
},{}],6:[function(require,module,exports){
(function () {
    'use strict';

    var directive = require('./heremaps.directive'),
        configProvider = require('./common/config.provider'),
        apiService = require('./common/api.service'),
        utilsService = require('./common/utils.service'),
        consts = require('./common/consts');

    angular.module('heremaps', [])
        .provider('Config', configProvider)
        .service('APIService', apiService)
        .service('UtilsService', utilsService)
        .constant('CONSTS', consts)
        .config(["ConfigProvider", function (ConfigProvider) {
            ConfigProvider.setOptions({
                'apiVersion': '3.0',
                'app_id': 'wMHJuLgCQzkfbhzXIwRF',
                'app_code': 'WLIc7QzoO8irv7lurUt1qA'
            });
        }])
        .directive('hereMaps', directive);
})();
},{"./common/api.service":1,"./common/config.provider":2,"./common/consts":3,"./common/utils.service":4,"./heremaps.directive":5}]},{},[6])


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29tbW9uL2FwaS5zZXJ2aWNlLmpzIiwic3JjL2NvbW1vbi9jb25maWcucHJvdmlkZXIuanMiLCJzcmMvY29tbW9uL2NvbnN0cy5qcyIsInNyYy9jb21tb24vdXRpbHMuc2VydmljZS5qcyIsInNyYy9oZXJlbWFwcy5kaXJlY3RpdmUuanMiLCJzcmMvaGVyZW1hcHMubW9kdWxlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJoZXJlbWFwcy5tb2R1bGUuanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8iLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHEsIENvbmZpZywgVXRpbHNTZXJ2aWNlKXtcclxuICAgIHZhciB2ZXJzaW9uID0gQ29uZmlnLmFwaVZlcnNpb24sXHJcbiAgICAgICAgQVBJX1ZFUlNJT04gPSB7XHJcbiAgICAgICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxyXG4gICAgICAgICAgICBTVUI6IHZlcnNpb25cclxuICAgICAgICB9LCBcclxuICAgICAgICBDT05GSUcgPSB7XHJcbiAgICAgICAgICAgIEJBU0U6IFwiaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92XCIsXHJcbiAgICAgICAgICAgIENPUkU6IFwibWFwc2pzLWNvcmUuanNcIixcclxuICAgICAgICAgICAgU0VSVklDRTogXCJtYXBzanMtc2VydmljZS5qc1wiLFxyXG4gICAgICAgICAgICBVSToge1xyXG4gICAgICAgICAgICAgICAgc3JjOiBcIm1hcHNqcy11aS5qc1wiLFxyXG4gICAgICAgICAgICAgICAgaHJlZjogXCJtYXBzanMtdWkuY3NzXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgUEFOTzogXCJtYXBzanMtcGFuby5qc1wiLFxyXG4gICAgICAgICAgICBFVkVOVFM6IFwibWFwc2pzLW1hcGV2ZW50cy5qc1wiXHJcbiAgICAgICAgfSwgXHJcbiAgICAgICAgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07XHJcbiAgICBcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbG9hZEFwaUNvcmU6IGxvYWRBcGlDb3JlLFxyXG4gICAgICAgIGxvYWRVSU1vZHVsZTogbG9hZFVJTW9kdWxlLFxyXG4gICAgICAgIGxvYWRQYW5vTW9kdWxlOiBsb2FkUGFub01vZHVsZSxcclxuICAgICAgICBsb2FkRXZlbnRzTW9kdWxlOiBsb2FkRXZlbnRzTW9kdWxlXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyNyZWdpb24gUFVCTElDIFxyXG4gICAgZnVuY3Rpb24gbG9hZEFwaUNvcmUoKXtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuQ09SRSlcclxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlNFUlZJQ0UpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGxvYWRVSU1vZHVsZSgpe1xyXG4gICAgICAgIHZhciBsaW5rID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZUxpbmtUYWcoe1xyXG4gICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgdHlwZTogJ3RleHQvY3NzJyxcclxuICAgICAgICAgICAgaHJlZjogX2dldFVSTChDT05GSUcuVUkuaHJlZiksXHJcbiAgICAgICAgICAgIGlkOiBDT05GSUcuVUkuaHJlZlxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBsaW5rICYmIGhlYWQuYXBwZW5kQ2hpbGQobGluayk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuVUkuc3JjKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbG9hZFBhbm9Nb2R1bGUoKXtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuUEFOTyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGxvYWRFdmVudHNNb2R1bGUoKXtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuRVZFTlRTKTtcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUNcclxuXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9nZXRVUkwoc291cmNlTmFtZSl7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgICAgIENPTkZJRy5CQVNFLFxyXG4gICAgICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICAgICAgQVBJX1ZFUlNJT04uU1VCLFxyXG4gICAgICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBzb3VyY2VOYW1lXHJcbiAgICAgICAgICAgIF0uam9pbihcIlwiKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlcihzb3VyY2VOYW1lKXtcclxuICAgICAgICB2YXIgc3JjID0gX2dldFVSTChzb3VyY2VOYW1lKSxcclxuICAgICAgICAgICAgY29yZVNjcmlwdCA9IFV0aWxzU2VydmljZS5jcmVhdGVTY3JpcHRUYWcoe1xyXG4gICAgICAgICAgICAgICAgc3JjOiBzcmMsXHJcbiAgICAgICAgICAgICAgICBpZDogc291cmNlTmFtZVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuICRxKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XHJcbiAgICAgICAgICAgIGlmKCFjb3JlU2NyaXB0KSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBoZWFkLmFwcGVuZENoaWxkKGNvcmVTY3JpcHQpO1xyXG5cclxuICAgICAgICAgICAgY29yZVNjcmlwdC5vbmxvYWQgPSByZXNvbHZlO1xyXG4gICAgICAgICAgICBjb3JlU2NyaXB0Lm9uZXJyb3IgPSByZWplY3Q7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBvcHRpb25zID0ge307XHJcbiAgICB2YXIgREVGQVVMVF9BUElfVkVSU0lPTiA9IFwiMy4wXCI7XHJcblxyXG4gICAgdGhpcy4kZ2V0ID0gZnVuY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBhcHBfaWQ6IG9wdGlvbnMuYXBwX2lkLFxyXG4gICAgICAgICAgICBhcHBfY29kZTogb3B0aW9ucy5hcHBfY29kZSxcclxuICAgICAgICAgICAgYXBpVmVyc2lvbjogb3B0aW9ucy5hcGlWZXJzaW9uIHx8IERFRkFVTFRfQVBJX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIHVzZUhUVFBTOiB0cnVlXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRzKXtcclxuICAgICAgICBvcHRpb25zID0gb3B0cztcclxuICAgIH07XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBcIlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVRcIjogNTAwLFxyXG4gICAgXCJERUZBVUxUX01BUF9TSVpFXCI6IHtcclxuICAgICAgICBIRUlHSFQ6IDQ4MCxcclxuICAgICAgICBXSURUSDogNjQwXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRyb290U2NvcGUsICR0aW1lb3V0KXtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxyXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxyXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXHJcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2Qpe1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgaWYoJHRpbWVvdXQpXHJcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNjcmlwdFRhZyhhdHRycyl7XHJcbiAgICAgICAgaWYoYXR0cnMuaWQgJiYgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaWQpKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcclxuICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xyXG5cclxuICAgICAgICBfc2V0QXR0cnMoc2NyaXB0LCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xyXG4gICAgICAgIGlmKGF0dHJzLmlkICYmIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmlkKSlcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcclxuXHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGxpbms7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xyXG4gICAgICAgIGlmKCFlbCB8fCAhYXR0cnMpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2VkIGF0dHJpYnV0ZXMnKTtcclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCIvKipcclxuICogQ3JlYXRlZCBieSBEbXl0cm8gb24gNC8xMS8yMDE2LlxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihcclxuICAgICRyb290U2NvcGUsXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHRpbWVvdXQsXHJcbiAgICBDb25maWcsXHJcbiAgICBBUElTZXJ2aWNlLFxyXG4gICAgVXRpbHNTZXJ2aWNlLFxyXG4gICAgQ09OU1RTKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiB3aWR0aCwgJ2hlaWdodCc6IGhlaWdodH1cXFwiPjwvZGl2PlwiLFxyXG4gICAgICAgIHJlcGxhY2U6IHRydWUsXHJcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XHJcbiAgICAgICAgICAgICRzY29wZS5tb2R1bGVzID0ge1xyXG4gICAgICAgICAgICAgICAgY29udHJvbHM6ICEhJGF0dHJzLiRhdHRyLmNvbnRyb2xzLFxyXG4gICAgICAgICAgICAgICAgcGFubzogISEkYXR0cnMuJGF0dHIucGFubyxcclxuICAgICAgICAgICAgICAgIGV2ZW50czogISEkYXR0cnMuJGF0dHIuZXZlbnRzXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRBcGlDb3JlKCkudGhlbihfYXBpUmVhZHkpO1xyXG5cclxuICAgICAgICAgICAgX3NldE1hcFNpemUoKTtcclxuXHJcbiAgICAgICAgICAgICR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgVXRpbHNTZXJ2aWNlLnRocm90dGxlKF9yZXNpemVIYW5kbGVyLCBDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCkpO1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2FwaVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCRlbGVtZW50Lmh0bWwoKSlcclxuICAgICAgICAgICAgICAgICAgICAkZWxlbWVudC5lbXB0eSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5wbGF0Zm9ybSA9IG5ldyBILnNlcnZpY2UuUGxhdGZvcm0oQ29uZmlnKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmxheWVycyA9ICRzY29wZS5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcbiAgICAgICAgICAgICAgICBcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUubWFwID0gbmV3IEguTWFwKCRlbGVtZW50WzBdLCAkc2NvcGUubGF5ZXJzLm5vcm1hbC5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgem9vbTogMTAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNlbnRlcjogbmV3IEguZ2VvLlBvaW50KDUyLjUsIDEzLjQpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuZ2luZVR5cGU6IEguTWFwLkVuZ2luZVR5cGUuUEFOT1JBTUFcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBfbG9hZE1vZHVsZXMoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfbG9hZE1vZHVsZXMoKXtcclxuICAgICAgICAgICAgICAgIGlmKCRzY29wZS5tb2R1bGVzLmNvbnRyb2xzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkVUlNb2R1bGUoKS50aGVuKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF91aU1vZHVsZVJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmKCRzY29wZS5tb2R1bGVzLnBhbm8pIHtcclxuICAgICAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRQYW5vTW9kdWxlKCkudGhlbihmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfcGFub01vZHVsZVJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmKCRzY29wZS5tb2R1bGVzLmV2ZW50cykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEV2ZW50c01vZHVsZSgpLnRoZW4oZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX2V2ZW50c01vZHVsZVJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKXtcclxuICAgICAgICAgICAgICAgICRzY29wZS51aUNvbXBvbmVudCA9IEgudWkuVUkuY3JlYXRlRGVmYXVsdCgkc2NvcGUubWFwLCAkc2NvcGUubGF5ZXJzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZnVuY3Rpb24gX3Bhbm9Nb2R1bGVSZWFkeSgpe1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3Bhbm8gcmVhZHknKVxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLnBsYXRmb3JtLmNvbmZpZ3VyZShILm1hcC5yZW5kZXIucGFub3JhbWEuUmVuZGVyRW5naW5lKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKXtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdldmVudHMgcmVhZHknKVxyXG4gICAgICAgICAgICAgICAgdmFyIG1hcEV2ZW50cyA9IG5ldyBILm1hcGV2ZW50cy5NYXBFdmVudHMoJHNjb3BlLm1hcCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTsgXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihldnQpe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGV2dC50eXBlLCBldnQuY3VycmVudFBvaW50ZXIudHlwZSk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgJHNjb3BlLm1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnJywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTsgXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKG1hcEV2ZW50cyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoKSB7XHJcbiAgICAgICAgICAgICAgICBfc2V0TWFwU2l6ZSgpO1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcC5nZXRWaWV3UG9ydCgpLnJlc2l6ZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSAkd2luZG93LmlubmVySGVpZ2h0IHx8IENPTlNUUy5ERUZBVUxUX01BUF9TSVpFLkhFSUdIVCxcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aCA9ICR3aW5kb3cuaW5uZXJXaWR0aCB8fCBDT05TVFMuREVGQVVMVF9NQVBfU0laRS5XSURUSDtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICRzY29wZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgVXRpbHNTZXJ2aWNlLnJ1blNjb3BlRGlnZXN0SWZOZWVkKCRzY29wZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgICBsaW5rOiBmdW5jdGlvbihzY29wZSkgeyB9XHJcbiAgICB9XHJcbn07IiwiKGZ1bmN0aW9uICgpIHtcclxuICAgICd1c2Ugc3RyaWN0JztcclxuXHJcbiAgICB2YXIgZGlyZWN0aXZlID0gcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSxcclxuICAgICAgICBjb25maWdQcm92aWRlciA9IHJlcXVpcmUoJy4vY29tbW9uL2NvbmZpZy5wcm92aWRlcicpLFxyXG4gICAgICAgIGFwaVNlcnZpY2UgPSByZXF1aXJlKCcuL2NvbW1vbi9hcGkuc2VydmljZScpLFxyXG4gICAgICAgIHV0aWxzU2VydmljZSA9IHJlcXVpcmUoJy4vY29tbW9uL3V0aWxzLnNlcnZpY2UnKSxcclxuICAgICAgICBjb25zdHMgPSByZXF1aXJlKCcuL2NvbW1vbi9jb25zdHMnKTtcclxuXHJcbiAgICBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMnLCBbXSlcclxuICAgICAgICAucHJvdmlkZXIoJ0NvbmZpZycsIGNvbmZpZ1Byb3ZpZGVyKVxyXG4gICAgICAgIC5zZXJ2aWNlKCdBUElTZXJ2aWNlJywgYXBpU2VydmljZSlcclxuICAgICAgICAuc2VydmljZSgnVXRpbHNTZXJ2aWNlJywgdXRpbHNTZXJ2aWNlKVxyXG4gICAgICAgIC5jb25zdGFudCgnQ09OU1RTJywgY29uc3RzKVxyXG4gICAgICAgIC5jb25maWcoW1wiQ29uZmlnUHJvdmlkZXJcIiwgZnVuY3Rpb24gKENvbmZpZ1Byb3ZpZGVyKSB7XHJcbiAgICAgICAgICAgIENvbmZpZ1Byb3ZpZGVyLnNldE9wdGlvbnMoe1xyXG4gICAgICAgICAgICAgICAgJ2FwaVZlcnNpb24nOiAnMy4wJyxcclxuICAgICAgICAgICAgICAgICdhcHBfaWQnOiAnd01ISnVMZ0NRemtmYmh6WEl3UkYnLFxyXG4gICAgICAgICAgICAgICAgJ2FwcF9jb2RlJzogJ1dMSWM3UXpvTzhpcnY3bHVyVXQxcUEnXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1dKVxyXG4gICAgICAgIC5kaXJlY3RpdmUoJ2hlcmVNYXBzJywgZGlyZWN0aXZlKTtcclxufSkoKTsiXX0=
