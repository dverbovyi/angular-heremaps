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
        var icon = this.place.markup;
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
        var map = heremaps.map;

        // TODO: LENGTH
        if (!places)
            return false;

        if (!(map instanceof H.Map))
            throw new Error('Unsupported map instance');

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


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2hlcmVtYXBzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvYXBpLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL2NvbmZpZy5wcm92aWRlci5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RlZmF1bHQubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RvbS5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvdXRpbHMuc2VydmljZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYW5ndWxhci1oZXJlbWFwcy5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgRG15dHJvIG9uIDQvMTEvMjAxNi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oXHJcbiAgICAkd2luZG93LFxyXG4gICAgQ29uZmlnLFxyXG4gICAgQVBJU2VydmljZSxcclxuICAgIFV0aWxzU2VydmljZSxcclxuICAgIE1hcmtlcnNTZXJ2aWNlLFxyXG4gICAgQ09OU1RTKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiB3aWR0aCwgJ2hlaWdodCc6IGhlaWdodH1cXFwiPjwvZGl2PlwiLFxyXG4gICAgICAgIHJlcGxhY2U6IHRydWUsXHJcbiAgICAgICAgc2NvcGU6IHtcclxuICAgICAgICAgICAgcGxhY2VzOiAnPSdcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycykge1xyXG4gICAgICAgICAgICAkc2NvcGUubW9kdWxlcyA9IHtcclxuICAgICAgICAgICAgICAgIGNvbnRyb2xzOiAhISRhdHRycy4kYXR0ci5jb250cm9scyxcclxuICAgICAgICAgICAgICAgIHBhbm86ICEhJGF0dHJzLiRhdHRyLnBhbm8sXHJcbiAgICAgICAgICAgICAgICBldmVudHM6ICEhJGF0dHJzLiRhdHRyLmV2ZW50c1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzID0ge307XHJcblxyXG4gICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRBcGlDb3JlKCkudGhlbihfYXBpUmVhZHkpO1xyXG5cclxuICAgICAgICAgICAgX3NldE1hcFNpemUoKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBfcmVzaXplTWFwID0gVXRpbHNTZXJ2aWNlLnRocm90dGxlKF9yZXNpemVIYW5kbGVyLCBDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCk7XHJcblxyXG4gICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9yZXNpemVNYXApO1xyXG5cclxuICAgICAgICAgICAgJHNjb3BlLiRvbignJGRlc3RvcnknLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgJHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfcmVzaXplTWFwKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2FwaVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogTW92ZSB0byBzZXBhcmF0ZSBmdW5jdGlvbiAtIF9TZXR1cE1hcFxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLnBsYXRmb3JtID0gbmV3IEguc2VydmljZS5QbGF0Zm9ybShDb25maWcpO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcy5sYXllcnMgPSAkc2NvcGUuaGVyZW1hcHMucGxhdGZvcm0uY3JlYXRlRGVmYXVsdExheWVycygpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIFRPRE86IFpvb20gbGV2ZWwgYW5kIGNlbnRlciBzaG91bGQgYmUgY29uZmlndXJhYmxlXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMubWFwID0gbmV3IEguTWFwKCRlbGVtZW50WzBdLCAkc2NvcGUuaGVyZW1hcHMubGF5ZXJzLm5vcm1hbC5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICB6b29tOiAxMCxcclxuICAgICAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludCg1Mi41LCAxMy40KVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgX2xvYWRNb2R1bGVzKCk7XHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL1RPRE86IHNob3VsZCBoYXMgYmVlbiByZWZhY3RvcmVkLyB1c2UgJGF0dHJzLiRhdHRyIGRpcmVjdGx5XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9sb2FkTW9kdWxlcygpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBBUElTZXJ2aWNlLmxvYWRNb2R1bGUoJGF0dHJzLiRhdHRyLCB7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgXCJjb250cm9sXCI6IF91aU1vZHVsZVJlYWR5LFxyXG4gICAgICAgICAgICAgICAgLy8gICAgIFwicGFub1wiOiBfcGFub01vZHVsZVJlYWR5XHJcbiAgICAgICAgICAgICAgICAvLyB9KVxyXG5cclxuICAgICAgICAgICAgICAgIGlmICgkc2NvcGUubW9kdWxlcy5jb250cm9scykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZFVJTW9kdWxlKCkudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX3VpTW9kdWxlUmVhZHkoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoJHNjb3BlLm1vZHVsZXMucGFubykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZFBhbm9Nb2R1bGUoKS50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfcGFub01vZHVsZVJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCRzY29wZS5tb2R1bGVzLmV2ZW50cykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEV2ZW50c01vZHVsZSgpLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF9ldmVudHNNb2R1bGVSZWFkeSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvL1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBVc2UgJHNjb3BlLmhlcmVtYXBzLnVpLmNvbXBvbmVudFxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLnVpQ29tcG9uZW50ID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KCRzY29wZS5oZXJlbWFwcy5tYXAsICRzY29wZS5oZXJlbWFwcy5sYXllcnMpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcGFub01vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgLy8kc2NvcGUuaGVyZW1hcHMucGxhdGZvcm0uY29uZmlndXJlKEgubWFwLnJlbmRlci5wYW5vcmFtYS5SZW5kZXJFbmdpbmUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gJHNjb3BlLmhlcmVtYXBzLm1hcCxcclxuICAgICAgICAgICAgICAgICAgICBldmVudHMgPSAkc2NvcGUuaGVyZW1hcHMubWFwRXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyhtYXApLFxyXG4gICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yID0gJHNjb3BlLmhlcmVtYXBzLmJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKGV2ZW50cyk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uKGV2dCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGV2dC50eXBlLCBldnQuY3VycmVudFBvaW50ZXIudHlwZSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBkaXNhYmxlIHRoZSBkZWZhdWx0IGRyYWdnYWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBtYXBcclxuICAgICAgICAgICAgICAgIC8vIHdoZW4gc3RhcnRpbmcgdG8gZHJhZyBhIG1hcmtlciBvYmplY3Q6XHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBILm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IuZGlzYWJsZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBMaXN0ZW4gdG8gdGhlIGRyYWcgZXZlbnQgYW5kIG1vdmUgdGhlIHBvc2l0aW9uIG9mIHRoZSBtYXJrZXJcclxuICAgICAgICAgICAgICAgIC8vIGFzIG5lY2Vzc2FyeVxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWcnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvaW50ZXIgPSBldi5jdXJyZW50UG9pbnRlcjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgbWFwc2pzLm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKG1hcC5zY3JlZW5Ub0dlbyhwb2ludGVyLnZpZXdwb3J0WCwgcG9pbnRlci52aWV3cG9ydFkpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gcmUtZW5hYmxlIHRoZSBkZWZhdWx0IGRyYWdnYWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBtYXBcclxuICAgICAgICAgICAgICAgIC8vIHdoZW4gZHJhZ2dpbmcgaGFzIGNvbXBsZXRlZFxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG1hcHNqcy5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yLmVuYWJsZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICBNYXJrZXJzU2VydmljZS5hZGRNYXJrZXJUb01hcCgkc2NvcGUuaGVyZW1hcHMsICRzY29wZS5wbGFjZXMpO1xyXG5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoKSB7XHJcbiAgICAgICAgICAgICAgICBfc2V0TWFwU2l6ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcy5tYXAuZ2V0Vmlld1BvcnQoKS5yZXNpemUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3NldE1hcFNpemUoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaGVpZ2h0ID0gJHdpbmRvdy5pbm5lckhlaWdodCB8fCBDT05TVFMuREVGQVVMVF9NQVBfU0laRS5IRUlHSFQsXHJcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSAkd2luZG93LmlubmVyV2lkdGggfHwgQ09OU1RTLkRFRkFVTFRfTUFQX1NJWkUuV0lEVEg7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlaWdodCA9IGhlaWdodCArICdweCc7XHJcbiAgICAgICAgICAgICAgICAkc2NvcGUud2lkdGggPSB3aWR0aCArICdweCc7XHJcblxyXG4gICAgICAgICAgICAgICAgVXRpbHNTZXJ2aWNlLnJ1blNjb3BlRGlnZXN0SWZOZWVkKCRzY29wZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyIsInJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5tb2R1bGUnKTtcclxuXHJcbnZhciBkaXJlY3RpdmUgPSByZXF1aXJlKCcuL2hlcmVtYXBzLmRpcmVjdGl2ZScpLFxyXG4gICAgY29uZmlnUHJvdmlkZXIgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25maWcucHJvdmlkZXInKSxcclxuICAgIGFwaVNlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9hcGkuc2VydmljZScpLFxyXG4gICAgdXRpbHNTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvdXRpbHMuc2VydmljZScpLFxyXG4gICAgY29uc3RzID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvY29uc3RzJyk7XHJcblxyXG52YXIgaGVyZW1hcHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMnLCBbXHJcbiAgICAnbWFya2Vycy1tb2R1bGUnXHJcbl0pO1xyXG5cclxuaGVyZW1hcHMucHJvdmlkZXIoJ0NvbmZpZycsIGNvbmZpZ1Byb3ZpZGVyKVxyXG4gICAgLnNlcnZpY2UoJ0FQSVNlcnZpY2UnLCBhcGlTZXJ2aWNlKVxyXG4gICAgLnNlcnZpY2UoJ1V0aWxzU2VydmljZScsIHV0aWxzU2VydmljZSlcclxuICAgIC5jb25zdGFudCgnQ09OU1RTJywgY29uc3RzKVxyXG5cclxuaGVyZW1hcHMuZGlyZWN0aXZlKCdoZXJlTWFwcycsIGRpcmVjdGl2ZSk7XHJcblxyXG5oZXJlbWFwcy5jb25maWcoW1wiQ29uZmlnUHJvdmlkZXJcIiwgZnVuY3Rpb24oQ29uZmlnUHJvdmlkZXIpIHtcclxuICAgIENvbmZpZ1Byb3ZpZGVyLnNldE9wdGlvbnMoe1xyXG4gICAgICAgICdhcGlWZXJzaW9uJzogJzMuMCcsXHJcbiAgICAgICAgJ2FwcF9pZCc6ICd3TUhKdUxnQ1F6a2ZiaHpYSXdSRicsXHJcbiAgICAgICAgJ2FwcF9jb2RlJzogJ1dMSWM3UXpvTzhpcnY3bHVyVXQxcUEnLFxyXG4gICAgICAgICd1c2VIVFRQUyc6IHRydWVcclxuICAgIH0pO1xyXG59XSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGhlcmVtYXBzOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHEsIENvbmZpZywgVXRpbHNTZXJ2aWNlKXtcclxuICAgIHZhciB2ZXJzaW9uID0gQ29uZmlnLmFwaVZlcnNpb24sXHJcbiAgICAgICAgQVBJX1ZFUlNJT04gPSB7XHJcbiAgICAgICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxyXG4gICAgICAgICAgICBTVUI6IHZlcnNpb25cclxuICAgICAgICB9LFxyXG4gICAgICAgIENPTkZJRyA9IHtcclxuICAgICAgICAgICAgQkFTRTogXCJodHRwOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICAgICAgQ09SRTogXCJtYXBzanMtY29yZS5qc1wiLFxyXG4gICAgICAgICAgICBTRVJWSUNFOiBcIm1hcHNqcy1zZXJ2aWNlLmpzXCIsXHJcbiAgICAgICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgICAgICBzcmM6IFwibWFwc2pzLXVpLmpzXCIsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBcIm1hcHNqcy11aS5jc3NcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBQQU5POiBcIm1hcHNqcy1wYW5vLmpzXCIsXHJcbiAgICAgICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbG9hZEFwaUNvcmU6IGxvYWRBcGlDb3JlLFxyXG4gICAgICAgIGxvYWRVSU1vZHVsZTogbG9hZFVJTW9kdWxlLFxyXG4gICAgICAgIGxvYWRQYW5vTW9kdWxlOiBsb2FkUGFub01vZHVsZSxcclxuICAgICAgICBsb2FkRXZlbnRzTW9kdWxlOiBsb2FkRXZlbnRzTW9kdWxlXHJcbiAgICB9O1xyXG5cclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIGxvYWRBcGlDb3JlKCl7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkNPUkUpXHJcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5TRVJWSUNFKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRVSU1vZHVsZSgpe1xyXG4gICAgICAgIHZhciBsaW5rID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZUxpbmtUYWcoe1xyXG4gICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgdHlwZTogJ3RleHQvY3NzJyxcclxuICAgICAgICAgICAgaHJlZjogX2dldFVSTChDT05GSUcuVUkuaHJlZiksXHJcbiAgICAgICAgICAgIGlkOiBDT05GSUcuVUkuaHJlZlxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBsaW5rICYmIGhlYWQuYXBwZW5kQ2hpbGQobGluayk7XHJcblxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRQYW5vTW9kdWxlKCl7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlBBTk8pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRFdmVudHNNb2R1bGUoKXtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuRVZFTlRTKTtcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUNcclxuXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9nZXRVUkwoc291cmNlTmFtZSl7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgICAgIENPTkZJRy5CQVNFLFxyXG4gICAgICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICAgICAgQVBJX1ZFUlNJT04uU1VCLFxyXG4gICAgICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBzb3VyY2VOYW1lXHJcbiAgICAgICAgICAgIF0uam9pbihcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyKHNvdXJjZU5hbWUpe1xyXG4gICAgICAgIC8vIFRPRE86IEluc3RlYWQgb2YgaWQgeW91IGNhbiBjaGVjayBnbG9iYWwgcHJvcGVydGllc1xyXG4gICAgICAgIHZhciBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxyXG4gICAgICAgICAgICBjb3JlU2NyaXB0ID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7XHJcbiAgICAgICAgICAgICAgICBzcmM6IHNyYyxcclxuICAgICAgICAgICAgICAgIGlkOiBzb3VyY2VOYW1lXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcclxuICAgICAgICAgICAgaWYoIWNvcmVTY3JpcHQpIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoY29yZVNjcmlwdCk7XHJcblxyXG4gICAgICAgICAgICBjb3JlU2NyaXB0Lm9ubG9hZCA9IHJlc29sdmU7XHJcbiAgICAgICAgICAgIGNvcmVTY3JpcHQub25lcnJvciA9IHJlamVjdDtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFwiVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVFwiOiA1MDAsXHJcbiAgICBcIkRFRkFVTFRfTUFQX1NJWkVcIjoge1xyXG4gICAgICAgIEhFSUdIVDogNDgwLFxyXG4gICAgICAgIFdJRFRIOiA2NDBcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERlZmF1bHRNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFRPRE86IE9iamVjdCBjcmVhdGUgc2hvdWxkIGhhdmUgcG9sbHlmaWxsXHJcbiAgICB2YXIgcHJvdG8gPSBEZWZhdWx0TWFya2VyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZSk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gZnVuY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIERlZmF1bHRNYXJrZXI7XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICAvLyBUT0RPOiBQdWJsaWMgbWV0aG9kcyBzaG91bGQgYmUgcGxhY2VkIGZpcnN0IGFuZCBpbXBsZW1lbnRhdGlvbiBkZXRhaWwgbW92ZWQgYm90dG9tXHJcblxyXG4gICAgZnVuY3Rpb24gRE9NTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBET01NYXJrZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShNYXJrZXJJbnRlcmZhY2UucHJvdG90eXBlKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRE9NTWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21NYXJrZXIodGhpcy5jb29yZHMsIHtcclxuICAgICAgICAgICAgaWNvbjogdGhpcy5fZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBwcm90by5fZ2V0SWNvbiA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcclxuICAgICAgICAgaWYoIWljb24pXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSWNvbiBtaXNzZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21JY29uKGljb24sIHRoaXMuX2dldEV2ZW50cygpKTtcclxuICAgIH07XHJcblxyXG4gICAgcHJvdG8uX3NldHVwRXZlbnRzID0gZnVuY3Rpb24oZWwsIGV2ZW50cywgcmVtb3ZlKXtcclxuICAgICAgICB2YXIgbWV0aG9kID0gcmVtb3ZlID8gJ3JlbW92ZUV2ZW50TGlzdGVuZXInIDogJ2FkZEV2ZW50TGlzdGVuZXInO1xyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBldmVudHMpIHtcclxuICAgICAgICAgICAgaWYoIWV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFttZXRob2RdLmNhbGwobnVsbCwga2V5LCBldmVudHNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBwcm90by5fZ2V0RXZlbnRzID0gZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgICAgIGV2ZW50cyA9IHRoaXMucGxhY2UuZXZlbnRzO1xyXG5cclxuICAgICAgICBpZighdGhpcy5wbGFjZS5ldmVudHMpXHJcbiAgICAgICAgICAgIHJldHVybiB7fTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgLy8gdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCBldmVyeSB0aW1lIG1hcmtlciBlbnRlcnMgdGhlIHZpZXdwb3J0XHJcbiAgICAgICAgICAgIG9uQXR0YWNoOiBmdW5jdGlvbihjbG9uZWRFbGVtZW50LCBkb21JY29uLCBkb21NYXJrZXIpe1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fc2V0dXBFdmVudHMoY2xvbmVkRWxlbWVudCwgZXZlbnRzKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgIC8vIHRoZSBmdW5jdGlvbiBpcyBjYWxsZWQgZXZlcnkgdGltZSBtYXJrZXIgbGVhdmVzIHRoZSB2aWV3cG9ydFxyXG4gICAgICAgICAgICBvbkRldGFjaDogZnVuY3Rpb24oY2xvbmVkRWxlbWVudCwgZG9tSWNvbiwgZG9tTWFya2VyKXtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3NldHVwRXZlbnRzKGNsb25lZEVsZW1lbnQsIGV2ZW50cywgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBET01NYXJrZXI7XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XHJcbiAgICBmdW5jdGlvbiBNYXJrZXIoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gTWFya2VyLnByb3RvdHlwZTtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gZnVuY3Rpb24oKXsgdGhyb3cgbmV3IEVycm9yKCdnZXRJbnN0YW5jZTo6IG5vdCBpbXBsZW1lbnRlZCcpOyB9O1xyXG4gICAgXHJcbiAgICBwcm90by5zZXRDb29yZHMgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHRoaXMuY29vcmRzID0ge1xyXG4gICAgICAgICAgICBsYXQ6IHRoaXMucGxhY2UucG9zLmxhdCxcclxuICAgICAgICAgICAgbG5nOiB0aGlzLnBsYWNlLnBvcy5sbmdcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBNYXJrZXI7XHJcbiAgICBcclxufSIsInZhciBtYXJrZXJJbnRlcmZhY2UgPSByZXF1aXJlKCcuL21hcmtlci5qcycpLFxyXG5cdGRlZmF1bHRNYXJrZXIgPSByZXF1aXJlKCcuL2RlZmF1bHQubWFya2VyLmpzJyksXHJcblx0ZG9tTWFya2VyID0gcmVxdWlyZSgnLi9kb20ubWFya2VyLmpzJyksXHJcbi8vIFx0c3ZnTWFya2VyID0gcmVxdWlyZSgnLi9zdmcubWFya2VyLmpzJyksXHJcbiAgICBtYXJrZXJzU2VydmljZSA9IHJlcXVpcmUoJy4vbWFya2Vycy5zZXJ2aWNlLmpzJyk7XHJcblxyXG5hbmd1bGFyLm1vZHVsZSgnbWFya2VyLWludGVyZmFjZScsIFtdKS5mYWN0b3J5KCdNYXJrZXJJbnRlcmZhY2UnLCBtYXJrZXJJbnRlcmZhY2UpO1xyXG5hbmd1bGFyLm1vZHVsZSgnZGVmYXVsdC1tYXJrZXInLCBbXSkuZmFjdG9yeSgnRGVmYXVsdE1hcmtlcicsIGRlZmF1bHRNYXJrZXIpO1xyXG5hbmd1bGFyLm1vZHVsZSgnZG9tLW1hcmtlcicsIFtdKS5mYWN0b3J5KCdET01NYXJrZXInLCBkb21NYXJrZXIpO1xyXG4vLyAvLyBhbmd1bGFyLm1vZHVsZSgnc3ZnLW1hcmtlcicsIFtdKS5mYWN0b3J5KCdTVkdNYXJrZXInLCBzdmdNYXJrZXIpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ21hcmtlcnMtc2VydmljZScsIFtdKS5zZXJ2aWNlKCdNYXJrZXJzU2VydmljZScsIG1hcmtlcnNTZXJ2aWNlKTtcclxuXHJcbnZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnbWFya2Vycy1tb2R1bGUnLCBbXHJcblx0J21hcmtlci1pbnRlcmZhY2UnLFxyXG4gICAgJ2RlZmF1bHQtbWFya2VyJyxcclxuICAgICdkb20tbWFya2VyJyxcclxuICAgICdtYXJrZXJzLXNlcnZpY2UnXHJcbi8vICAgICAvLyAnc3ZnLW1hcmtlcidcclxuXSk7Ly8ucnVuKGZ1bmN0aW9uKERlZmF1bHRNYXJrZXIpey8vLCBET01NYXJrZXIsIFNWR01hcmtlcil7XHJcblxyXG4vLyB9KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYXBwOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oRGVmYXVsdE1hcmtlciwgRE9NTWFya2VyKSB7XHJcbiAgICAvLyBUT0RPOiBTaG91bGQgYmUgcGxhY2VkIGluIGNvbnN0IGZpbGVcclxuICAgIHZhciBNQVJLRVJfVFlQRVMgPSB7XHJcbiAgICAgICAgREVGQVVMVDogMCxcclxuICAgICAgICBET006IDEsXHJcbiAgICAgICAgU1ZHOiAyXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgYWRkTWFya2VyVG9NYXA6IGFkZE1hcmtlclRvTWFwXHJcbiAgICB9XHJcblxyXG4gICAgLy8gVE9ETzogWW91IHNob3VsZCBwYXNzIG9ubHkgTUFQIGluc3RlYWQgb2YgZnVsbCBoZXJlbWFwcyBvYmpcclxuICAgIGZ1bmN0aW9uIGFkZE1hcmtlclRvTWFwKGhlcmVtYXBzLCBwbGFjZXMpIHtcclxuICAgICAgICB2YXIgbWFwID0gaGVyZW1hcHMubWFwO1xyXG5cclxuICAgICAgICAvLyBUT0RPOiBMRU5HVEhcclxuICAgICAgICBpZiAoIXBsYWNlcylcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBILk1hcCkpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgIHBsYWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHBsYWNlLCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpO1xyXG4gICAgICAgICAgICB2YXIgbWFya2VyID0gcGxhY2UuZHJhZ2dhYmxlID8gX2RyYWdnYWJsZU1hcmtlck1peGluKGNyZWF0b3IuY3JlYXRlKCkpIDogY3JlYXRvci5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgICAgIG1hcC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcclxuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXI7XHJcblxyXG4gICAgICAgIHN3aXRjaChwbGFjZS50eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLkRPTTpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRE9NTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLlNWRzpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gU1ZHTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IERlZmF1bHRNYXJrZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IENvbmNyZXRlTWFya2VyKHBsYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZHJhZ2dhYmxlTWFya2VyTWl4aW4obWFya2VyKSB7XHJcbiAgICAgICAgLy8gRW5zdXJlIHRoYXQgdGhlIG1hcmtlciBjYW4gcmVjZWl2ZSBkcmFnIGV2ZW50c1xyXG4gICAgICAgIG1hcmtlci5kcmFnZ2FibGUgPSB0cnVlO1xyXG5cclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgfVxyXG5cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRyb290U2NvcGUsICR0aW1lb3V0KXtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxyXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxyXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXHJcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyNyZWdpb24gUFVCTElDXHJcbiAgICBmdW5jdGlvbiB0aHJvdHRsZShmbiwgcGVyaW9kKXtcclxuICAgICAgICB2YXIgdGltZW91dCA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIGlmKCR0aW1lb3V0KVxyXG4gICAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRpbWVvdXQgPSAkdGltZW91dChmbiwgcGVyaW9kKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHJ1blNjb3BlRGlnZXN0SWZOZWVkKHNjb3BlLCBjYikge1xyXG4gICAgICAgIGlmIChzY29wZS4kcm9vdCAmJiBzY29wZS4kcm9vdC4kJHBoYXNlICE9PSAnJGFwcGx5JyAmJiBzY29wZS4kcm9vdC4kJHBoYXNlICE9PSAnJGRpZ2VzdCcpIHtcclxuICAgICAgICAgICAgc2NvcGUuJGRpZ2VzdChjYiB8fCBhbmd1bGFyLm5vb3ApO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVTY3JpcHRUYWcoYXR0cnMpe1xyXG4gICAgICAgIGlmKGF0dHJzLmlkICYmIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmlkKSlcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuXHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gc2NyaXB0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUxpbmtUYWcoYXR0cnMpIHtcclxuICAgICAgICBpZihhdHRycy5pZCAmJiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5pZCkpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcblxyXG4gICAgICAgIF9zZXRBdHRycyhsaW5rLCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQyBcclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xyXG4gICAgICAgIGlmKCFlbCB8fCAhYXR0cnMpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2VkIGF0dHJpYnV0ZXMnKTtcclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiXX0=
