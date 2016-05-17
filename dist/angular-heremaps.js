(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function(
    $timeout,
    $window,
    $rootScope,
    HereMapsConfig,
    APIService,
    HereMapUtilsService,
    MarkersService,
    CONSTS) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': mapWidth, 'height': mapHeight}\"></div>",
        replace: true,
        scope: {
            opts: '=options',
            places: '=',
            onMapReady: "&mapReady"
        },
        controller: function($scope, $element, $attrs) {
            var options = angular.extend({}, CONSTS.DEFAULT_MAP_OPTIONS, $scope.opts),
                position = options.coords;

            var heremaps = {}, mapReady = $scope.onMapReady();

            $element[0].parentNode.style.overflow = 'hidden';

            $timeout(function(){
                return _setMapSize();
            }).then(function(){
                APIService.loadApi().then(_apiReady);
            });

            options.resize && addOnResizeListener();

            $scope.$on('$destroy', function() {
                $window.removeEventListener('resize', _resizeMap);
            });

            function addOnResizeListener() {
                var _onResizeMap = HereMapUtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT);
                $window.addEventListener('resize', _onResizeMap);
            }

            function _apiReady() {
                _setupMapPlatform();

                _setupMap();
            }

            function _setupMapPlatform() {
                heremaps.platform = new H.service.Platform(HereMapsConfig);
                heremaps.layers = heremaps.platform.createDefaultLayers();
            }

            function _getLocation() {
                return APIService.getPosition({
                    coords: position,
                    enableHighAccuracy: true,
                    maximumAge: 10000
                });
            }

            function _locationFailure() {
                console.error('Can not get a geo position');
            }

            function _setupMap(coords) {
                if (coords)
                    position = coords;

                _initMap(function() {
                    APIService.loadModules($attrs.$attr, {
                        "controls": _uiModuleReady,
                        "events": _eventsModuleReady
                    });
                });
            }

            function _initMap(cb) {
                console.log(position)
                var map = heremaps.map = new H.Map($element[0], heremaps.layers.normal.map, {
                    zoom: options.zoom,
                    center: new H.geo.Point(position.latitude, position.longitude)
                });
                
                // MarkersService.addUserMarker(map, {
                //     pos: { lat: position.latitude, lng: position.longitude }
                // });

                MarkersService.addMarkersToMap(map, $scope.places);

                mapReady && mapReady(MapProxy());

                cb && cb();
            }

            function _uiModuleReady() {
                var ui = heremaps.ui = H.ui.UI.createDefault(heremaps.map, heremaps.layers);

                _setControlsPosition(ui);
            }
            
            function _setControlsPosition(ui){
                var position = $attrs.controls;
                if(!ui || !_isValidPosition(position))
                    return;

                var availableControls = CONSTS.CONTROLS; 
                for(key in availableControls){
                    if(!availableControls.hasOwnProperty(key))
                        continue;
                    var value = availableControls[key],
                        control = ui.getControl(value);
                        
                    if(!control)
                        return;
                        
                    control.setAlignment(position);
                }
            }
            
            function _isValidPosition(position){
                var isValid = false;
                switch(position) {
                    case 'top-right':
                    case 'top-left':
                    case 'bottom-right':
                    case 'bottom-left':
                        isValid = true;
                        break;
                    default:
                        isValid = false;
                }
                
                return isValid;
            }

            function _eventsModuleReady() {
                var map = heremaps.map,
                    events = heremaps.mapEvents = new H.mapevents.MapEvents(map),
                    behavior = heremaps.behavior = new H.mapevents.Behavior(events);

                map.addEventListener('tap', function(evt) {
                    // console.log(evt.type, evt.currentPointer.type);
                });

                map.addEventListener('dragstart', function(ev) {
                    var target = ev.target;
                    if (target instanceof H.map.Marker) {
                        behavior.disable();
                    }
                }, false);

                map.addEventListener('drag', function(ev) {
                    var target = ev.target,
                        pointer = ev.currentPointer;
                    if (target instanceof mapsjs.map.Marker) {
                        target.setPosition(map.screenToGeo(pointer.viewportX, pointer.viewportY));
                    }
                }, false);

                map.addEventListener('dragend', function(ev) {
                    var target = ev.target;
                    if (target instanceof mapsjs.map.Marker) {
                        behavior.enable();
                    }
                }, false);

                map.draggable = options.draggable;
            }

            function _resizeHandler() {
                _setMapSize(true);

                heremaps.map.getViewPort().resize();
            }

            function _setMapSize() {
                var height = $element[0].parentNode.offsetHeight || options.height,
                    width = $element[0].parentNode.offsetWidth || options.width;

                $scope.mapHeight = height + 'px';
                $scope.mapWidth = width + 'px';

                HereMapUtilsService.runScopeDigestIfNeed($scope);
            }

            function MapProxy() {
                return {
                    getMap: function() {
                        return heremaps.map
                    },
                    calculateRoute: function(driveType, direction) {
                        APIService.calculateRoute(heremaps.platform, heremaps.map, {
                            driveType: driveType,
                            direction: direction
                        });
                    },
                    setZoom: function(zoom){
                      heremaps.map.setZoom(zoom || 10);  
                    },
                    setCenter: function(coords) {
                        if (!coords) {
                            return _getLocation()
                                .then(function(response) {
                                    heremaps.map.setCenter({
                                        lng: response.coords.longitude,
                                        lat: response.coords.latitude
                                    });
                                })
                                .catch(_locationFailure);
                        }

                        heremaps.map.setCenter(coords);
                    }
                }
            }

        }
    }
};

},{}],2:[function(require,module,exports){
require('./providers/markers/markers.module');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/mapconfig.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/utils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module'
]);

heremaps
    .provider('HereMapsConfig', configProvider)
    .service('APIService', ['$q', 'HereMapsConfig', 'HereMapUtilsService', 'CONSTS', apiService])
    .service('HereMapUtilsService', utilsService)
    .constant('CONSTS', consts);

heremaps.directive('heremaps', directive);

