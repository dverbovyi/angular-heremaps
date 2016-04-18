(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
            //

            function _uiModuleReady() {
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

        },
        link: function(scope) { }
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
    
    var proto = DefaultMarker.prototype = Object.create(MarkerInterface.prototype);
    proto.constructor = DefaultMarker;
    
    proto.create = function(){
        return new H.map.Marker(this.coords);
    }
    
    return DefaultMarker;
}
},{}],7:[function(require,module,exports){
module.exports = function(MarkerInterface){
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
    var MARKER_TYPES = {
        DEFAULT: 0,
        DOM: 1,
        SVG: 2
    };

    return {
        addMarkerToMap: addMarkerToMap
    }
    
    function addMarkerToMap(heremaps, places) {
        console.log(heremaps);
        var map = heremaps.map;
        console.log(places)

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
        var ConcreteMarker = angular.noop;
        
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


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2hlcmVtYXBzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvYXBpLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL2NvbmZpZy5wcm92aWRlci5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RlZmF1bHQubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RvbS5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvdXRpbHMuc2VydmljZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImFuZ3VsYXItaGVyZW1hcHMuanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8iLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IERteXRybyBvbiA0LzExLzIwMTYuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgICR3aW5kb3csXHJcbiAgICAkdGltZW91dCxcclxuICAgIENvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBVdGlsc1NlcnZpY2UsXHJcbiAgICBNYXJrZXJzU2VydmljZSxcclxuICAgIENPTlNUUykge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogd2lkdGgsICdoZWlnaHQnOiBoZWlnaHR9XFxcIj48L2Rpdj5cIixcclxuICAgICAgICByZXBsYWNlOiB0cnVlLFxyXG4gICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgIHBsYWNlczogJz0nXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICAgICAgJHNjb3BlLm1vZHVsZXMgPSB7XHJcbiAgICAgICAgICAgICAgICBjb250cm9sczogISEkYXR0cnMuJGF0dHIuY29udHJvbHMsXHJcbiAgICAgICAgICAgICAgICBwYW5vOiAhISRhdHRycy4kYXR0ci5wYW5vLFxyXG4gICAgICAgICAgICAgICAgZXZlbnRzOiAhISRhdHRycy4kYXR0ci5ldmVudHNcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcyA9IHt9O1xyXG5cclxuICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkQXBpQ29yZSgpLnRoZW4oX2FwaVJlYWR5KTtcclxuXHJcbiAgICAgICAgICAgIF9zZXRNYXBTaXplKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgX3Jlc2l6ZU1hcCA9IFV0aWxzU2VydmljZS50aHJvdHRsZShfcmVzaXplSGFuZGxlciwgQ09OU1RTLlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQpO1xyXG5cclxuICAgICAgICAgICAgJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfcmVzaXplTWFwKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICRzY29wZS4kb24oJyRkZXN0b3J5JywgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX3Jlc2l6ZU1hcCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2FwaVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCRlbGVtZW50Lmh0bWwoKSlcclxuICAgICAgICAgICAgICAgICAgICAkZWxlbWVudC5lbXB0eSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcy5wbGF0Zm9ybSA9IG5ldyBILnNlcnZpY2UuUGxhdGZvcm0oQ29uZmlnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMubGF5ZXJzID0gJHNjb3BlLmhlcmVtYXBzLnBsYXRmb3JtLmNyZWF0ZURlZmF1bHRMYXllcnMoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMubWFwID0gbmV3IEguTWFwKCRlbGVtZW50WzBdLCAkc2NvcGUuaGVyZW1hcHMubGF5ZXJzLm5vcm1hbC5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICB6b29tOiAxMCxcclxuICAgICAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludCg1Mi41LCAxMy40KVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgX2xvYWRNb2R1bGVzKCk7XHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL1RPRE86IHNob3VsZCBoYXMgYmVlbiByZWZhY3RvcmVkXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9sb2FkTW9kdWxlcygpIHtcclxuICAgICAgICAgICAgICAgIGlmICgkc2NvcGUubW9kdWxlcy5jb250cm9scykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZFVJTW9kdWxlKCkudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX3VpTW9kdWxlUmVhZHkoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoJHNjb3BlLm1vZHVsZXMucGFubykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZFBhbm9Nb2R1bGUoKS50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfcGFub01vZHVsZVJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCRzY29wZS5tb2R1bGVzLmV2ZW50cykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEV2ZW50c01vZHVsZSgpLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF9ldmVudHNNb2R1bGVSZWFkeSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvL1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICAkc2NvcGUudWlDb21wb25lbnQgPSBILnVpLlVJLmNyZWF0ZURlZmF1bHQoJHNjb3BlLmhlcmVtYXBzLm1hcCwgJHNjb3BlLmhlcmVtYXBzLmxheWVycyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9wYW5vTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICAvLyRzY29wZS5oZXJlbWFwcy5wbGF0Zm9ybS5jb25maWd1cmUoSC5tYXAucmVuZGVyLnBhbm9yYW1hLlJlbmRlckVuZ2luZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9ldmVudHNNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBtYXAgPSAkc2NvcGUuaGVyZW1hcHMubWFwLFxyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50cyA9ICRzY29wZS5oZXJlbWFwcy5tYXBFdmVudHMgPSBuZXcgSC5tYXBldmVudHMuTWFwRXZlbnRzKG1hcCksXHJcbiAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IgPSAkc2NvcGUuaGVyZW1hcHMuYmVoYXZpb3IgPSBuZXcgSC5tYXBldmVudHMuQmVoYXZpb3IoZXZlbnRzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBkaXNhYmxlIHRoZSBkZWZhdWx0IGRyYWdnYWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBtYXBcclxuICAgICAgICAgICAgICAgIC8vIHdoZW4gc3RhcnRpbmcgdG8gZHJhZyBhIG1hcmtlciBvYmplY3Q6XHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBILm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IuZGlzYWJsZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gTGlzdGVuIHRvIHRoZSBkcmFnIGV2ZW50IGFuZCBtb3ZlIHRoZSBwb3NpdGlvbiBvZiB0aGUgbWFya2VyXHJcbiAgICAgICAgICAgICAgICAvLyBhcyBuZWNlc3NhcnlcclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyID0gZXYuY3VycmVudFBvaW50ZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG1hcHNqcy5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldC5zZXRQb3NpdGlvbihtYXAuc2NyZWVuVG9HZW8ocG9pbnRlci52aWV3cG9ydFgsIHBvaW50ZXIudmlld3BvcnRZKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIHJlLWVuYWJsZSB0aGUgZGVmYXVsdCBkcmFnZ2FiaWxpdHkgb2YgdGhlIHVuZGVybHlpbmcgbWFwXHJcbiAgICAgICAgICAgICAgICAvLyB3aGVuIGRyYWdnaW5nIGhhcyBjb21wbGV0ZWRcclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBtYXBzanMubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWhhdmlvci5lbmFibGUoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIE1hcmtlcnNTZXJ2aWNlLmFkZE1hcmtlclRvTWFwKCRzY29wZS5oZXJlbWFwcywgJHNjb3BlLnBsYWNlcyk7XHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcmVzaXplSGFuZGxlcigpIHtcclxuICAgICAgICAgICAgICAgIF9zZXRNYXBTaXplKCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcy5tYXAuZ2V0Vmlld1BvcnQoKS5yZXNpemUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3NldE1hcFNpemUoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaGVpZ2h0ID0gJHdpbmRvdy5pbm5lckhlaWdodCB8fCBDT05TVFMuREVGQVVMVF9NQVBfU0laRS5IRUlHSFQsXHJcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSAkd2luZG93LmlubmVyV2lkdGggfHwgQ09OU1RTLkRFRkFVTFRfTUFQX1NJWkUuV0lEVEg7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlaWdodCA9IGhlaWdodCArICdweCc7XHJcbiAgICAgICAgICAgICAgICAkc2NvcGUud2lkdGggPSB3aWR0aCArICdweCc7XHJcblxyXG4gICAgICAgICAgICAgICAgVXRpbHNTZXJ2aWNlLnJ1blNjb3BlRGlnZXN0SWZOZWVkKCRzY29wZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgICBsaW5rOiBmdW5jdGlvbihzY29wZSkgeyB9XHJcbiAgICB9XHJcbn07IiwicmVxdWlyZSgnLi9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXJzLm1vZHVsZScpO1xyXG5cclxudmFyIGRpcmVjdGl2ZSA9IHJlcXVpcmUoJy4vaGVyZW1hcHMuZGlyZWN0aXZlJyksXHJcbiAgICBjb25maWdQcm92aWRlciA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbmZpZy5wcm92aWRlcicpLFxyXG4gICAgYXBpU2VydmljZSA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2FwaS5zZXJ2aWNlJyksXHJcbiAgICB1dGlsc1NlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy91dGlscy5zZXJ2aWNlJyksXHJcbiAgICBjb25zdHMgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25zdHMnKTtcclxuXHJcbnZhciBoZXJlbWFwcyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcycsIFtcclxuICAgICdtYXJrZXJzLW1vZHVsZSdcclxuXSk7XHJcblxyXG5oZXJlbWFwcy5wcm92aWRlcignQ29uZmlnJywgY29uZmlnUHJvdmlkZXIpXHJcbiAgICAuc2VydmljZSgnQVBJU2VydmljZScsIGFwaVNlcnZpY2UpXHJcbiAgICAuc2VydmljZSgnVXRpbHNTZXJ2aWNlJywgdXRpbHNTZXJ2aWNlKVxyXG4gICAgLmNvbnN0YW50KCdDT05TVFMnLCBjb25zdHMpXHJcblxyXG5oZXJlbWFwcy5kaXJlY3RpdmUoJ2hlcmVNYXBzJywgZGlyZWN0aXZlKTtcclxuXHJcbmhlcmVtYXBzLmNvbmZpZyhbXCJDb25maWdQcm92aWRlclwiLCBmdW5jdGlvbihDb25maWdQcm92aWRlcikge1xyXG4gICAgQ29uZmlnUHJvdmlkZXIuc2V0T3B0aW9ucyh7XHJcbiAgICAgICAgJ2FwaVZlcnNpb24nOiAnMy4wJyxcclxuICAgICAgICAnYXBwX2lkJzogJ3dNSEp1TGdDUXprZmJoelhJd1JGJyxcclxuICAgICAgICAnYXBwX2NvZGUnOiAnV0xJYzdRem9POGlydjdsdXJVdDFxQScsXHJcbiAgICAgICAgJ3VzZUhUVFBTJzogdHJ1ZVxyXG4gICAgfSk7XHJcbn1dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaGVyZW1hcHM7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcSwgQ29uZmlnLCBVdGlsc1NlcnZpY2Upe1xyXG4gICAgdmFyIHZlcnNpb24gPSBDb25maWcuYXBpVmVyc2lvbixcclxuICAgICAgICBBUElfVkVSU0lPTiA9IHtcclxuICAgICAgICAgICAgVjogcGFyc2VJbnQodmVyc2lvbiksXHJcbiAgICAgICAgICAgIFNVQjogdmVyc2lvblxyXG4gICAgICAgIH0sIFxyXG4gICAgICAgIENPTkZJRyA9IHtcclxuICAgICAgICAgICAgQkFTRTogXCJodHRwOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICAgICAgQ09SRTogXCJtYXBzanMtY29yZS5qc1wiLFxyXG4gICAgICAgICAgICBTRVJWSUNFOiBcIm1hcHNqcy1zZXJ2aWNlLmpzXCIsXHJcbiAgICAgICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgICAgICBzcmM6IFwibWFwc2pzLXVpLmpzXCIsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBcIm1hcHNqcy11aS5jc3NcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBQQU5POiBcIm1hcHNqcy1wYW5vLmpzXCIsXHJcbiAgICAgICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcclxuICAgICAgICB9LCBcclxuICAgICAgICBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsb2FkQXBpQ29yZTogbG9hZEFwaUNvcmUsXHJcbiAgICAgICAgbG9hZFVJTW9kdWxlOiBsb2FkVUlNb2R1bGUsXHJcbiAgICAgICAgbG9hZFBhbm9Nb2R1bGU6IGxvYWRQYW5vTW9kdWxlLFxyXG4gICAgICAgIGxvYWRFdmVudHNNb2R1bGU6IGxvYWRFdmVudHNNb2R1bGVcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vI3JlZ2lvbiBQVUJMSUMgXHJcbiAgICBmdW5jdGlvbiBsb2FkQXBpQ29yZSgpe1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5DT1JFKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbG9hZFVJTW9kdWxlKCl7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XHJcbiAgICAgICAgICAgIHJlbDogJ3N0eWxlc2hlZXQnLFxyXG4gICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxyXG4gICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKSxcclxuICAgICAgICAgICAgaWQ6IENPTkZJRy5VSS5ocmVmXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBsb2FkUGFub01vZHVsZSgpe1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5QQU5PKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbG9hZEV2ZW50c01vZHVsZSgpe1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX2dldFVSTChzb3VyY2VOYW1lKXtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICAgICAgQ09ORklHLkJBU0UsXHJcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTi5WLFxyXG4gICAgICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXHJcbiAgICAgICAgICAgICAgICBcIi9cIixcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICAgICAgXS5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyKHNvdXJjZU5hbWUpe1xyXG4gICAgICAgIHZhciBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxyXG4gICAgICAgICAgICBjb3JlU2NyaXB0ID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7XHJcbiAgICAgICAgICAgICAgICBzcmM6IHNyYyxcclxuICAgICAgICAgICAgICAgIGlkOiBzb3VyY2VOYW1lXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcclxuICAgICAgICAgICAgaWYoIWNvcmVTY3JpcHQpIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoY29yZVNjcmlwdCk7XHJcblxyXG4gICAgICAgICAgICBjb3JlU2NyaXB0Lm9ubG9hZCA9IHJlc29sdmU7XHJcbiAgICAgICAgICAgIGNvcmVTY3JpcHQub25lcnJvciA9IHJlamVjdDtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFwiVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVFwiOiA1MDAsXHJcbiAgICBcIkRFRkFVTFRfTUFQX1NJWkVcIjoge1xyXG4gICAgICAgIEhFSUdIVDogNDgwLFxyXG4gICAgICAgIFdJRFRIOiA2NDBcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERlZmF1bHRNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBEZWZhdWx0TWFya2VyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZSk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XHJcbiAgICBcclxuICAgIHByb3RvLmNyZWF0ZSA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5NYXJrZXIodGhpcy5jb29yZHMpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gRGVmYXVsdE1hcmtlcjtcclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERPTU1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBwcm90byA9IERPTU1hcmtlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKE1hcmtlckludGVyZmFjZS5wcm90b3R5cGUpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBET01NYXJrZXI7XHJcbiAgICBcclxuICAgIHByb3RvLmNyZWF0ZSA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21NYXJrZXIodGhpcy5jb29yZHMsIHtcclxuICAgICAgICAgICAgaWNvbjogdGhpcy5fZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgcHJvdG8uX2dldEljb24gPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5pY29uO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMucGxhY2UpXHJcbiAgICAgICAgIGlmKCFpY29uKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ljb24gbWlzc2VkJyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uLCB0aGlzLl9nZXRFdmVudHMoKSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBwcm90by5fc2V0dXBFdmVudHMgPSBmdW5jdGlvbihlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gZXZlbnRzKSB7XHJcbiAgICAgICAgICAgIGlmKCFldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBwcm90by5fZ2V0RXZlbnRzID0gZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgICAgIGV2ZW50cyA9IHRoaXMucGxhY2UuZXZlbnRzO1xyXG4gICAgICAgICAgICAgXHJcbiAgICAgICAgaWYoIXRoaXMucGxhY2UuZXZlbnRzKVxyXG4gICAgICAgICAgICByZXR1cm4ge307XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIC8vIHRoZSBmdW5jdGlvbiBpcyBjYWxsZWQgZXZlcnkgdGltZSBtYXJrZXIgZW50ZXJzIHRoZSB2aWV3cG9ydFxyXG4gICAgICAgICAgICBvbkF0dGFjaDogZnVuY3Rpb24oY2xvbmVkRWxlbWVudCwgZG9tSWNvbiwgZG9tTWFya2VyKXtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3NldHVwRXZlbnRzKGNsb25lZEVsZW1lbnQsIGV2ZW50cyk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAvLyB0aGUgZnVuY3Rpb24gaXMgY2FsbGVkIGV2ZXJ5IHRpbWUgbWFya2VyIGxlYXZlcyB0aGUgdmlld3BvcnRcclxuICAgICAgICAgICAgb25EZXRhY2g6IGZ1bmN0aW9uKGNsb25lZEVsZW1lbnQsIGRvbUljb24sIGRvbU1hcmtlcil7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zZXR1cEV2ZW50cyhjbG9uZWRFbGVtZW50LCBldmVudHMsIHRydWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgcmV0dXJuIERPTU1hcmtlcjtcclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcclxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MhIFRoZSBJbnN0YW5jZSBzaG91bGQgYmUgY3JlYXRlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBNYXJrZXIucHJvdG90eXBlO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBmdW5jdGlvbigpeyB0aHJvdyBuZXcgRXJyb3IoJ2dldEluc3RhbmNlOjogbm90IGltcGxlbWVudGVkJyk7IH07XHJcbiAgICBcclxuICAgIHByb3RvLnNldENvb3JkcyA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdGhpcy5jb29yZHMgPSB7XHJcbiAgICAgICAgICAgIGxhdDogdGhpcy5wbGFjZS5wb3MubGF0LFxyXG4gICAgICAgICAgICBsbmc6IHRoaXMucGxhY2UucG9zLmxuZ1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIE1hcmtlcjtcclxuICAgIFxyXG59IiwidmFyIG1hcmtlckludGVyZmFjZSA9IHJlcXVpcmUoJy4vbWFya2VyLmpzJyksXHJcblx0ZGVmYXVsdE1hcmtlciA9IHJlcXVpcmUoJy4vZGVmYXVsdC5tYXJrZXIuanMnKSxcclxuXHRkb21NYXJrZXIgPSByZXF1aXJlKCcuL2RvbS5tYXJrZXIuanMnKSxcclxuLy8gXHRzdmdNYXJrZXIgPSByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSxcclxuICAgIG1hcmtlcnNTZXJ2aWNlID0gcmVxdWlyZSgnLi9tYXJrZXJzLnNlcnZpY2UuanMnKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXItaW50ZXJmYWNlJywgW10pLmZhY3RvcnkoJ01hcmtlckludGVyZmFjZScsIG1hcmtlckludGVyZmFjZSk7XHJcbmFuZ3VsYXIubW9kdWxlKCdkZWZhdWx0LW1hcmtlcicsIFtdKS5mYWN0b3J5KCdEZWZhdWx0TWFya2VyJywgZGVmYXVsdE1hcmtlcik7XHJcbmFuZ3VsYXIubW9kdWxlKCdkb20tbWFya2VyJywgW10pLmZhY3RvcnkoJ0RPTU1hcmtlcicsIGRvbU1hcmtlcik7XHJcbi8vIC8vIGFuZ3VsYXIubW9kdWxlKCdzdmctbWFya2VyJywgW10pLmZhY3RvcnkoJ1NWR01hcmtlcicsIHN2Z01hcmtlcik7XHJcblxyXG5hbmd1bGFyLm1vZHVsZSgnbWFya2Vycy1zZXJ2aWNlJywgW10pLnNlcnZpY2UoJ01hcmtlcnNTZXJ2aWNlJywgbWFya2Vyc1NlcnZpY2UpO1xyXG5cclxudmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLW1vZHVsZScsIFtcclxuXHQnbWFya2VyLWludGVyZmFjZScsXHJcbiAgICAnZGVmYXVsdC1tYXJrZXInLFxyXG4gICAgJ2RvbS1tYXJrZXInLFxyXG4gICAgJ21hcmtlcnMtc2VydmljZSdcclxuLy8gICAgIC8vICdzdmctbWFya2VyJ1xyXG5dKTsvLy5ydW4oZnVuY3Rpb24oRGVmYXVsdE1hcmtlcil7Ly8sIERPTU1hcmtlciwgU1ZHTWFya2VyKXtcclxuXHJcbi8vIH0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhcHA7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihEZWZhdWx0TWFya2VyLCBET01NYXJrZXIpIHtcclxuICAgIHZhciBNQVJLRVJfVFlQRVMgPSB7XHJcbiAgICAgICAgREVGQVVMVDogMCxcclxuICAgICAgICBET006IDEsXHJcbiAgICAgICAgU1ZHOiAyXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgYWRkTWFya2VyVG9NYXA6IGFkZE1hcmtlclRvTWFwXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGFkZE1hcmtlclRvTWFwKGhlcmVtYXBzLCBwbGFjZXMpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhoZXJlbWFwcyk7XHJcbiAgICAgICAgdmFyIG1hcCA9IGhlcmVtYXBzLm1hcDtcclxuICAgICAgICBjb25zb2xlLmxvZyhwbGFjZXMpXHJcblxyXG4gICAgICAgIGlmICghcGxhY2VzKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGlmICghKG1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBtYXAgaW5zdGFuY2UnKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2cocGxhY2VzKVxyXG4gICAgICAgIHBsYWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHBsYWNlLCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpO1xyXG4gICAgICAgICAgICB2YXIgbWFya2VyID0gcGxhY2UuZHJhZ2dhYmxlID8gX2RyYWdnYWJsZU1hcmtlck1peGluKGNyZWF0b3IuY3JlYXRlKCkpIDogY3JlYXRvci5jcmVhdGUoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIG1hcC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcclxuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXIgPSBhbmd1bGFyLm5vb3A7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoKHBsYWNlLnR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBTVkdNYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDogXHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IERlZmF1bHRNYXJrZXI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcclxuICAgICAgICAvLyBFbnN1cmUgdGhhdCB0aGUgbWFya2VyIGNhbiByZWNlaXZlIGRyYWcgZXZlbnRzXHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcm9vdFNjb3BlLCAkdGltZW91dCl7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRocm90dGxlOiB0aHJvdHRsZSxcclxuICAgICAgICBjcmVhdGVTY3JpcHRUYWc6IGNyZWF0ZVNjcmlwdFRhZyxcclxuICAgICAgICBjcmVhdGVMaW5rVGFnOiBjcmVhdGVMaW5rVGFnLFxyXG4gICAgICAgIHJ1blNjb3BlRGlnZXN0SWZOZWVkOiBydW5TY29wZURpZ2VzdElmTmVlZFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gdGhyb3R0bGUoZm4sIHBlcmlvZCl7XHJcbiAgICAgICAgdmFyIHRpbWVvdXQgPSBudWxsO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICBpZigkdGltZW91dClcclxuICAgICAgICAgICAgICAgICR0aW1lb3V0LmNhbmNlbCh0aW1lb3V0KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aW1lb3V0ID0gJHRpbWVvdXQoZm4sIHBlcmlvZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBydW5TY29wZURpZ2VzdElmTmVlZChzY29wZSwgY2IpIHtcclxuICAgICAgICBpZiAoc2NvcGUuJHJvb3QgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRhcHBseScgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRkaWdlc3QnKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLiRkaWdlc3QoY2IgfHwgYW5ndWxhci5ub29wKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlU2NyaXB0VGFnKGF0dHJzKXtcclxuICAgICAgICBpZihhdHRycy5pZCAmJiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5pZCkpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xyXG4gICAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XHJcblxyXG4gICAgICAgIF9zZXRBdHRycyhzY3JpcHQsIGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHNjcmlwdDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVMaW5rVGFnKGF0dHJzKSB7XHJcbiAgICAgICAgaWYoYXR0cnMuaWQgJiYgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaWQpKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpO1xyXG5cclxuICAgICAgICBfc2V0QXR0cnMobGluaywgYXR0cnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gbGluaztcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUMgXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcclxuICAgICAgICBpZighZWwgfHwgIWF0dHJzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGF0dHJzKSB7XHJcbiAgICAgICAgICAgIGlmKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFtrZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07Il19
