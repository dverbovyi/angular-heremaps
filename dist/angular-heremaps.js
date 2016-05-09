(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function(
    $window,
    $rootScope,
    MapConfig,
    APIService,
    UtilsService,
    MarkersService,
    CONSTS) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': mapWidth, 'height': mapHeight}\"></div>",
        replace: true,
        scope: {
            opts: '=options',
            places: '=',
            onMapReady: "=mapReady"
        },
        controller: function($scope, $element, $attrs) {
            var options = angular.extend({}, CONSTS.DEFAULT_MAP_OPTIONS, $scope.opts),
                position = options.coords;

            var heremaps = {};

            APIService.loadApi().then(_apiReady);

            $element[0].parentNode.style.overflow = 'hidden';

            _setMapSize();

            options.resize && addOnResizeListener();

            $scope.$on('$destroy', function() {
                $window.removeEventListener('resize', _resizeMap);
            });

            function addOnResizeListener() {
                var _onResizeMap = UtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT);
                $window.addEventListener('resize', _onResizeMap);
            }

            function _apiReady() {
                _setupMapPlatform();

                _getLocation()
                    .then(function(response) {
                        _setupMap({
                            longitude: response.coords.longitude,
                            latitude: response.coords.latitude
                        });
                    })
                    .catch(_locationFailure);
            }

            function _setupMapPlatform() {
                heremaps.platform = new H.service.Platform(MapConfig);
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
                var map = heremaps.map = new H.Map($element[0], heremaps.layers.normal.map, {
                    zoom: options.zoom,
                    center: new H.geo.Point(position.latitude, position.longitude)
                });

                MarkersService.addUserMarker(heremaps.map, {
                    pos: { lat: position.latitude, lng: position.longitude }
                });

                MarkersService.addMarkersToMap(heremaps.map, $scope.places);

                $scope.onMapReady && $scope.onMapReady(MapProxy());

                cb && cb();
            }

            function _uiModuleReady() {
                var ui = heremaps.ui = H.ui.UI.createDefault(heremaps.map, heremaps.layers);

                // var mapSettings = ui.getControl('mapsettings');
                // var zoom = ui.getControl('zoom');
                // var scalebar = ui.getControl('scalebar');
                // var panorama = ui.getControl('panorama');

                // mapSettings.setAlignment('bottom-right');
                // zoom.setAlignment('bottom-right');
                // scalebar.setAlignment('bottom-right');
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

                UtilsService.runScopeDigestIfNeed($scope);
            }

            function MapProxy() {
                return {
                    getMap: function() {
                        return heremaps.map
                    },
                    reload: function(){ //TODO: not working
                        _setMapSize();
                        _initMap();
                    },
                    calculateRoute: function(driveType, direction) {
                        APIService.calculateRoute(heremaps.platform, heremaps.map, {
                            driveType: driveType,
                            direction: direction
                        });
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
    .provider('MapConfig', configProvider)
    .service('APIService', ['$q', 'MapConfig', 'UtilsService', 'CONSTS', apiService])
    .service('UtilsService', utilsService)
    .constant('CONSTS', consts)

heremaps.directive('heremaps', directive);

module.exports = heremaps;
},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/consts":4,"./providers/mapconfig.provider":5,"./providers/markers/markers.module":9,"./providers/utils.service":12}],3:[function(require,module,exports){
module.exports = function($q, MapConfig, UtilsService, CONSTS) {
    var version = MapConfig.apiVersion;

    var API_VERSION = {
        V: parseInt(version),
        SUB: version
    };

    var CONFIG = {
        BASE: "http://js.api.here.com/v",
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
                .then(handlers[key])
        }
    }

    function getPosition(options) {
        var coordsExist = options.coords && (typeof options.coords.latitude === 'number' && typeof options.coords.longitude === 'number');

        var dererred = $q.defer();

        if (coordsExist) {
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
        console.log(platform, map, params);
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
            
        console.log(routeRequestParams)

        router.calculateRoute(
            routeRequestParams,
            _onRouteSuccess,
            _onRouteFailure
        );
    }
    //#endregion PUBLIC


    //#region PRIVATE
    function _onRouteSuccess(result){
        console.log(result)
    }
    
    function _onRouteFailure(error){
        console.log('Calculate route failure', error);
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
            var link = UtilsService.createLinkTag({
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
                script = UtilsService.createScriptTag({ src: src });

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
        draggable: false
    },
    "MARKER_TYPES": {
        DOM: "DOM",
        SVG: "SVG"
    },
    "MAP_EVENTS": {
        NAVIGATE: "NAVIGATE",
        RELOAD: "RELOAD"
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
    
    function Marker(){};
    
    Marker.prototype = proto;
    
    return Marker;
    
    function create(){
        throw new Error('getInstance:: not implemented'); 
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


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2hlcmVtYXBzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvYXBpLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL2NvbnN0cy5qcyIsInNyYy9wcm92aWRlcnMvbWFwY29uZmlnLnByb3ZpZGVyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RlZmF1bHQubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RvbS5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9zdmcubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy91dGlscy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1WEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYW5ndWxhci1oZXJlbWFwcy5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgRG15dHJvIG9uIDQvMTEvMjAxNi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgIE1hcENvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBVdGlsc1NlcnZpY2UsXHJcbiAgICBNYXJrZXJzU2VydmljZSxcclxuICAgIENPTlNUUykge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogbWFwV2lkdGgsICdoZWlnaHQnOiBtYXBIZWlnaHR9XFxcIj48L2Rpdj5cIixcclxuICAgICAgICByZXBsYWNlOiB0cnVlLFxyXG4gICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgIG9wdHM6ICc9b3B0aW9ucycsXHJcbiAgICAgICAgICAgIHBsYWNlczogJz0nLFxyXG4gICAgICAgICAgICBvbk1hcFJlYWR5OiBcIj1tYXBSZWFkeVwiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICAgICAgdmFyIG9wdGlvbnMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMsICRzY29wZS5vcHRzKSxcclxuICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gb3B0aW9ucy5jb29yZHM7XHJcblxyXG4gICAgICAgICAgICB2YXIgaGVyZW1hcHMgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEFwaSgpLnRoZW4oX2FwaVJlYWR5KTtcclxuXHJcbiAgICAgICAgICAgICRlbGVtZW50WzBdLnBhcmVudE5vZGUuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcclxuXHJcbiAgICAgICAgICAgIF9zZXRNYXBTaXplKCk7XHJcblxyXG4gICAgICAgICAgICBvcHRpb25zLnJlc2l6ZSAmJiBhZGRPblJlc2l6ZUxpc3RlbmVyKCk7XHJcblxyXG4gICAgICAgICAgICAkc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgJHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfcmVzaXplTWFwKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBhZGRPblJlc2l6ZUxpc3RlbmVyKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIF9vblJlc2l6ZU1hcCA9IFV0aWxzU2VydmljZS50aHJvdHRsZShfcmVzaXplSGFuZGxlciwgQ09OU1RTLlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQpO1xyXG4gICAgICAgICAgICAgICAgJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICBfc2V0dXBNYXBQbGF0Zm9ybSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIF9nZXRMb2NhdGlvbigpXHJcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX3NldHVwTWFwKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvbmdpdHVkZTogcmVzcG9uc2UuY29vcmRzLmxvbmdpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhdGl0dWRlOiByZXNwb25zZS5jb29yZHMubGF0aXR1ZGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goX2xvY2F0aW9uRmFpbHVyZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcFBsYXRmb3JtKCkge1xyXG4gICAgICAgICAgICAgICAgaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKE1hcENvbmZpZyk7XHJcbiAgICAgICAgICAgICAgICBoZXJlbWFwcy5sYXllcnMgPSBoZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9nZXRMb2NhdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBBUElTZXJ2aWNlLmdldFBvc2l0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgICBjb29yZHM6IHBvc2l0aW9uLFxyXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBtYXhpbXVtQWdlOiAxMDAwMFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9sb2NhdGlvbkZhaWx1cmUoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDYW4gbm90IGdldCBhIGdlbyBwb3NpdGlvbicpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXAoY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29vcmRzKVxyXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gY29vcmRzO1xyXG5cclxuICAgICAgICAgICAgICAgIF9pbml0TWFwKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZE1vZHVsZXMoJGF0dHJzLiRhdHRyLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiY29udHJvbHNcIjogX3VpTW9kdWxlUmVhZHksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZXZlbnRzXCI6IF9ldmVudHNNb2R1bGVSZWFkeVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9pbml0TWFwKGNiKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gaGVyZW1hcHMubWFwID0gbmV3IEguTWFwKCRlbGVtZW50WzBdLCBoZXJlbWFwcy5sYXllcnMubm9ybWFsLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHpvb206IG9wdGlvbnMuem9vbSxcclxuICAgICAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludChwb3NpdGlvbi5sYXRpdHVkZSwgcG9zaXRpb24ubG9uZ2l0dWRlKVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UuYWRkVXNlck1hcmtlcihoZXJlbWFwcy5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICBwb3M6IHsgbGF0OiBwb3NpdGlvbi5sYXRpdHVkZSwgbG5nOiBwb3NpdGlvbi5sb25naXR1ZGUgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UuYWRkTWFya2Vyc1RvTWFwKGhlcmVtYXBzLm1hcCwgJHNjb3BlLnBsYWNlcyk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm9uTWFwUmVhZHkgJiYgJHNjb3BlLm9uTWFwUmVhZHkoTWFwUHJveHkoKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdWkgPSBoZXJlbWFwcy51aSA9IEgudWkuVUkuY3JlYXRlRGVmYXVsdChoZXJlbWFwcy5tYXAsIGhlcmVtYXBzLmxheWVycyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gdmFyIG1hcFNldHRpbmdzID0gdWkuZ2V0Q29udHJvbCgnbWFwc2V0dGluZ3MnKTtcclxuICAgICAgICAgICAgICAgIC8vIHZhciB6b29tID0gdWkuZ2V0Q29udHJvbCgnem9vbScpO1xyXG4gICAgICAgICAgICAgICAgLy8gdmFyIHNjYWxlYmFyID0gdWkuZ2V0Q29udHJvbCgnc2NhbGViYXInKTtcclxuICAgICAgICAgICAgICAgIC8vIHZhciBwYW5vcmFtYSA9IHVpLmdldENvbnRyb2woJ3Bhbm9yYW1hJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gbWFwU2V0dGluZ3Muc2V0QWxpZ25tZW50KCdib3R0b20tcmlnaHQnKTtcclxuICAgICAgICAgICAgICAgIC8vIHpvb20uc2V0QWxpZ25tZW50KCdib3R0b20tcmlnaHQnKTtcclxuICAgICAgICAgICAgICAgIC8vIHNjYWxlYmFyLnNldEFsaWdubWVudCgnYm90dG9tLXJpZ2h0Jyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9ldmVudHNNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBtYXAgPSBoZXJlbWFwcy5tYXAsXHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzID0gaGVyZW1hcHMubWFwRXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyhtYXApLFxyXG4gICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yID0gaGVyZW1hcHMuYmVoYXZpb3IgPSBuZXcgSC5tYXBldmVudHMuQmVoYXZpb3IoZXZlbnRzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWhhdmlvci5kaXNhYmxlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyID0gZXYuY3VycmVudFBvaW50ZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG1hcHNqcy5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldC5zZXRQb3NpdGlvbihtYXAuc2NyZWVuVG9HZW8ocG9pbnRlci52aWV3cG9ydFgsIHBvaW50ZXIudmlld3BvcnRZKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBtYXBzanMubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWhhdmlvci5lbmFibGUoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmRyYWdnYWJsZSA9IG9wdGlvbnMuZHJhZ2dhYmxlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcmVzaXplSGFuZGxlcigpIHtcclxuICAgICAgICAgICAgICAgIF9zZXRNYXBTaXplKHRydWUpO1xyXG5cclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5nZXRWaWV3UG9ydCgpLnJlc2l6ZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSAkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldEhlaWdodCB8fCBvcHRpb25zLmhlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aCA9ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0V2lkdGggfHwgb3B0aW9ucy53aWR0aDtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUubWFwSGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXBXaWR0aCA9IHdpZHRoICsgJ3B4JztcclxuXHJcbiAgICAgICAgICAgICAgICBVdGlsc1NlcnZpY2UucnVuU2NvcGVEaWdlc3RJZk5lZWQoJHNjb3BlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gTWFwUHJveHkoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGdldE1hcDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwcy5tYXBcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlbG9hZDogZnVuY3Rpb24oKXsgLy9UT0RPOiBub3Qgd29ya2luZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfc2V0TWFwU2l6ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfaW5pdE1hcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgY2FsY3VsYXRlUm91dGU6IGZ1bmN0aW9uKGRyaXZlVHlwZSwgZGlyZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UuY2FsY3VsYXRlUm91dGUoaGVyZW1hcHMucGxhdGZvcm0sIGhlcmVtYXBzLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJpdmVUeXBlOiBkcml2ZVR5cGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXJlY3Rpb246IGRpcmVjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHNldENlbnRlcjogZnVuY3Rpb24oY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvY2F0aW9uKClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Q2VudGVyKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogcmVzcG9uc2UuY29vcmRzLmxvbmdpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogcmVzcG9uc2UuY29vcmRzLmxhdGl0dWRlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKF9sb2NhdGlvbkZhaWx1cmUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Q2VudGVyKGNvb3Jkcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuIiwicmVxdWlyZSgnLi9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXJzLm1vZHVsZScpO1xyXG5cclxudmFyIGRpcmVjdGl2ZSA9IHJlcXVpcmUoJy4vaGVyZW1hcHMuZGlyZWN0aXZlJyksXHJcbiAgICBjb25maWdQcm92aWRlciA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcGNvbmZpZy5wcm92aWRlcicpLFxyXG4gICAgYXBpU2VydmljZSA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2FwaS5zZXJ2aWNlJyksXHJcbiAgICB1dGlsc1NlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy91dGlscy5zZXJ2aWNlJyksXHJcbiAgICBjb25zdHMgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25zdHMnKTtcclxuXHJcbnZhciBoZXJlbWFwcyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcycsIFtcclxuICAgICdtYXJrZXJzLW1vZHVsZSdcclxuXSk7XHJcblxyXG5oZXJlbWFwc1xyXG4gICAgLnByb3ZpZGVyKCdNYXBDb25maWcnLCBjb25maWdQcm92aWRlcilcclxuICAgIC5zZXJ2aWNlKCdBUElTZXJ2aWNlJywgWyckcScsICdNYXBDb25maWcnLCAnVXRpbHNTZXJ2aWNlJywgJ0NPTlNUUycsIGFwaVNlcnZpY2VdKVxyXG4gICAgLnNlcnZpY2UoJ1V0aWxzU2VydmljZScsIHV0aWxzU2VydmljZSlcclxuICAgIC5jb25zdGFudCgnQ09OU1RTJywgY29uc3RzKVxyXG5cclxuaGVyZW1hcHMuZGlyZWN0aXZlKCdoZXJlbWFwcycsIGRpcmVjdGl2ZSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGhlcmVtYXBzOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHEsIE1hcENvbmZpZywgVXRpbHNTZXJ2aWNlLCBDT05TVFMpIHtcclxuICAgIHZhciB2ZXJzaW9uID0gTWFwQ29uZmlnLmFwaVZlcnNpb247XHJcblxyXG4gICAgdmFyIEFQSV9WRVJTSU9OID0ge1xyXG4gICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxyXG4gICAgICAgIFNVQjogdmVyc2lvblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgQ09ORklHID0ge1xyXG4gICAgICAgIEJBU0U6IFwiaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92XCIsXHJcbiAgICAgICAgQ09SRTogXCJtYXBzanMtY29yZS5qc1wiLFxyXG4gICAgICAgIFNFUlZJQ0U6IFwibWFwc2pzLXNlcnZpY2UuanNcIixcclxuICAgICAgICBVSToge1xyXG4gICAgICAgICAgICBzcmM6IFwibWFwc2pzLXVpLmpzXCIsXHJcbiAgICAgICAgICAgIGhyZWY6IFwibWFwc2pzLXVpLmNzc1wiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBFVkVOVFM6IFwibWFwc2pzLW1hcGV2ZW50cy5qc1wiXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBBUElfREVGRVJTUXVldWUgPSB7fTtcclxuXHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLkNPUkVdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlNFUlZJQ0VdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlVJLnNyY10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuUEFOT10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuRVZFTlRTXSA9IFtdO1xyXG5cclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxvYWRBcGk6IGxvYWRBcGksXHJcbiAgICAgICAgbG9hZE1vZHVsZXM6IGxvYWRNb2R1bGVzLFxyXG4gICAgICAgIGdldFBvc2l0aW9uOiBnZXRQb3NpdGlvbixcclxuICAgICAgICBjYWxjdWxhdGVSb3V0ZTogY2FsY3VsYXRlUm91dGVcclxuICAgIH07XHJcblxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gbG9hZEFwaSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuQ09SRSlcclxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRNb2R1bGVzKGF0dHJzLCBoYW5kbGVycykge1xyXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBoYW5kbGVycykge1xyXG4gICAgICAgICAgICBpZiAoIWhhbmRsZXJzLmhhc093blByb3BlcnR5KGtleSkgfHwgIWF0dHJzW2tleV0pXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIHZhciBsb2FkZXIgPSBfZ2V0TG9hZGVyQnlBdHRyKGtleSk7XHJcbiAgICAgICAgICAgIGxvYWRlcigpXHJcbiAgICAgICAgICAgICAgICAudGhlbihoYW5kbGVyc1trZXldKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXRQb3NpdGlvbihvcHRpb25zKSB7XHJcbiAgICAgICAgdmFyIGNvb3Jkc0V4aXN0ID0gb3B0aW9ucy5jb29yZHMgJiYgKHR5cGVvZiBvcHRpb25zLmNvb3Jkcy5sYXRpdHVkZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIG9wdGlvbnMuY29vcmRzLmxvbmdpdHVkZSA9PT0gJ251bWJlcicpO1xyXG5cclxuICAgICAgICB2YXIgZGVyZXJyZWQgPSAkcS5kZWZlcigpO1xyXG5cclxuICAgICAgICBpZiAoY29vcmRzRXhpc3QpIHtcclxuICAgICAgICAgICAgZGVyZXJyZWQucmVzb2x2ZSh7IGNvb3Jkczogb3B0aW9ucy5jb29yZHMgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgZGVyZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBkZXJlcnJlZC5yZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICB9LCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBkZXJlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtcyB7T2JqZWN0fSBkcml2ZVR5cGUsIGZyb20sIHRvXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZVJvdXRlKHBsYXRmb3JtLCBtYXAsIHBhcmFtcykge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHBsYXRmb3JtLCBtYXAsIHBhcmFtcyk7XHJcbiAgICAgICAgdmFyIHJvdXRlciA9IHBsYXRmb3JtLmdldFJvdXRpbmdTZXJ2aWNlKCksXHJcbiAgICAgICAgICAgIGRpciA9IHBhcmFtcy5kaXJlY3Rpb247XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJvdXRlUmVxdWVzdFBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbW9kZTogJ2Zhc3Rlc3Q7e3tWZWNoaWxlfX0nLnJlcGxhY2UoL3t7VmVjaGlsZX19LywgcGFyYW1zLmRyaXZlVHlwZSksXHJcbiAgICAgICAgICAgIHJlcHJlc2VudGF0aW9uOiAnZGlzcGxheScsXHJcbiAgICAgICAgICAgIHJvdXRlYXR0cmlidXRlczogJ3dheXBvaW50cyxzdW1tYXJ5LHNoYXBlLGxlZ3MnLFxyXG4gICAgICAgICAgICBtYW5ldXZlcmF0dHJpYnV0ZXM6ICdkaXJlY3Rpb24sYWN0aW9uJyxcclxuICAgICAgICAgICAgd2F5cG9pbnQwOiBbZGlyLmZyb20ubGF0LCBkaXIuZnJvbS5sbmddLmpvaW4oJywnKSxcclxuICAgICAgICAgICAgd2F5cG9pbnQxOiBbZGlyLnRvLmxhdCwgZGlyLnRvLmxuZ10uam9pbignLCcpXHJcbiAgICAgICAgfTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc29sZS5sb2cocm91dGVSZXF1ZXN0UGFyYW1zKVxyXG5cclxuICAgICAgICByb3V0ZXIuY2FsY3VsYXRlUm91dGUoXHJcbiAgICAgICAgICAgIHJvdXRlUmVxdWVzdFBhcmFtcyxcclxuICAgICAgICAgICAgX29uUm91dGVTdWNjZXNzLFxyXG4gICAgICAgICAgICBfb25Sb3V0ZUZhaWx1cmVcclxuICAgICAgICApO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX29uUm91dGVTdWNjZXNzKHJlc3VsdCl7XHJcbiAgICAgICAgY29uc29sZS5sb2cocmVzdWx0KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfb25Sb3V0ZUZhaWx1cmUoZXJyb3Ipe1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdDYWxjdWxhdGUgcm91dGUgZmFpbHVyZScsIGVycm9yKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlckJ5QXR0cihhdHRyKSB7XHJcbiAgICAgICAgdmFyIGxvYWRlcjtcclxuXHJcbiAgICAgICAgc3dpdGNoIChhdHRyKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09OU1RTLk1PRFVMRVMuVUk6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZFVJTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09OU1RTLk1PRFVMRVMuRVZFTlRTOlxyXG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRFdmVudHNNb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUnLCBhdHRyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBsb2FkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2xvYWRVSU1vZHVsZSgpIHtcclxuICAgICAgICBpZiAoIV9pc0xvYWRlZChDT05GSUcuVUkpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaW5rID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZUxpbmtUYWcoe1xyXG4gICAgICAgICAgICAgICAgcmVsOiAnc3R5bGVzaGVldCcsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxyXG4gICAgICAgICAgICAgICAgaHJlZjogX2dldFVSTChDT05GSUcuVUkuaHJlZilcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsaW5rICYmIGhlYWQuYXBwZW5kQ2hpbGQobGluayk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuVUkuc3JjKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZEV2ZW50c01vZHVsZSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuRVZFTlRTKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VOYW1lXHJcbiAgICAgKiByZXR1cm4ge1N0cmluZ30gZS5nIGh0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdntWRVJ9L3tTVUJWRVJTSU9OfS97U09VUkNFfVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBfZ2V0VVJMKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICBDT05GSUcuQkFTRSxcclxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlNVQixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICBdLmpvaW4oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKSwgc3JjLCBzY3JpcHQ7XHJcblxyXG4gICAgICAgIGlmIChfaXNMb2FkZWQoc291cmNlTmFtZSkpIHtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNyYyA9IF9nZXRVUkwoc291cmNlTmFtZSksXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQgPSBVdGlsc1NlcnZpY2UuY3JlYXRlU2NyaXB0VGFnKHsgc3JjOiBzcmMgfSk7XHJcblxyXG4gICAgICAgICAgICBzY3JpcHQgJiYgaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xyXG5cclxuICAgICAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdLnB1c2goZGVmZXIpO1xyXG5cclxuICAgICAgICAgICAgc2NyaXB0Lm9ubG9hZCA9IF9vbkxvYWQuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcclxuICAgICAgICAgICAgc2NyaXB0Lm9uZXJyb3IgPSBfb25FcnJvci5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzTG9hZGVkKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgY2hlY2tlciA9IG51bGw7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoc291cmNlTmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5DT1JFOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0NvcmVMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuU0VSVklDRTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNTZXJ2aWNlTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlVJOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1VJTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkVWRU5UUzpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNFdmVudHNMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gY2hlY2tlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0NvcmVMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhd2luZG93Lkg7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzU2VydmljZUxvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93Lkguc2VydmljZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzVUlMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnVpKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNFdmVudHNMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILm1hcGV2ZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uTG9hZChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xyXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25FcnJvcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xyXG4gICAgICAgICAgICBkZWZlci5yZWplY3QoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIEgubWFwLlBvbHlsaW5lIGZyb20gdGhlIHNoYXBlIG9mIHRoZSByb3V0ZSBhbmQgYWRkcyBpdCB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZFJvdXRlU2hhcGVUb01hcChtYXAsIHJvdXRlKXtcclxuICAgICAgICB2YXIgc3RyaXAgPSBuZXcgSC5nZW8uU3RyaXAoKSxcclxuICAgICAgICAgICAgcm91dGVTaGFwZSA9IHJvdXRlLnNoYXBlLFxyXG4gICAgICAgICAgICBwb2x5bGluZTtcclxuXHJcbiAgICAgICAgcm91dGVTaGFwZS5mb3JFYWNoKGZ1bmN0aW9uKHBvaW50KSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJ0cyA9IHBvaW50LnNwbGl0KCcsJyk7XHJcbiAgICAgICAgICAgIHN0cmlwLnB1c2hMYXRMbmdBbHQocGFydHNbMF0sIHBhcnRzWzFdKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcG9seWxpbmUgPSBuZXcgSC5tYXAuUG9seWxpbmUoc3RyaXAsIHtcclxuICAgICAgICAgICAgc3R5bGU6IHtcclxuICAgICAgICAgICAgbGluZVdpZHRoOiA0LFxyXG4gICAgICAgICAgICBzdHJva2VDb2xvcjogJ3JnYmEoMCwgMTI4LCAyNTUsIDAuNyknXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICAvLyBBZGQgdGhlIHBvbHlsaW5lIHRvIHRoZSBtYXBcclxuICAgICAgICBtYXAuYWRkT2JqZWN0KHBvbHlsaW5lKTtcclxuICAgICAgICAvLyBBbmQgem9vbSB0byBpdHMgYm91bmRpbmcgcmVjdGFuZ2xlXHJcbiAgICAgICAgbWFwLnNldFZpZXdCb3VuZHMocG9seWxpbmUuZ2V0Qm91bmRzKCksIHRydWUpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZE1hbnVldmVyc1RvTWFwKG1hcCwgcm91dGUpe1xyXG4gICAgICAgIHZhciBzdmdNYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiAnICtcclxuICAgICAgICAgICAgJ3htbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj4nICtcclxuICAgICAgICAgICAgJzxjaXJjbGUgY3g9XCI4XCIgY3k9XCI4XCIgcj1cIjhcIiAnICtcclxuICAgICAgICAgICAgJ2ZpbGw9XCIjMWI0NjhkXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIxXCIgIC8+JyArXHJcbiAgICAgICAgICAgICc8L3N2Zz4nLFxyXG4gICAgICAgICAgICBkb3RJY29uID0gbmV3IEgubWFwLkljb24oc3ZnTWFya3VwLCB7YW5jaG9yOiB7eDo4LCB5Ojh9fSksXHJcbiAgICAgICAgICAgIGdyb3VwID0gbmV3ICBILm1hcC5Hcm91cCgpLFxyXG4gICAgICAgICAgICBpLFxyXG4gICAgICAgICAgICBqO1xyXG5cclxuICAgICAgICAvLyBBZGQgYSBtYXJrZXIgZm9yIGVhY2ggbWFuZXV2ZXJcclxuICAgICAgICBmb3IgKGkgPSAwOyAgaSA8IHJvdXRlLmxlZy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICBmb3IgKGogPSAwOyAgaiA8IHJvdXRlLmxlZ1tpXS5tYW5ldXZlci5sZW5ndGg7IGogKz0gMSkge1xyXG4gICAgICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxyXG4gICAgICAgICAgICAgICAgbWFuZXV2ZXIgPSByb3V0ZS5sZWdbaV0ubWFuZXV2ZXJbal07XHJcbiAgICAgICAgICAgICAgICAvLyBBZGQgYSBtYXJrZXIgdG8gdGhlIG1hbmV1dmVycyBncm91cFxyXG4gICAgICAgICAgICAgICAgdmFyIG1hcmtlciA9ICBuZXcgSC5tYXAuTWFya2VyKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiBtYW5ldXZlci5wb3NpdGlvbi5sYXRpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbG5nOiBtYW5ldXZlci5wb3NpdGlvbi5sb25naXR1ZGV9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7aWNvbjogZG90SWNvbn1cclxuICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgbWFya2VyLmluc3RydWN0aW9uID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XHJcbiAgICAgICAgICAgICAgICBncm91cC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ3JvdXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24gKGV2dCkge1xyXG4gICAgICAgICAgICBtYXAuc2V0Q2VudGVyKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSk7XHJcbiAgICAgICAgICAgIG9wZW5CdWJibGUoZXZ0LnRhcmdldC5nZXRQb3NpdGlvbigpLCBldnQudGFyZ2V0Lmluc3RydWN0aW9uKTtcclxuICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCB0aGUgbWFuZXV2ZXJzIGdyb3VwIHRvIHRoZSBtYXBcclxuICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRXYXlwb2ludHNUb1BhbmVsKHdheXBvaW50cyl7XHJcbiAgICAgICAgdmFyIG5vZGVIMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyksXHJcbiAgICAgICAgICAgIHdheXBvaW50TGFiZWxzID0gW10sXHJcbiAgICAgICAgICAgIGk7XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7ICBpIDwgd2F5cG9pbnRzLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIHdheXBvaW50TGFiZWxzLnB1c2god2F5cG9pbnRzW2ldLmxhYmVsKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbm9kZUgzLnRleHRDb250ZW50ID0gd2F5cG9pbnRMYWJlbHMuam9pbignIC0gJyk7XHJcblxyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGVIMyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRTdW1tYXJ5VG9QYW5lbChzdW1tYXJ5KXtcclxuICAgICAgICB2YXIgc3VtbWFyeURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxyXG4gICAgICAgICAgICBjb250ZW50ID0gJyc7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnRlbnQgKz0gJzxiPlRvdGFsIGRpc3RhbmNlPC9iPjogJyArIHN1bW1hcnkuZGlzdGFuY2UgICsgJ20uIDxici8+JztcclxuICAgICAgICBjb250ZW50ICs9ICc8Yj5UcmF2ZWwgVGltZTwvYj46ICcgKyBzdW1tYXJ5LnRyYXZlbFRpbWUudG9NTVNTKCkgKyAnIChpbiBjdXJyZW50IHRyYWZmaWMpJztcclxuXHJcblxyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUuZm9udFNpemUgPSAnc21hbGwnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUubWFyZ2luTGVmdCA9JzUlJztcclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpblJpZ2h0ID0nNSUnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuaW5uZXJIVE1MID0gY29udGVudDtcclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChzdW1tYXJ5RGl2KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZE1hbnVldmVyc1RvUGFuZWwocm91dGUpe1xyXG4gICAgICAgIHZhciBub2RlT0wgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvbCcpLCBpLCBqO1xyXG5cclxuICAgICAgICBub2RlT0wuc3R5bGUuZm9udFNpemUgPSAnc21hbGwnO1xyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5tYXJnaW5MZWZ0ID0nNSUnO1xyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5tYXJnaW5SaWdodCA9JzUlJztcclxuICAgICAgICBub2RlT0wuY2xhc3NOYW1lID0gJ2RpcmVjdGlvbnMnO1xyXG5cclxuICAgICAgICAvLyBBZGQgYSBtYXJrZXIgZm9yIGVhY2ggbWFuZXV2ZXJcclxuICAgICAgICBmb3IgKGkgPSAwOyAgaSA8IHJvdXRlLmxlZy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICBmb3IgKGogPSAwOyAgaiA8IHJvdXRlLmxlZ1tpXS5tYW5ldXZlci5sZW5ndGg7IGogKz0gMSkge1xyXG4gICAgICAgICAgICAvLyBHZXQgdGhlIG5leHQgbWFuZXV2ZXIuXHJcbiAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xyXG5cclxuICAgICAgICAgICAgdmFyIGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKSxcclxuICAgICAgICAgICAgICAgIHNwYW5BcnJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKSxcclxuICAgICAgICAgICAgICAgIHNwYW5JbnN0cnVjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuXHJcbiAgICAgICAgICAgIHNwYW5BcnJvdy5jbGFzc05hbWUgPSAnYXJyb3cgJyAgKyBtYW5ldXZlci5hY3Rpb247XHJcbiAgICAgICAgICAgIHNwYW5JbnN0cnVjdGlvbi5pbm5lckhUTUwgPSBtYW5ldXZlci5pbnN0cnVjdGlvbjtcclxuICAgICAgICAgICAgbGkuYXBwZW5kQ2hpbGQoc3BhbkFycm93KTtcclxuICAgICAgICAgICAgbGkuYXBwZW5kQ2hpbGQoc3Bhbkluc3RydWN0aW9uKTtcclxuXHJcbiAgICAgICAgICAgIG5vZGVPTC5hcHBlbmRDaGlsZChsaSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGVPTCk7XHJcbiAgICB9XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBcIlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVRcIjogNTAwLFxyXG4gICAgXCJNT0RVTEVTXCI6IHtcclxuICAgICAgICBVSTogJ2NvbnRyb2xzJyxcclxuICAgICAgICBFVkVOVFM6ICdldmVudHMnLFxyXG4gICAgICAgIFBBTk86ICdwYW5vJ1xyXG4gICAgfSxcclxuICAgIFwiREVGQVVMVF9NQVBfT1BUSU9OU1wiOiB7XHJcbiAgICAgICAgaGVpZ2h0OiA0ODAsXHJcbiAgICAgICAgd2lkdGg6IDY0MCxcclxuICAgICAgICB6b29tOiAxMCxcclxuICAgICAgICBkcmFnZ2FibGU6IGZhbHNlXHJcbiAgICB9LFxyXG4gICAgXCJNQVJLRVJfVFlQRVNcIjoge1xyXG4gICAgICAgIERPTTogXCJET01cIixcclxuICAgICAgICBTVkc6IFwiU1ZHXCJcclxuICAgIH0sXHJcbiAgICBcIk1BUF9FVkVOVFNcIjoge1xyXG4gICAgICAgIE5BVklHQVRFOiBcIk5BVklHQVRFXCIsXHJcbiAgICAgICAgUkVMT0FEOiBcIlJFTE9BRFwiXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBEZWZhdWx0TWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBEZWZhdWx0TWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRGVmYXVsdE1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcblxyXG4gICAgcmV0dXJuIERlZmF1bHRNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzKTtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERPTU1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRE9NTWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRE9NTWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLl9nZXRJY29uID0gX2dldEljb247XHJcbiAgICBwcm90by5fc2V0dXBFdmVudHMgPSBfc2V0dXBFdmVudHM7XHJcbiAgICBwcm90by5fZ2V0RXZlbnRzID0gX2dldEV2ZW50cztcclxuXHJcbiAgICByZXR1cm4gRE9NTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkRvbU1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLl9nZXRJY29uKClcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uLCB0aGlzLl9nZXRFdmVudHMoKSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9zZXR1cEV2ZW50cyhlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9nZXRFdmVudHMoKXtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgICAgIGV2ZW50cyA9IHRoaXMucGxhY2UuZXZlbnRzO1xyXG5cclxuICAgICAgICBpZighdGhpcy5wbGFjZS5ldmVudHMpXHJcbiAgICAgICAgICAgIHJldHVybiB7fTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgb25BdHRhY2g6IGZ1bmN0aW9uKGNsb25lZEVsZW1lbnQsIGRvbUljb24sIGRvbU1hcmtlcil7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zZXR1cEV2ZW50cyhjbG9uZWRFbGVtZW50LCBldmVudHMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBvbkRldGFjaDogZnVuY3Rpb24oY2xvbmVkRWxlbWVudCwgZG9tSWNvbiwgZG9tTWFya2VyKXtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3NldHVwRXZlbnRzKGNsb25lZEVsZW1lbnQsIGV2ZW50cywgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XHJcbiAgICBmdW5jdGlvbiBNYXJrZXJJbnRlcmZhY2UoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBNYXJrZXIoKXt9O1xyXG4gICAgXHJcbiAgICBNYXJrZXIucHJvdG90eXBlID0gcHJvdG87XHJcbiAgICBcclxuICAgIHJldHVybiBNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZ2V0SW5zdGFuY2U6OiBub3QgaW1wbGVtZW50ZWQnKTsgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHNldENvb3Jkcygpe1xyXG4gICAgICAgICB0aGlzLmNvb3JkcyA9IHtcclxuICAgICAgICAgICAgbGF0OiB0aGlzLnBsYWNlLnBvcy5sYXQsXHJcbiAgICAgICAgICAgIGxuZzogdGhpcy5wbGFjZS5wb3MubG5nXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbn0iLCJ2YXIgbWFya2VySW50ZXJmYWNlID0gcmVxdWlyZSgnLi9tYXJrZXIuanMnKSxcclxuXHRkZWZhdWx0TWFya2VyID0gcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpLFxyXG5cdGRvbU1hcmtlciA9IHJlcXVpcmUoJy4vZG9tLm1hcmtlci5qcycpLFxyXG5cdHN2Z01hcmtlciA9IHJlcXVpcmUoJy4vc3ZnLm1hcmtlci5qcycpLFxyXG4gICAgbWFya2Vyc1NlcnZpY2UgPSByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ21hcmtlci1pbnRlcmZhY2UnLCBbXSkuZmFjdG9yeSgnTWFya2VySW50ZXJmYWNlJywgbWFya2VySW50ZXJmYWNlKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RlZmF1bHQtbWFya2VyJywgW10pLmZhY3RvcnkoJ0RlZmF1bHRNYXJrZXInLCBkZWZhdWx0TWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RvbS1tYXJrZXInLCBbXSkuZmFjdG9yeSgnRE9NTWFya2VyJywgZG9tTWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ3N2Zy1tYXJrZXInLCBbXSkuZmFjdG9yeSgnU1ZHTWFya2VyJywgc3ZnTWFya2VyKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLXNlcnZpY2UnLCBbXSkuc2VydmljZSgnTWFya2Vyc1NlcnZpY2UnLCBtYXJrZXJzU2VydmljZSk7XHJcblxyXG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ21hcmtlcnMtbW9kdWxlJywgW1xyXG5cdCdtYXJrZXItaW50ZXJmYWNlJyxcclxuICAgICdkZWZhdWx0LW1hcmtlcicsXHJcbiAgICAnZG9tLW1hcmtlcicsXHJcbiAgICAnbWFya2Vycy1zZXJ2aWNlJyxcclxuICAgICdzdmctbWFya2VyJ1xyXG5dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYXBwOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oRGVmYXVsdE1hcmtlciwgRE9NTWFya2VyLCBTVkdNYXJrZXIsIENPTlNUUykge1xyXG5cclxuICAgIHZhciBNQVJLRVJfVFlQRVMgPSBDT05TVFMuTUFSS0VSX1RZUEVTO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJzVG9NYXA6IGFkZE1hcmtlcnNUb01hcCxcclxuICAgICAgICBhZGRVc2VyTWFya2VyOiBhZGRVc2VyTWFya2VyXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkTWFya2Vyc1RvTWFwKG1hcCwgcGxhY2VzKSB7XHJcbiAgICAgICAgaWYgKCFwbGFjZXMgfHwgIXBsYWNlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgaWYgKCEobWFwIGluc3RhbmNlb2YgSC5NYXApKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG1hcCBpbnN0YW5jZScpO1xyXG5cclxuICAgICAgICBwbGFjZXMuZm9yRWFjaChmdW5jdGlvbihwbGFjZSwgaSkge1xyXG4gICAgICAgICAgICB2YXIgY3JlYXRvciA9IF9nZXRNYXJrZXJDcmVhdG9yKHBsYWNlKTtcclxuICAgICAgICAgICAgdmFyIG1hcmtlciA9IHBsYWNlLmRyYWdnYWJsZSA/IF9kcmFnZ2FibGVNYXJrZXJNaXhpbihjcmVhdG9yLmNyZWF0ZSgpKSA6IGNyZWF0b3IuY3JlYXRlKCk7XHJcblxyXG4gICAgICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZFVzZXJNYXJrZXIobWFwLCBwbGFjZSkge1xyXG4gICAgICAgIHZhciBzdHlsZXMgPSBbXHJcbiAgICAgICAgICAgIFwiYm9yZGVyLXJhZGl1czogNTAlXCIsXHJcbiAgICAgICAgICAgIFwiYmFja2dyb3VuZC1jb2xvcjogcmdiYSgzOCwgMzMsIDk3LCAuOClcIixcclxuICAgICAgICAgICAgXCJoZWlnaHQ6IDEycHhcIixcclxuICAgICAgICAgICAgXCJ3aWR0aDogMTJweFwiXHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAgICAgdmFyIG1hcmt1cCA9ICc8ZGl2IHN0eWxlPVwie3N0eWxlfVwiPjwvZGl2Pic7XHJcbiAgICAgICAgcGxhY2UubWFya3VwID0gbWFya3VwLnJlcGxhY2UoL3tzdHlsZX0vLCBzdHlsZXMuam9pbignOycpKTtcclxuXHJcbiAgICAgICAgdmFyIGNyZWF0b3IgPSBuZXcgRE9NTWFya2VyKHBsYWNlKTtcclxuXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChjcmVhdG9yLmNyZWF0ZSgpKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyB2YXIgbWFya2VyID0gbmV3IEgubWFwLkNpcmNsZShwbGFjZS5wb3MsIDEwMDAwLCB7XHJcbiAgICAgICAgLy8gICAgICAgICBzdHlsZToge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIHN0cm9rZUNvbG9yOiAncmdiYSg1NSwgODUsIDE3MCwgMC42KScsIC8vIENvbG9yIG9mIHRoZSBwZXJpbWV0ZXJcclxuICAgICAgICAvLyAgICAgICAgICAgICBsaW5lV2lkdGg6IDIsXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgZmlsbENvbG9yOiAncmdiYSgwLCAxMjgsIDAsIDAuNyknICAvLyBDb2xvciBvZiB0aGUgY2lyY2xlXHJcbiAgICAgICAgLy8gICAgICAgICB9XHJcbiAgICAgICAgLy8gICAgIH1cclxuICAgICAgICAvLyApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIG1hcC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSkge1xyXG4gICAgICAgIHZhciBDb25jcmV0ZU1hcmtlcixcclxuICAgICAgICAgICAgdHlwZSA9IHBsYWNlLnR5cGUgPyBwbGFjZS50eXBlLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBTVkdNYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRGVmYXVsdE1hcmtlcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcclxuICAgICAgICBtYXJrZXIuZHJhZ2dhYmxlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gU1ZHTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gU1ZHTWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIFxyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLl9nZXRJY29uID0gX2dldEljb247XHJcbiAgICBcclxuICAgIHJldHVybiBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuX2dldEljb24oKSxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuSWNvbihpY29uKTtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHJvb3RTY29wZSwgJHRpbWVvdXQpe1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB0aHJvdHRsZTogdGhyb3R0bGUsXHJcbiAgICAgICAgY3JlYXRlU2NyaXB0VGFnOiBjcmVhdGVTY3JpcHRUYWcsXHJcbiAgICAgICAgY3JlYXRlTGlua1RhZzogY3JlYXRlTGlua1RhZyxcclxuICAgICAgICBydW5TY29wZURpZ2VzdElmTmVlZDogcnVuU2NvcGVEaWdlc3RJZk5lZWRcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2Qpe1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgaWYoJHRpbWVvdXQpXHJcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNjcmlwdFRhZyhhdHRycyl7XHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLnNyYyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYoc2NyaXB0KVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBzY3JpcHQuaWQgPSBhdHRycy5zcmM7XHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpOyAgICBcclxuXHJcbiAgICAgICAgcmV0dXJuIHNjcmlwdDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVMaW5rVGFnKGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5ocmVmKTtcclxuICAgICAgICBcclxuICAgICAgICBpZihsaW5rKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcbiAgICAgICAgbGluay5pZCA9IGF0dHJzLmhyZWY7XHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbGluaztcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUMgXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcclxuICAgICAgICBpZighZWwgfHwgIWF0dHJzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGF0dHJzKSB7XHJcbiAgICAgICAgICAgIGlmKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFtrZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07Il19
