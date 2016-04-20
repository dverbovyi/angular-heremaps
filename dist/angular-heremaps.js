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
        template: "<div ng-style=\"{'width': mapWidth, 'height': mapHeight}\"></div>",
        replace: true,
        scope: {
            coords: '=',
            zoom: '=',
            height: '=',
            width: '=',
            places: '=',
            events: '=' //TODO: support passing custom listeners
        },
        controller: function($scope, $element, $attrs) {
            console.log($scope)
            $scope.modules = {
                controls: !!$attrs.$attr.controls,
                pano: !!$attrs.$attr.pano,
                events: !!$attrs.$attr.events
            };

            $scope.heremaps = {};

            APIService.loadApiCore().then(_apiReady);

            _setMapSize();

            var _resizeMap = UtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT);

            // $window.addEventListener('resize', _resizeMap); TODO

            $scope.$on('$destory', function(){
                $window.removeEventListener('resize', _resizeMap);
            });


            function _apiReady() {
                // TODO: Move to separate function - _SetupMap
                $scope.heremaps.platform = new H.service.Platform(Config);

                $scope.heremaps.layers = $scope.heremaps.platform.createDefaultLayers();

                if(typeof $scope.coords.lat === 'number' && typeof $scope.coords.lng === 'number') {
                    $scope.heremaps.map = new H.Map($element[0], $scope.heremaps.layers.normal.map, {
                        zoom: $scope.zoom || 10,
                        center: new H.geo.Point($scope.coords.lat, $scope.coords.lng)
                    });

                    _loadModules();    
                } else {
                    console.error('Missed coords');
                }
                

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
                var height = $scope.height || CONSTS.DEFAULT_MAP_SIZE.HEIGHT,
                    width = $scope.width || CONSTS.DEFAULT_MAP_SIZE.WIDTH;

                $scope.mapHeight = height + 'px';
                $scope.mapWidth = width + 'px';

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

heremaps
    .provider('Config', configProvider)
    .service('APIService', ['$q', 'Config', 'UtilsService', apiService])
    .service('UtilsService', utilsService)
    .constant('CONSTS', consts)

heremaps.directive('heremaps', directive);

heremaps.config(["ConfigProvider", function(ConfigProvider) {
    ConfigProvider.setOptions({
        'apiVersion': '3.0',
        'app_id': 'wMHJuLgCQzkfbhzXIwRF',
        'app_code': 'WLIc7QzoO8irv7lurUt1qA',
        'useHTTPS': true
    });
}]);

module.exports = heremaps;
},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/config.provider":4,"./providers/consts":5,"./providers/markers/markers.module":9,"./providers/utils.service":12}],3:[function(require,module,exports){
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
            script = UtilsService.createScriptTag({
                src: src,
                id: sourceName
            });

        head.appendChild(script);
        
        return _createPromise(script);
    }
    
    function _createPromise(script){
        var dererred = $q.defer();
        
        if(!script) {
            dererred.resolve();
            return true;
        }

        script.onload = function(){
            dererred.resolve();
        };
        
        script.onerror = function(){
            dererred.reject();
        };        
        
        return dererred.promise;
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

    var proto = DefaultMarker.prototype = new MarkerInterface();
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

    var proto = DOMMarker.prototype = new MarkerInterface();
    proto.constructor = DOMMarker;

    proto.create = function(){
        return new H.map.DomMarker(this.coords, {
            icon: this._getIcon(),
        });
    };

    proto._getIcon = function(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

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
    function MarkerInterface(){
        throw new Error('Abstract class! The Instance should be created');
    }
    
    var proto = MarkerInterface.prototype;
    
    proto.create = function(){ throw new Error('getInstance:: not implemented'); };
    
    proto.setCoords = function(){
        this.coords = {
            lat: this.place.pos.lat,
            lng: this.place.pos.lng
        }
    }
    
    function Marker(){};
    
    Marker.prototype = proto;
    
    return Marker;
    
}
},{}],9:[function(require,module,exports){
var markerInterface = require('./marker.js'),
	defaultMarker = require('./default.marker.js'),
	domMarker = require('./dom.marker.js'),
	svgMarker = require('./svg.marker.js'),
    markersService = require('./markers.service.js');

angular.module('marker-interface', []).factory('MarkerInterface', markerInterface);
angular.module('default-marker', []).factory('DefaultMarker', defaultMarker);
angular.module('dom-marker', []).factory('DOMMarker', domMarker);
angular.module('svg-marker', []).factory('SVGMarker', svgMarker);

angular.module('markers-service', []).service('MarkersService', markersService);

var app = angular.module('markers-module', [
	'marker-interface',
    'default-marker',
    'dom-marker',
    'markers-service',
    'svg-marker'
]);

module.exports = app;
},{"./default.marker.js":6,"./dom.marker.js":7,"./marker.js":8,"./markers.service.js":10,"./svg.marker.js":11}],10:[function(require,module,exports){
module.exports = function(DefaultMarker, DOMMarker, SVGMarker) {
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

        if (!places || !places.length)
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
module.exports = function(MarkerInterface){
    function SVGMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = SVGMarker.prototype = new MarkerInterface();
    
    proto.constructor = SVGMarker;
    
    proto.create = function(){
        return new H.map.Marker(this.coords, {
            icon: this._getIcon(),
        });
    };
    
    proto._getIcon = function(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.Icon(icon);
    };
    
    return SVGMarker;
}
},{}],12:[function(require,module,exports){
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


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2hlcmVtYXBzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvYXBpLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL2NvbmZpZy5wcm92aWRlci5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RlZmF1bHQubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RvbS5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9zdmcubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy91dGlscy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYW5ndWxhci1oZXJlbWFwcy5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgRG15dHJvIG9uIDQvMTEvMjAxNi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oXHJcbiAgICAkd2luZG93LFxyXG4gICAgQ29uZmlnLFxyXG4gICAgQVBJU2VydmljZSxcclxuICAgIFV0aWxzU2VydmljZSxcclxuICAgIE1hcmtlcnNTZXJ2aWNlLFxyXG4gICAgQ09OU1RTKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiBtYXBXaWR0aCwgJ2hlaWdodCc6IG1hcEhlaWdodH1cXFwiPjwvZGl2PlwiLFxyXG4gICAgICAgIHJlcGxhY2U6IHRydWUsXHJcbiAgICAgICAgc2NvcGU6IHtcclxuICAgICAgICAgICAgY29vcmRzOiAnPScsXHJcbiAgICAgICAgICAgIHpvb206ICc9JyxcclxuICAgICAgICAgICAgaGVpZ2h0OiAnPScsXHJcbiAgICAgICAgICAgIHdpZHRoOiAnPScsXHJcbiAgICAgICAgICAgIHBsYWNlczogJz0nLFxyXG4gICAgICAgICAgICBldmVudHM6ICc9JyAvL1RPRE86IHN1cHBvcnQgcGFzc2luZyBjdXN0b20gbGlzdGVuZXJzXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJHNjb3BlKVxyXG4gICAgICAgICAgICAkc2NvcGUubW9kdWxlcyA9IHtcclxuICAgICAgICAgICAgICAgIGNvbnRyb2xzOiAhISRhdHRycy4kYXR0ci5jb250cm9scyxcclxuICAgICAgICAgICAgICAgIHBhbm86ICEhJGF0dHJzLiRhdHRyLnBhbm8sXHJcbiAgICAgICAgICAgICAgICBldmVudHM6ICEhJGF0dHJzLiRhdHRyLmV2ZW50c1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzID0ge307XHJcblxyXG4gICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRBcGlDb3JlKCkudGhlbihfYXBpUmVhZHkpO1xyXG5cclxuICAgICAgICAgICAgX3NldE1hcFNpemUoKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBfcmVzaXplTWFwID0gVXRpbHNTZXJ2aWNlLnRocm90dGxlKF9yZXNpemVIYW5kbGVyLCBDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCk7XHJcblxyXG4gICAgICAgICAgICAvLyAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9yZXNpemVNYXApOyBUT0RPXHJcblxyXG4gICAgICAgICAgICAkc2NvcGUuJG9uKCckZGVzdG9yeScsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9yZXNpemVNYXApO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBNb3ZlIHRvIHNlcGFyYXRlIGZ1bmN0aW9uIC0gX1NldHVwTWFwXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKENvbmZpZyk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLmxheWVycyA9ICRzY29wZS5oZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYodHlwZW9mICRzY29wZS5jb29yZHMubGF0ID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgJHNjb3BlLmNvb3Jkcy5sbmcgPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLm1hcCA9IG5ldyBILk1hcCgkZWxlbWVudFswXSwgJHNjb3BlLmhlcmVtYXBzLmxheWVycy5ub3JtYWwubWFwLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHpvb206ICRzY29wZS56b29tIHx8IDEwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludCgkc2NvcGUuY29vcmRzLmxhdCwgJHNjb3BlLmNvb3Jkcy5sbmcpXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIF9sb2FkTW9kdWxlcygpOyAgICBcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignTWlzc2VkIGNvb3JkcycpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL1RPRE86IHNob3VsZCBoYXMgYmVlbiByZWZhY3RvcmVkLyB1c2UgJGF0dHJzLiRhdHRyIGRpcmVjdGx5XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9sb2FkTW9kdWxlcygpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBBUElTZXJ2aWNlLmxvYWRNb2R1bGUoJGF0dHJzLiRhdHRyLCB7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgXCJjb250cm9sXCI6IF91aU1vZHVsZVJlYWR5LFxyXG4gICAgICAgICAgICAgICAgLy8gICAgIFwicGFub1wiOiBfcGFub01vZHVsZVJlYWR5XHJcbiAgICAgICAgICAgICAgICAvLyB9KVxyXG5cclxuICAgICAgICAgICAgICAgIGlmICgkc2NvcGUubW9kdWxlcy5jb250cm9scykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZFVJTW9kdWxlKCkudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX3VpTW9kdWxlUmVhZHkoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoJHNjb3BlLm1vZHVsZXMucGFubykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZFBhbm9Nb2R1bGUoKS50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfcGFub01vZHVsZVJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCRzY29wZS5tb2R1bGVzLmV2ZW50cykge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEV2ZW50c01vZHVsZSgpLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF9ldmVudHNNb2R1bGVSZWFkeSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvL1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBVc2UgJHNjb3BlLmhlcmVtYXBzLnVpLmNvbXBvbmVudFxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLnVpQ29tcG9uZW50ID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KCRzY29wZS5oZXJlbWFwcy5tYXAsICRzY29wZS5oZXJlbWFwcy5sYXllcnMpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcGFub01vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgLy8kc2NvcGUuaGVyZW1hcHMucGxhdGZvcm0uY29uZmlndXJlKEgubWFwLnJlbmRlci5wYW5vcmFtYS5SZW5kZXJFbmdpbmUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gJHNjb3BlLmhlcmVtYXBzLm1hcCxcclxuICAgICAgICAgICAgICAgICAgICBldmVudHMgPSAkc2NvcGUuaGVyZW1hcHMubWFwRXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyhtYXApLFxyXG4gICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yID0gJHNjb3BlLmhlcmVtYXBzLmJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKGV2ZW50cyk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uKGV2dCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGV2dC50eXBlLCBldnQuY3VycmVudFBvaW50ZXIudHlwZSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBkaXNhYmxlIHRoZSBkZWZhdWx0IGRyYWdnYWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBtYXBcclxuICAgICAgICAgICAgICAgIC8vIHdoZW4gc3RhcnRpbmcgdG8gZHJhZyBhIG1hcmtlciBvYmplY3Q6XHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBILm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IuZGlzYWJsZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBMaXN0ZW4gdG8gdGhlIGRyYWcgZXZlbnQgYW5kIG1vdmUgdGhlIHBvc2l0aW9uIG9mIHRoZSBtYXJrZXJcclxuICAgICAgICAgICAgICAgIC8vIGFzIG5lY2Vzc2FyeVxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWcnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvaW50ZXIgPSBldi5jdXJyZW50UG9pbnRlcjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgbWFwc2pzLm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKG1hcC5zY3JlZW5Ub0dlbyhwb2ludGVyLnZpZXdwb3J0WCwgcG9pbnRlci52aWV3cG9ydFkpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gcmUtZW5hYmxlIHRoZSBkZWZhdWx0IGRyYWdnYWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBtYXBcclxuICAgICAgICAgICAgICAgIC8vIHdoZW4gZHJhZ2dpbmcgaGFzIGNvbXBsZXRlZFxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG1hcHNqcy5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yLmVuYWJsZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICBNYXJrZXJzU2VydmljZS5hZGRNYXJrZXJUb01hcCgkc2NvcGUuaGVyZW1hcHMsICRzY29wZS5wbGFjZXMpO1xyXG5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoKSB7XHJcbiAgICAgICAgICAgICAgICBfc2V0TWFwU2l6ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5oZXJlbWFwcy5tYXAuZ2V0Vmlld1BvcnQoKS5yZXNpemUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3NldE1hcFNpemUoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaGVpZ2h0ID0gJHNjb3BlLmhlaWdodCB8fCBDT05TVFMuREVGQVVMVF9NQVBfU0laRS5IRUlHSFQsXHJcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSAkc2NvcGUud2lkdGggfHwgQ09OU1RTLkRFRkFVTFRfTUFQX1NJWkUuV0lEVEg7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcEhlaWdodCA9IGhlaWdodCArICdweCc7XHJcbiAgICAgICAgICAgICAgICAkc2NvcGUubWFwV2lkdGggPSB3aWR0aCArICdweCc7XHJcblxyXG4gICAgICAgICAgICAgICAgVXRpbHNTZXJ2aWNlLnJ1blNjb3BlRGlnZXN0SWZOZWVkKCRzY29wZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyIsInJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5tb2R1bGUnKTtcclxuXHJcbnZhciBkaXJlY3RpdmUgPSByZXF1aXJlKCcuL2hlcmVtYXBzLmRpcmVjdGl2ZScpLFxyXG4gICAgY29uZmlnUHJvdmlkZXIgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25maWcucHJvdmlkZXInKSxcclxuICAgIGFwaVNlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9hcGkuc2VydmljZScpLFxyXG4gICAgdXRpbHNTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvdXRpbHMuc2VydmljZScpLFxyXG4gICAgY29uc3RzID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvY29uc3RzJyk7XHJcblxyXG52YXIgaGVyZW1hcHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMnLCBbXHJcbiAgICAnbWFya2Vycy1tb2R1bGUnXHJcbl0pO1xyXG5cclxuaGVyZW1hcHNcclxuICAgIC5wcm92aWRlcignQ29uZmlnJywgY29uZmlnUHJvdmlkZXIpXHJcbiAgICAuc2VydmljZSgnQVBJU2VydmljZScsIFsnJHEnLCAnQ29uZmlnJywgJ1V0aWxzU2VydmljZScsIGFwaVNlcnZpY2VdKVxyXG4gICAgLnNlcnZpY2UoJ1V0aWxzU2VydmljZScsIHV0aWxzU2VydmljZSlcclxuICAgIC5jb25zdGFudCgnQ09OU1RTJywgY29uc3RzKVxyXG5cclxuaGVyZW1hcHMuZGlyZWN0aXZlKCdoZXJlbWFwcycsIGRpcmVjdGl2ZSk7XHJcblxyXG5oZXJlbWFwcy5jb25maWcoW1wiQ29uZmlnUHJvdmlkZXJcIiwgZnVuY3Rpb24oQ29uZmlnUHJvdmlkZXIpIHtcclxuICAgIENvbmZpZ1Byb3ZpZGVyLnNldE9wdGlvbnMoe1xyXG4gICAgICAgICdhcGlWZXJzaW9uJzogJzMuMCcsXHJcbiAgICAgICAgJ2FwcF9pZCc6ICd3TUhKdUxnQ1F6a2ZiaHpYSXdSRicsXHJcbiAgICAgICAgJ2FwcF9jb2RlJzogJ1dMSWM3UXpvTzhpcnY3bHVyVXQxcUEnLFxyXG4gICAgICAgICd1c2VIVFRQUyc6IHRydWVcclxuICAgIH0pO1xyXG59XSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGhlcmVtYXBzOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHEsIENvbmZpZywgVXRpbHNTZXJ2aWNlKXtcclxuICAgIHZhciB2ZXJzaW9uID0gQ29uZmlnLmFwaVZlcnNpb24sXHJcbiAgICAgICAgQVBJX1ZFUlNJT04gPSB7XHJcbiAgICAgICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxyXG4gICAgICAgICAgICBTVUI6IHZlcnNpb25cclxuICAgICAgICB9LFxyXG4gICAgICAgIENPTkZJRyA9IHtcclxuICAgICAgICAgICAgQkFTRTogXCJodHRwOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICAgICAgQ09SRTogXCJtYXBzanMtY29yZS5qc1wiLFxyXG4gICAgICAgICAgICBTRVJWSUNFOiBcIm1hcHNqcy1zZXJ2aWNlLmpzXCIsXHJcbiAgICAgICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgICAgICBzcmM6IFwibWFwc2pzLXVpLmpzXCIsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBcIm1hcHNqcy11aS5jc3NcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBQQU5POiBcIm1hcHNqcy1wYW5vLmpzXCIsXHJcbiAgICAgICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbG9hZEFwaUNvcmU6IGxvYWRBcGlDb3JlLFxyXG4gICAgICAgIGxvYWRVSU1vZHVsZTogbG9hZFVJTW9kdWxlLFxyXG4gICAgICAgIGxvYWRQYW5vTW9kdWxlOiBsb2FkUGFub01vZHVsZSxcclxuICAgICAgICBsb2FkRXZlbnRzTW9kdWxlOiBsb2FkRXZlbnRzTW9kdWxlXHJcbiAgICB9O1xyXG5cclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIGxvYWRBcGlDb3JlKCl7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkNPUkUpXHJcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5TRVJWSUNFKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRVSU1vZHVsZSgpe1xyXG4gICAgICAgIHZhciBsaW5rID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZUxpbmtUYWcoe1xyXG4gICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgdHlwZTogJ3RleHQvY3NzJyxcclxuICAgICAgICAgICAgaHJlZjogX2dldFVSTChDT05GSUcuVUkuaHJlZiksXHJcbiAgICAgICAgICAgIGlkOiBDT05GSUcuVUkuaHJlZlxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBsaW5rICYmIGhlYWQuYXBwZW5kQ2hpbGQobGluayk7XHJcblxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRQYW5vTW9kdWxlKCl7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlBBTk8pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRFdmVudHNNb2R1bGUoKXtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuRVZFTlRTKTtcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUNcclxuXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9nZXRVUkwoc291cmNlTmFtZSl7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgICAgIENPTkZJRy5CQVNFLFxyXG4gICAgICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICAgICAgQVBJX1ZFUlNJT04uU1VCLFxyXG4gICAgICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBzb3VyY2VOYW1lXHJcbiAgICAgICAgICAgIF0uam9pbihcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyKHNvdXJjZU5hbWUpe1xyXG4gICAgICAgIC8vIFRPRE86IEluc3RlYWQgb2YgaWQgeW91IGNhbiBjaGVjayBnbG9iYWwgcHJvcGVydGllc1xyXG4gICAgICAgIHZhciBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxyXG4gICAgICAgICAgICBzY3JpcHQgPSBVdGlsc1NlcnZpY2UuY3JlYXRlU2NyaXB0VGFnKHtcclxuICAgICAgICAgICAgICAgIHNyYzogc3JjLFxyXG4gICAgICAgICAgICAgICAgaWQ6IHNvdXJjZU5hbWVcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gX2NyZWF0ZVByb21pc2Uoc2NyaXB0KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2NyZWF0ZVByb21pc2Uoc2NyaXB0KXtcclxuICAgICAgICB2YXIgZGVyZXJyZWQgPSAkcS5kZWZlcigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKCFzY3JpcHQpIHtcclxuICAgICAgICAgICAgZGVyZXJyZWQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHNjcmlwdC5vbmxvYWQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICBkZXJlcnJlZC5yZXNvbHZlKCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIGRlcmVycmVkLnJlamVjdCgpO1xyXG4gICAgICAgIH07ICAgICAgICBcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZGVyZXJyZWQucHJvbWlzZTtcclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFwiVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVFwiOiA1MDAsXHJcbiAgICBcIkRFRkFVTFRfTUFQX1NJWkVcIjoge1xyXG4gICAgICAgIEhFSUdIVDogNDgwLFxyXG4gICAgICAgIFdJRFRIOiA2NDBcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERlZmF1bHRNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERlZmF1bHRNYXJrZXIucHJvdG90eXBlID0gbmV3IE1hcmtlckludGVyZmFjZSgpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBEZWZhdWx0TWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5NYXJrZXIodGhpcy5jb29yZHMpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBEZWZhdWx0TWFya2VyO1xyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgLy8gVE9ETzogUHVibGljIG1ldGhvZHMgc2hvdWxkIGJlIHBsYWNlZCBmaXJzdCBhbmQgaW1wbGVtZW50YXRpb24gZGV0YWlsIG1vdmVkIGJvdHRvbVxyXG5cclxuICAgIGZ1bmN0aW9uIERPTU1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRE9NTWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRE9NTWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21NYXJrZXIodGhpcy5jb29yZHMsIHtcclxuICAgICAgICAgICAgaWNvbjogdGhpcy5fZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBwcm90by5fZ2V0SWNvbiA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcclxuICAgICAgICAgaWYoIWljb24pXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWFya3VwIG1pc3NlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkRvbUljb24oaWNvbiwgdGhpcy5fZ2V0RXZlbnRzKCkpO1xyXG4gICAgfTtcclxuXHJcbiAgICBwcm90by5fc2V0dXBFdmVudHMgPSBmdW5jdGlvbihlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RvLl9nZXRFdmVudHMgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICAgICAgZXZlbnRzID0gdGhpcy5wbGFjZS5ldmVudHM7XHJcblxyXG4gICAgICAgIGlmKCF0aGlzLnBsYWNlLmV2ZW50cylcclxuICAgICAgICAgICAgcmV0dXJuIHt9O1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAvLyB0aGUgZnVuY3Rpb24gaXMgY2FsbGVkIGV2ZXJ5IHRpbWUgbWFya2VyIGVudGVycyB0aGUgdmlld3BvcnRcclxuICAgICAgICAgICAgb25BdHRhY2g6IGZ1bmN0aW9uKGNsb25lZEVsZW1lbnQsIGRvbUljb24sIGRvbU1hcmtlcil7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zZXR1cEV2ZW50cyhjbG9uZWRFbGVtZW50LCBldmVudHMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgLy8gdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCBldmVyeSB0aW1lIG1hcmtlciBsZWF2ZXMgdGhlIHZpZXdwb3J0XHJcbiAgICAgICAgICAgIG9uRGV0YWNoOiBmdW5jdGlvbihjbG9uZWRFbGVtZW50LCBkb21JY29uLCBkb21NYXJrZXIpe1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fc2V0dXBFdmVudHMoY2xvbmVkRWxlbWVudCwgZXZlbnRzLCB0cnVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIERPTU1hcmtlcjtcclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcclxuICAgIGZ1bmN0aW9uIE1hcmtlckludGVyZmFjZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MhIFRoZSBJbnN0YW5jZSBzaG91bGQgYmUgY3JlYXRlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBNYXJrZXJJbnRlcmZhY2UucHJvdG90eXBlO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBmdW5jdGlvbigpeyB0aHJvdyBuZXcgRXJyb3IoJ2dldEluc3RhbmNlOjogbm90IGltcGxlbWVudGVkJyk7IH07XHJcbiAgICBcclxuICAgIHByb3RvLnNldENvb3JkcyA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdGhpcy5jb29yZHMgPSB7XHJcbiAgICAgICAgICAgIGxhdDogdGhpcy5wbGFjZS5wb3MubGF0LFxyXG4gICAgICAgICAgICBsbmc6IHRoaXMucGxhY2UucG9zLmxuZ1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gTWFya2VyKCl7fTtcclxuICAgIFxyXG4gICAgTWFya2VyLnByb3RvdHlwZSA9IHByb3RvO1xyXG4gICAgXHJcbiAgICByZXR1cm4gTWFya2VyO1xyXG4gICAgXHJcbn0iLCJ2YXIgbWFya2VySW50ZXJmYWNlID0gcmVxdWlyZSgnLi9tYXJrZXIuanMnKSxcclxuXHRkZWZhdWx0TWFya2VyID0gcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpLFxyXG5cdGRvbU1hcmtlciA9IHJlcXVpcmUoJy4vZG9tLm1hcmtlci5qcycpLFxyXG5cdHN2Z01hcmtlciA9IHJlcXVpcmUoJy4vc3ZnLm1hcmtlci5qcycpLFxyXG4gICAgbWFya2Vyc1NlcnZpY2UgPSByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ21hcmtlci1pbnRlcmZhY2UnLCBbXSkuZmFjdG9yeSgnTWFya2VySW50ZXJmYWNlJywgbWFya2VySW50ZXJmYWNlKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RlZmF1bHQtbWFya2VyJywgW10pLmZhY3RvcnkoJ0RlZmF1bHRNYXJrZXInLCBkZWZhdWx0TWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RvbS1tYXJrZXInLCBbXSkuZmFjdG9yeSgnRE9NTWFya2VyJywgZG9tTWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ3N2Zy1tYXJrZXInLCBbXSkuZmFjdG9yeSgnU1ZHTWFya2VyJywgc3ZnTWFya2VyKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLXNlcnZpY2UnLCBbXSkuc2VydmljZSgnTWFya2Vyc1NlcnZpY2UnLCBtYXJrZXJzU2VydmljZSk7XHJcblxyXG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ21hcmtlcnMtbW9kdWxlJywgW1xyXG5cdCdtYXJrZXItaW50ZXJmYWNlJyxcclxuICAgICdkZWZhdWx0LW1hcmtlcicsXHJcbiAgICAnZG9tLW1hcmtlcicsXHJcbiAgICAnbWFya2Vycy1zZXJ2aWNlJyxcclxuICAgICdzdmctbWFya2VyJ1xyXG5dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYXBwOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oRGVmYXVsdE1hcmtlciwgRE9NTWFya2VyLCBTVkdNYXJrZXIpIHtcclxuICAgIC8vIFRPRE86IFNob3VsZCBiZSBwbGFjZWQgaW4gY29uc3QgZmlsZVxyXG4gICAgdmFyIE1BUktFUl9UWVBFUyA9IHtcclxuICAgICAgICBERUZBVUxUOiAwLFxyXG4gICAgICAgIERPTTogMSxcclxuICAgICAgICBTVkc6IDJcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJUb01hcDogYWRkTWFya2VyVG9NYXBcclxuICAgIH1cclxuXHJcbiAgICAvLyBUT0RPOiBZb3Ugc2hvdWxkIHBhc3Mgb25seSBNQVAgaW5zdGVhZCBvZiBmdWxsIGhlcmVtYXBzIG9ialxyXG4gICAgZnVuY3Rpb24gYWRkTWFya2VyVG9NYXAoaGVyZW1hcHMsIHBsYWNlcykge1xyXG4gICAgICAgIHZhciBtYXAgPSBoZXJlbWFwcy5tYXA7XHJcblxyXG4gICAgICAgIGlmICghcGxhY2VzIHx8ICFwbGFjZXMubGVuZ3RoKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGlmICghKG1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBtYXAgaW5zdGFuY2UnKTtcclxuXHJcbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24ocGxhY2UsIGkpIHtcclxuICAgICAgICAgICAgdmFyIGNyZWF0b3IgPSBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSk7XHJcbiAgICAgICAgICAgIHZhciBtYXJrZXIgPSBwbGFjZS5kcmFnZ2FibGUgPyBfZHJhZ2dhYmxlTWFya2VyTWl4aW4oY3JlYXRvci5jcmVhdGUoKSkgOiBjcmVhdG9yLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgbWFwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSkge1xyXG4gICAgICAgIHZhciBDb25jcmV0ZU1hcmtlcjtcclxuXHJcbiAgICAgICAgc3dpdGNoKHBsYWNlLnR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBTVkdNYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRGVmYXVsdE1hcmtlcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcclxuICAgICAgICAvLyBFbnN1cmUgdGhhdCB0aGUgbWFya2VyIGNhbiByZWNlaXZlIGRyYWcgZXZlbnRzXHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIFNWR01hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBwcm90byA9IFNWR01hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gU1ZHTWFya2VyO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuX2dldEljb24oKSxcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHByb3RvLl9nZXRJY29uID0gZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuSWNvbihpY29uKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHJldHVybiBTVkdNYXJrZXI7XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRyb290U2NvcGUsICR0aW1lb3V0KXtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxyXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxyXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXHJcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyNyZWdpb24gUFVCTElDXHJcbiAgICBmdW5jdGlvbiB0aHJvdHRsZShmbiwgcGVyaW9kKXtcclxuICAgICAgICB2YXIgdGltZW91dCA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIGlmKCR0aW1lb3V0KVxyXG4gICAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRpbWVvdXQgPSAkdGltZW91dChmbiwgcGVyaW9kKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHJ1blNjb3BlRGlnZXN0SWZOZWVkKHNjb3BlLCBjYikge1xyXG4gICAgICAgIGlmIChzY29wZS4kcm9vdCAmJiBzY29wZS4kcm9vdC4kJHBoYXNlICE9PSAnJGFwcGx5JyAmJiBzY29wZS4kcm9vdC4kJHBoYXNlICE9PSAnJGRpZ2VzdCcpIHtcclxuICAgICAgICAgICAgc2NvcGUuJGRpZ2VzdChjYiB8fCBhbmd1bGFyLm5vb3ApO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVTY3JpcHRUYWcoYXR0cnMpe1xyXG4gICAgICAgIGlmKGF0dHJzLmlkICYmIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmlkKSlcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuXHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gc2NyaXB0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUxpbmtUYWcoYXR0cnMpIHtcclxuICAgICAgICBpZihhdHRycy5pZCAmJiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5pZCkpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcblxyXG4gICAgICAgIF9zZXRBdHRycyhsaW5rLCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQyBcclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xyXG4gICAgICAgIGlmKCFlbCB8fCAhYXR0cnMpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2VkIGF0dHJpYnV0ZXMnKTtcclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiXX0=