module.exports = heremaps;
},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/consts":4,"./providers/mapconfig.provider":5,"./providers/markers/markers.module":9,"./providers/utils.service":12}],3:[function(require,module,exports){
module.exports = function($q, HereMapsConfig, HereMapUtilsService, CONSTS) {
    var version = HereMapsConfig.apiVersion;

    var API_VERSION = {
        V: parseInt(version),
        SUB: version
    };

    var CONFIG = {
        BASE: "https://js.api.here.com/v",
        CORE: "mapsjs-core.js",
        SERVICE: "mapsjs-service.js",
        UI: {
            src: "mapsjs-ui.js",
            href: "mapsjs-ui.css"
        },
        EVENTS: "mapsjs-mapevents.js"
    };

    var API_DEFERSQueue = {};

    API_DEFERSQueue[CONFIG.CORE] = [];
    API_DEFERSQueue[CONFIG.SERVICE] = [];
    API_DEFERSQueue[CONFIG.UI.src] = [];
    API_DEFERSQueue[CONFIG.PANO] = [];
    API_DEFERSQueue[CONFIG.EVENTS] = [];

    var head = document.getElementsByTagName('head')[0];

    return {
        loadApi: loadApi,
        loadModules: loadModules,
        getPosition: getPosition,
        calculateRoute: calculateRoute
    };

    //#region PUBLIC
    function loadApi() {
        return _getLoader(CONFIG.CORE)
            .then(function() {
                return _getLoader(CONFIG.SERVICE);
            });
    }

    function loadModules(attrs, handlers) {
        for (var key in handlers) {
            if (!handlers.hasOwnProperty(key) || !attrs[key])
                continue;

            var loader = _getLoaderByAttr(key);

            loader()
                .then(handlers[key]);
        }
    }

    function getPosition(options) {
        var dererred = $q.defer();

        if (_isValidCoords(options.coords)) {
            dererred.resolve({ coords: options.coords });
        } else {
            navigator.geolocation.getCurrentPosition(function(response) {
                dererred.resolve(response);
            }, function(error) {
                dererred.reject(error);
            }, options);
        }

        return dererred.promise;
    }

    /**
     * @params {Object} driveType, from, to
     */
    function calculateRoute(platform, map, params) {
        var router = platform.getRoutingService(),
            dir = params.direction;
        
        var routeRequestParams = {
            mode: 'fastest;{{Vechile}}'.replace(/{{Vechile}}/, params.driveType),
            representation: 'display',
            routeattributes: 'waypoints,summary,shape,legs',
            maneuverattributes: 'direction,action',
            waypoint0: [dir.from.lat, dir.from.lng].join(','),
            waypoint1: [dir.to.lat, dir.to.lng].join(',')
        };
            
        router.calculateRoute(
            routeRequestParams,
            _onRouteSuccess,
            _onRouteFailure
        );
    }
    //#endregion PUBLIC


    //#region PRIVATE
    function _onRouteSuccess(result){
        // console.log(result)
    }
    
    function _onRouteFailure(error){
        // console.log('Calculate route failure', error);
    }
    
    function _getLoaderByAttr(attr) {
        var loader;

        switch (attr) {
            case CONSTS.MODULES.UI:
                loader = _loadUIModule;
                break;
            case CONSTS.MODULES.EVENTS:
                loader = _loadEventsModule;
                break;
            default:
                throw new Error('Unknown module', attr);
        }

        return loader;
    }

    function _loadUIModule() {
        if (!_isLoaded(CONFIG.UI)) {
            var link = HereMapUtilsService.createLinkTag({
                rel: 'stylesheet',
                type: 'text/css',
                href: _getURL(CONFIG.UI.href)
            });

            link && head.appendChild(link);
        }

        return _getLoader(CONFIG.UI.src);
    }

    function _loadEventsModule() {
        return _getLoader(CONFIG.EVENTS);
    }

    /**
     * @param {String} sourceName
     * return {String} e.g http://js.api.here.com/v{VER}/{SUBVERSION}/{SOURCE}
     */
    function _getURL(sourceName) {
        return [
            CONFIG.BASE,
            API_VERSION.V,
            "/",
            API_VERSION.SUB,
            "/",
            sourceName
        ].join("");
    }

    function _getLoader(sourceName) {
        var defer = $q.defer(), src, script;

        if (_isLoaded(sourceName)) {
            defer.resolve();
        } else {
            src = _getURL(sourceName),
                script = HereMapUtilsService.createScriptTag({ src: src });

            script && head.appendChild(script);

            API_DEFERSQueue[sourceName].push(defer);

            script.onload = _onLoad.bind(null, sourceName);
            script.onerror = _onError.bind(null, sourceName);
        }

        return defer.promise;
    }

    function _isLoaded(sourceName) {
        var checker = null;

        switch (sourceName) {
            case CONFIG.CORE:
                checker = _isCoreLoaded;
                break;
            case CONFIG.SERVICE:
                checker = _isServiceLoaded;
                break;
            case CONFIG.UI:
                checker = _isUILoaded;
                break;
            case CONFIG.EVENTS:
                checker = _isEventsLoaded;
                break;
            default:
                checker = function() { return false };
        }

        return checker();
    }

    function _isCoreLoaded() {
        return !!window.H;
    }

    function _isServiceLoaded() {
        return !!(window.H && window.H.service);
    }

    function _isUILoaded() {
        return !!(window.H && window.H.ui);
    }

    function _isEventsLoaded() {
        return !!(window.H && window.H.mapevents);
    }

    function _onLoad(sourceName) {
        var deferQueue = API_DEFERSQueue[sourceName];
        for (var i = 0, l = deferQueue.length; i < l; ++i) {
            var defer = deferQueue[i];
            defer.resolve();
        }

        API_DEFERSQueue[sourceName] = [];
    }

    function _onError(sourceName) {
        var deferQueue = API_DEFERSQueue[sourceName];
        for (var i = 0, l = deferQueue.length; i < l; ++i) {
            var defer = deferQueue[i];
            defer.reject();
        }

        API_DEFERSQueue[sourceName] = [];
    }
    
    
    /**
     * Creates a H.map.Polyline from the shape of the route and adds it to the map.
     * @param {Object} route A route as received from the H.service.RoutingService
     */
    function addRouteShapeToMap(map, route){
        var strip = new H.geo.Strip(),
            routeShape = route.shape,
            polyline;

        routeShape.forEach(function(point) {
            var parts = point.split(',');
            strip.pushLatLngAlt(parts[0], parts[1]);
        });

        polyline = new H.map.Polyline(strip, {
            style: {
            lineWidth: 4,
            strokeColor: 'rgba(0, 128, 255, 0.7)'
            }
        });
        // Add the polyline to the map
        map.addObject(polyline);
        // And zoom to its bounding rectangle
        map.setViewBounds(polyline.getBounds(), true);
    }


    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addManueversToMap(map, route){
        var svgMarkup = '<svg width="18" height="18" ' +
            'xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="8" cy="8" r="8" ' +
            'fill="#1b468d" stroke="white" stroke-width="1"  />' +
            '</svg>',
            dotIcon = new H.map.Icon(svgMarkup, {anchor: {x:8, y:8}}),
            group = new  H.map.Group(),
            i,
            j;

        // Add a marker for each maneuver
        for (i = 0;  i < route.leg.length; i += 1) {
            for (j = 0;  j < route.leg[i].maneuver.length; j += 1) {
                // Get the next maneuver.
                maneuver = route.leg[i].maneuver[j];
                // Add a marker to the maneuvers group
                var marker =  new H.map.Marker({
                        lat: maneuver.position.latitude,
                        lng: maneuver.position.longitude},
                        {icon: dotIcon}
                    );
                    
                marker.instruction = maneuver.instruction;
                group.addObject(marker);
            }
        }

        group.addEventListener('tap', function (evt) {
            map.setCenter(evt.target.getPosition());
            openBubble(evt.target.getPosition(), evt.target.instruction);
        }, false);

        // Add the maneuvers group to the map
        map.addObject(group);
    }


    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addWaypointsToPanel(waypoints){
        var nodeH3 = document.createElement('h3'),
            waypointLabels = [],
            i;

        for (i = 0;  i < waypoints.length; i += 1) {
            waypointLabels.push(waypoints[i].label)
        }

        nodeH3.textContent = waypointLabels.join(' - ');

        routeInstructionsContainer.innerHTML = '';
        routeInstructionsContainer.appendChild(nodeH3);
    }

    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addSummaryToPanel(summary){
        var summaryDiv = document.createElement('div'),
            content = '';
            
        content += '<b>Total distance</b>: ' + summary.distance  + 'm. <br/>';
        content += '<b>Travel Time</b>: ' + summary.travelTime.toMMSS() + ' (in current traffic)';


        summaryDiv.style.fontSize = 'small';
        summaryDiv.style.marginLeft ='5%';
        summaryDiv.style.marginRight ='5%';
        summaryDiv.innerHTML = content;
        routeInstructionsContainer.appendChild(summaryDiv);
    }

    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addManueversToPanel(route){
        var nodeOL = document.createElement('ol'), i, j;

        nodeOL.style.fontSize = 'small';
        nodeOL.style.marginLeft ='5%';
        nodeOL.style.marginRight ='5%';
        nodeOL.className = 'directions';

        // Add a marker for each maneuver
        for (i = 0;  i < route.leg.length; i += 1) {
            for (j = 0;  j < route.leg[i].maneuver.length; j += 1) {
            // Get the next maneuver.
            maneuver = route.leg[i].maneuver[j];

            var li = document.createElement('li'),
                spanArrow = document.createElement('span'),
                spanInstruction = document.createElement('span');

            spanArrow.className = 'arrow '  + maneuver.action;
            spanInstruction.innerHTML = maneuver.instruction;
            li.appendChild(spanArrow);
            li.appendChild(spanInstruction);

            nodeOL.appendChild(li);
            }
        }

        routeInstructionsContainer.appendChild(nodeOL);
    }
    
    function _isValidCoords(coords){
        var lng = coords && coords.longitude,
            lat = coords && coords.latitude;
            
        return (typeof lng === 'number' || typeof lng === 'string') &&
                (typeof lat === 'number' || typeof lat === 'string'); 
    }
};
},{}],4:[function(require,module,exports){
module.exports = {
    "UPDATE_MAP_RESIZE_TIMEOUT": 500,
    "MODULES": {
        UI: 'controls',
        EVENTS: 'events',
        PANO: 'pano'
    },
    "DEFAULT_MAP_OPTIONS": {
        height: 480,
        width: 640,
        zoom: 10,
        draggable: false,
        coords: {
            longitude: 0,
            latitude: 0
        }
    },
    "MARKER_TYPES": {
        DOM: "DOM",
        SVG: "SVG"
    },
    "CONTROLS": {
        settings: 'mapsettings',
        zoom: 'zoom',
        scale: 'scalebar',
        pano: 'panorama'
    }
}
},{}],5:[function(require,module,exports){
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
},{}],6:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function DefaultMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DefaultMarker.prototype = new MarkerInterface();
    proto.constructor = DefaultMarker;

    proto.create = create;

    return DefaultMarker;
    
    function create(){
        return new H.map.Marker(this.coords);
    }
}
},{}],7:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function DOMMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DOMMarker.prototype = new MarkerInterface();
    proto.constructor = DOMMarker;

    proto.create = create;
    proto._getIcon = _getIcon;
    proto._setupEvents = _setupEvents;
    proto._getEvents = _getEvents;

    return DOMMarker;
    
    function create(){
        return new H.map.DomMarker(this.coords, {
            icon: this._getIcon()
        });
    }
    
    function _getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.DomIcon(icon, this._getEvents());
    }
    
    function _setupEvents(el, events, remove){
        var method = remove ? 'removeEventListener' : 'addEventListener';

        for(var key in events) {
            if(!events.hasOwnProperty(key))
                continue;

            el[method].call(null, key, events[key]);
        }
    }
    
    function _getEvents(){
        var self = this,
            events = this.place.events;

        if(!this.place.events)
            return {};

        return {
            onAttach: function(clonedElement, domIcon, domMarker){
                self._setupEvents(clonedElement, events);
            },
            onDetach: function(clonedElement, domIcon, domMarker){
                self._setupEvents(clonedElement, events, true);
            }
        }
    }
}
},{}],8:[function(require,module,exports){
module.exports = function(){
    function MarkerInterface(){
        throw new Error('Abstract class! The Instance should be created');
    }
    
    var proto = MarkerInterface.prototype;
    
    proto.create = create;
    proto.setCoords = setCoords;
    
    function Marker(){}
    
    Marker.prototype = proto;
    
    return Marker;
    
    function create(){
        throw new Error('create:: not implemented'); 
    }
    
    function setCoords(){
         this.coords = {
            lat: this.place.pos.lat,
            lng: this.place.pos.lng
        }
    }
    
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
module.exports = function(DefaultMarker, DOMMarker, SVGMarker, CONSTS) {

    var MARKER_TYPES = CONSTS.MARKER_TYPES;
    return {
        addMarkersToMap: addMarkersToMap,
        addUserMarker: addUserMarker
    }

    function addMarkersToMap(map, places) {
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

    function addUserMarker(map, place) {
        var styles = [
            "border-radius: 50%",
            "background-color: rgba(38, 33, 97, .8)",
            "height: 12px",
            "width: 12px"
        ];

        var markup = '<div style="{style}"></div>';
        place.markup = markup.replace(/{style}/, styles.join(';'));

        var creator = new DOMMarker(place);

        map.addObject(creator.create());
        
        // var marker = new H.map.Circle(place.pos, 10000, {
        //         style: {
        //             strokeColor: 'rgba(55, 85, 170, 0.6)', // Color of the perimeter
        //             lineWidth: 2,
        //             fillColor: 'rgba(0, 128, 0, 0.7)'  // Color of the circle
        //         }
        //     }
        // );
        
        // map.addObject(marker);
    }

    function _getMarkerCreator(place) {
        var ConcreteMarker,
            type = place.type ? place.type.toUpperCase() : null;

        switch (type) {
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
    
    proto.create = create;
    proto._getIcon = _getIcon;
    
    return SVGMarker;
    
    function create(){
        return new H.map.Marker(this.coords, {
            icon: this._getIcon(),
        });
    }
    
    function _getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.Icon(icon);
    }
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
        var script = document.getElementById(attrs.src);
        
        if(script)
            return false;
        
        script = document.createElement('script');
        script.type = 'text/javascript';
        script.id = attrs.src;
        _setAttrs(script, attrs);    

        return script;
    }

    function createLinkTag(attrs) {
        var link = document.getElementById(attrs.href);
        
        if(link)
            return false;
            
        link = document.createElement('link');
        link.id = attrs.href;
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


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5tb2R1bGUuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3V0aWxzLnNlcnZpY2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJhbmd1bGFyLWhlcmVtYXBzLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcclxuICogQ3JlYXRlZCBieSBEbXl0cm8gb24gNC8xMS8yMDE2LlxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihcclxuICAgICR0aW1lb3V0LFxyXG4gICAgJHdpbmRvdyxcclxuICAgICRyb290U2NvcGUsXHJcbiAgICBIZXJlTWFwc0NvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLFxyXG4gICAgTWFya2Vyc1NlcnZpY2UsXHJcbiAgICBDT05TVFMpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgICAgdGVtcGxhdGU6IFwiPGRpdiBuZy1zdHlsZT1cXFwieyd3aWR0aCc6IG1hcFdpZHRoLCAnaGVpZ2h0JzogbWFwSGVpZ2h0fVxcXCI+PC9kaXY+XCIsXHJcbiAgICAgICAgcmVwbGFjZTogdHJ1ZSxcclxuICAgICAgICBzY29wZToge1xyXG4gICAgICAgICAgICBvcHRzOiAnPW9wdGlvbnMnLFxyXG4gICAgICAgICAgICBwbGFjZXM6ICc9JyxcclxuICAgICAgICAgICAgb25NYXBSZWFkeTogXCImbWFwUmVhZHlcIlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XHJcbiAgICAgICAgICAgIHZhciBvcHRpb25zID0gYW5ndWxhci5leHRlbmQoe30sIENPTlNUUy5ERUZBVUxUX01BUF9PUFRJT05TLCAkc2NvcGUub3B0cyksXHJcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IG9wdGlvbnMuY29vcmRzO1xyXG5cclxuICAgICAgICAgICAgdmFyIGhlcmVtYXBzID0ge30sIG1hcFJlYWR5ID0gJHNjb3BlLm9uTWFwUmVhZHkoKTtcclxuXHJcbiAgICAgICAgICAgICRlbGVtZW50WzBdLnBhcmVudE5vZGUuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcclxuXHJcbiAgICAgICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gX3NldE1hcFNpemUoKTtcclxuICAgICAgICAgICAgfSkudGhlbihmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkQXBpKCkudGhlbihfYXBpUmVhZHkpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIG9wdGlvbnMucmVzaXplICYmIGFkZE9uUmVzaXplTGlzdGVuZXIoKTtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9yZXNpemVNYXApO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFkZE9uUmVzaXplTGlzdGVuZXIoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgX29uUmVzaXplTWFwID0gSGVyZU1hcFV0aWxzU2VydmljZS50aHJvdHRsZShfcmVzaXplSGFuZGxlciwgQ09OU1RTLlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQpO1xyXG4gICAgICAgICAgICAgICAgJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICBfc2V0dXBNYXBQbGF0Zm9ybSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIF9zZXR1cE1hcCgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXBQbGF0Zm9ybSgpIHtcclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLnBsYXRmb3JtID0gbmV3IEguc2VydmljZS5QbGF0Zm9ybShIZXJlTWFwc0NvbmZpZyk7XHJcbiAgICAgICAgICAgICAgICBoZXJlbWFwcy5sYXllcnMgPSBoZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9nZXRMb2NhdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBBUElTZXJ2aWNlLmdldFBvc2l0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgICBjb29yZHM6IHBvc2l0aW9uLFxyXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBtYXhpbXVtQWdlOiAxMDAwMFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9sb2NhdGlvbkZhaWx1cmUoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDYW4gbm90IGdldCBhIGdlbyBwb3NpdGlvbicpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXAoY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29vcmRzKVxyXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gY29vcmRzO1xyXG5cclxuICAgICAgICAgICAgICAgIF9pbml0TWFwKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZE1vZHVsZXMoJGF0dHJzLiRhdHRyLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiY29udHJvbHNcIjogX3VpTW9kdWxlUmVhZHksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZXZlbnRzXCI6IF9ldmVudHNNb2R1bGVSZWFkeVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9pbml0TWFwKGNiKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhwb3NpdGlvbilcclxuICAgICAgICAgICAgICAgIHZhciBtYXAgPSBoZXJlbWFwcy5tYXAgPSBuZXcgSC5NYXAoJGVsZW1lbnRbMF0sIGhlcmVtYXBzLmxheWVycy5ub3JtYWwubWFwLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgem9vbTogb3B0aW9ucy56b29tLFxyXG4gICAgICAgICAgICAgICAgICAgIGNlbnRlcjogbmV3IEguZ2VvLlBvaW50KHBvc2l0aW9uLmxhdGl0dWRlLCBwb3NpdGlvbi5sb25naXR1ZGUpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gTWFya2Vyc1NlcnZpY2UuYWRkVXNlck1hcmtlcihtYXAsIHtcclxuICAgICAgICAgICAgICAgIC8vICAgICBwb3M6IHsgbGF0OiBwb3NpdGlvbi5sYXRpdHVkZSwgbG5nOiBwb3NpdGlvbi5sb25naXR1ZGUgfVxyXG4gICAgICAgICAgICAgICAgLy8gfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UuYWRkTWFya2Vyc1RvTWFwKG1hcCwgJHNjb3BlLnBsYWNlcyk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwUmVhZHkgJiYgbWFwUmVhZHkoTWFwUHJveHkoKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdWkgPSBoZXJlbWFwcy51aSA9IEgudWkuVUkuY3JlYXRlRGVmYXVsdChoZXJlbWFwcy5tYXAsIGhlcmVtYXBzLmxheWVycyk7XHJcblxyXG4gICAgICAgICAgICAgICAgX3NldENvbnRyb2xzUG9zaXRpb24odWkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0Q29udHJvbHNQb3NpdGlvbih1aSl7XHJcbiAgICAgICAgICAgICAgICB2YXIgcG9zaXRpb24gPSAkYXR0cnMuY29udHJvbHM7XHJcbiAgICAgICAgICAgICAgICBpZighdWkgfHwgIV9pc1ZhbGlkUG9zaXRpb24ocG9zaXRpb24pKVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgYXZhaWxhYmxlQ29udHJvbHMgPSBDT05TVFMuQ09OVFJPTFM7IFxyXG4gICAgICAgICAgICAgICAgZm9yKGtleSBpbiBhdmFpbGFibGVDb250cm9scyl7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIWF2YWlsYWJsZUNvbnRyb2xzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IGF2YWlsYWJsZUNvbnRyb2xzW2tleV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRyb2wgPSB1aS5nZXRDb250cm9sKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIWNvbnRyb2wpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbC5zZXRBbGlnbm1lbnQocG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfaXNWYWxpZFBvc2l0aW9uKHBvc2l0aW9uKXtcclxuICAgICAgICAgICAgICAgIHZhciBpc1ZhbGlkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBzd2l0Y2gocG9zaXRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICd0b3AtcmlnaHQnOlxyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3RvcC1sZWZ0JzpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdib3R0b20tcmlnaHQnOlxyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2JvdHRvbS1sZWZ0JzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNWYWxpZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzVmFsaWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzVmFsaWQ7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9ldmVudHNNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBtYXAgPSBoZXJlbWFwcy5tYXAsXHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzID0gaGVyZW1hcHMubWFwRXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyhtYXApLFxyXG4gICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yID0gaGVyZW1hcHMuYmVoYXZpb3IgPSBuZXcgSC5tYXBldmVudHMuQmVoYXZpb3IoZXZlbnRzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWhhdmlvci5kaXNhYmxlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyID0gZXYuY3VycmVudFBvaW50ZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG1hcHNqcy5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldC5zZXRQb3NpdGlvbihtYXAuc2NyZWVuVG9HZW8ocG9pbnRlci52aWV3cG9ydFgsIHBvaW50ZXIudmlld3BvcnRZKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBtYXBzanMubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWhhdmlvci5lbmFibGUoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmRyYWdnYWJsZSA9IG9wdGlvbnMuZHJhZ2dhYmxlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcmVzaXplSGFuZGxlcigpIHtcclxuICAgICAgICAgICAgICAgIF9zZXRNYXBTaXplKHRydWUpO1xyXG5cclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5nZXRWaWV3UG9ydCgpLnJlc2l6ZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSAkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldEhlaWdodCB8fCBvcHRpb25zLmhlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aCA9ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0V2lkdGggfHwgb3B0aW9ucy53aWR0aDtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUubWFwSGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXBXaWR0aCA9IHdpZHRoICsgJ3B4JztcclxuXHJcbiAgICAgICAgICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLnJ1blNjb3BlRGlnZXN0SWZOZWVkKCRzY29wZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIE1hcFByb3h5KCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBnZXRNYXA6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBjYWxjdWxhdGVSb3V0ZTogZnVuY3Rpb24oZHJpdmVUeXBlLCBkaXJlY3Rpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgQVBJU2VydmljZS5jYWxjdWxhdGVSb3V0ZShoZXJlbWFwcy5wbGF0Zm9ybSwgaGVyZW1hcHMubWFwLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcml2ZVR5cGU6IGRyaXZlVHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogZGlyZWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc2V0Wm9vbTogZnVuY3Rpb24oem9vbSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Wm9vbSh6b29tIHx8IDEwKTsgIFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc2V0Q2VudGVyOiBmdW5jdGlvbihjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9jYXRpb24oKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5zZXRDZW50ZXIoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5nOiByZXNwb25zZS5jb29yZHMubG9uZ2l0dWRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiByZXNwb25zZS5jb29yZHMubGF0aXR1ZGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goX2xvY2F0aW9uRmFpbHVyZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5zZXRDZW50ZXIoY29vcmRzKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG4iLCJyZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlJyk7XHJcblxyXG52YXIgZGlyZWN0aXZlID0gcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSxcclxuICAgIGNvbmZpZ1Byb3ZpZGVyID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwY29uZmlnLnByb3ZpZGVyJyksXHJcbiAgICBhcGlTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvYXBpLnNlcnZpY2UnKSxcclxuICAgIHV0aWxzU2VydmljZSA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL3V0aWxzLnNlcnZpY2UnKSxcclxuICAgIGNvbnN0cyA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbnN0cycpO1xyXG5cclxudmFyIGhlcmVtYXBzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzJywgW1xyXG4gICAgJ21hcmtlcnMtbW9kdWxlJ1xyXG5dKTtcclxuXHJcbmhlcmVtYXBzXHJcbiAgICAucHJvdmlkZXIoJ0hlcmVNYXBzQ29uZmlnJywgY29uZmlnUHJvdmlkZXIpXHJcbiAgICAuc2VydmljZSgnQVBJU2VydmljZScsIFsnJHEnLCAnSGVyZU1hcHNDb25maWcnLCAnSGVyZU1hcFV0aWxzU2VydmljZScsICdDT05TVFMnLCBhcGlTZXJ2aWNlXSlcclxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwVXRpbHNTZXJ2aWNlJywgdXRpbHNTZXJ2aWNlKVxyXG4gICAgLmNvbnN0YW50KCdDT05TVFMnLCBjb25zdHMpO1xyXG5cclxuaGVyZW1hcHMuZGlyZWN0aXZlKCdoZXJlbWFwcycsIGRpcmVjdGl2ZSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGhlcmVtYXBzOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHEsIEhlcmVNYXBzQ29uZmlnLCBIZXJlTWFwVXRpbHNTZXJ2aWNlLCBDT05TVFMpIHtcclxuICAgIHZhciB2ZXJzaW9uID0gSGVyZU1hcHNDb25maWcuYXBpVmVyc2lvbjtcclxuXHJcbiAgICB2YXIgQVBJX1ZFUlNJT04gPSB7XHJcbiAgICAgICAgVjogcGFyc2VJbnQodmVyc2lvbiksXHJcbiAgICAgICAgU1VCOiB2ZXJzaW9uXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBDT05GSUcgPSB7XHJcbiAgICAgICAgQkFTRTogXCJodHRwczovL2pzLmFwaS5oZXJlLmNvbS92XCIsXHJcbiAgICAgICAgQ09SRTogXCJtYXBzanMtY29yZS5qc1wiLFxyXG4gICAgICAgIFNFUlZJQ0U6IFwibWFwc2pzLXNlcnZpY2UuanNcIixcclxuICAgICAgICBVSToge1xyXG4gICAgICAgICAgICBzcmM6IFwibWFwc2pzLXVpLmpzXCIsXHJcbiAgICAgICAgICAgIGhyZWY6IFwibWFwc2pzLXVpLmNzc1wiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBFVkVOVFM6IFwibWFwc2pzLW1hcGV2ZW50cy5qc1wiXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBBUElfREVGRVJTUXVldWUgPSB7fTtcclxuXHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLkNPUkVdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlNFUlZJQ0VdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlVJLnNyY10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuUEFOT10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuRVZFTlRTXSA9IFtdO1xyXG5cclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxvYWRBcGk6IGxvYWRBcGksXHJcbiAgICAgICAgbG9hZE1vZHVsZXM6IGxvYWRNb2R1bGVzLFxyXG4gICAgICAgIGdldFBvc2l0aW9uOiBnZXRQb3NpdGlvbixcclxuICAgICAgICBjYWxjdWxhdGVSb3V0ZTogY2FsY3VsYXRlUm91dGVcclxuICAgIH07XHJcblxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gbG9hZEFwaSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuQ09SRSlcclxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRNb2R1bGVzKGF0dHJzLCBoYW5kbGVycykge1xyXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBoYW5kbGVycykge1xyXG4gICAgICAgICAgICBpZiAoIWhhbmRsZXJzLmhhc093blByb3BlcnR5KGtleSkgfHwgIWF0dHJzW2tleV0pXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIHZhciBsb2FkZXIgPSBfZ2V0TG9hZGVyQnlBdHRyKGtleSk7XHJcblxyXG4gICAgICAgICAgICBsb2FkZXIoKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oaGFuZGxlcnNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldFBvc2l0aW9uKG9wdGlvbnMpIHtcclxuICAgICAgICB2YXIgZGVyZXJyZWQgPSAkcS5kZWZlcigpO1xyXG5cclxuICAgICAgICBpZiAoX2lzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpKSB7XHJcbiAgICAgICAgICAgIGRlcmVycmVkLnJlc29sdmUoeyBjb29yZHM6IG9wdGlvbnMuY29vcmRzIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgIGRlcmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICB9LCBmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgZGVyZXJyZWQucmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgfSwgb3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZGVyZXJyZWQucHJvbWlzZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEBwYXJhbXMge09iamVjdH0gZHJpdmVUeXBlLCBmcm9tLCB0b1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVSb3V0ZShwbGF0Zm9ybSwgbWFwLCBwYXJhbXMpIHtcclxuICAgICAgICB2YXIgcm91dGVyID0gcGxhdGZvcm0uZ2V0Um91dGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGlyID0gcGFyYW1zLmRpcmVjdGlvbjtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcm91dGVSZXF1ZXN0UGFyYW1zID0ge1xyXG4gICAgICAgICAgICBtb2RlOiAnZmFzdGVzdDt7e1ZlY2hpbGV9fScucmVwbGFjZSgve3tWZWNoaWxlfX0vLCBwYXJhbXMuZHJpdmVUeXBlKSxcclxuICAgICAgICAgICAgcmVwcmVzZW50YXRpb246ICdkaXNwbGF5JyxcclxuICAgICAgICAgICAgcm91dGVhdHRyaWJ1dGVzOiAnd2F5cG9pbnRzLHN1bW1hcnksc2hhcGUsbGVncycsXHJcbiAgICAgICAgICAgIG1hbmV1dmVyYXR0cmlidXRlczogJ2RpcmVjdGlvbixhY3Rpb24nLFxyXG4gICAgICAgICAgICB3YXlwb2ludDA6IFtkaXIuZnJvbS5sYXQsIGRpci5mcm9tLmxuZ10uam9pbignLCcpLFxyXG4gICAgICAgICAgICB3YXlwb2ludDE6IFtkaXIudG8ubGF0LCBkaXIudG8ubG5nXS5qb2luKCcsJylcclxuICAgICAgICB9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICByb3V0ZXIuY2FsY3VsYXRlUm91dGUoXHJcbiAgICAgICAgICAgIHJvdXRlUmVxdWVzdFBhcmFtcyxcclxuICAgICAgICAgICAgX29uUm91dGVTdWNjZXNzLFxyXG4gICAgICAgICAgICBfb25Sb3V0ZUZhaWx1cmVcclxuICAgICAgICApO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX29uUm91dGVTdWNjZXNzKHJlc3VsdCl7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2cocmVzdWx0KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfb25Sb3V0ZUZhaWx1cmUoZXJyb3Ipe1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdDYWxjdWxhdGUgcm91dGUgZmFpbHVyZScsIGVycm9yKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlckJ5QXR0cihhdHRyKSB7XHJcbiAgICAgICAgdmFyIGxvYWRlcjtcclxuXHJcbiAgICAgICAgc3dpdGNoIChhdHRyKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09OU1RTLk1PRFVMRVMuVUk6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZFVJTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09OU1RTLk1PRFVMRVMuRVZFTlRTOlxyXG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRFdmVudHNNb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUnLCBhdHRyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBsb2FkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2xvYWRVSU1vZHVsZSgpIHtcclxuICAgICAgICBpZiAoIV9pc0xvYWRlZChDT05GSUcuVUkpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaW5rID0gSGVyZU1hcFV0aWxzU2VydmljZS5jcmVhdGVMaW5rVGFnKHtcclxuICAgICAgICAgICAgICAgIHJlbDogJ3N0eWxlc2hlZXQnLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3RleHQvY3NzJyxcclxuICAgICAgICAgICAgICAgIGhyZWY6IF9nZXRVUkwoQ09ORklHLlVJLmhyZWYpXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgbGluayAmJiBoZWFkLmFwcGVuZENoaWxkKGxpbmspO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlVJLnNyYyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2xvYWRFdmVudHNNb2R1bGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkVWRU5UUyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc291cmNlTmFtZVxyXG4gICAgICogcmV0dXJuIHtTdHJpbmd9IGUuZyBodHRwOi8vanMuYXBpLmhlcmUuY29tL3Z7VkVSfS97U1VCVkVSU0lPTn0ve1NPVVJDRX1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gX2dldFVSTChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgQ09ORklHLkJBU0UsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlYsXHJcbiAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXHJcbiAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICBzb3VyY2VOYW1lXHJcbiAgICAgICAgXS5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXIoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlciA9ICRxLmRlZmVyKCksIHNyYywgc2NyaXB0O1xyXG5cclxuICAgICAgICBpZiAoX2lzTG9hZGVkKHNvdXJjZU5hbWUpKSB7XHJcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxyXG4gICAgICAgICAgICAgICAgc2NyaXB0ID0gSGVyZU1hcFV0aWxzU2VydmljZS5jcmVhdGVTY3JpcHRUYWcoeyBzcmM6IHNyYyB9KTtcclxuXHJcbiAgICAgICAgICAgIHNjcmlwdCAmJiBoZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XHJcblxyXG4gICAgICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0ucHVzaChkZWZlcik7XHJcblxyXG4gICAgICAgICAgICBzY3JpcHQub25sb2FkID0gX29uTG9hZC5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xyXG4gICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IF9vbkVycm9yLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNMb2FkZWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBjaGVja2VyID0gbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoIChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkNPUkU6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzQ29yZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5TRVJWSUNFOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1NlcnZpY2VMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuVUk6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzVUlMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuRVZFTlRTOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0V2ZW50c0xvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZmFsc2UgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBjaGVja2VyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzQ29yZUxvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISF3aW5kb3cuSDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNTZXJ2aWNlTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5zZXJ2aWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNVSUxvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93LkgudWkpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0V2ZW50c0xvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93LkgubWFwZXZlbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25Mb2FkKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgZGVmZXJRdWV1ZSA9IEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRlZmVyUXVldWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBkZWZlciA9IGRlZmVyUXVldWVbaV07XHJcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbkVycm9yKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgZGVmZXJRdWV1ZSA9IEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRlZmVyUXVldWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBkZWZlciA9IGRlZmVyUXVldWVbaV07XHJcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XHJcbiAgICB9XHJcbiAgICBcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgSC5tYXAuUG9seWxpbmUgZnJvbSB0aGUgc2hhcGUgb2YgdGhlIHJvdXRlIGFuZCBhZGRzIGl0IHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkUm91dGVTaGFwZVRvTWFwKG1hcCwgcm91dGUpe1xyXG4gICAgICAgIHZhciBzdHJpcCA9IG5ldyBILmdlby5TdHJpcCgpLFxyXG4gICAgICAgICAgICByb3V0ZVNoYXBlID0gcm91dGUuc2hhcGUsXHJcbiAgICAgICAgICAgIHBvbHlsaW5lO1xyXG5cclxuICAgICAgICByb3V0ZVNoYXBlLmZvckVhY2goZnVuY3Rpb24ocG9pbnQpIHtcclxuICAgICAgICAgICAgdmFyIHBhcnRzID0gcG9pbnQuc3BsaXQoJywnKTtcclxuICAgICAgICAgICAgc3RyaXAucHVzaExhdExuZ0FsdChwYXJ0c1swXSwgcGFydHNbMV0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBwb2x5bGluZSA9IG5ldyBILm1hcC5Qb2x5bGluZShzdHJpcCwge1xyXG4gICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICBsaW5lV2lkdGg6IDQsXHJcbiAgICAgICAgICAgIHN0cm9rZUNvbG9yOiAncmdiYSgwLCAxMjgsIDI1NSwgMC43KSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIC8vIEFkZCB0aGUgcG9seWxpbmUgdG8gdGhlIG1hcFxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QocG9seWxpbmUpO1xyXG4gICAgICAgIC8vIEFuZCB6b29tIHRvIGl0cyBib3VuZGluZyByZWN0YW5nbGVcclxuICAgICAgICBtYXAuc2V0Vmlld0JvdW5kcyhwb2x5bGluZS5nZXRCb3VuZHMoKSwgdHJ1ZSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkTWFudWV2ZXJzVG9NYXAobWFwLCByb3V0ZSl7XHJcbiAgICAgICAgdmFyIHN2Z01hcmt1cCA9ICc8c3ZnIHdpZHRoPVwiMThcIiBoZWlnaHQ9XCIxOFwiICcgK1xyXG4gICAgICAgICAgICAneG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPicgK1xyXG4gICAgICAgICAgICAnPGNpcmNsZSBjeD1cIjhcIiBjeT1cIjhcIiByPVwiOFwiICcgK1xyXG4gICAgICAgICAgICAnZmlsbD1cIiMxYjQ2OGRcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZS13aWR0aD1cIjFcIiAgLz4nICtcclxuICAgICAgICAgICAgJzwvc3ZnPicsXHJcbiAgICAgICAgICAgIGRvdEljb24gPSBuZXcgSC5tYXAuSWNvbihzdmdNYXJrdXAsIHthbmNob3I6IHt4OjgsIHk6OH19KSxcclxuICAgICAgICAgICAgZ3JvdXAgPSBuZXcgIEgubWFwLkdyb3VwKCksXHJcbiAgICAgICAgICAgIGksXHJcbiAgICAgICAgICAgIGo7XHJcblxyXG4gICAgICAgIC8vIEFkZCBhIG1hcmtlciBmb3IgZWFjaCBtYW5ldXZlclxyXG4gICAgICAgIGZvciAoaSA9IDA7ICBpIDwgcm91dGUubGVnLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIGZvciAoaiA9IDA7ICBqIDwgcm91dGUubGVnW2ldLm1hbmV1dmVyLmxlbmd0aDsgaiArPSAxKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBHZXQgdGhlIG5leHQgbWFuZXV2ZXIuXHJcbiAgICAgICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcclxuICAgICAgICAgICAgICAgIC8vIEFkZCBhIG1hcmtlciB0byB0aGUgbWFuZXV2ZXJzIGdyb3VwXHJcbiAgICAgICAgICAgICAgICB2YXIgbWFya2VyID0gIG5ldyBILm1hcC5NYXJrZXIoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IG1hbmV1dmVyLnBvc2l0aW9uLmxhdGl0dWRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsbmc6IG1hbmV1dmVyLnBvc2l0aW9uLmxvbmdpdHVkZX0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtpY29uOiBkb3RJY29ufVxyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBtYXJrZXIuaW5zdHJ1Y3Rpb24gPSBtYW5ldXZlci5pbnN0cnVjdGlvbjtcclxuICAgICAgICAgICAgICAgIGdyb3VwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBncm91cC5hZGRFdmVudExpc3RlbmVyKCd0YXAnLCBmdW5jdGlvbiAoZXZ0KSB7XHJcbiAgICAgICAgICAgIG1hcC5zZXRDZW50ZXIoZXZ0LnRhcmdldC5nZXRQb3NpdGlvbigpKTtcclxuICAgICAgICAgICAgb3BlbkJ1YmJsZShldnQudGFyZ2V0LmdldFBvc2l0aW9uKCksIGV2dC50YXJnZXQuaW5zdHJ1Y3Rpb24pO1xyXG4gICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgLy8gQWRkIHRoZSBtYW5ldXZlcnMgZ3JvdXAgdG8gdGhlIG1hcFxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QoZ3JvdXApO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZFdheXBvaW50c1RvUGFuZWwod2F5cG9pbnRzKXtcclxuICAgICAgICB2YXIgbm9kZUgzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDMnKSxcclxuICAgICAgICAgICAgd2F5cG9pbnRMYWJlbHMgPSBbXSxcclxuICAgICAgICAgICAgaTtcclxuXHJcbiAgICAgICAgZm9yIChpID0gMDsgIGkgPCB3YXlwb2ludHMubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgd2F5cG9pbnRMYWJlbHMucHVzaCh3YXlwb2ludHNbaV0ubGFiZWwpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBub2RlSDMudGV4dENvbnRlbnQgPSB3YXlwb2ludExhYmVscy5qb2luKCcgLSAnKTtcclxuXHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuaW5uZXJIVE1MID0gJyc7XHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZUgzKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZFN1bW1hcnlUb1BhbmVsKHN1bW1hcnkpe1xyXG4gICAgICAgIHZhciBzdW1tYXJ5RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgICAgICAgIGNvbnRlbnQgPSAnJztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29udGVudCArPSAnPGI+VG90YWwgZGlzdGFuY2U8L2I+OiAnICsgc3VtbWFyeS5kaXN0YW5jZSAgKyAnbS4gPGJyLz4nO1xyXG4gICAgICAgIGNvbnRlbnQgKz0gJzxiPlRyYXZlbCBUaW1lPC9iPjogJyArIHN1bW1hcnkudHJhdmVsVGltZS50b01NU1MoKSArICcgKGluIGN1cnJlbnQgdHJhZmZpYyknO1xyXG5cclxuXHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5mb250U2l6ZSA9ICdzbWFsbCc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5MZWZ0ID0nNSUnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUubWFyZ2luUmlnaHQgPSc1JSc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5pbm5lckhUTUwgPSBjb250ZW50O1xyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKHN1bW1hcnlEaXYpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkTWFudWV2ZXJzVG9QYW5lbChyb3V0ZSl7XHJcbiAgICAgICAgdmFyIG5vZGVPTCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29sJyksIGksIGo7XHJcblxyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5mb250U2l6ZSA9ICdzbWFsbCc7XHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLm1hcmdpbkxlZnQgPSc1JSc7XHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLm1hcmdpblJpZ2h0ID0nNSUnO1xyXG4gICAgICAgIG5vZGVPTC5jbGFzc05hbWUgPSAnZGlyZWN0aW9ucyc7XHJcblxyXG4gICAgICAgIC8vIEFkZCBhIG1hcmtlciBmb3IgZWFjaCBtYW5ldXZlclxyXG4gICAgICAgIGZvciAoaSA9IDA7ICBpIDwgcm91dGUubGVnLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIGZvciAoaiA9IDA7ICBqIDwgcm91dGUubGVnW2ldLm1hbmV1dmVyLmxlbmd0aDsgaiArPSAxKSB7XHJcbiAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cclxuICAgICAgICAgICAgbWFuZXV2ZXIgPSByb3V0ZS5sZWdbaV0ubWFuZXV2ZXJbal07XHJcblxyXG4gICAgICAgICAgICB2YXIgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpLFxyXG4gICAgICAgICAgICAgICAgc3BhbkFycm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpLFxyXG4gICAgICAgICAgICAgICAgc3Bhbkluc3RydWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG5cclxuICAgICAgICAgICAgc3BhbkFycm93LmNsYXNzTmFtZSA9ICdhcnJvdyAnICArIG1hbmV1dmVyLmFjdGlvbjtcclxuICAgICAgICAgICAgc3Bhbkluc3RydWN0aW9uLmlubmVySFRNTCA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xyXG4gICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChzcGFuQXJyb3cpO1xyXG4gICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChzcGFuSW5zdHJ1Y3Rpb24pO1xyXG5cclxuICAgICAgICAgICAgbm9kZU9MLmFwcGVuZENoaWxkKGxpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZU9MKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2lzVmFsaWRDb29yZHMoY29vcmRzKXtcclxuICAgICAgICB2YXIgbG5nID0gY29vcmRzICYmIGNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgIGxhdCA9IGNvb3JkcyAmJiBjb29yZHMubGF0aXR1ZGU7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiAodHlwZW9mIGxuZyA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGxuZyA9PT0gJ3N0cmluZycpICYmXHJcbiAgICAgICAgICAgICAgICAodHlwZW9mIGxhdCA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGxhdCA9PT0gJ3N0cmluZycpOyBcclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFwiVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVFwiOiA1MDAsXHJcbiAgICBcIk1PRFVMRVNcIjoge1xyXG4gICAgICAgIFVJOiAnY29udHJvbHMnLFxyXG4gICAgICAgIEVWRU5UUzogJ2V2ZW50cycsXHJcbiAgICAgICAgUEFOTzogJ3Bhbm8nXHJcbiAgICB9LFxyXG4gICAgXCJERUZBVUxUX01BUF9PUFRJT05TXCI6IHtcclxuICAgICAgICBoZWlnaHQ6IDQ4MCxcclxuICAgICAgICB3aWR0aDogNjQwLFxyXG4gICAgICAgIHpvb206IDEwLFxyXG4gICAgICAgIGRyYWdnYWJsZTogZmFsc2UsXHJcbiAgICAgICAgY29vcmRzOiB7XHJcbiAgICAgICAgICAgIGxvbmdpdHVkZTogMCxcclxuICAgICAgICAgICAgbGF0aXR1ZGU6IDBcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgXCJNQVJLRVJfVFlQRVNcIjoge1xyXG4gICAgICAgIERPTTogXCJET01cIixcclxuICAgICAgICBTVkc6IFwiU1ZHXCJcclxuICAgIH0sXHJcbiAgICBcIkNPTlRST0xTXCI6IHtcclxuICAgICAgICBzZXR0aW5nczogJ21hcHNldHRpbmdzJyxcclxuICAgICAgICB6b29tOiAnem9vbScsXHJcbiAgICAgICAgc2NhbGU6ICdzY2FsZWJhcicsXHJcbiAgICAgICAgcGFubzogJ3Bhbm9yYW1hJ1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBvcHRpb25zID0ge307XHJcbiAgICB2YXIgREVGQVVMVF9BUElfVkVSU0lPTiA9IFwiMy4wXCI7XHJcblxyXG4gICAgdGhpcy4kZ2V0ID0gZnVuY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBhcHBfaWQ6IG9wdGlvbnMuYXBwX2lkLFxyXG4gICAgICAgICAgICBhcHBfY29kZTogb3B0aW9ucy5hcHBfY29kZSxcclxuICAgICAgICAgICAgYXBpVmVyc2lvbjogb3B0aW9ucy5hcGlWZXJzaW9uIHx8IERFRkFVTFRfQVBJX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIHVzZUhUVFBTOiBvcHRpb25zLnVzZUhUVFBTXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRzKXtcclxuICAgICAgICBvcHRpb25zID0gb3B0cztcclxuICAgIH07XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRGVmYXVsdE1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRGVmYXVsdE1hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG5cclxuICAgIHJldHVybiBEZWZhdWx0TWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcyk7XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBET01NYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERPTU1hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERPTU1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5fZ2V0SWNvbiA9IF9nZXRJY29uO1xyXG4gICAgcHJvdG8uX3NldHVwRXZlbnRzID0gX3NldHVwRXZlbnRzO1xyXG4gICAgcHJvdG8uX2dldEV2ZW50cyA9IF9nZXRFdmVudHM7XHJcblxyXG4gICAgcmV0dXJuIERPTU1hcmtlcjtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21NYXJrZXIodGhpcy5jb29yZHMsIHtcclxuICAgICAgICAgICAgaWNvbjogdGhpcy5fZ2V0SWNvbigpXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9nZXRJY29uKCl7XHJcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcclxuICAgICAgICAgaWYoIWljb24pXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWFya3VwIG1pc3NlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkRvbUljb24oaWNvbiwgdGhpcy5fZ2V0RXZlbnRzKCkpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfc2V0dXBFdmVudHMoZWwsIGV2ZW50cywgcmVtb3ZlKXtcclxuICAgICAgICB2YXIgbWV0aG9kID0gcmVtb3ZlID8gJ3JlbW92ZUV2ZW50TGlzdGVuZXInIDogJ2FkZEV2ZW50TGlzdGVuZXInO1xyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBldmVudHMpIHtcclxuICAgICAgICAgICAgaWYoIWV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFttZXRob2RdLmNhbGwobnVsbCwga2V5LCBldmVudHNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfZ2V0RXZlbnRzKCl7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgICAgICBldmVudHMgPSB0aGlzLnBsYWNlLmV2ZW50cztcclxuXHJcbiAgICAgICAgaWYoIXRoaXMucGxhY2UuZXZlbnRzKVxyXG4gICAgICAgICAgICByZXR1cm4ge307XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIG9uQXR0YWNoOiBmdW5jdGlvbihjbG9uZWRFbGVtZW50LCBkb21JY29uLCBkb21NYXJrZXIpe1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fc2V0dXBFdmVudHMoY2xvbmVkRWxlbWVudCwgZXZlbnRzKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgb25EZXRhY2g6IGZ1bmN0aW9uKGNsb25lZEVsZW1lbnQsIGRvbUljb24sIGRvbU1hcmtlcil7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zZXR1cEV2ZW50cyhjbG9uZWRFbGVtZW50LCBldmVudHMsIHRydWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpe1xyXG4gICAgZnVuY3Rpb24gTWFya2VySW50ZXJmYWNlKCl7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBYnN0cmFjdCBjbGFzcyEgVGhlIEluc3RhbmNlIHNob3VsZCBiZSBjcmVhdGVkJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBwcm90byA9IE1hcmtlckludGVyZmFjZS5wcm90b3R5cGU7XHJcbiAgICBcclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLnNldENvb3JkcyA9IHNldENvb3JkcztcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gTWFya2VyKCl7fVxyXG4gICAgXHJcbiAgICBNYXJrZXIucHJvdG90eXBlID0gcHJvdG87XHJcbiAgICBcclxuICAgIHJldHVybiBNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY3JlYXRlOjogbm90IGltcGxlbWVudGVkJyk7IFxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBzZXRDb29yZHMoKXtcclxuICAgICAgICAgdGhpcy5jb29yZHMgPSB7XHJcbiAgICAgICAgICAgIGxhdDogdGhpcy5wbGFjZS5wb3MubGF0LFxyXG4gICAgICAgICAgICBsbmc6IHRoaXMucGxhY2UucG9zLmxuZ1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG59IiwidmFyIG1hcmtlckludGVyZmFjZSA9IHJlcXVpcmUoJy4vbWFya2VyLmpzJyksXHJcblx0ZGVmYXVsdE1hcmtlciA9IHJlcXVpcmUoJy4vZGVmYXVsdC5tYXJrZXIuanMnKSxcclxuXHRkb21NYXJrZXIgPSByZXF1aXJlKCcuL2RvbS5tYXJrZXIuanMnKSxcclxuXHRzdmdNYXJrZXIgPSByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSxcclxuICAgIG1hcmtlcnNTZXJ2aWNlID0gcmVxdWlyZSgnLi9tYXJrZXJzLnNlcnZpY2UuanMnKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXItaW50ZXJmYWNlJywgW10pLmZhY3RvcnkoJ01hcmtlckludGVyZmFjZScsIG1hcmtlckludGVyZmFjZSk7XHJcbmFuZ3VsYXIubW9kdWxlKCdkZWZhdWx0LW1hcmtlcicsIFtdKS5mYWN0b3J5KCdEZWZhdWx0TWFya2VyJywgZGVmYXVsdE1hcmtlcik7XHJcbmFuZ3VsYXIubW9kdWxlKCdkb20tbWFya2VyJywgW10pLmZhY3RvcnkoJ0RPTU1hcmtlcicsIGRvbU1hcmtlcik7XHJcbmFuZ3VsYXIubW9kdWxlKCdzdmctbWFya2VyJywgW10pLmZhY3RvcnkoJ1NWR01hcmtlcicsIHN2Z01hcmtlcik7XHJcblxyXG5hbmd1bGFyLm1vZHVsZSgnbWFya2Vycy1zZXJ2aWNlJywgW10pLnNlcnZpY2UoJ01hcmtlcnNTZXJ2aWNlJywgbWFya2Vyc1NlcnZpY2UpO1xyXG5cclxudmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLW1vZHVsZScsIFtcclxuXHQnbWFya2VyLWludGVyZmFjZScsXHJcbiAgICAnZGVmYXVsdC1tYXJrZXInLFxyXG4gICAgJ2RvbS1tYXJrZXInLFxyXG4gICAgJ21hcmtlcnMtc2VydmljZScsXHJcbiAgICAnc3ZnLW1hcmtlcidcclxuXSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFwcDsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKERlZmF1bHRNYXJrZXIsIERPTU1hcmtlciwgU1ZHTWFya2VyLCBDT05TVFMpIHtcclxuXHJcbiAgICB2YXIgTUFSS0VSX1RZUEVTID0gQ09OU1RTLk1BUktFUl9UWVBFUztcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgYWRkTWFya2Vyc1RvTWFwOiBhZGRNYXJrZXJzVG9NYXAsXHJcbiAgICAgICAgYWRkVXNlck1hcmtlcjogYWRkVXNlck1hcmtlclxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZE1hcmtlcnNUb01hcChtYXAsIHBsYWNlcykge1xyXG4gICAgICAgIGlmICghcGxhY2VzIHx8ICFwbGFjZXMubGVuZ3RoKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGlmICghKG1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBtYXAgaW5zdGFuY2UnKTtcclxuXHJcbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24ocGxhY2UsIGkpIHtcclxuICAgICAgICAgICAgdmFyIGNyZWF0b3IgPSBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSk7XHJcbiAgICAgICAgICAgIHZhciBtYXJrZXIgPSBwbGFjZS5kcmFnZ2FibGUgPyBfZHJhZ2dhYmxlTWFya2VyTWl4aW4oY3JlYXRvci5jcmVhdGUoKSkgOiBjcmVhdG9yLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgbWFwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRVc2VyTWFya2VyKG1hcCwgcGxhY2UpIHtcclxuICAgICAgICB2YXIgc3R5bGVzID0gW1xyXG4gICAgICAgICAgICBcImJvcmRlci1yYWRpdXM6IDUwJVwiLFxyXG4gICAgICAgICAgICBcImJhY2tncm91bmQtY29sb3I6IHJnYmEoMzgsIDMzLCA5NywgLjgpXCIsXHJcbiAgICAgICAgICAgIFwiaGVpZ2h0OiAxMnB4XCIsXHJcbiAgICAgICAgICAgIFwid2lkdGg6IDEycHhcIlxyXG4gICAgICAgIF07XHJcblxyXG4gICAgICAgIHZhciBtYXJrdXAgPSAnPGRpdiBzdHlsZT1cIntzdHlsZX1cIj48L2Rpdj4nO1xyXG4gICAgICAgIHBsYWNlLm1hcmt1cCA9IG1hcmt1cC5yZXBsYWNlKC97c3R5bGV9Lywgc3R5bGVzLmpvaW4oJzsnKSk7XHJcblxyXG4gICAgICAgIHZhciBjcmVhdG9yID0gbmV3IERPTU1hcmtlcihwbGFjZSk7XHJcblxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QoY3JlYXRvci5jcmVhdGUoKSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gdmFyIG1hcmtlciA9IG5ldyBILm1hcC5DaXJjbGUocGxhY2UucG9zLCAxMDAwMCwge1xyXG4gICAgICAgIC8vICAgICAgICAgc3R5bGU6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBzdHJva2VDb2xvcjogJ3JnYmEoNTUsIDg1LCAxNzAsIDAuNiknLCAvLyBDb2xvciBvZiB0aGUgcGVyaW1ldGVyXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgbGluZVdpZHRoOiAyLFxyXG4gICAgICAgIC8vICAgICAgICAgICAgIGZpbGxDb2xvcjogJ3JnYmEoMCwgMTI4LCAwLCAwLjcpJyAgLy8gQ29sb3Igb2YgdGhlIGNpcmNsZVxyXG4gICAgICAgIC8vICAgICAgICAgfVxyXG4gICAgICAgIC8vICAgICB9XHJcbiAgICAgICAgLy8gKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBtYXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcclxuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXIsXHJcbiAgICAgICAgICAgIHR5cGUgPSBwbGFjZS50eXBlID8gcGxhY2UudHlwZS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLkRPTTpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRE9NTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLlNWRzpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gU1ZHTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IERlZmF1bHRNYXJrZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IENvbmNyZXRlTWFya2VyKHBsYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZHJhZ2dhYmxlTWFya2VyTWl4aW4obWFya2VyKSB7XHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIFNWR01hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBwcm90byA9IFNWR01hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IFNWR01hcmtlcjtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uX2dldEljb24gPSBfZ2V0SWNvbjtcclxuICAgIFxyXG4gICAgcmV0dXJuIFNWR01hcmtlcjtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5NYXJrZXIodGhpcy5jb29yZHMsIHtcclxuICAgICAgICAgICAgaWNvbjogdGhpcy5fZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfZ2V0SWNvbigpe1xyXG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5tYXJrdXA7XHJcbiAgICAgICAgIGlmKCFpY29uKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcmt1cCBtaXNzZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5JY29uKGljb24pO1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcm9vdFNjb3BlLCAkdGltZW91dCl7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRocm90dGxlOiB0aHJvdHRsZSxcclxuICAgICAgICBjcmVhdGVTY3JpcHRUYWc6IGNyZWF0ZVNjcmlwdFRhZyxcclxuICAgICAgICBjcmVhdGVMaW5rVGFnOiBjcmVhdGVMaW5rVGFnLFxyXG4gICAgICAgIHJ1blNjb3BlRGlnZXN0SWZOZWVkOiBydW5TY29wZURpZ2VzdElmTmVlZFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gdGhyb3R0bGUoZm4sIHBlcmlvZCl7XHJcbiAgICAgICAgdmFyIHRpbWVvdXQgPSBudWxsO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICBpZigkdGltZW91dClcclxuICAgICAgICAgICAgICAgICR0aW1lb3V0LmNhbmNlbCh0aW1lb3V0KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aW1lb3V0ID0gJHRpbWVvdXQoZm4sIHBlcmlvZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBydW5TY29wZURpZ2VzdElmTmVlZChzY29wZSwgY2IpIHtcclxuICAgICAgICBpZiAoc2NvcGUuJHJvb3QgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRhcHBseScgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRkaWdlc3QnKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLiRkaWdlc3QoY2IgfHwgYW5ndWxhci5ub29wKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlU2NyaXB0VGFnKGF0dHJzKXtcclxuICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuc3JjKTtcclxuICAgICAgICBcclxuICAgICAgICBpZihzY3JpcHQpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICBcclxuICAgICAgICBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcclxuICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xyXG4gICAgICAgIHNjcmlwdC5pZCA9IGF0dHJzLnNyYztcclxuICAgICAgICBfc2V0QXR0cnMoc2NyaXB0LCBhdHRycyk7ICAgIFxyXG5cclxuICAgICAgICByZXR1cm4gc2NyaXB0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUxpbmtUYWcoYXR0cnMpIHtcclxuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmhyZWYpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKGxpbmspXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcclxuICAgICAgICBsaW5rLmlkID0gYXR0cnMuaHJlZjtcclxuICAgICAgICBfc2V0QXR0cnMobGluaywgYXR0cnMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQyBcclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xyXG4gICAgICAgIGlmKCFlbCB8fCAhYXR0cnMpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2VkIGF0dHJpYnV0ZXMnKTtcclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiXX0=
