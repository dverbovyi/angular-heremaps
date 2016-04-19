(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function(
    $window,
    Config,
    APIService,
    UtilsService,
    MarkersService,
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

            var _resizeMap = UtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT);

            $window.addEventListener('resize', _resizeMap);

            $scope.$on('$destory', function(){
                $window.removeEventListener('resize', _resizeMap);
            });


            function _apiReady() {
                // TODO: Move to separate function - _SetupMap
                $scope.heremaps.platform = new H.service.Platform(Config);

                $scope.heremaps.layers = $scope.heremaps.platform.createDefaultLayers();

                // TODO: Zoom level and center should be configurable
                $scope.heremaps.map = new H.Map($element[0], $scope.heremaps.layers.normal.map, {
                    zoom: 10,
                    center: new H.geo.Point(52.5, 13.4)
                });

                _loadModules();

            }

            //TODO: should has been refactored/ use $attrs.$attr directly
            function _loadModules() {

                // APIService.loadModule($attrs.$attr, {
                //     "control": _uiModuleReady,
                //     "pano": _panoModuleReady
                // })

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
            //

            function _uiModuleReady() {
                // TODO: Use $scope.heremaps.ui.component
                $scope.uiComponent = H.ui.UI.createDefault($scope.heremaps.map, $scope.heremaps.layers);
            }

            function _panoModuleReady() {
                //$scope.heremaps.platform.configure(H.map.render.panorama.RenderEngine);
            }

            function _eventsModuleReady() {
                var map = $scope.heremaps.map,
                    events = $scope.heremaps.mapEvents = new H.mapevents.MapEvents(map),
                    behavior = $scope.heremaps.behavior = new H.mapevents.Behavior(events);

                map.addEventListener('tap', function(evt) {
                    console.log(evt.type, evt.currentPointer.type);
                });

                // disable the default draggability of the underlying map
                // when starting to drag a marker object:
                map.addEventListener('dragstart', function(ev) {
                    var target = ev.target;
                    if (target instanceof H.map.Marker) {
                        behavior.disable();
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

                // re-enable the default draggability of the underlying map
                // when dragging has completed
                map.addEventListener('dragend', function(ev) {
                    var target = ev.target;
                    if (target instanceof mapsjs.map.Marker) {
                        behavior.enable();
                    }
                }, false);

                MarkersService.addMarkerToMap($scope.heremaps, $scope.places);

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

        }
    }
};
},{}],2:[function(require,module,exports){
require('./providers/markers/markers.module');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/config.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/utils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module'
]);

heremaps.provider('Config', configProvider)
    .service('APIService', apiService)
    .service('UtilsService', utilsService)
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
},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/config.provider":4,"./providers/consts":5,"./providers/markers/markers.module":9,"./providers/utils.service":11}],3:[function(require,module,exports){
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
        // TODO: Instead of id you can check global properties
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
},{}],4:[function(require,module,exports){
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
},{}],5:[function(require,module,exports){
module.exports = {
    "UPDATE_MAP_RESIZE_TIMEOUT": 500,
    "DEFAULT_MAP_SIZE": {
        HEIGHT: 480,
        WIDTH: 640
    }
}
},{}],6:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function DefaultMarker(place){
        this.place = place;
        this.setCoords();
    }

    // TODO: Object create should have pollyfill
    var proto = DefaultMarker.prototype = Object.create(MarkerInterface.prototype);
    proto.constructor = DefaultMarker;

    proto.create = function(){
        return new H.map.Marker(this.coords);
    }

    return DefaultMarker;
}
},{}],7:[function(require,module,exports){
module.exports = function(MarkerInterface){
    // TODO: Public methods should be placed first and implementation detail moved bottom

    function DOMMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DOMMarker.prototype = Object.create(MarkerInterface.prototype);
    proto.constructor = DOMMarker;

    proto.create = function(){
        return new H.map.DomMarker(this.coords, {
            icon: this._getIcon(),
        });
    };

    proto._getIcon = function(){
        var icon = this.place.icon;
        console.log(this.place)
         if(!icon)
            throw new Error('Icon missed');

        return new H.map.DomIcon(icon, this._getEvents());
    };

    proto._setupEvents = function(el, events, remove){
        var method = remove ? 'removeEventListener' : 'addEventListener';

        for(var key in events) {
            if(!events.hasOwnProperty(key))
                continue;

            el[method].call(null, key, events[key]);
        }
    };

    proto._getEvents = function(){
        var self = this,
            events = this.place.events;

        if(!this.place.events)
            return {};

        return {
            // the function is called every time marker enters the viewport
            onAttach: function(clonedElement, domIcon, domMarker){
                self._setupEvents(clonedElement, events);
            },
             // the function is called every time marker leaves the viewport
            onDetach: function(clonedElement, domIcon, domMarker){
                self._setupEvents(clonedElement, events, true);
            }
        }
    };

    return DOMMarker;
}
},{}],8:[function(require,module,exports){
module.exports = function(){
    function Marker(){
        throw new Error('Abstract class! The Instance should be created');
    }
    
    var proto = Marker.prototype;
    
    proto.create = function(){ throw new Error('getInstance:: not implemented'); };
    
    proto.setCoords = function(){
        this.coords = {
            lat: this.place.pos.lat,
            lng: this.place.pos.lng
        }
    }
    
    return Marker;
    
}
},{}],9:[function(require,module,exports){
var markerInterface = require('./marker.js'),
	defaultMarker = require('./default.marker.js'),
	domMarker = require('./dom.marker.js'),
// 	svgMarker = require('./svg.marker.js'),
    markersService = require('./markers.service.js');

angular.module('marker-interface', []).factory('MarkerInterface', markerInterface);
angular.module('default-marker', []).factory('DefaultMarker', defaultMarker);
angular.module('dom-marker', []).factory('DOMMarker', domMarker);
// // angular.module('svg-marker', []).factory('SVGMarker', svgMarker);

angular.module('markers-service', []).service('MarkersService', markersService);

var app = angular.module('markers-module', [
	'marker-interface',
    'default-marker',
    'dom-marker',
    'markers-service'
//     // 'svg-marker'
]);//.run(function(DefaultMarker){//, DOMMarker, SVGMarker){

// });

module.exports = app;
},{"./default.marker.js":6,"./dom.marker.js":7,"./marker.js":8,"./markers.service.js":10}],10:[function(require,module,exports){
module.exports = function(DefaultMarker, DOMMarker) {
    // TODO: Should be placed in const file
    var MARKER_TYPES = {
        DEFAULT: 0,
        DOM: 1,
        SVG: 2
    };

    return {
        addMarkerToMap: addMarkerToMap
    }

    // TODO: You should pass only MAP instead of full heremaps obj
    function addMarkerToMap(heremaps, places) {
        console.log(heremaps);
        var map = heremaps.map;
        console.log(places)

        // TODO: LENGTH
        if (!places)
            return false;

        if (!(map instanceof H.Map))
            throw new Error('Unsupported map instance');

        console.log(places)
        places.forEach(function(place, i) {
            var creator = _getMarkerCreator(place);
            var marker = place.draggable ? _draggableMarkerMixin(creator.create()) : creator.create();

            map.addObject(marker);
        });

    }

    function _getMarkerCreator(place) {
        var ConcreteMarker;

        switch(place.type) {
            case MARKER_TYPES.DOM:
                ConcreteMarker = DOMMarker;
                break;
            case MARKER_TYPES.SVG:
                ConcreteMarker = SVGMarker;
                break;
            default:
                ConcreteMarker = DefaultMarker;
        }

        return new ConcreteMarker(place);
    }

    function _draggableMarkerMixin(marker) {
        // Ensure that the marker can receive drag events
        marker.draggable = true;

        return marker;
    }

};
},{}],11:[function(require,module,exports){
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


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2hlcmVtYXBzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvYXBpLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL2NvbmZpZy5wcm92aWRlci5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RlZmF1bHQubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RvbS5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvdXRpbHMuc2VydmljZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJhbmd1bGFyLWhlcmVtYXBzLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcclxuICogQ3JlYXRlZCBieSBEbXl0cm8gb24gNC8xMS8yMDE2LlxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihcclxuICAgICR3aW5kb3csXHJcbiAgICBDb25maWcsXHJcbiAgICBBUElTZXJ2aWNlLFxyXG4gICAgVXRpbHNTZXJ2aWNlLFxyXG4gICAgTWFya2Vyc1NlcnZpY2UsXHJcbiAgICBDT05TVFMpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgICAgdGVtcGxhdGU6IFwiPGRpdiBuZy1zdHlsZT1cXFwieyd3aWR0aCc6IHdpZHRoLCAnaGVpZ2h0JzogaGVpZ2h0fVxcXCI+PC9kaXY+XCIsXHJcbiAgICAgICAgcmVwbGFjZTogdHJ1ZSxcclxuICAgICAgICBzY29wZToge1xyXG4gICAgICAgICAgICBwbGFjZXM6ICc9J1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XHJcbiAgICAgICAgICAgICRzY29wZS5tb2R1bGVzID0ge1xyXG4gICAgICAgICAgICAgICAgY29udHJvbHM6ICEhJGF0dHJzLiRhdHRyLmNvbnRyb2xzLFxyXG4gICAgICAgICAgICAgICAgcGFubzogISEkYXR0cnMuJGF0dHIucGFubyxcclxuICAgICAgICAgICAgICAgIGV2ZW50czogISEkYXR0cnMuJGF0dHIuZXZlbnRzXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEFwaUNvcmUoKS50aGVuKF9hcGlSZWFkeSk7XHJcblxyXG4gICAgICAgICAgICBfc2V0TWFwU2l6ZSgpO1xyXG5cclxuICAgICAgICAgICAgdmFyIF9yZXNpemVNYXAgPSBVdGlsc1NlcnZpY2UudGhyb3R0bGUoX3Jlc2l6ZUhhbmRsZXIsIENPTlNUUy5VUERBVEVfTUFQX1JFU0laRV9USU1FT1VUKTtcclxuXHJcbiAgICAgICAgICAgICR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX3Jlc2l6ZU1hcCk7XHJcblxyXG4gICAgICAgICAgICAkc2NvcGUuJG9uKCckZGVzdG9yeScsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9yZXNpemVNYXApO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBNb3ZlIHRvIHNlcGFyYXRlIGZ1bmN0aW9uIC0gX1NldHVwTWFwXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKENvbmZpZyk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLmxheWVycyA9ICRzY29wZS5oZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogWm9vbSBsZXZlbCBhbmQgY2VudGVyIHNob3VsZCBiZSBjb25maWd1cmFibGVcclxuICAgICAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcy5tYXAgPSBuZXcgSC5NYXAoJGVsZW1lbnRbMF0sICRzY29wZS5oZXJlbWFwcy5sYXllcnMubm9ybWFsLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHpvb206IDEwLFxyXG4gICAgICAgICAgICAgICAgICAgIGNlbnRlcjogbmV3IEguZ2VvLlBvaW50KDUyLjUsIDEzLjQpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBfbG9hZE1vZHVsZXMoKTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vVE9ETzogc2hvdWxkIGhhcyBiZWVuIHJlZmFjdG9yZWQvIHVzZSAkYXR0cnMuJGF0dHIgZGlyZWN0bHlcclxuICAgICAgICAgICAgZnVuY3Rpb24gX2xvYWRNb2R1bGVzKCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEFQSVNlcnZpY2UubG9hZE1vZHVsZSgkYXR0cnMuJGF0dHIsIHtcclxuICAgICAgICAgICAgICAgIC8vICAgICBcImNvbnRyb2xcIjogX3VpTW9kdWxlUmVhZHksXHJcbiAgICAgICAgICAgICAgICAvLyAgICAgXCJwYW5vXCI6IF9wYW5vTW9kdWxlUmVhZHlcclxuICAgICAgICAgICAgICAgIC8vIH0pXHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCRzY29wZS5tb2R1bGVzLmNvbnRyb2xzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkVUlNb2R1bGUoKS50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfdWlNb2R1bGVSZWFkeSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmICgkc2NvcGUubW9kdWxlcy5wYW5vKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkUGFub01vZHVsZSgpLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF9wYW5vTW9kdWxlUmVhZHkoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoJHNjb3BlLm1vZHVsZXMuZXZlbnRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkRXZlbnRzTW9kdWxlKCkudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX2V2ZW50c01vZHVsZVJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vXHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfdWlNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIC8vIFRPRE86IFVzZSAkc2NvcGUuaGVyZW1hcHMudWkuY29tcG9uZW50XHJcbiAgICAgICAgICAgICAgICAkc2NvcGUudWlDb21wb25lbnQgPSBILnVpLlVJLmNyZWF0ZURlZmF1bHQoJHNjb3BlLmhlcmVtYXBzLm1hcCwgJHNjb3BlLmhlcmVtYXBzLmxheWVycyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9wYW5vTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICAvLyRzY29wZS5oZXJlbWFwcy5wbGF0Zm9ybS5jb25maWd1cmUoSC5tYXAucmVuZGVyLnBhbm9yYW1hLlJlbmRlckVuZ2luZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9ldmVudHNNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBtYXAgPSAkc2NvcGUuaGVyZW1hcHMubWFwLFxyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50cyA9ICRzY29wZS5oZXJlbWFwcy5tYXBFdmVudHMgPSBuZXcgSC5tYXBldmVudHMuTWFwRXZlbnRzKG1hcCksXHJcbiAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IgPSAkc2NvcGUuaGVyZW1hcHMuYmVoYXZpb3IgPSBuZXcgSC5tYXBldmVudHMuQmVoYXZpb3IoZXZlbnRzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGRpc2FibGUgdGhlIGRlZmF1bHQgZHJhZ2dhYmlsaXR5IG9mIHRoZSB1bmRlcmx5aW5nIG1hcFxyXG4gICAgICAgICAgICAgICAgLy8gd2hlbiBzdGFydGluZyB0byBkcmFnIGEgbWFya2VyIG9iamVjdDpcclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWhhdmlvci5kaXNhYmxlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIExpc3RlbiB0byB0aGUgZHJhZyBldmVudCBhbmQgbW92ZSB0aGUgcG9zaXRpb24gb2YgdGhlIG1hcmtlclxyXG4gICAgICAgICAgICAgICAgLy8gYXMgbmVjZXNzYXJ5XHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZycsIGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV2LnRhcmdldCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRlciA9IGV2LmN1cnJlbnRQb2ludGVyO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBtYXBzanMubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQuc2V0UG9zaXRpb24obWFwLnNjcmVlblRvR2VvKHBvaW50ZXIudmlld3BvcnRYLCBwb2ludGVyLnZpZXdwb3J0WSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyByZS1lbmFibGUgdGhlIGRlZmF1bHQgZHJhZ2dhYmlsaXR5IG9mIHRoZSB1bmRlcmx5aW5nIG1hcFxyXG4gICAgICAgICAgICAgICAgLy8gd2hlbiBkcmFnZ2luZyBoYXMgY29tcGxldGVkXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV2LnRhcmdldDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgbWFwc2pzLm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IuZW5hYmxlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIE1hcmtlcnNTZXJ2aWNlLmFkZE1hcmtlclRvTWFwKCRzY29wZS5oZXJlbWFwcywgJHNjb3BlLnBsYWNlcyk7XHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcmVzaXplSGFuZGxlcigpIHtcclxuICAgICAgICAgICAgICAgIF9zZXRNYXBTaXplKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLm1hcC5nZXRWaWV3UG9ydCgpLnJlc2l6ZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSAkd2luZG93LmlubmVySGVpZ2h0IHx8IENPTlNUUy5ERUZBVUxUX01BUF9TSVpFLkhFSUdIVCxcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aCA9ICR3aW5kb3cuaW5uZXJXaWR0aCB8fCBDT05TVFMuREVGQVVMVF9NQVBfU0laRS5XSURUSDtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICRzY29wZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcclxuXHJcbiAgICAgICAgICAgICAgICBVdGlsc1NlcnZpY2UucnVuU2NvcGVEaWdlc3RJZk5lZWQoJHNjb3BlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07IiwicmVxdWlyZSgnLi9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXJzLm1vZHVsZScpO1xyXG5cclxudmFyIGRpcmVjdGl2ZSA9IHJlcXVpcmUoJy4vaGVyZW1hcHMuZGlyZWN0aXZlJyksXHJcbiAgICBjb25maWdQcm92aWRlciA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbmZpZy5wcm92aWRlcicpLFxyXG4gICAgYXBpU2VydmljZSA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2FwaS5zZXJ2aWNlJyksXHJcbiAgICB1dGlsc1NlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy91dGlscy5zZXJ2aWNlJyksXHJcbiAgICBjb25zdHMgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25zdHMnKTtcclxuXHJcbnZhciBoZXJlbWFwcyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcycsIFtcclxuICAgICdtYXJrZXJzLW1vZHVsZSdcclxuXSk7XHJcblxyXG5oZXJlbWFwcy5wcm92aWRlcignQ29uZmlnJywgY29uZmlnUHJvdmlkZXIpXHJcbiAgICAuc2VydmljZSgnQVBJU2VydmljZScsIGFwaVNlcnZpY2UpXHJcbiAgICAuc2VydmljZSgnVXRpbHNTZXJ2aWNlJywgdXRpbHNTZXJ2aWNlKVxyXG4gICAgLmNvbnN0YW50KCdDT05TVFMnLCBjb25zdHMpXHJcblxyXG5oZXJlbWFwcy5kaXJlY3RpdmUoJ2hlcmVNYXBzJywgZGlyZWN0aXZlKTtcclxuXHJcbmhlcmVtYXBzLmNvbmZpZyhbXCJDb25maWdQcm92aWRlclwiLCBmdW5jdGlvbihDb25maWdQcm92aWRlcikge1xyXG4gICAgQ29uZmlnUHJvdmlkZXIuc2V0T3B0aW9ucyh7XHJcbiAgICAgICAgJ2FwaVZlcnNpb24nOiAnMy4wJyxcclxuICAgICAgICAnYXBwX2lkJzogJ3dNSEp1TGdDUXprZmJoelhJd1JGJyxcclxuICAgICAgICAnYXBwX2NvZGUnOiAnV0xJYzdRem9POGlydjdsdXJVdDFxQScsXHJcbiAgICAgICAgJ3VzZUhUVFBTJzogdHJ1ZVxyXG4gICAgfSk7XHJcbn1dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaGVyZW1hcHM7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcSwgQ29uZmlnLCBVdGlsc1NlcnZpY2Upe1xyXG4gICAgdmFyIHZlcnNpb24gPSBDb25maWcuYXBpVmVyc2lvbixcclxuICAgICAgICBBUElfVkVSU0lPTiA9IHtcclxuICAgICAgICAgICAgVjogcGFyc2VJbnQodmVyc2lvbiksXHJcbiAgICAgICAgICAgIFNVQjogdmVyc2lvblxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQ09ORklHID0ge1xyXG4gICAgICAgICAgICBCQVNFOiBcImh0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdlwiLFxyXG4gICAgICAgICAgICBDT1JFOiBcIm1hcHNqcy1jb3JlLmpzXCIsXHJcbiAgICAgICAgICAgIFNFUlZJQ0U6IFwibWFwc2pzLXNlcnZpY2UuanNcIixcclxuICAgICAgICAgICAgVUk6IHtcclxuICAgICAgICAgICAgICAgIHNyYzogXCJtYXBzanMtdWkuanNcIixcclxuICAgICAgICAgICAgICAgIGhyZWY6IFwibWFwc2pzLXVpLmNzc1wiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFBBTk86IFwibWFwc2pzLXBhbm8uanNcIixcclxuICAgICAgICAgICAgRVZFTlRTOiBcIm1hcHNqcy1tYXBldmVudHMuanNcIlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsb2FkQXBpQ29yZTogbG9hZEFwaUNvcmUsXHJcbiAgICAgICAgbG9hZFVJTW9kdWxlOiBsb2FkVUlNb2R1bGUsXHJcbiAgICAgICAgbG9hZFBhbm9Nb2R1bGU6IGxvYWRQYW5vTW9kdWxlLFxyXG4gICAgICAgIGxvYWRFdmVudHNNb2R1bGU6IGxvYWRFdmVudHNNb2R1bGVcclxuICAgIH07XHJcblxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gbG9hZEFwaUNvcmUoKXtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuQ09SRSlcclxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlNFUlZJQ0UpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZFVJTW9kdWxlKCl7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XHJcbiAgICAgICAgICAgIHJlbDogJ3N0eWxlc2hlZXQnLFxyXG4gICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxyXG4gICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKSxcclxuICAgICAgICAgICAgaWQ6IENPTkZJRy5VSS5ocmVmXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlVJLnNyYyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZFBhbm9Nb2R1bGUoKXtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuUEFOTyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZEV2ZW50c01vZHVsZSgpe1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX2dldFVSTChzb3VyY2VOYW1lKXtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICAgICAgQ09ORklHLkJBU0UsXHJcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTi5WLFxyXG4gICAgICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXHJcbiAgICAgICAgICAgICAgICBcIi9cIixcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICAgICAgXS5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXIoc291cmNlTmFtZSl7XHJcbiAgICAgICAgLy8gVE9ETzogSW5zdGVhZCBvZiBpZCB5b3UgY2FuIGNoZWNrIGdsb2JhbCBwcm9wZXJ0aWVzXHJcbiAgICAgICAgdmFyIHNyYyA9IF9nZXRVUkwoc291cmNlTmFtZSksXHJcbiAgICAgICAgICAgIGNvcmVTY3JpcHQgPSBVdGlsc1NlcnZpY2UuY3JlYXRlU2NyaXB0VGFnKHtcclxuICAgICAgICAgICAgICAgIHNyYzogc3JjLFxyXG4gICAgICAgICAgICAgICAgaWQ6IHNvdXJjZU5hbWVcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xyXG4gICAgICAgICAgICBpZighY29yZVNjcmlwdCkge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChjb3JlU2NyaXB0KTtcclxuXHJcbiAgICAgICAgICAgIGNvcmVTY3JpcHQub25sb2FkID0gcmVzb2x2ZTtcclxuICAgICAgICAgICAgY29yZVNjcmlwdC5vbmVycm9yID0gcmVqZWN0O1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xyXG4gICAgdmFyIERFRkFVTFRfQVBJX1ZFUlNJT04gPSBcIjMuMFwiO1xyXG5cclxuICAgIHRoaXMuJGdldCA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgYXBwX2lkOiBvcHRpb25zLmFwcF9pZCxcclxuICAgICAgICAgICAgYXBwX2NvZGU6IG9wdGlvbnMuYXBwX2NvZGUsXHJcbiAgICAgICAgICAgIGFwaVZlcnNpb246IG9wdGlvbnMuYXBpVmVyc2lvbiB8fCBERUZBVUxUX0FQSV9WRVJTSU9OLFxyXG4gICAgICAgICAgICB1c2VIVFRQUzogb3B0aW9ucy51c2VIVFRQU1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5zZXRPcHRpb25zID0gZnVuY3Rpb24ob3B0cyl7XHJcbiAgICAgICAgb3B0aW9ucyA9IG9wdHM7XHJcbiAgICB9O1xyXG59OyIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgXCJVUERBVEVfTUFQX1JFU0laRV9USU1FT1VUXCI6IDUwMCxcclxuICAgIFwiREVGQVVMVF9NQVBfU0laRVwiOiB7XHJcbiAgICAgICAgSEVJR0hUOiA0ODAsXHJcbiAgICAgICAgV0lEVEg6IDY0MFxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRGVmYXVsdE1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gVE9ETzogT2JqZWN0IGNyZWF0ZSBzaG91bGQgaGF2ZSBwb2xseWZpbGxcclxuICAgIHZhciBwcm90byA9IERlZmF1bHRNYXJrZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShNYXJrZXJJbnRlcmZhY2UucHJvdG90eXBlKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRGVmYXVsdE1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gRGVmYXVsdE1hcmtlcjtcclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIC8vIFRPRE86IFB1YmxpYyBtZXRob2RzIHNob3VsZCBiZSBwbGFjZWQgZmlyc3QgYW5kIGltcGxlbWVudGF0aW9uIGRldGFpbCBtb3ZlZCBib3R0b21cclxuXHJcbiAgICBmdW5jdGlvbiBET01NYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERPTU1hcmtlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKE1hcmtlckludGVyZmFjZS5wcm90b3R5cGUpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBET01NYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gZnVuY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkRvbU1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLl9nZXRJY29uKCksXHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RvLl9nZXRJY29uID0gZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UuaWNvbjtcclxuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLnBsYWNlKVxyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJY29uIG1pc3NlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkRvbUljb24oaWNvbiwgdGhpcy5fZ2V0RXZlbnRzKCkpO1xyXG4gICAgfTtcclxuXHJcbiAgICBwcm90by5fc2V0dXBFdmVudHMgPSBmdW5jdGlvbihlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RvLl9nZXRFdmVudHMgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICAgICAgZXZlbnRzID0gdGhpcy5wbGFjZS5ldmVudHM7XHJcblxyXG4gICAgICAgIGlmKCF0aGlzLnBsYWNlLmV2ZW50cylcclxuICAgICAgICAgICAgcmV0dXJuIHt9O1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAvLyB0aGUgZnVuY3Rpb24gaXMgY2FsbGVkIGV2ZXJ5IHRpbWUgbWFya2VyIGVudGVycyB0aGUgdmlld3BvcnRcclxuICAgICAgICAgICAgb25BdHRhY2g6IGZ1bmN0aW9uKGNsb25lZEVsZW1lbnQsIGRvbUljb24sIGRvbU1hcmtlcil7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zZXR1cEV2ZW50cyhjbG9uZWRFbGVtZW50LCBldmVudHMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgLy8gdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCBldmVyeSB0aW1lIG1hcmtlciBsZWF2ZXMgdGhlIHZpZXdwb3J0XHJcbiAgICAgICAgICAgIG9uRGV0YWNoOiBmdW5jdGlvbihjbG9uZWRFbGVtZW50LCBkb21JY29uLCBkb21NYXJrZXIpe1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fc2V0dXBFdmVudHMoY2xvbmVkRWxlbWVudCwgZXZlbnRzLCB0cnVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIERPTU1hcmtlcjtcclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcclxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MhIFRoZSBJbnN0YW5jZSBzaG91bGQgYmUgY3JlYXRlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBNYXJrZXIucHJvdG90eXBlO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBmdW5jdGlvbigpeyB0aHJvdyBuZXcgRXJyb3IoJ2dldEluc3RhbmNlOjogbm90IGltcGxlbWVudGVkJyk7IH07XHJcbiAgICBcclxuICAgIHByb3RvLnNldENvb3JkcyA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdGhpcy5jb29yZHMgPSB7XHJcbiAgICAgICAgICAgIGxhdDogdGhpcy5wbGFjZS5wb3MubGF0LFxyXG4gICAgICAgICAgICBsbmc6IHRoaXMucGxhY2UucG9zLmxuZ1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIE1hcmtlcjtcclxuICAgIFxyXG59IiwidmFyIG1hcmtlckludGVyZmFjZSA9IHJlcXVpcmUoJy4vbWFya2VyLmpzJyksXHJcblx0ZGVmYXVsdE1hcmtlciA9IHJlcXVpcmUoJy4vZGVmYXVsdC5tYXJrZXIuanMnKSxcclxuXHRkb21NYXJrZXIgPSByZXF1aXJlKCcuL2RvbS5tYXJrZXIuanMnKSxcclxuLy8gXHRzdmdNYXJrZXIgPSByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSxcclxuICAgIG1hcmtlcnNTZXJ2aWNlID0gcmVxdWlyZSgnLi9tYXJrZXJzLnNlcnZpY2UuanMnKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXItaW50ZXJmYWNlJywgW10pLmZhY3RvcnkoJ01hcmtlckludGVyZmFjZScsIG1hcmtlckludGVyZmFjZSk7XHJcbmFuZ3VsYXIubW9kdWxlKCdkZWZhdWx0LW1hcmtlcicsIFtdKS5mYWN0b3J5KCdEZWZhdWx0TWFya2VyJywgZGVmYXVsdE1hcmtlcik7XHJcbmFuZ3VsYXIubW9kdWxlKCdkb20tbWFya2VyJywgW10pLmZhY3RvcnkoJ0RPTU1hcmtlcicsIGRvbU1hcmtlcik7XHJcbi8vIC8vIGFuZ3VsYXIubW9kdWxlKCdzdmctbWFya2VyJywgW10pLmZhY3RvcnkoJ1NWR01hcmtlcicsIHN2Z01hcmtlcik7XHJcblxyXG5hbmd1bGFyLm1vZHVsZSgnbWFya2Vycy1zZXJ2aWNlJywgW10pLnNlcnZpY2UoJ01hcmtlcnNTZXJ2aWNlJywgbWFya2Vyc1NlcnZpY2UpO1xyXG5cclxudmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLW1vZHVsZScsIFtcclxuXHQnbWFya2VyLWludGVyZmFjZScsXHJcbiAgICAnZGVmYXVsdC1tYXJrZXInLFxyXG4gICAgJ2RvbS1tYXJrZXInLFxyXG4gICAgJ21hcmtlcnMtc2VydmljZSdcclxuLy8gICAgIC8vICdzdmctbWFya2VyJ1xyXG5dKTsvLy5ydW4oZnVuY3Rpb24oRGVmYXVsdE1hcmtlcil7Ly8sIERPTU1hcmtlciwgU1ZHTWFya2VyKXtcclxuXHJcbi8vIH0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhcHA7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihEZWZhdWx0TWFya2VyLCBET01NYXJrZXIpIHtcclxuICAgIC8vIFRPRE86IFNob3VsZCBiZSBwbGFjZWQgaW4gY29uc3QgZmlsZVxyXG4gICAgdmFyIE1BUktFUl9UWVBFUyA9IHtcclxuICAgICAgICBERUZBVUxUOiAwLFxyXG4gICAgICAgIERPTTogMSxcclxuICAgICAgICBTVkc6IDJcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJUb01hcDogYWRkTWFya2VyVG9NYXBcclxuICAgIH1cclxuXHJcbiAgICAvLyBUT0RPOiBZb3Ugc2hvdWxkIHBhc3Mgb25seSBNQVAgaW5zdGVhZCBvZiBmdWxsIGhlcmVtYXBzIG9ialxyXG4gICAgZnVuY3Rpb24gYWRkTWFya2VyVG9NYXAoaGVyZW1hcHMsIHBsYWNlcykge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGhlcmVtYXBzKTtcclxuICAgICAgICB2YXIgbWFwID0gaGVyZW1hcHMubWFwO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHBsYWNlcylcclxuXHJcbiAgICAgICAgLy8gVE9ETzogTEVOR1RIXHJcbiAgICAgICAgaWYgKCFwbGFjZXMpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgaWYgKCEobWFwIGluc3RhbmNlb2YgSC5NYXApKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG1hcCBpbnN0YW5jZScpO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhwbGFjZXMpXHJcbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24ocGxhY2UsIGkpIHtcclxuICAgICAgICAgICAgdmFyIGNyZWF0b3IgPSBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSk7XHJcbiAgICAgICAgICAgIHZhciBtYXJrZXIgPSBwbGFjZS5kcmFnZ2FibGUgPyBfZHJhZ2dhYmxlTWFya2VyTWl4aW4oY3JlYXRvci5jcmVhdGUoKSkgOiBjcmVhdG9yLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgbWFwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSkge1xyXG4gICAgICAgIHZhciBDb25jcmV0ZU1hcmtlcjtcclxuXHJcbiAgICAgICAgc3dpdGNoKHBsYWNlLnR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBTVkdNYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRGVmYXVsdE1hcmtlcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcclxuICAgICAgICAvLyBFbnN1cmUgdGhhdCB0aGUgbWFya2VyIGNhbiByZWNlaXZlIGRyYWcgZXZlbnRzXHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHJvb3RTY29wZSwgJHRpbWVvdXQpe1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB0aHJvdHRsZTogdGhyb3R0bGUsXHJcbiAgICAgICAgY3JlYXRlU2NyaXB0VGFnOiBjcmVhdGVTY3JpcHRUYWcsXHJcbiAgICAgICAgY3JlYXRlTGlua1RhZzogY3JlYXRlTGlua1RhZyxcclxuICAgICAgICBydW5TY29wZURpZ2VzdElmTmVlZDogcnVuU2NvcGVEaWdlc3RJZk5lZWRcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2Qpe1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgaWYoJHRpbWVvdXQpXHJcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNjcmlwdFRhZyhhdHRycyl7XHJcbiAgICAgICAgaWYoYXR0cnMuaWQgJiYgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaWQpKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcclxuICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xyXG5cclxuICAgICAgICBfc2V0QXR0cnMoc2NyaXB0LCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xyXG4gICAgICAgIGlmKGF0dHJzLmlkICYmIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmlkKSlcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcclxuXHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGxpbms7XHJcbiAgICB9XHJcbiAgICAvLyNlbmRyZWdpb24gUFVCTElDIFxyXG5cclxuICAgIC8vI3JlZ2lvbiBQUklWQVRFXHJcbiAgICBmdW5jdGlvbiBfc2V0QXR0cnMoZWwsIGF0dHJzKSB7XHJcbiAgICAgICAgaWYoIWVsIHx8ICFhdHRycylcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzZWQgYXR0cmlidXRlcycpO1xyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBhdHRycykge1xyXG4gICAgICAgICAgICBpZighYXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgZWxba2V5XSA9IGF0dHJzW2tleV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyJdfQ==
