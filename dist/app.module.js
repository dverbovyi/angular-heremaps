(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function($scope){
    $scope.markers = [
        {
            pos: {lat: 52.508249, lng: 13.338931},
            draggable: true
        },
        {
            pos: {lat: 52.506682, lng: 13.332107}
        },
        {
            pos: {lat: 52.503730, lng: 13.331678}
        },
        {
            pos: {lat: 52.531, lng: 13.380}
        }
    ]
};
},{}],2:[function(require,module,exports){

require('./heremaps/heremaps.module');

var controller = require('./app.controller')

var app = angular.module('app', [
    "heremaps"
]);

app.controller('AppCtrl', controller);

module.exports = app;
    


},{"./app.controller":1,"./heremaps/heremaps.module":4}],3:[function(require,module,exports){
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
    MarkersFactory,
    CONSTS) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': width, 'height': height}\"></div>",
        replace: true,
        scope: {
            places: '='
        },
        controller: function($scope, $element, $attrs) {
            $scope.modules = {
                controls: !!$attrs.$attr.controls,
                pano: !!$attrs.$attr.pano,
                events: !!$attrs.$attr.events
            };

            $scope.heremaps = {};

            APIService.loadApiCore().then(_apiReady);

            _setMapSize();

            $window.addEventListener('resize', UtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT));

            function _apiReady() {
                if ($element.html())
                    $element.empty();

                $scope.heremaps.platform = new H.service.Platform(Config);

                $scope.heremaps.layers = $scope.heremaps.platform.createDefaultLayers();

                $scope.heremaps.map = new H.Map($element[0], $scope.heremaps.layers.normal.map, {
                    zoom: 10,
                    center: new H.geo.Point(52.5, 13.4)
                });

                _loadModules();

            }

            //TODO: should has been refactored
            function _loadModules() {
                if ($scope.modules.controls) {
                    APIService.loadUIModule().then(function() {
                        _uiModuleReady();
                    });
                }

                if ($scope.modules.pano) {
                    APIService.loadPanoModule().then(function() {
                        _panoModuleReady();
                    });
                }

                if ($scope.modules.events) {
                    APIService.loadEventsModule().then(function() {
                        _eventsModuleReady();
                    });
                }

            }

            function _uiModuleReady() {
                $scope.uiComponent = H.ui.UI.createDefault($scope.heremaps.map, $scope.heremaps.layers);
            }

            function _panoModuleReady() {
                //$scope.platform.configure(H.map.render.panorama.RenderEngine);
            }

            function _eventsModuleReady() {
                var map = $scope.heremaps.map;
                
                var events = $scope.heremaps.mapEvents = new H.mapevents.MapEvents(map);

                map.addEventListener('tap', function(evt) {
                    console.log(evt.type, evt.currentPointer.type);
                });

                map.addEventListener('dragstart', function(evt) {
                    console.log(evt.type, evt.currentPointer.type);
                });

                map.addEventListener('drag', function(evt) {
                    console.log(evt.type, evt.currentPointer.type);
                });

                $scope.heremaps.behavior = new H.mapevents.Behavior(events);
                
                MarkersFactory.addMarkerToMap($scope.heremaps, $scope.places);

            }

            function _resizeHandler() {
                _setMapSize();
                
                $scope.heremaps.map.getViewPort().resize();
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
},{}],4:[function(require,module,exports){
var directive = require('./heremaps.directive'),
    configProvider = require('./providers/config.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/utils.service'),
    markersFactory = require('./providers/markers.factory.js'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', []);

heremaps.provider('Config', configProvider)
    .service('APIService', apiService)
    .service('UtilsService', utilsService)
    .factory('MarkersFactory', markersFactory)
    .constant('CONSTS', consts)

heremaps.directive('hereMaps', directive);

heremaps.config(["ConfigProvider", function(ConfigProvider) {
    ConfigProvider.setOptions({
        'apiVersion': '3.0',
        'app_id': 'wMHJuLgCQzkfbhzXIwRF',
        'app_code': 'WLIc7QzoO8irv7lurUt1qA',
        'useHTTPS': true
    });
}]);

module.exports = heremaps;
},{"./heremaps.directive":3,"./providers/api.service":5,"./providers/config.provider":6,"./providers/consts":7,"./providers/markers.factory.js":8,"./providers/utils.service":9}],5:[function(require,module,exports){
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
},{}],6:[function(require,module,exports){
module.exports = function() {
    var options = {};
    var DEFAULT_API_VERSION = "3.0";

    this.$get = function(){
        return {
            app_id: options.app_id,
            app_code: options.app_code,
            apiVersion: options.apiVersion || DEFAULT_API_VERSION,
            useHTTPS: options.useHTTPS
        }
    };

    this.setOptions = function(opts){
        options = opts;
    };
};
},{}],7:[function(require,module,exports){
module.exports = {
    "UPDATE_MAP_RESIZE_TIMEOUT": 500,
    "DEFAULT_MAP_SIZE": {
        HEIGHT: 480,
        WIDTH: 640
    }
}
},{}],8:[function(require,module,exports){
module.exports = function() {
    var MARKERS_TYPE = {

    }

    return {
        createMarker: createMarker,
        addMarkerToMap: addMarkerToMap
    }

    function createMarker(type) {
        return
    }

    function addMarkerToMap(heremaps, places) {
        console.log(heremaps);
        var map = heremaps.map;

        if (!places)
            return false;

        if (!(map instanceof H.Map))
            throw new Error('Unsupported map instance');

        places.forEach(function(place) {
            var marker = new H.map.Marker({
                lat: place.pos.lat,
                lng: place.pos.lng
            });
            
           //draggableMarkerMixin(heremaps, marker)
            
            map.addObject(marker);
        });

    }

    //TODO: should has been improved
    function draggableMarkerMixin(heremaps, marker) {
        console.log(heremaps)
        var map = heremaps.map,
            behavior = heremaps.behavior;
        
        // Ensure that the marker can receive drag events
        marker.draggable = true;

        // disable the default draggability of the underlying map
        // when starting to drag a marker object:
        map.addEventListener('dragstart', function(ev) {
            var target = ev.target;
            if (target instanceof H.map.Marker) {
                behavior.disable();
            }
        }, false);


        // re-enable the default draggability of the underlying map
        // when dragging has completed
        map.addEventListener('dragend', function(ev) {
            var target = ev.target;
            if (target instanceof mapsjs.map.Marker) {
                behavior.enable();
            }
        }, false);

        // Listen to the drag event and move the position of the marker
        // as necessary
        map.addEventListener('drag', function(ev) {
            var target = ev.target,
                pointer = ev.currentPointer;
            if (target instanceof mapsjs.map.Marker) {
                target.setPosition(map.screenToGeo(pointer.viewportX, pointer.viewportY));
            }
        }, false);
        
        return marker;
    }

};
},{}],9:[function(require,module,exports){
module.exports = function($rootScope, $timeout){
    return {
        throttle: throttle,
        createScriptTag: createScriptTag,
        createLinkTag: createLinkTag,
        runScopeDigestIfNeed: runScopeDigestIfNeed
    };
    
    //#region PUBLIC
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
    //#endregion PUBLIC 

    //#region PRIVATE
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
},{}]},{},[2])


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmNvbnRyb2xsZXIuanMiLCJzcmMvYXBwLm1vZHVsZS5qcyIsInNyYy9oZXJlbWFwcy9oZXJlbWFwcy5kaXJlY3RpdmUuanMiLCJzcmMvaGVyZW1hcHMvaGVyZW1hcHMubW9kdWxlLmpzIiwic3JjL2hlcmVtYXBzL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9oZXJlbWFwcy9wcm92aWRlcnMvY29uZmlnLnByb3ZpZGVyLmpzIiwic3JjL2hlcmVtYXBzL3Byb3ZpZGVycy9jb25zdHMuanMiLCJzcmMvaGVyZW1hcHMvcHJvdmlkZXJzL21hcmtlcnMuZmFjdG9yeS5qcyIsInNyYy9oZXJlbWFwcy9wcm92aWRlcnMvdXRpbHMuc2VydmljZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYXBwLm1vZHVsZS5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkc2NvcGUpe1xyXG4gICAgJHNjb3BlLm1hcmtlcnMgPSBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwb3M6IHtsYXQ6IDUyLjUwODI0OSwgbG5nOiAxMy4zMzg5MzF9LFxyXG4gICAgICAgICAgICBkcmFnZ2FibGU6IHRydWVcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcG9zOiB7bGF0OiA1Mi41MDY2ODIsIGxuZzogMTMuMzMyMTA3fVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwb3M6IHtsYXQ6IDUyLjUwMzczMCwgbG5nOiAxMy4zMzE2Nzh9XHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHBvczoge2xhdDogNTIuNTMxLCBsbmc6IDEzLjM4MH1cclxuICAgICAgICB9XHJcbiAgICBdXHJcbn07IiwiXHJcbnJlcXVpcmUoJy4vaGVyZW1hcHMvaGVyZW1hcHMubW9kdWxlJyk7XHJcblxyXG52YXIgY29udHJvbGxlciA9IHJlcXVpcmUoJy4vYXBwLmNvbnRyb2xsZXInKVxyXG5cclxudmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdhcHAnLCBbXHJcbiAgICBcImhlcmVtYXBzXCJcclxuXSk7XHJcblxyXG5hcHAuY29udHJvbGxlcignQXBwQ3RybCcsIGNvbnRyb2xsZXIpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhcHA7XHJcbiAgICBcclxuXHJcbiIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IERteXRybyBvbiA0LzExLzIwMTYuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgICR3aW5kb3csXHJcbiAgICAkdGltZW91dCxcclxuICAgIENvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBVdGlsc1NlcnZpY2UsXHJcbiAgICBNYXJrZXJzRmFjdG9yeSxcclxuICAgIENPTlNUUykge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogd2lkdGgsICdoZWlnaHQnOiBoZWlnaHR9XFxcIj48L2Rpdj5cIixcclxuICAgICAgICByZXBsYWNlOiB0cnVlLFxyXG4gICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgIHBsYWNlczogJz0nXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICAgICAgJHNjb3BlLm1vZHVsZXMgPSB7XHJcbiAgICAgICAgICAgICAgICBjb250cm9sczogISEkYXR0cnMuJGF0dHIuY29udHJvbHMsXHJcbiAgICAgICAgICAgICAgICBwYW5vOiAhISRhdHRycy4kYXR0ci5wYW5vLFxyXG4gICAgICAgICAgICAgICAgZXZlbnRzOiAhISRhdHRycy4kYXR0ci5ldmVudHNcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcyA9IHt9O1xyXG5cclxuICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkQXBpQ29yZSgpLnRoZW4oX2FwaVJlYWR5KTtcclxuXHJcbiAgICAgICAgICAgIF9zZXRNYXBTaXplKCk7XHJcblxyXG4gICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIFV0aWxzU2VydmljZS50aHJvdHRsZShfcmVzaXplSGFuZGxlciwgQ09OU1RTLlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQpKTtcclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9hcGlSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIGlmICgkZWxlbWVudC5odG1sKCkpXHJcbiAgICAgICAgICAgICAgICAgICAgJGVsZW1lbnQuZW1wdHkoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKENvbmZpZyk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLmxheWVycyA9ICRzY29wZS5oZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLm1hcCA9IG5ldyBILk1hcCgkZWxlbWVudFswXSwgJHNjb3BlLmhlcmVtYXBzLmxheWVycy5ub3JtYWwubWFwLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgem9vbTogMTAsXHJcbiAgICAgICAgICAgICAgICAgICAgY2VudGVyOiBuZXcgSC5nZW8uUG9pbnQoNTIuNSwgMTMuNClcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIF9sb2FkTW9kdWxlcygpO1xyXG5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy9UT0RPOiBzaG91bGQgaGFzIGJlZW4gcmVmYWN0b3JlZFxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfbG9hZE1vZHVsZXMoKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoJHNjb3BlLm1vZHVsZXMuY29udHJvbHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRVSU1vZHVsZSgpLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF91aU1vZHVsZVJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCRzY29wZS5tb2R1bGVzLnBhbm8pIHtcclxuICAgICAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRQYW5vTW9kdWxlKCkudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX3Bhbm9Nb2R1bGVSZWFkeSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmICgkc2NvcGUubW9kdWxlcy5ldmVudHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRFdmVudHNNb2R1bGUoKS50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfZXZlbnRzTW9kdWxlUmVhZHkoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF91aU1vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLnVpQ29tcG9uZW50ID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KCRzY29wZS5oZXJlbWFwcy5tYXAsICRzY29wZS5oZXJlbWFwcy5sYXllcnMpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcGFub01vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgLy8kc2NvcGUucGxhdGZvcm0uY29uZmlndXJlKEgubWFwLnJlbmRlci5wYW5vcmFtYS5SZW5kZXJFbmdpbmUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gJHNjb3BlLmhlcmVtYXBzLm1hcDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGV2ZW50cyA9ICRzY29wZS5oZXJlbWFwcy5tYXBFdmVudHMgPSBuZXcgSC5tYXBldmVudHMuTWFwRXZlbnRzKG1hcCk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uKGV2dCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGV2dC50eXBlLCBldnQuY3VycmVudFBvaW50ZXIudHlwZSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnJywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcy5iZWhhdmlvciA9IG5ldyBILm1hcGV2ZW50cy5CZWhhdmlvcihldmVudHMpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBNYXJrZXJzRmFjdG9yeS5hZGRNYXJrZXJUb01hcCgkc2NvcGUuaGVyZW1hcHMsICRzY29wZS5wbGFjZXMpO1xyXG5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoKSB7XHJcbiAgICAgICAgICAgICAgICBfc2V0TWFwU2l6ZSgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXRNYXBTaXplKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGhlaWdodCA9ICR3aW5kb3cuaW5uZXJIZWlnaHQgfHwgQ09OU1RTLkRFRkFVTFRfTUFQX1NJWkUuSEVJR0hULFxyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoID0gJHdpbmRvdy5pbm5lcldpZHRoIHx8IENPTlNUUy5ERUZBVUxUX01BUF9TSVpFLldJRFRIO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5oZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLndpZHRoID0gd2lkdGggKyAncHgnO1xyXG5cclxuICAgICAgICAgICAgICAgIFV0aWxzU2VydmljZS5ydW5TY29wZURpZ2VzdElmTmVlZCgkc2NvcGUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbGluazogZnVuY3Rpb24oc2NvcGUpIHsgfVxyXG4gICAgfVxyXG59OyIsInZhciBkaXJlY3RpdmUgPSByZXF1aXJlKCcuL2hlcmVtYXBzLmRpcmVjdGl2ZScpLFxyXG4gICAgY29uZmlnUHJvdmlkZXIgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25maWcucHJvdmlkZXInKSxcclxuICAgIGFwaVNlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9hcGkuc2VydmljZScpLFxyXG4gICAgdXRpbHNTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvdXRpbHMuc2VydmljZScpLFxyXG4gICAgbWFya2Vyc0ZhY3RvcnkgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXJrZXJzLmZhY3RvcnkuanMnKSxcclxuICAgIGNvbnN0cyA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbnN0cycpO1xyXG5cclxudmFyIGhlcmVtYXBzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzJywgW10pO1xyXG5cclxuaGVyZW1hcHMucHJvdmlkZXIoJ0NvbmZpZycsIGNvbmZpZ1Byb3ZpZGVyKVxyXG4gICAgLnNlcnZpY2UoJ0FQSVNlcnZpY2UnLCBhcGlTZXJ2aWNlKVxyXG4gICAgLnNlcnZpY2UoJ1V0aWxzU2VydmljZScsIHV0aWxzU2VydmljZSlcclxuICAgIC5mYWN0b3J5KCdNYXJrZXJzRmFjdG9yeScsIG1hcmtlcnNGYWN0b3J5KVxyXG4gICAgLmNvbnN0YW50KCdDT05TVFMnLCBjb25zdHMpXHJcblxyXG5oZXJlbWFwcy5kaXJlY3RpdmUoJ2hlcmVNYXBzJywgZGlyZWN0aXZlKTtcclxuXHJcbmhlcmVtYXBzLmNvbmZpZyhbXCJDb25maWdQcm92aWRlclwiLCBmdW5jdGlvbihDb25maWdQcm92aWRlcikge1xyXG4gICAgQ29uZmlnUHJvdmlkZXIuc2V0T3B0aW9ucyh7XHJcbiAgICAgICAgJ2FwaVZlcnNpb24nOiAnMy4wJyxcclxuICAgICAgICAnYXBwX2lkJzogJ3dNSEp1TGdDUXprZmJoelhJd1JGJyxcclxuICAgICAgICAnYXBwX2NvZGUnOiAnV0xJYzdRem9POGlydjdsdXJVdDFxQScsXHJcbiAgICAgICAgJ3VzZUhUVFBTJzogdHJ1ZVxyXG4gICAgfSk7XHJcbn1dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaGVyZW1hcHM7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcSwgQ29uZmlnLCBVdGlsc1NlcnZpY2Upe1xyXG4gICAgdmFyIHZlcnNpb24gPSBDb25maWcuYXBpVmVyc2lvbixcclxuICAgICAgICBBUElfVkVSU0lPTiA9IHtcclxuICAgICAgICAgICAgVjogcGFyc2VJbnQodmVyc2lvbiksXHJcbiAgICAgICAgICAgIFNVQjogdmVyc2lvblxyXG4gICAgICAgIH0sIFxyXG4gICAgICAgIENPTkZJRyA9IHtcclxuICAgICAgICAgICAgQkFTRTogXCJodHRwOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICAgICAgQ09SRTogXCJtYXBzanMtY29yZS5qc1wiLFxyXG4gICAgICAgICAgICBTRVJWSUNFOiBcIm1hcHNqcy1zZXJ2aWNlLmpzXCIsXHJcbiAgICAgICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgICAgICBzcmM6IFwibWFwc2pzLXVpLmpzXCIsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBcIm1hcHNqcy11aS5jc3NcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBQQU5POiBcIm1hcHNqcy1wYW5vLmpzXCIsXHJcbiAgICAgICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcclxuICAgICAgICB9LCBcclxuICAgICAgICBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsb2FkQXBpQ29yZTogbG9hZEFwaUNvcmUsXHJcbiAgICAgICAgbG9hZFVJTW9kdWxlOiBsb2FkVUlNb2R1bGUsXHJcbiAgICAgICAgbG9hZFBhbm9Nb2R1bGU6IGxvYWRQYW5vTW9kdWxlLFxyXG4gICAgICAgIGxvYWRFdmVudHNNb2R1bGU6IGxvYWRFdmVudHNNb2R1bGVcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vI3JlZ2lvbiBQVUJMSUMgXHJcbiAgICBmdW5jdGlvbiBsb2FkQXBpQ29yZSgpe1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5DT1JFKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbG9hZFVJTW9kdWxlKCl7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XHJcbiAgICAgICAgICAgIHJlbDogJ3N0eWxlc2hlZXQnLFxyXG4gICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxyXG4gICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKSxcclxuICAgICAgICAgICAgaWQ6IENPTkZJRy5VSS5ocmVmXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBsb2FkUGFub01vZHVsZSgpe1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5QQU5PKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbG9hZEV2ZW50c01vZHVsZSgpe1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX2dldFVSTChzb3VyY2VOYW1lKXtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICAgICAgQ09ORklHLkJBU0UsXHJcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTi5WLFxyXG4gICAgICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXHJcbiAgICAgICAgICAgICAgICBcIi9cIixcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICAgICAgXS5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyKHNvdXJjZU5hbWUpe1xyXG4gICAgICAgIHZhciBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxyXG4gICAgICAgICAgICBjb3JlU2NyaXB0ID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7XHJcbiAgICAgICAgICAgICAgICBzcmM6IHNyYyxcclxuICAgICAgICAgICAgICAgIGlkOiBzb3VyY2VOYW1lXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcclxuICAgICAgICAgICAgaWYoIWNvcmVTY3JpcHQpIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoY29yZVNjcmlwdCk7XHJcblxyXG4gICAgICAgICAgICBjb3JlU2NyaXB0Lm9ubG9hZCA9IHJlc29sdmU7XHJcbiAgICAgICAgICAgIGNvcmVTY3JpcHQub25lcnJvciA9IHJlamVjdDtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFwiVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVFwiOiA1MDAsXHJcbiAgICBcIkRFRkFVTFRfTUFQX1NJWkVcIjoge1xyXG4gICAgICAgIEhFSUdIVDogNDgwLFxyXG4gICAgICAgIFdJRFRIOiA2NDBcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgTUFSS0VSU19UWVBFID0ge1xyXG5cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGNyZWF0ZU1hcmtlcjogY3JlYXRlTWFya2VyLFxyXG4gICAgICAgIGFkZE1hcmtlclRvTWFwOiBhZGRNYXJrZXJUb01hcFxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZU1hcmtlcih0eXBlKSB7XHJcbiAgICAgICAgcmV0dXJuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkTWFya2VyVG9NYXAoaGVyZW1hcHMsIHBsYWNlcykge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGhlcmVtYXBzKTtcclxuICAgICAgICB2YXIgbWFwID0gaGVyZW1hcHMubWFwO1xyXG5cclxuICAgICAgICBpZiAoIXBsYWNlcylcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBILk1hcCkpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgIHBsYWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHBsYWNlKSB7XHJcbiAgICAgICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHtcclxuICAgICAgICAgICAgICAgIGxhdDogcGxhY2UucG9zLmxhdCxcclxuICAgICAgICAgICAgICAgIGxuZzogcGxhY2UucG9zLmxuZ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgLy9kcmFnZ2FibGVNYXJrZXJNaXhpbihoZXJlbWFwcywgbWFya2VyKVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbWFwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICAvL1RPRE86IHNob3VsZCBoYXMgYmVlbiBpbXByb3ZlZFxyXG4gICAgZnVuY3Rpb24gZHJhZ2dhYmxlTWFya2VyTWl4aW4oaGVyZW1hcHMsIG1hcmtlcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGhlcmVtYXBzKVxyXG4gICAgICAgIHZhciBtYXAgPSBoZXJlbWFwcy5tYXAsXHJcbiAgICAgICAgICAgIGJlaGF2aW9yID0gaGVyZW1hcHMuYmVoYXZpb3I7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gRW5zdXJlIHRoYXQgdGhlIG1hcmtlciBjYW4gcmVjZWl2ZSBkcmFnIGV2ZW50c1xyXG4gICAgICAgIG1hcmtlci5kcmFnZ2FibGUgPSB0cnVlO1xyXG5cclxuICAgICAgICAvLyBkaXNhYmxlIHRoZSBkZWZhdWx0IGRyYWdnYWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBtYXBcclxuICAgICAgICAvLyB3aGVuIHN0YXJ0aW5nIHRvIGRyYWcgYSBtYXJrZXIgb2JqZWN0OlxyXG4gICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgSC5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICBiZWhhdmlvci5kaXNhYmxlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG5cclxuICAgICAgICAvLyByZS1lbmFibGUgdGhlIGRlZmF1bHQgZHJhZ2dhYmlsaXR5IG9mIHRoZSB1bmRlcmx5aW5nIG1hcFxyXG4gICAgICAgIC8vIHdoZW4gZHJhZ2dpbmcgaGFzIGNvbXBsZXRlZFxyXG4gICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV2LnRhcmdldDtcclxuICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG1hcHNqcy5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICBiZWhhdmlvci5lbmFibGUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgLy8gTGlzdGVuIHRvIHRoZSBkcmFnIGV2ZW50IGFuZCBtb3ZlIHRoZSBwb3NpdGlvbiBvZiB0aGUgbWFya2VyXHJcbiAgICAgICAgLy8gYXMgbmVjZXNzYXJ5XHJcbiAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWcnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0LFxyXG4gICAgICAgICAgICAgICAgcG9pbnRlciA9IGV2LmN1cnJlbnRQb2ludGVyO1xyXG4gICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgbWFwc2pzLm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgIHRhcmdldC5zZXRQb3NpdGlvbihtYXAuc2NyZWVuVG9HZW8ocG9pbnRlci52aWV3cG9ydFgsIHBvaW50ZXIudmlld3BvcnRZKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCBmYWxzZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcm9vdFNjb3BlLCAkdGltZW91dCl7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRocm90dGxlOiB0aHJvdHRsZSxcclxuICAgICAgICBjcmVhdGVTY3JpcHRUYWc6IGNyZWF0ZVNjcmlwdFRhZyxcclxuICAgICAgICBjcmVhdGVMaW5rVGFnOiBjcmVhdGVMaW5rVGFnLFxyXG4gICAgICAgIHJ1blNjb3BlRGlnZXN0SWZOZWVkOiBydW5TY29wZURpZ2VzdElmTmVlZFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gdGhyb3R0bGUoZm4sIHBlcmlvZCl7XHJcbiAgICAgICAgdmFyIHRpbWVvdXQgPSBudWxsO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICBpZigkdGltZW91dClcclxuICAgICAgICAgICAgICAgICR0aW1lb3V0LmNhbmNlbCh0aW1lb3V0KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aW1lb3V0ID0gJHRpbWVvdXQoZm4sIHBlcmlvZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBydW5TY29wZURpZ2VzdElmTmVlZChzY29wZSwgY2IpIHtcclxuICAgICAgICBpZiAoc2NvcGUuJHJvb3QgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRhcHBseScgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRkaWdlc3QnKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLiRkaWdlc3QoY2IgfHwgYW5ndWxhci5ub29wKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlU2NyaXB0VGFnKGF0dHJzKXtcclxuICAgICAgICBpZihhdHRycy5pZCAmJiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5pZCkpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xyXG4gICAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XHJcblxyXG4gICAgICAgIF9zZXRBdHRycyhzY3JpcHQsIGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHNjcmlwdDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVMaW5rVGFnKGF0dHJzKSB7XHJcbiAgICAgICAgaWYoYXR0cnMuaWQgJiYgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaWQpKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpO1xyXG5cclxuICAgICAgICBfc2V0QXR0cnMobGluaywgYXR0cnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gbGluaztcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUMgXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcclxuICAgICAgICBpZighZWwgfHwgIWF0dHJzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGF0dHJzKSB7XHJcbiAgICAgICAgICAgIGlmKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFtrZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07Il19
