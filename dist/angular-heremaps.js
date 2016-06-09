(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function(
    $timeout,
    $window,
    $rootScope,
    $filter,
    HereMapsConfig,
    APIService,
    HereMapUtilsService,
    MarkersService,
    CONSTS,
    EventsModule,
    UIModule) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': mapWidth, 'height': mapHeight}\"></div>",
        replace: true,
        scope: {
            opts: '&options',
            places: '&',
            onMapReady: "&mapReady",
            events: '&'
        },
        controller: function($scope, $element, $attrs) {
            var CONTROL_NAMES = CONSTS.CONTROLS.NAMES,
                places = $scope.places(),
                opts = $scope.opts(),
                listeners = $scope.events();

            var options = angular.extend({}, CONSTS.DEFAULT_MAP_OPTIONS, opts),
                position = HereMapUtilsService.isValidCoords(options.coords) ? options.coords : CONSTS.DEFAULT_MAP_OPTIONS.coords;

            var heremaps = {},
                mapReady = $scope.onMapReady(),
                _onResizeMap = null;;

            // TODO: Do we really need this $timeout workaround ?
            // document.addEventListener("DOMContentLoaded", function(){
                _setMapSize();
                APIService.loadApi().then(_apiReady);
            // });

            options.resize && addOnResizeListener();

            $scope.$on('$destroy', function() {
                $window.removeEventListener('resize', _onResizeMap);
            });

            function addOnResizeListener() {
                _onResizeMap = HereMapUtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT);
                $window.addEventListener('resize', _onResizeMap);
            }

            function _apiReady() {
                _setupMapPlatform();
                _setupMap();
            }

            function _setupMapPlatform() {
                if (!HereMapsConfig.app_id || !HereMapsConfig.app_code)
                    throw new Error('app_id or app_code were missed. Please specify their in HereMapsConfig');

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

            function _setupMap() {
                _initMap(function() {
                    APIService.loadModules($attrs.$attr, {
                        "controls": _uiModuleReady,
                        "events": _eventsModuleReady
                    });
                });
            }

            function _initMap(cb) {
                var map = heremaps.map = new H.Map($element[0], heremaps.layers.normal.map, {
                    zoom: HereMapUtilsService.isValidCoords(position) ? options.zoom : options.maxZoom,
                    center: new H.geo.Point(position.latitude, position.longitude)
                });

                // MarkersService.addUserMarker(map, {
                //     pos: { lat: position.latitude, lng: position.longitude }
                // });

                MarkersService.addMarkersToMap(map, places);

                mapReady && mapReady(MapProxy());

                cb && cb();
            }

            function _uiModuleReady(){
                UIModule.start({
                    platform: heremaps,
                    alignment: $attrs.controls
                });
            }

            function _eventsModuleReady() {
                EventsModule.start({
                    platform: heremaps,
                    listeners: listeners,
                    options: options,
                    injector: _moduleInjector
                });
            }

            function _moduleInjector() {
                return function(id) {
                    return heremaps[id];
                }
            }

            function _resizeHandler() {
                _setMapSize();

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
                    getPlatform: function() {
                        return heremaps;
                    },
                    calculateRoute: function(driveType, direction) {
                        APIService.calculateRoute(heremaps.platform, heremaps.map, {
                            driveType: driveType,
                            direction: direction
                        });
                    },
                    setZoom: function(zoom, step) {
                        HereMapUtilsService.zoom(heremaps.map, zoom || 10, step);
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
                    },
                    updateMarkers: function(places) {
                        MarkersService.updateMarkers(heremaps.map, places);
                    }
                }
            }

        }
    }
};

},{}],2:[function(require,module,exports){
require('./providers/markers/markers.module');
require('./providers/components/components.module');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/mapconfig.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/maputils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module',
    'components-module'
]);

heremaps
    .provider('HereMapsConfig', configProvider)
    .service('APIService', ['$q', 'HereMapsConfig', 'HereMapUtilsService', 'CONSTS', apiService])
    .service('HereMapUtilsService', utilsService)
    .constant('CONSTS', consts);

heremaps.directive('heremaps', directive);

module.exports = heremaps;
},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/components/components.module":4,"./providers/consts":8,"./providers/mapconfig.provider":9,"./providers/maputils.service":10,"./providers/markers/markers.module":14}],3:[function(require,module,exports){
module.exports = function($q, HereMapsConfig, HereMapUtilsService, CONSTS) {
    var version = HereMapsConfig.apiVersion,
        protocol = HereMapsConfig.useHTTPS ? 'https' : 'http';

    var API_VERSION = {
        V: parseInt(version),
        SUB: version
    };

    var CONFIG = {
        BASE: "://js.api.here.com/v",
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

        if (options && _isValidCoords(options.coords)) {
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
        console.log(result)
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
            protocol,            
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
var eventsModule = require('./events/events.js'),
    infoBubble = require('./events/infobubble.js');
    
var uiModule = require('./ui/ui.js');

angular.module('events-module', [])
    .factory('EventsModule', eventsModule)
    .factory('InfoBubbleFactory', infoBubble);
    
angular.module('ui-module', [])
    .factory('UIModule', uiModule)

var app = angular.module('components-module', [
	'events-module',
    'ui-module'
]);

module.exports = app;
},{"./events/events.js":5,"./events/infobubble.js":6,"./ui/ui.js":7}],5:[function(require,module,exports){
module.exports = function(HereMapUtilsService, MarkersService, CONSTS, InfoBubbleFactory) {
    function Events(platform, Injector, listeners) {
        this.map = platform.map;
        this.listeners = listeners;
        this.inject = new Injector();
        this.events = platform.events = new H.mapevents.MapEvents(this.map);
        this.behavior = platform.behavior = new H.mapevents.Behavior(this.events);
        this.bubble = InfoBubbleFactory.create();

        this.setupEventListeners();
    }

    var proto = Events.prototype;

    proto.setupEventListeners = setupEventListeners;
    proto.setupOptions = setupOptions;
    proto.triggerUserListener = triggerUserListener;
    proto.infoBubbleHandler = infoBubbleHandler;  

    return {
        start: function(args) {
            if (!(args.platform.map instanceof H.Map))
                return console.error('Missed required map instance');

            var events = new Events(args.platform, args.injector, args.listeners);

            args.options && events.setupOptions(args.options);
        }
    }

    function setupEventListeners() {
        var self = this;

        HereMapUtilsService.addEventListener(this.map, 'tap', this.infoBubbleHandler.bind(this));

        HereMapUtilsService.addEventListener(this.map, 'pointermove', this.infoBubbleHandler.bind(this));

        HereMapUtilsService.addEventListener(this.map, 'dragstart', function(e) {
            if (MarkersService.isMarkerInstance(e.target)) {
                self.behavior.disable();
            }

            self.triggerUserListener(CONSTS.USER_EVENTS[e.type], e);
        });

        HereMapUtilsService.addEventListener(this.map, 'drag', function(e) {
            var pointer = e.currentPointer,
                target = e.target;

            if (MarkersService.isMarkerInstance(target)) {
                target.setPosition(self.map.screenToGeo(pointer.viewportX, pointer.viewportY));
            }

            self.triggerUserListener(CONSTS.USER_EVENTS[e.type], e);
        });

        HereMapUtilsService.addEventListener(this.map, 'dragend', function(e) {
            if (MarkersService.isMarkerInstance(e.target)) {
                self.behavior.enable();
            }

            self.triggerUserListener(CONSTS.USER_EVENTS[e.type], e);
        });
    }

    function setupOptions(options) {
        if (!options)
            return;

        this.map.draggable = !!options.draggable;
    }

    function triggerUserListener(eventName, e) {
        if (!this.listeners)
            return;

        var callback = this.listeners[eventName];

        callback && callback(e);
    }
    
    function infoBubbleHandler(e){
        var ui = this.inject('ui');
        
        if(ui)
            this.bubble.toggle(e, ui);
            
        this.triggerUserListener(CONSTS.USER_EVENTS[e.type], e);      
    }

};
},{}],6:[function(require,module,exports){
module.exports = function(MarkersService, HereMapUtilsService, CONSTS) {
    function InfoBubble() {}

    var proto = InfoBubble.prototype;
        
    proto.create = create;
    proto.update = update;
    proto.toggle = toggle;
    proto.show = show;
    proto.close = close;

    return {
        create: function(){
            return new InfoBubble();
        }
    }

    function toggle(e, ui) {
        if (MarkersService.isMarkerInstance(e.target))
            this.show(e, ui);
        else
            this.close(e, ui);
    }

    function update(bubble, data) {
        bubble.display = data.display;

        bubble.setPosition(data.position);
        bubble.setContent(data.markup);

        bubble.setState(CONSTS.INFOBUBBLE.STATE.OPEN);
    }

    function create(source) {
        var bubble = new H.ui.InfoBubble(source.position, {
            content: source.markup
        });

        bubble.display = source.display;
        bubble.addClass(CONSTS.INFOBUBBLE.STATE.OPEN)

        HereMapUtilsService.addEventListener(bubble, 'statechange', function(e) {
            var state = this.getState(),
                el = this.getElement();
            if (state === CONSTS.INFOBUBBLE.STATE.CLOSED) {
                el.classList.remove(CONSTS.INFOBUBBLE.STATE.OPEN);
            } else
                this.addClass(state)
        });

        return bubble;
    }

    function show(e, ui, data) {
        var target = e.target,
            data = target.getData(),
            el = null;

        if (!data || !data.display || !data.markup || data.display !== CONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type])
            return;

        var source = {
            position: target.getPosition(),
            markup: data.markup,
            display: data.display
        };

        if (!ui.bubble) {
            ui.bubble = this.create(source);
            ui.addBubble(ui.bubble);

            return;
        }

        this.update(ui.bubble, source);
    }

    function close(e, ui) {
        if (!ui.bubble || ui.bubble.display !== CONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type]) {
            return;
        }

        ui.bubble.setState(CONSTS.INFOBUBBLE.STATE.CLOSED);
    }
}
},{}],7:[function(require,module,exports){
module.exports = function(APIService, MarkersService, HereMapUtilsService, CONSTS) {
    function UI(platform, alignment) {
        this.map = platform.map;
        this.layers = platform.layers;
        this.alignment = alignment;
        this.ui = platform.ui = H.ui.UI.createDefault(this.map, this.layers);

        this.setupControls();
    }

    UI.isValidAlignment = isValidAlignment;

    var proto = UI.prototype;

    proto.setupControls = setupControls;
    proto.createUserControl = createUserControl;
    proto.setControlsAlignment = setControlsAlignment;

    return {
        start: function(args) {
            if (!(args.platform.map instanceof H.Map) && !(args.platform.layers))
                return console.error('Missed ui module dependencies');

            var ui = new UI(args.platform, args.alignment);
        }
    }

    function setupControls() {
        var NAMES = CONSTS.CONTROLS.NAMES,
            userControl = this.createUserControl();

        this.ui.getControl(NAMES.SETTINGS).setIncidentsLayer(false);
        this.ui.addControl(NAMES.USER, userControl);
        this.setControlsAlignment(NAMES);
    }

    function createUserControl() {
        var self = this,
            userControl = new H.ui.Control(),
            markup = '<svg class="H_icon" fill="#fff" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path class="middle_location_stroke" d="M8 12c-2.206 0-4-1.795-4-4 0-2.206 1.794-4 4-4s4 1.794 4 4c0 2.205-1.794 4-4 4M8 1.25a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5"></path><path class="inner_location_stroke" d="M8 5a3 3 0 1 1 .001 6A3 3 0 0 1 8 5m0-1C5.794 4 4 5.794 4 8c0 2.205 1.794 4 4 4s4-1.795 4-4c0-2.206-1.794-4-4-4"></path><path class="outer_location_stroke" d="M8 1.25a6.75 6.75 0 1 1 0 13.5 6.75 6.75 0 0 1 0-13.5M8 0C3.59 0 0 3.59 0 8c0 4.411 3.59 8 8 8s8-3.589 8-8c0-4.41-3.59-8-8-8"></path></svg>';

        var userControlButton = new H.ui.base.Button({
            label: markup,
            onStateChange: function(evt) {
                if (userControlButton.getState() === H.ui.base.Button.State.DOWN)
                    return;

                APIService.getPosition().then(function(response) {
                    var position = {
                        lng: response.coords.longitude,
                        lat: response.coords.latitude
                    };
                    
                    self.map.setCenter(position);
                    
                    HereMapUtilsService.zoom(self.map, 17, .08);

                    if (self.userMarker) {
                        self.userMarker.setPosition(position);
                        return;
                    }
                    
                    self.userMarker = MarkersService.addUserMarker(self.map, {
                        pos: position
                    });
                });
            }
        });

        userControl.addChild(userControlButton);

        return userControl;
    }

    function setControlsAlignment(NAMES) {
        if (!UI.isValidAlignment(this.alignment))
            return;

        for (var id in NAMES) {
            var control = this.ui.getControl(NAMES[id]);

            if (!NAMES.hasOwnProperty(id) || !control)
                continue;

            control.setAlignment(this.alignment);
        }
    }

    function isValidAlignment(alignment) {
        return !!(CONSTS.CONTROLS.POSITIONS.indexOf(alignment) + 1);
    }

};
},{}],8:[function(require,module,exports){
module.exports = {
    UPDATE_MAP_RESIZE_TIMEOUT: 500,
    ANIMATION_ZOOM_STEP: .05,
    MODULES: {
        UI: 'controls',
        EVENTS: 'events',
        PANO: 'pano'
    },
    DEFAULT_MAP_OPTIONS: {
        height: 480,
        width: 640,
        zoom: 12,
        maxZoom: 2,
        resize: false,
        draggable: false,
        coords: {
            longitude: 0,
            latitude: 0
        }
    },
    MARKER_TYPES: {
        DOM: "DOM",
        SVG: "SVG"
    },
    CONTROLS: {
        NAMES: {
            SCALE: 'scalebar',
            SETTINGS: 'mapsettings',
            ZOOM: 'zoom',
            USER: 'userposition'
        },
        POSITIONS: [
            'top-right',
            'top-center',
            'top-left',
            'left-top',
            'left-middle',
            'left-bottom',
            'right-top',
            'right-middle',
            'right-bottom',
            'bottom-right',
            'bottom-center',
            'bottom-left'
        ]
    },
    INFOBUBBLE: {
        STATE: {
            OPEN: 'open',
            CLOSED: 'closed'
        },
        DISPLAY_EVENT: {
            pointermove: 'onHover',
            tap: 'onClick'
        }
    },
    USER_EVENTS: {
        tap: 'click',
        pointermove: 'mousemove',
        pointerleave: 'mouseleave',
        pointerenter: 'mouseenter',
        drag: 'drag',
        dragstart: 'dragstart',
        dragend: 'dragend'
    }
}
},{}],9:[function(require,module,exports){
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
},{}],10:[function(require,module,exports){
module.exports = function($rootScope, $timeout, CONSTS){
    return {
        throttle: throttle,
        createScriptTag: createScriptTag,
        createLinkTag: createLinkTag,
        runScopeDigestIfNeed: runScopeDigestIfNeed,
        isValidCoords: isValidCoords,
        addEventListener: addEventListener,
        zoom: zoom
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
    
    function addEventListener(obj, eventName, listener, useCapture) {
        var _useCapture = !!useCapture;

        obj.addEventListener(eventName, listener, _useCapture);
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

    function isValidCoords(coords){
        return coords && 
            (typeof coords.latitude === 'string' ||  typeof coords.latitude === 'number') &&
            (typeof coords.longitude === 'string' ||  typeof coords.longitude === 'number')
    }
    
    function zoom(map, value, step){
        var currentZoom = map.getZoom(),
            _step = step || CONSTS.ANIMATION_ZOOM_STEP,
            factor = currentZoom >= value ? -1 : 1,
            increment = step * factor;
            
        return (function zoom(){
            if(!step || Math.floor(currentZoom) === Math.floor(value)) {
                map.setZoom(value);
                return;
            }
                
            currentZoom += increment;
            map.setZoom(currentZoom);
            
            requestAnimationFrame(zoom);
        })();
    }
    
    //#endregion PUBLIC 

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
},{}],11:[function(require,module,exports){
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
        var marker = new H.map.Marker(this.coords);
        
        this.addInfoBubble(marker);
        
        return marker;
    }
}
},{}],12:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function DOMMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DOMMarker.prototype = new MarkerInterface();
    proto.constructor = DOMMarker;

    proto.create = create;
    proto.getIcon = getIcon;
    proto.setupEvents = setupEvents;

    return DOMMarker;
    
    function create(){
        var marker = new H.map.DomMarker(this.coords, {
            icon: this.getIcon()
        });
        
        this.addInfoBubble(marker);
        
        return marker;
    }
    
    function getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.DomIcon(icon);
    }
    
    function setupEvents(el, events, remove){
        var method = remove ? 'removeEventListener' : 'addEventListener';

        for(var key in events) {
            if(!events.hasOwnProperty(key))
                continue;

            el[method].call(null, key, events[key]);
        }
    }
}
},{}],13:[function(require,module,exports){
module.exports = function(){
    function MarkerInterface(){
        throw new Error('Abstract class! The Instance should be created');
    }
    
    var proto = MarkerInterface.prototype;
    
    proto.create = create;
    proto.setCoords = setCoords;
    proto.addInfoBubble = addInfoBubble;
    
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
    
    function addInfoBubble(marker){
        if(!this.place.popup)
            return;
            
        marker.setData(this.place.popup)
    }
}
},{}],14:[function(require,module,exports){
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
},{"./default.marker.js":11,"./dom.marker.js":12,"./marker.js":13,"./markers.service.js":15,"./svg.marker.js":16}],15:[function(require,module,exports){
module.exports = function(DefaultMarker, DOMMarker, SVGMarker, CONSTS) {

    var MARKER_TYPES = CONSTS.MARKER_TYPES;

    return {
        addMarkersToMap: addMarkersToMap,
        addUserMarker: addUserMarker,
        updateMarkers: updateMarkers,
        isMarkerInstance: isMarkerInstance
    }

    function isMarkerInstance(target) {
        return target instanceof H.map.Marker || target instanceof H.map.DomMarker;
    }

    function addUserMarker(map, place) {
        place.markup = '<svg width="35px" height="35px" viewBox="0 0 90 90" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
            '<defs><circle id="path-1" cx="302" cy="802" r="15"></circle>' +
            '<mask id="mask-2" maskContentUnits="userSpaceOnUse" maskUnits="objectBoundingBox" x="-30" y="-30" width="90" height="90">' +
            '<rect x="257" y="757" width="90" height="90" fill="white"></rect><use xlink:href="#path-1" fill="black"></use>' +
            '</mask></defs><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">' +
            '<g id="Service-Options---directions---map" transform="translate(-257.000000, -757.000000)"><g id="Oval-15">' +
            '<use fill="#FFFFFF" fill-rule="evenodd" xlink:href="#path-1"></use>' +
            '<use stroke-opacity="0.29613904" stroke="#3F34A0" mask="url(#mask-2)" stroke-width="60" xlink:href="#path-1"></use>' +
            '<use stroke="#3F34A0" stroke-width="5" xlink:href="#path-1"></use></g></g></g></svg>';

        var marker = new SVGMarker(place).create();

        map.addObject(marker);

        return marker;
    }

    function addMarkersToMap(map, places) {
        if (!places || !places.length)
            return false;

        if (!(map instanceof H.Map))
            throw new Error('Unsupported map instance');

        if (!map.markersGroup)
            map.markersGroup = new H.map.Group();

        places.forEach(function(place, i) {
            var creator = _getMarkerCreator(place),
                marker = place.draggable ? _draggableMarkerMixin(creator.create()) : creator.create();

            map.markersGroup.addObject(marker);
        });

        map.addObject(map.markersGroup);
    }

    function updateMarkers(map, places) {
        if (map.markersGroup) {
            map.markersGroup.removeAll();
            map.removeObject(map.markersGroup);
            map.markersGroup = null;
        }

        addMarkersToMap.apply(null, arguments);
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
},{}],16:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function SVGMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = SVGMarker.prototype = new MarkerInterface();
    proto.constructor = SVGMarker;
    
    proto.create = create;
    proto.getIcon = getIcon;
    
    return SVGMarker;
    
    function create(){
        var marker = new H.map.Marker(this.coords, {
            icon: this.getIcon(),
        });
        
        this.addInfoBubble(marker);
        
        return marker;
    }
    
    function getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.Icon(icon);
    }
}
},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29tcG9uZW50cy9jb21wb25lbnRzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvY29tcG9uZW50cy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9jb21wb25lbnRzL2V2ZW50cy9pbmZvYnViYmxlLmpzIiwic3JjL3Byb3ZpZGVycy9jb21wb25lbnRzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9jb25zdHMuanMiLCJzcmMvcHJvdmlkZXJzL21hcGNvbmZpZy5wcm92aWRlci5qcyIsInNyYy9wcm92aWRlcnMvbWFwdXRpbHMuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9kZWZhdWx0Lm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9kb20ubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXJzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXJzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvc3ZnLm1hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IERteXRybyBvbiA0LzExLzIwMTYuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFxyXG4gICAgJHRpbWVvdXQsXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgICRmaWx0ZXIsXHJcbiAgICBIZXJlTWFwc0NvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLFxyXG4gICAgTWFya2Vyc1NlcnZpY2UsXHJcbiAgICBDT05TVFMsXHJcbiAgICBFdmVudHNNb2R1bGUsXHJcbiAgICBVSU1vZHVsZSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogbWFwV2lkdGgsICdoZWlnaHQnOiBtYXBIZWlnaHR9XFxcIj48L2Rpdj5cIixcclxuICAgICAgICByZXBsYWNlOiB0cnVlLFxyXG4gICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgIG9wdHM6ICcmb3B0aW9ucycsXHJcbiAgICAgICAgICAgIHBsYWNlczogJyYnLFxyXG4gICAgICAgICAgICBvbk1hcFJlYWR5OiBcIiZtYXBSZWFkeVwiLFxyXG4gICAgICAgICAgICBldmVudHM6ICcmJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XHJcbiAgICAgICAgICAgIHZhciBDT05UUk9MX05BTUVTID0gQ09OU1RTLkNPTlRST0xTLk5BTUVTLFxyXG4gICAgICAgICAgICAgICAgcGxhY2VzID0gJHNjb3BlLnBsYWNlcygpLFxyXG4gICAgICAgICAgICAgICAgb3B0cyA9ICRzY29wZS5vcHRzKCksXHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSAkc2NvcGUuZXZlbnRzKCk7XHJcblxyXG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUywgb3B0cyksXHJcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IEhlcmVNYXBVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykgPyBvcHRpb25zLmNvb3JkcyA6IENPTlNUUy5ERUZBVUxUX01BUF9PUFRJT05TLmNvb3JkcztcclxuXHJcbiAgICAgICAgICAgIHZhciBoZXJlbWFwcyA9IHt9LFxyXG4gICAgICAgICAgICAgICAgbWFwUmVhZHkgPSAkc2NvcGUub25NYXBSZWFkeSgpLFxyXG4gICAgICAgICAgICAgICAgX29uUmVzaXplTWFwID0gbnVsbDs7XHJcblxyXG4gICAgICAgICAgICAvLyBUT0RPOiBEbyB3ZSByZWFsbHkgbmVlZCB0aGlzICR0aW1lb3V0IHdvcmthcm91bmQgP1xyXG4gICAgICAgICAgICAvLyBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgX3NldE1hcFNpemUoKTtcclxuICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEFwaSgpLnRoZW4oX2FwaVJlYWR5KTtcclxuICAgICAgICAgICAgLy8gfSk7XHJcblxyXG4gICAgICAgICAgICBvcHRpb25zLnJlc2l6ZSAmJiBhZGRPblJlc2l6ZUxpc3RlbmVyKCk7XHJcblxyXG4gICAgICAgICAgICAkc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgJHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFkZE9uUmVzaXplTGlzdGVuZXIoKSB7XHJcbiAgICAgICAgICAgICAgICBfb25SZXNpemVNYXAgPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLnRocm90dGxlKF9yZXNpemVIYW5kbGVyLCBDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCk7XHJcbiAgICAgICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9hcGlSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIF9zZXR1cE1hcFBsYXRmb3JtKCk7XHJcbiAgICAgICAgICAgICAgICBfc2V0dXBNYXAoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3NldHVwTWFwUGxhdGZvcm0oKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIUhlcmVNYXBzQ29uZmlnLmFwcF9pZCB8fCAhSGVyZU1hcHNDb25maWcuYXBwX2NvZGUpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcHBfaWQgb3IgYXBwX2NvZGUgd2VyZSBtaXNzZWQuIFBsZWFzZSBzcGVjaWZ5IHRoZWlyIGluIEhlcmVNYXBzQ29uZmlnJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKEhlcmVNYXBzQ29uZmlnKTtcclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLmxheWVycyA9IGhlcmVtYXBzLnBsYXRmb3JtLmNyZWF0ZURlZmF1bHRMYXllcnMoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2dldExvY2F0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIEFQSVNlcnZpY2UuZ2V0UG9zaXRpb24oe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvb3JkczogcG9zaXRpb24sXHJcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlSGlnaEFjY3VyYWN5OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIG1heGltdW1BZ2U6IDEwMDAwXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2xvY2F0aW9uRmFpbHVyZSgpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NhbiBub3QgZ2V0IGEgZ2VvIHBvc2l0aW9uJyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcCgpIHtcclxuICAgICAgICAgICAgICAgIF9pbml0TWFwKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZE1vZHVsZXMoJGF0dHJzLiRhdHRyLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiY29udHJvbHNcIjogX3VpTW9kdWxlUmVhZHksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZXZlbnRzXCI6IF9ldmVudHNNb2R1bGVSZWFkeVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9pbml0TWFwKGNiKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gaGVyZW1hcHMubWFwID0gbmV3IEguTWFwKCRlbGVtZW50WzBdLCBoZXJlbWFwcy5sYXllcnMubm9ybWFsLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHpvb206IEhlcmVNYXBVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3Jkcyhwb3NpdGlvbikgPyBvcHRpb25zLnpvb20gOiBvcHRpb25zLm1heFpvb20sXHJcbiAgICAgICAgICAgICAgICAgICAgY2VudGVyOiBuZXcgSC5nZW8uUG9pbnQocG9zaXRpb24ubGF0aXR1ZGUsIHBvc2l0aW9uLmxvbmdpdHVkZSlcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIE1hcmtlcnNTZXJ2aWNlLmFkZFVzZXJNYXJrZXIobWFwLCB7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgcG9zOiB7IGxhdDogcG9zaXRpb24ubGF0aXR1ZGUsIGxuZzogcG9zaXRpb24ubG9uZ2l0dWRlIH1cclxuICAgICAgICAgICAgICAgIC8vIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIE1hcmtlcnNTZXJ2aWNlLmFkZE1hcmtlcnNUb01hcChtYXAsIHBsYWNlcyk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwUmVhZHkgJiYgbWFwUmVhZHkoTWFwUHJveHkoKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKXtcclxuICAgICAgICAgICAgICAgIFVJTW9kdWxlLnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXHJcbiAgICAgICAgICAgICAgICAgICAgYWxpZ25tZW50OiAkYXR0cnMuY29udHJvbHNcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICBFdmVudHNNb2R1bGUuc3RhcnQoe1xyXG4gICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBoZXJlbWFwcyxcclxuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnM6IGxpc3RlbmVycyxcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxyXG4gICAgICAgICAgICAgICAgICAgIGluamVjdG9yOiBfbW9kdWxlSW5qZWN0b3JcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfbW9kdWxlSW5qZWN0b3IoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oaWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHNbaWRdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcmVzaXplSGFuZGxlcigpIHtcclxuICAgICAgICAgICAgICAgIF9zZXRNYXBTaXplKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXRNYXBTaXplKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGhlaWdodCA9ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0SGVpZ2h0IHx8IG9wdGlvbnMuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoID0gJGVsZW1lbnRbMF0ucGFyZW50Tm9kZS5vZmZzZXRXaWR0aCB8fCBvcHRpb25zLndpZHRoO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXBIZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcFdpZHRoID0gd2lkdGggKyAncHgnO1xyXG5cclxuICAgICAgICAgICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UucnVuU2NvcGVEaWdlc3RJZk5lZWQoJHNjb3BlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gTWFwUHJveHkoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGdldFBsYXRmb3JtOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgY2FsY3VsYXRlUm91dGU6IGZ1bmN0aW9uKGRyaXZlVHlwZSwgZGlyZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UuY2FsY3VsYXRlUm91dGUoaGVyZW1hcHMucGxhdGZvcm0sIGhlcmVtYXBzLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJpdmVUeXBlOiBkcml2ZVR5cGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXJlY3Rpb246IGRpcmVjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHNldFpvb206IGZ1bmN0aW9uKHpvb20sIHN0ZXApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS56b29tKGhlcmVtYXBzLm1hcCwgem9vbSB8fCAxMCwgc3RlcCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzZXRDZW50ZXI6IGZ1bmN0aW9uKGNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbigpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldENlbnRlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmc6IHJlc3BvbnNlLmNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IHJlc3BvbnNlLmNvb3Jkcy5sYXRpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaChfbG9jYXRpb25GYWlsdXJlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Q2VudGVyKGNvb3Jkcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVNYXJrZXJzOiBmdW5jdGlvbihwbGFjZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UudXBkYXRlTWFya2VycyhoZXJlbWFwcy5tYXAsIHBsYWNlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuIiwicmVxdWlyZSgnLi9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXJzLm1vZHVsZScpO1xyXG5yZXF1aXJlKCcuL3Byb3ZpZGVycy9jb21wb25lbnRzL2NvbXBvbmVudHMubW9kdWxlJyk7XHJcblxyXG52YXIgZGlyZWN0aXZlID0gcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSxcclxuICAgIGNvbmZpZ1Byb3ZpZGVyID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwY29uZmlnLnByb3ZpZGVyJyksXHJcbiAgICBhcGlTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvYXBpLnNlcnZpY2UnKSxcclxuICAgIHV0aWxzU2VydmljZSA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UnKSxcclxuICAgIGNvbnN0cyA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbnN0cycpO1xyXG5cclxudmFyIGhlcmVtYXBzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzJywgW1xyXG4gICAgJ21hcmtlcnMtbW9kdWxlJyxcclxuICAgICdjb21wb25lbnRzLW1vZHVsZSdcclxuXSk7XHJcblxyXG5oZXJlbWFwc1xyXG4gICAgLnByb3ZpZGVyKCdIZXJlTWFwc0NvbmZpZycsIGNvbmZpZ1Byb3ZpZGVyKVxyXG4gICAgLnNlcnZpY2UoJ0FQSVNlcnZpY2UnLCBbJyRxJywgJ0hlcmVNYXBzQ29uZmlnJywgJ0hlcmVNYXBVdGlsc1NlcnZpY2UnLCAnQ09OU1RTJywgYXBpU2VydmljZV0pXHJcbiAgICAuc2VydmljZSgnSGVyZU1hcFV0aWxzU2VydmljZScsIHV0aWxzU2VydmljZSlcclxuICAgIC5jb25zdGFudCgnQ09OU1RTJywgY29uc3RzKTtcclxuXHJcbmhlcmVtYXBzLmRpcmVjdGl2ZSgnaGVyZW1hcHMnLCBkaXJlY3RpdmUpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBoZXJlbWFwczsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRxLCBIZXJlTWFwc0NvbmZpZywgSGVyZU1hcFV0aWxzU2VydmljZSwgQ09OU1RTKSB7XHJcbiAgICB2YXIgdmVyc2lvbiA9IEhlcmVNYXBzQ29uZmlnLmFwaVZlcnNpb24sXHJcbiAgICAgICAgcHJvdG9jb2wgPSBIZXJlTWFwc0NvbmZpZy51c2VIVFRQUyA/ICdodHRwcycgOiAnaHR0cCc7XHJcblxyXG4gICAgdmFyIEFQSV9WRVJTSU9OID0ge1xyXG4gICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxyXG4gICAgICAgIFNVQjogdmVyc2lvblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgQ09ORklHID0ge1xyXG4gICAgICAgIEJBU0U6IFwiOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICBDT1JFOiBcIm1hcHNqcy1jb3JlLmpzXCIsXHJcbiAgICAgICAgU0VSVklDRTogXCJtYXBzanMtc2VydmljZS5qc1wiLFxyXG4gICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgIHNyYzogXCJtYXBzanMtdWkuanNcIixcclxuICAgICAgICAgICAgaHJlZjogXCJtYXBzanMtdWkuY3NzXCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIEFQSV9ERUZFUlNRdWV1ZSA9IHt9O1xyXG5cclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuQ09SRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuU0VSVklDRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuVUkuc3JjXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5QQU5PXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5FVkVOVFNdID0gW107XHJcblxyXG4gICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbG9hZEFwaTogbG9hZEFwaSxcclxuICAgICAgICBsb2FkTW9kdWxlczogbG9hZE1vZHVsZXMsXHJcbiAgICAgICAgZ2V0UG9zaXRpb246IGdldFBvc2l0aW9uLFxyXG4gICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBjYWxjdWxhdGVSb3V0ZVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyNyZWdpb24gUFVCTElDXHJcbiAgICBmdW5jdGlvbiBsb2FkQXBpKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5DT1JFKVxyXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5TRVJWSUNFKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZE1vZHVsZXMoYXR0cnMsIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgICAgIGlmICghaGFuZGxlcnMuaGFzT3duUHJvcGVydHkoa2V5KSB8fCAhYXR0cnNba2V5XSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgdmFyIGxvYWRlciA9IF9nZXRMb2FkZXJCeUF0dHIoa2V5KTtcclxuXHJcbiAgICAgICAgICAgIGxvYWRlcigpXHJcbiAgICAgICAgICAgICAgICAudGhlbihoYW5kbGVyc1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0UG9zaXRpb24ob3B0aW9ucykge1xyXG4gICAgICAgIHZhciBkZXJlcnJlZCA9ICRxLmRlZmVyKCk7XHJcblxyXG4gICAgICAgIGlmIChvcHRpb25zICYmIF9pc1ZhbGlkQ29vcmRzKG9wdGlvbnMuY29vcmRzKSkge1xyXG4gICAgICAgICAgICBkZXJlcnJlZC5yZXNvbHZlKHsgY29vcmRzOiBvcHRpb25zLmNvb3JkcyB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICBkZXJlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGRlcmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGRlcmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcGFyYW1zIHtPYmplY3R9IGRyaXZlVHlwZSwgZnJvbSwgdG9cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlUm91dGUocGxhdGZvcm0sIG1hcCwgcGFyYW1zKSB7XHJcbiAgICAgICAgdmFyIHJvdXRlciA9IHBsYXRmb3JtLmdldFJvdXRpbmdTZXJ2aWNlKCksXHJcbiAgICAgICAgICAgIGRpciA9IHBhcmFtcy5kaXJlY3Rpb247XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJvdXRlUmVxdWVzdFBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbW9kZTogJ2Zhc3Rlc3Q7e3tWZWNoaWxlfX0nLnJlcGxhY2UoL3t7VmVjaGlsZX19LywgcGFyYW1zLmRyaXZlVHlwZSksXHJcbiAgICAgICAgICAgIHJlcHJlc2VudGF0aW9uOiAnZGlzcGxheScsXHJcbiAgICAgICAgICAgIHJvdXRlYXR0cmlidXRlczogJ3dheXBvaW50cyxzdW1tYXJ5LHNoYXBlLGxlZ3MnLFxyXG4gICAgICAgICAgICBtYW5ldXZlcmF0dHJpYnV0ZXM6ICdkaXJlY3Rpb24sYWN0aW9uJyxcclxuICAgICAgICAgICAgd2F5cG9pbnQwOiBbZGlyLmZyb20ubGF0LCBkaXIuZnJvbS5sbmddLmpvaW4oJywnKSxcclxuICAgICAgICAgICAgd2F5cG9pbnQxOiBbZGlyLnRvLmxhdCwgZGlyLnRvLmxuZ10uam9pbignLCcpXHJcbiAgICAgICAgfTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgcm91dGVyLmNhbGN1bGF0ZVJvdXRlKFxyXG4gICAgICAgICAgICByb3V0ZVJlcXVlc3RQYXJhbXMsXHJcbiAgICAgICAgICAgIF9vblJvdXRlU3VjY2VzcyxcclxuICAgICAgICAgICAgX29uUm91dGVGYWlsdXJlXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUNcclxuXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9vblJvdXRlU3VjY2VzcyhyZXN1bHQpe1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHJlc3VsdClcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX29uUm91dGVGYWlsdXJlKGVycm9yKXtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZygnQ2FsY3VsYXRlIHJvdXRlIGZhaWx1cmUnLCBlcnJvcik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXJCeUF0dHIoYXR0cikge1xyXG4gICAgICAgIHZhciBsb2FkZXI7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoYXR0cikge1xyXG4gICAgICAgICAgICBjYXNlIENPTlNUUy5NT0RVTEVTLlVJOlxyXG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRVSU1vZHVsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTlNUUy5NT0RVTEVTLkVWRU5UUzpcclxuICAgICAgICAgICAgICAgIGxvYWRlciA9IF9sb2FkRXZlbnRzTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbW9kdWxlJywgYXR0cik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbG9hZGVyO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9sb2FkVUlNb2R1bGUoKSB7XHJcbiAgICAgICAgaWYgKCFfaXNMb2FkZWQoQ09ORklHLlVJKSkge1xyXG4gICAgICAgICAgICB2YXIgbGluayA9IEhlcmVNYXBVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XHJcbiAgICAgICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgICAgIHR5cGU6ICd0ZXh0L2NzcycsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9sb2FkRXZlbnRzTW9kdWxlKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZU5hbWVcclxuICAgICAqIHJldHVybiB7U3RyaW5nfSBlLmcgaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92e1ZFUn0ve1NVQlZFUlNJT059L3tTT1VSQ0V9XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIF9nZXRVUkwoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHJldHVybiBbXHJcbiAgICAgICAgICAgIHByb3RvY29sLCAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBDT05GSUcuQkFTRSxcclxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlNVQixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICBdLmpvaW4oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKSwgc3JjLCBzY3JpcHQ7XHJcblxyXG4gICAgICAgIGlmIChfaXNMb2FkZWQoc291cmNlTmFtZSkpIHtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNyYyA9IF9nZXRVUkwoc291cmNlTmFtZSksXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQgPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7IHNyYzogc3JjIH0pO1xyXG5cclxuICAgICAgICAgICAgc2NyaXB0ICYmIGhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcclxuXHJcbiAgICAgICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXS5wdXNoKGRlZmVyKTtcclxuXHJcbiAgICAgICAgICAgIHNjcmlwdC5vbmxvYWQgPSBfb25Mb2FkLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcbiAgICAgICAgICAgIHNjcmlwdC5vbmVycm9yID0gX29uRXJyb3IuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0xvYWRlZChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGNoZWNrZXIgPSBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuQ09SRTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNDb3JlTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlNFUlZJQ0U6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzU2VydmljZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5VSTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNVSUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5FVkVOVFM6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzRXZlbnRzTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNoZWNrZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNDb3JlTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhIXdpbmRvdy5IO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1NlcnZpY2VMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnNlcnZpY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1VJTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC51aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzRXZlbnRzTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5tYXBldmVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbkxvYWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uRXJyb3Ioc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVqZWN0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBILm1hcC5Qb2x5bGluZSBmcm9tIHRoZSBzaGFwZSBvZiB0aGUgcm91dGUgYW5kIGFkZHMgaXQgdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRSb3V0ZVNoYXBlVG9NYXAobWFwLCByb3V0ZSl7XHJcbiAgICAgICAgdmFyIHN0cmlwID0gbmV3IEguZ2VvLlN0cmlwKCksXHJcbiAgICAgICAgICAgIHJvdXRlU2hhcGUgPSByb3V0ZS5zaGFwZSxcclxuICAgICAgICAgICAgcG9seWxpbmU7XHJcblxyXG4gICAgICAgIHJvdXRlU2hhcGUuZm9yRWFjaChmdW5jdGlvbihwb2ludCkge1xyXG4gICAgICAgICAgICB2YXIgcGFydHMgPSBwb2ludC5zcGxpdCgnLCcpO1xyXG4gICAgICAgICAgICBzdHJpcC5wdXNoTGF0TG5nQWx0KHBhcnRzWzBdLCBwYXJ0c1sxXSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHBvbHlsaW5lID0gbmV3IEgubWFwLlBvbHlsaW5lKHN0cmlwLCB7XHJcbiAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgIGxpbmVXaWR0aDogNCxcclxuICAgICAgICAgICAgc3Ryb2tlQ29sb3I6ICdyZ2JhKDAsIDEyOCwgMjU1LCAwLjcpJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgLy8gQWRkIHRoZSBwb2x5bGluZSB0byB0aGUgbWFwXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChwb2x5bGluZSk7XHJcbiAgICAgICAgLy8gQW5kIHpvb20gdG8gaXRzIGJvdW5kaW5nIHJlY3RhbmdsZVxyXG4gICAgICAgIG1hcC5zZXRWaWV3Qm91bmRzKHBvbHlsaW5lLmdldEJvdW5kcygpLCB0cnVlKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb01hcChtYXAsIHJvdXRlKXtcclxuICAgICAgICB2YXIgc3ZnTWFya3VwID0gJzxzdmcgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgJyArXHJcbiAgICAgICAgICAgICd4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+JyArXHJcbiAgICAgICAgICAgICc8Y2lyY2xlIGN4PVwiOFwiIGN5PVwiOFwiIHI9XCI4XCIgJyArXHJcbiAgICAgICAgICAgICdmaWxsPVwiIzFiNDY4ZFwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlLXdpZHRoPVwiMVwiICAvPicgK1xyXG4gICAgICAgICAgICAnPC9zdmc+JyxcclxuICAgICAgICAgICAgZG90SWNvbiA9IG5ldyBILm1hcC5JY29uKHN2Z01hcmt1cCwge2FuY2hvcjoge3g6OCwgeTo4fX0pLFxyXG4gICAgICAgICAgICBncm91cCA9IG5ldyAgSC5tYXAuR3JvdXAoKSxcclxuICAgICAgICAgICAgaSxcclxuICAgICAgICAgICAgajtcclxuXHJcbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXHJcbiAgICAgICAgZm9yIChpID0gMDsgIGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgZm9yIChqID0gMDsgIGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cclxuICAgICAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xyXG4gICAgICAgICAgICAgICAgLy8gQWRkIGEgbWFya2VyIHRvIHRoZSBtYW5ldXZlcnMgZ3JvdXBcclxuICAgICAgICAgICAgICAgIHZhciBtYXJrZXIgPSAgbmV3IEgubWFwLk1hcmtlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogbWFuZXV2ZXIucG9zaXRpb24ubGF0aXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogbWFuZXV2ZXIucG9zaXRpb24ubG9uZ2l0dWRlfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAge2ljb246IGRvdEljb259XHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIG1hcmtlci5pbnN0cnVjdGlvbiA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdyb3VwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uIChldnQpIHtcclxuICAgICAgICAgICAgbWFwLnNldENlbnRlcihldnQudGFyZ2V0LmdldFBvc2l0aW9uKCkpO1xyXG4gICAgICAgICAgICBvcGVuQnViYmxlKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSwgZXZ0LnRhcmdldC5pbnN0cnVjdGlvbik7XHJcbiAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAvLyBBZGQgdGhlIG1hbmV1dmVycyBncm91cCB0byB0aGUgbWFwXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChncm91cCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkV2F5cG9pbnRzVG9QYW5lbCh3YXlwb2ludHMpe1xyXG4gICAgICAgIHZhciBub2RlSDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpLFxyXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscyA9IFtdLFxyXG4gICAgICAgICAgICBpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyAgaSA8IHdheXBvaW50cy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscy5wdXNoKHdheXBvaW50c1tpXS5sYWJlbClcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5vZGVIMy50ZXh0Q29udGVudCA9IHdheXBvaW50TGFiZWxzLmpvaW4oJyAtICcpO1xyXG5cclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlSDMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkU3VtbWFyeVRvUGFuZWwoc3VtbWFyeSl7XHJcbiAgICAgICAgdmFyIHN1bW1hcnlEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgICAgICAgY29udGVudCA9ICcnO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb250ZW50ICs9ICc8Yj5Ub3RhbCBkaXN0YW5jZTwvYj46ICcgKyBzdW1tYXJ5LmRpc3RhbmNlICArICdtLiA8YnIvPic7XHJcbiAgICAgICAgY29udGVudCArPSAnPGI+VHJhdmVsIFRpbWU8L2I+OiAnICsgc3VtbWFyeS50cmF2ZWxUaW1lLnRvTU1TUygpICsgJyAoaW4gY3VycmVudCB0cmFmZmljKSc7XHJcblxyXG5cclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpbkxlZnQgPSc1JSc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5SaWdodCA9JzUlJztcclxuICAgICAgICBzdW1tYXJ5RGl2LmlubmVySFRNTCA9IGNvbnRlbnQ7XHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQoc3VtbWFyeURpdik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb1BhbmVsKHJvdXRlKXtcclxuICAgICAgICB2YXIgbm9kZU9MID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb2wnKSwgaSwgajtcclxuXHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcclxuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luTGVmdCA9JzUlJztcclxuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luUmlnaHQgPSc1JSc7XHJcbiAgICAgICAgbm9kZU9MLmNsYXNzTmFtZSA9ICdkaXJlY3Rpb25zJztcclxuXHJcbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXHJcbiAgICAgICAgZm9yIChpID0gMDsgIGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgZm9yIChqID0gMDsgIGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxyXG4gICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcclxuXHJcbiAgICAgICAgICAgIHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyksXHJcbiAgICAgICAgICAgICAgICBzcGFuQXJyb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyksXHJcbiAgICAgICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcblxyXG4gICAgICAgICAgICBzcGFuQXJyb3cuY2xhc3NOYW1lID0gJ2Fycm93ICcgICsgbWFuZXV2ZXIuYWN0aW9uO1xyXG4gICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24uaW5uZXJIVE1MID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XHJcbiAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5BcnJvdyk7XHJcbiAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5JbnN0cnVjdGlvbik7XHJcblxyXG4gICAgICAgICAgICBub2RlT0wuYXBwZW5kQ2hpbGQobGkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlT0wpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfaXNWYWxpZENvb3Jkcyhjb29yZHMpe1xyXG4gICAgICAgIHZhciBsbmcgPSBjb29yZHMgJiYgY29vcmRzLmxvbmdpdHVkZSxcclxuICAgICAgICAgICAgbGF0ID0gY29vcmRzICYmIGNvb3Jkcy5sYXRpdHVkZTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuICh0eXBlb2YgbG5nID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgbG5nID09PSAnc3RyaW5nJykgJiZcclxuICAgICAgICAgICAgICAgICh0eXBlb2YgbGF0ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgbGF0ID09PSAnc3RyaW5nJyk7IFxyXG4gICAgfVxyXG59OyIsInZhciBldmVudHNNb2R1bGUgPSByZXF1aXJlKCcuL2V2ZW50cy9ldmVudHMuanMnKSxcclxuICAgIGluZm9CdWJibGUgPSByZXF1aXJlKCcuL2V2ZW50cy9pbmZvYnViYmxlLmpzJyk7XHJcbiAgICBcclxudmFyIHVpTW9kdWxlID0gcmVxdWlyZSgnLi91aS91aS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ2V2ZW50cy1tb2R1bGUnLCBbXSlcclxuICAgIC5mYWN0b3J5KCdFdmVudHNNb2R1bGUnLCBldmVudHNNb2R1bGUpXHJcbiAgICAuZmFjdG9yeSgnSW5mb0J1YmJsZUZhY3RvcnknLCBpbmZvQnViYmxlKTtcclxuICAgIFxyXG5hbmd1bGFyLm1vZHVsZSgndWktbW9kdWxlJywgW10pXHJcbiAgICAuZmFjdG9yeSgnVUlNb2R1bGUnLCB1aU1vZHVsZSlcclxuXHJcbnZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnY29tcG9uZW50cy1tb2R1bGUnLCBbXHJcblx0J2V2ZW50cy1tb2R1bGUnLFxyXG4gICAgJ3VpLW1vZHVsZSdcclxuXSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFwcDsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKEhlcmVNYXBVdGlsc1NlcnZpY2UsIE1hcmtlcnNTZXJ2aWNlLCBDT05TVFMsIEluZm9CdWJibGVGYWN0b3J5KSB7XHJcbiAgICBmdW5jdGlvbiBFdmVudHMocGxhdGZvcm0sIEluamVjdG9yLCBsaXN0ZW5lcnMpIHtcclxuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcclxuICAgICAgICB0aGlzLmxpc3RlbmVycyA9IGxpc3RlbmVycztcclxuICAgICAgICB0aGlzLmluamVjdCA9IG5ldyBJbmplY3RvcigpO1xyXG4gICAgICAgIHRoaXMuZXZlbnRzID0gcGxhdGZvcm0uZXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyh0aGlzLm1hcCk7XHJcbiAgICAgICAgdGhpcy5iZWhhdmlvciA9IHBsYXRmb3JtLmJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKHRoaXMuZXZlbnRzKTtcclxuICAgICAgICB0aGlzLmJ1YmJsZSA9IEluZm9CdWJibGVGYWN0b3J5LmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICB0aGlzLnNldHVwRXZlbnRMaXN0ZW5lcnMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBFdmVudHMucHJvdG90eXBlO1xyXG5cclxuICAgIHByb3RvLnNldHVwRXZlbnRMaXN0ZW5lcnMgPSBzZXR1cEV2ZW50TGlzdGVuZXJzO1xyXG4gICAgcHJvdG8uc2V0dXBPcHRpb25zID0gc2V0dXBPcHRpb25zO1xyXG4gICAgcHJvdG8udHJpZ2dlclVzZXJMaXN0ZW5lciA9IHRyaWdnZXJVc2VyTGlzdGVuZXI7XHJcbiAgICBwcm90by5pbmZvQnViYmxlSGFuZGxlciA9IGluZm9CdWJibGVIYW5kbGVyOyAgXHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydDogZnVuY3Rpb24oYXJncykge1xyXG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgICAgICB2YXIgZXZlbnRzID0gbmV3IEV2ZW50cyhhcmdzLnBsYXRmb3JtLCBhcmdzLmluamVjdG9yLCBhcmdzLmxpc3RlbmVycyk7XHJcblxyXG4gICAgICAgICAgICBhcmdzLm9wdGlvbnMgJiYgZXZlbnRzLnNldHVwT3B0aW9ucyhhcmdzLm9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzZXR1cEV2ZW50TGlzdGVuZXJzKCkge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAndGFwJywgdGhpcy5pbmZvQnViYmxlSGFuZGxlci5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAncG9pbnRlcm1vdmUnLCB0aGlzLmluZm9CdWJibGVIYW5kbGVyLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnc3RhcnQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGlmIChNYXJrZXJzU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5iZWhhdmlvci5kaXNhYmxlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWcnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIHZhciBwb2ludGVyID0gZS5jdXJyZW50UG9pbnRlcixcclxuICAgICAgICAgICAgICAgIHRhcmdldCA9IGUudGFyZ2V0O1xyXG5cclxuICAgICAgICAgICAgaWYgKE1hcmtlcnNTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UodGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKHNlbGYubWFwLnNjcmVlblRvR2VvKHBvaW50ZXIudmlld3BvcnRYLCBwb2ludGVyLnZpZXdwb3J0WSkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnZW5kJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBpZiAoTWFya2Vyc1NlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZShlLnRhcmdldCkpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuYmVoYXZpb3IuZW5hYmxlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBPcHRpb25zKG9wdGlvbnMpIHtcclxuICAgICAgICBpZiAoIW9wdGlvbnMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXAuZHJhZ2dhYmxlID0gISFvcHRpb25zLmRyYWdnYWJsZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB0cmlnZ2VyVXNlckxpc3RlbmVyKGV2ZW50TmFtZSwgZSkge1xyXG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcclxuXHJcbiAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGluZm9CdWJibGVIYW5kbGVyKGUpe1xyXG4gICAgICAgIHZhciB1aSA9IHRoaXMuaW5qZWN0KCd1aScpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKHVpKVxyXG4gICAgICAgICAgICB0aGlzLmJ1YmJsZS50b2dnbGUoZSwgdWkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB0aGlzLnRyaWdnZXJVc2VyTGlzdGVuZXIoQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpOyAgICAgIFxyXG4gICAgfVxyXG5cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlcnNTZXJ2aWNlLCBIZXJlTWFwVXRpbHNTZXJ2aWNlLCBDT05TVFMpIHtcclxuICAgIGZ1bmN0aW9uIEluZm9CdWJibGUoKSB7fVxyXG5cclxuICAgIHZhciBwcm90byA9IEluZm9CdWJibGUucHJvdG90eXBlO1xyXG4gICAgICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8udXBkYXRlID0gdXBkYXRlO1xyXG4gICAgcHJvdG8udG9nZ2xlID0gdG9nZ2xlO1xyXG4gICAgcHJvdG8uc2hvdyA9IHNob3c7XHJcbiAgICBwcm90by5jbG9zZSA9IGNsb3NlO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgY3JlYXRlOiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IEluZm9CdWJibGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdG9nZ2xlKGUsIHVpKSB7XHJcbiAgICAgICAgaWYgKE1hcmtlcnNTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKVxyXG4gICAgICAgICAgICB0aGlzLnNob3coZSwgdWkpO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgdGhpcy5jbG9zZShlLCB1aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlKGJ1YmJsZSwgZGF0YSkge1xyXG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gZGF0YS5kaXNwbGF5O1xyXG5cclxuICAgICAgICBidWJibGUuc2V0UG9zaXRpb24oZGF0YS5wb3NpdGlvbik7XHJcbiAgICAgICAgYnViYmxlLnNldENvbnRlbnQoZGF0YS5tYXJrdXApO1xyXG5cclxuICAgICAgICBidWJibGUuc2V0U3RhdGUoQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKHNvdXJjZSkge1xyXG4gICAgICAgIHZhciBidWJibGUgPSBuZXcgSC51aS5JbmZvQnViYmxlKHNvdXJjZS5wb3NpdGlvbiwge1xyXG4gICAgICAgICAgICBjb250ZW50OiBzb3VyY2UubWFya3VwXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gc291cmNlLmRpc3BsYXk7XHJcbiAgICAgICAgYnViYmxlLmFkZENsYXNzKENPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pXHJcblxyXG4gICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcihidWJibGUsICdzdGF0ZWNoYW5nZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgZWwgPSB0aGlzLmdldEVsZW1lbnQoKTtcclxuICAgICAgICAgICAgaWYgKHN0YXRlID09PSBDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5DTE9TRUQpIHtcclxuICAgICAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XHJcbiAgICAgICAgICAgIH0gZWxzZVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRDbGFzcyhzdGF0ZSlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGJ1YmJsZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzaG93KGUsIHVpLCBkYXRhKSB7XHJcbiAgICAgICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0LFxyXG4gICAgICAgICAgICBkYXRhID0gdGFyZ2V0LmdldERhdGEoKSxcclxuICAgICAgICAgICAgZWwgPSBudWxsO1xyXG5cclxuICAgICAgICBpZiAoIWRhdGEgfHwgIWRhdGEuZGlzcGxheSB8fCAhZGF0YS5tYXJrdXAgfHwgZGF0YS5kaXNwbGF5ICE9PSBDT05TVFMuSU5GT0JVQkJMRS5ESVNQTEFZX0VWRU5UW2UudHlwZV0pXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIHNvdXJjZSA9IHtcclxuICAgICAgICAgICAgcG9zaXRpb246IHRhcmdldC5nZXRQb3NpdGlvbigpLFxyXG4gICAgICAgICAgICBtYXJrdXA6IGRhdGEubWFya3VwLFxyXG4gICAgICAgICAgICBkaXNwbGF5OiBkYXRhLmRpc3BsYXlcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAoIXVpLmJ1YmJsZSkge1xyXG4gICAgICAgICAgICB1aS5idWJibGUgPSB0aGlzLmNyZWF0ZShzb3VyY2UpO1xyXG4gICAgICAgICAgICB1aS5hZGRCdWJibGUodWkuYnViYmxlKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMudXBkYXRlKHVpLmJ1YmJsZSwgc291cmNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjbG9zZShlLCB1aSkge1xyXG4gICAgICAgIGlmICghdWkuYnViYmxlIHx8IHVpLmJ1YmJsZS5kaXNwbGF5ICE9PSBDT05TVFMuSU5GT0JVQkJMRS5ESVNQTEFZX0VWRU5UW2UudHlwZV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdWkuYnViYmxlLnNldFN0YXRlKENPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLkNMT1NFRCk7XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKEFQSVNlcnZpY2UsIE1hcmtlcnNTZXJ2aWNlLCBIZXJlTWFwVXRpbHNTZXJ2aWNlLCBDT05TVFMpIHtcclxuICAgIGZ1bmN0aW9uIFVJKHBsYXRmb3JtLCBhbGlnbm1lbnQpIHtcclxuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcclxuICAgICAgICB0aGlzLmxheWVycyA9IHBsYXRmb3JtLmxheWVycztcclxuICAgICAgICB0aGlzLmFsaWdubWVudCA9IGFsaWdubWVudDtcclxuICAgICAgICB0aGlzLnVpID0gcGxhdGZvcm0udWkgPSBILnVpLlVJLmNyZWF0ZURlZmF1bHQodGhpcy5tYXAsIHRoaXMubGF5ZXJzKTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXR1cENvbnRyb2xzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgVUkuaXNWYWxpZEFsaWdubWVudCA9IGlzVmFsaWRBbGlnbm1lbnQ7XHJcblxyXG4gICAgdmFyIHByb3RvID0gVUkucHJvdG90eXBlO1xyXG5cclxuICAgIHByb3RvLnNldHVwQ29udHJvbHMgPSBzZXR1cENvbnRyb2xzO1xyXG4gICAgcHJvdG8uY3JlYXRlVXNlckNvbnRyb2wgPSBjcmVhdGVVc2VyQ29udHJvbDtcclxuICAgIHByb3RvLnNldENvbnRyb2xzQWxpZ25tZW50ID0gc2V0Q29udHJvbHNBbGlnbm1lbnQ7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydDogZnVuY3Rpb24oYXJncykge1xyXG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSAmJiAhKGFyZ3MucGxhdGZvcm0ubGF5ZXJzKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgdWkgbW9kdWxlIGRlcGVuZGVuY2llcycpO1xyXG5cclxuICAgICAgICAgICAgdmFyIHVpID0gbmV3IFVJKGFyZ3MucGxhdGZvcm0sIGFyZ3MuYWxpZ25tZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBDb250cm9scygpIHtcclxuICAgICAgICB2YXIgTkFNRVMgPSBDT05TVFMuQ09OVFJPTFMuTkFNRVMsXHJcbiAgICAgICAgICAgIHVzZXJDb250cm9sID0gdGhpcy5jcmVhdGVVc2VyQ29udHJvbCgpO1xyXG5cclxuICAgICAgICB0aGlzLnVpLmdldENvbnRyb2woTkFNRVMuU0VUVElOR1MpLnNldEluY2lkZW50c0xheWVyKGZhbHNlKTtcclxuICAgICAgICB0aGlzLnVpLmFkZENvbnRyb2woTkFNRVMuVVNFUiwgdXNlckNvbnRyb2wpO1xyXG4gICAgICAgIHRoaXMuc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVVzZXJDb250cm9sKCkge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICAgICAgdXNlckNvbnRyb2wgPSBuZXcgSC51aS5Db250cm9sKCksXHJcbiAgICAgICAgICAgIG1hcmt1cCA9ICc8c3ZnIGNsYXNzPVwiSF9pY29uXCIgZmlsbD1cIiNmZmZcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxNlwiIGhlaWdodD1cIjE2XCIgdmlld0JveD1cIjAgMCAxNiAxNlwiPjxwYXRoIGNsYXNzPVwibWlkZGxlX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCAxMmMtMi4yMDYgMC00LTEuNzk1LTQtNCAwLTIuMjA2IDEuNzk0LTQgNC00czQgMS43OTQgNCA0YzAgMi4yMDUtMS43OTQgNC00IDRNOCAxLjI1YTYuNzUgNi43NSAwIDEgMCAwIDEzLjUgNi43NSA2Ljc1IDAgMCAwIDAtMTMuNVwiPjwvcGF0aD48cGF0aCBjbGFzcz1cImlubmVyX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCA1YTMgMyAwIDEgMSAuMDAxIDZBMyAzIDAgMCAxIDggNW0wLTFDNS43OTQgNCA0IDUuNzk0IDQgOGMwIDIuMjA1IDEuNzk0IDQgNCA0czQtMS43OTUgNC00YzAtMi4yMDYtMS43OTQtNC00LTRcIj48L3BhdGg+PHBhdGggY2xhc3M9XCJvdXRlcl9sb2NhdGlvbl9zdHJva2VcIiBkPVwiTTggMS4yNWE2Ljc1IDYuNzUgMCAxIDEgMCAxMy41IDYuNzUgNi43NSAwIDAgMSAwLTEzLjVNOCAwQzMuNTkgMCAwIDMuNTkgMCA4YzAgNC40MTEgMy41OSA4IDggOHM4LTMuNTg5IDgtOGMwLTQuNDEtMy41OS04LTgtOFwiPjwvcGF0aD48L3N2Zz4nO1xyXG5cclxuICAgICAgICB2YXIgdXNlckNvbnRyb2xCdXR0b24gPSBuZXcgSC51aS5iYXNlLkJ1dHRvbih7XHJcbiAgICAgICAgICAgIGxhYmVsOiBtYXJrdXAsXHJcbiAgICAgICAgICAgIG9uU3RhdGVDaGFuZ2U6IGZ1bmN0aW9uKGV2dCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHVzZXJDb250cm9sQnV0dG9uLmdldFN0YXRlKCkgPT09IEgudWkuYmFzZS5CdXR0b24uU3RhdGUuRE9XTilcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAgICAgQVBJU2VydmljZS5nZXRQb3NpdGlvbigpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcG9zaXRpb24gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogcmVzcG9uc2UuY29vcmRzLmxvbmdpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiByZXNwb25zZS5jb29yZHMubGF0aXR1ZGVcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHNlbGYubWFwLnNldENlbnRlcihwb3NpdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS56b29tKHNlbGYubWFwLCAxNywgLjA4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYudXNlck1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnVzZXJNYXJrZXIuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHNlbGYudXNlck1hcmtlciA9IE1hcmtlcnNTZXJ2aWNlLmFkZFVzZXJNYXJrZXIoc2VsZi5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdXNlckNvbnRyb2wuYWRkQ2hpbGQodXNlckNvbnRyb2xCdXR0b24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdXNlckNvbnRyb2w7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpIHtcclxuICAgICAgICBpZiAoIVVJLmlzVmFsaWRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIGZvciAodmFyIGlkIGluIE5BTUVTKSB7XHJcbiAgICAgICAgICAgIHZhciBjb250cm9sID0gdGhpcy51aS5nZXRDb250cm9sKE5BTUVTW2lkXSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIU5BTUVTLmhhc093blByb3BlcnR5KGlkKSB8fCAhY29udHJvbClcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgY29udHJvbC5zZXRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBpc1ZhbGlkQWxpZ25tZW50KGFsaWdubWVudCkge1xyXG4gICAgICAgIHJldHVybiAhIShDT05TVFMuQ09OVFJPTFMuUE9TSVRJT05TLmluZGV4T2YoYWxpZ25tZW50KSArIDEpO1xyXG4gICAgfVxyXG5cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQ6IDUwMCxcclxuICAgIEFOSU1BVElPTl9aT09NX1NURVA6IC4wNSxcclxuICAgIE1PRFVMRVM6IHtcclxuICAgICAgICBVSTogJ2NvbnRyb2xzJyxcclxuICAgICAgICBFVkVOVFM6ICdldmVudHMnLFxyXG4gICAgICAgIFBBTk86ICdwYW5vJ1xyXG4gICAgfSxcclxuICAgIERFRkFVTFRfTUFQX09QVElPTlM6IHtcclxuICAgICAgICBoZWlnaHQ6IDQ4MCxcclxuICAgICAgICB3aWR0aDogNjQwLFxyXG4gICAgICAgIHpvb206IDEyLFxyXG4gICAgICAgIG1heFpvb206IDIsXHJcbiAgICAgICAgcmVzaXplOiBmYWxzZSxcclxuICAgICAgICBkcmFnZ2FibGU6IGZhbHNlLFxyXG4gICAgICAgIGNvb3Jkczoge1xyXG4gICAgICAgICAgICBsb25naXR1ZGU6IDAsXHJcbiAgICAgICAgICAgIGxhdGl0dWRlOiAwXHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIE1BUktFUl9UWVBFUzoge1xyXG4gICAgICAgIERPTTogXCJET01cIixcclxuICAgICAgICBTVkc6IFwiU1ZHXCJcclxuICAgIH0sXHJcbiAgICBDT05UUk9MUzoge1xyXG4gICAgICAgIE5BTUVTOiB7XHJcbiAgICAgICAgICAgIFNDQUxFOiAnc2NhbGViYXInLFxyXG4gICAgICAgICAgICBTRVRUSU5HUzogJ21hcHNldHRpbmdzJyxcclxuICAgICAgICAgICAgWk9PTTogJ3pvb20nLFxyXG4gICAgICAgICAgICBVU0VSOiAndXNlcnBvc2l0aW9uJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgUE9TSVRJT05TOiBbXHJcbiAgICAgICAgICAgICd0b3AtcmlnaHQnLFxyXG4gICAgICAgICAgICAndG9wLWNlbnRlcicsXHJcbiAgICAgICAgICAgICd0b3AtbGVmdCcsXHJcbiAgICAgICAgICAgICdsZWZ0LXRvcCcsXHJcbiAgICAgICAgICAgICdsZWZ0LW1pZGRsZScsXHJcbiAgICAgICAgICAgICdsZWZ0LWJvdHRvbScsXHJcbiAgICAgICAgICAgICdyaWdodC10b3AnLFxyXG4gICAgICAgICAgICAncmlnaHQtbWlkZGxlJyxcclxuICAgICAgICAgICAgJ3JpZ2h0LWJvdHRvbScsXHJcbiAgICAgICAgICAgICdib3R0b20tcmlnaHQnLFxyXG4gICAgICAgICAgICAnYm90dG9tLWNlbnRlcicsXHJcbiAgICAgICAgICAgICdib3R0b20tbGVmdCdcclxuICAgICAgICBdXHJcbiAgICB9LFxyXG4gICAgSU5GT0JVQkJMRToge1xyXG4gICAgICAgIFNUQVRFOiB7XHJcbiAgICAgICAgICAgIE9QRU46ICdvcGVuJyxcclxuICAgICAgICAgICAgQ0xPU0VEOiAnY2xvc2VkJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgRElTUExBWV9FVkVOVDoge1xyXG4gICAgICAgICAgICBwb2ludGVybW92ZTogJ29uSG92ZXInLFxyXG4gICAgICAgICAgICB0YXA6ICdvbkNsaWNrJ1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBVU0VSX0VWRU5UUzoge1xyXG4gICAgICAgIHRhcDogJ2NsaWNrJyxcclxuICAgICAgICBwb2ludGVybW92ZTogJ21vdXNlbW92ZScsXHJcbiAgICAgICAgcG9pbnRlcmxlYXZlOiAnbW91c2VsZWF2ZScsXHJcbiAgICAgICAgcG9pbnRlcmVudGVyOiAnbW91c2VlbnRlcicsXHJcbiAgICAgICAgZHJhZzogJ2RyYWcnLFxyXG4gICAgICAgIGRyYWdzdGFydDogJ2RyYWdzdGFydCcsXHJcbiAgICAgICAgZHJhZ2VuZDogJ2RyYWdlbmQnXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRyb290U2NvcGUsICR0aW1lb3V0LCBDT05TVFMpe1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB0aHJvdHRsZTogdGhyb3R0bGUsXHJcbiAgICAgICAgY3JlYXRlU2NyaXB0VGFnOiBjcmVhdGVTY3JpcHRUYWcsXHJcbiAgICAgICAgY3JlYXRlTGlua1RhZzogY3JlYXRlTGlua1RhZyxcclxuICAgICAgICBydW5TY29wZURpZ2VzdElmTmVlZDogcnVuU2NvcGVEaWdlc3RJZk5lZWQsXHJcbiAgICAgICAgaXNWYWxpZENvb3JkczogaXNWYWxpZENvb3JkcyxcclxuICAgICAgICBhZGRFdmVudExpc3RlbmVyOiBhZGRFdmVudExpc3RlbmVyLFxyXG4gICAgICAgIHpvb206IHpvb21cclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2Qpe1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgaWYoJHRpbWVvdXQpXHJcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihvYmosIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUpIHtcclxuICAgICAgICB2YXIgX3VzZUNhcHR1cmUgPSAhIXVzZUNhcHR1cmU7XHJcblxyXG4gICAgICAgIG9iai5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIsIF91c2VDYXB0dXJlKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNjcmlwdFRhZyhhdHRycyl7XHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLnNyYyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYoc2NyaXB0KVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBzY3JpcHQuaWQgPSBhdHRycy5zcmM7XHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpOyAgICBcclxuXHJcbiAgICAgICAgcmV0dXJuIHNjcmlwdDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVMaW5rVGFnKGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5ocmVmKTtcclxuICAgICAgICBcclxuICAgICAgICBpZihsaW5rKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcbiAgICAgICAgbGluay5pZCA9IGF0dHJzLmhyZWY7XHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbGluaztcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBpc1ZhbGlkQ29vcmRzKGNvb3Jkcyl7XHJcbiAgICAgICAgcmV0dXJuIGNvb3JkcyAmJiBcclxuICAgICAgICAgICAgKHR5cGVvZiBjb29yZHMubGF0aXR1ZGUgPT09ICdzdHJpbmcnIHx8ICB0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnbnVtYmVyJykgJiZcclxuICAgICAgICAgICAgKHR5cGVvZiBjb29yZHMubG9uZ2l0dWRlID09PSAnc3RyaW5nJyB8fCAgdHlwZW9mIGNvb3Jkcy5sb25naXR1ZGUgPT09ICdudW1iZXInKVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiB6b29tKG1hcCwgdmFsdWUsIHN0ZXApe1xyXG4gICAgICAgIHZhciBjdXJyZW50Wm9vbSA9IG1hcC5nZXRab29tKCksXHJcbiAgICAgICAgICAgIF9zdGVwID0gc3RlcCB8fCBDT05TVFMuQU5JTUFUSU9OX1pPT01fU1RFUCxcclxuICAgICAgICAgICAgZmFjdG9yID0gY3VycmVudFpvb20gPj0gdmFsdWUgPyAtMSA6IDEsXHJcbiAgICAgICAgICAgIGluY3JlbWVudCA9IHN0ZXAgKiBmYWN0b3I7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiAoZnVuY3Rpb24gem9vbSgpe1xyXG4gICAgICAgICAgICBpZighc3RlcCB8fCBNYXRoLmZsb29yKGN1cnJlbnRab29tKSA9PT0gTWF0aC5mbG9vcih2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgIG1hcC5zZXRab29tKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGN1cnJlbnRab29tICs9IGluY3JlbWVudDtcclxuICAgICAgICAgICAgbWFwLnNldFpvb20oY3VycmVudFpvb20pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHpvb20pO1xyXG4gICAgICAgIH0pKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUMgXHJcblxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xyXG4gICAgICAgIGlmKCFlbCB8fCAhYXR0cnMpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2VkIGF0dHJpYnV0ZXMnKTtcclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBEZWZhdWx0TWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBEZWZhdWx0TWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRGVmYXVsdE1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcblxyXG4gICAgcmV0dXJuIERlZmF1bHRNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzKTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRE9NTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBET01NYXJrZXIucHJvdG90eXBlID0gbmV3IE1hcmtlckludGVyZmFjZSgpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBET01NYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XHJcbiAgICBwcm90by5zZXR1cEV2ZW50cyA9IHNldHVwRXZlbnRzO1xyXG5cclxuICAgIHJldHVybiBET01NYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuRG9tTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuZ2V0SWNvbigpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0SWNvbigpe1xyXG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5tYXJrdXA7XHJcbiAgICAgICAgIGlmKCFpY29uKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcmt1cCBtaXNzZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21JY29uKGljb24pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBzZXR1cEV2ZW50cyhlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XHJcbiAgICBmdW5jdGlvbiBNYXJrZXJJbnRlcmZhY2UoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xyXG4gICAgcHJvdG8uYWRkSW5mb0J1YmJsZSA9IGFkZEluZm9CdWJibGU7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe31cclxuICAgIFxyXG4gICAgTWFya2VyLnByb3RvdHlwZSA9IHByb3RvO1xyXG4gICAgXHJcbiAgICByZXR1cm4gTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NyZWF0ZTo6IG5vdCBpbXBsZW1lbnRlZCcpOyBcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0Q29vcmRzKCl7XHJcbiAgICAgICAgIHRoaXMuY29vcmRzID0ge1xyXG4gICAgICAgICAgICBsYXQ6IHRoaXMucGxhY2UucG9zLmxhdCxcclxuICAgICAgICAgICAgbG5nOiB0aGlzLnBsYWNlLnBvcy5sbmdcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGFkZEluZm9CdWJibGUobWFya2VyKXtcclxuICAgICAgICBpZighdGhpcy5wbGFjZS5wb3B1cClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBtYXJrZXIuc2V0RGF0YSh0aGlzLnBsYWNlLnBvcHVwKVxyXG4gICAgfVxyXG59IiwidmFyIG1hcmtlckludGVyZmFjZSA9IHJlcXVpcmUoJy4vbWFya2VyLmpzJyksXHJcblx0ZGVmYXVsdE1hcmtlciA9IHJlcXVpcmUoJy4vZGVmYXVsdC5tYXJrZXIuanMnKSxcclxuXHRkb21NYXJrZXIgPSByZXF1aXJlKCcuL2RvbS5tYXJrZXIuanMnKSxcclxuXHRzdmdNYXJrZXIgPSByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSxcclxuICAgIG1hcmtlcnNTZXJ2aWNlID0gcmVxdWlyZSgnLi9tYXJrZXJzLnNlcnZpY2UuanMnKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXItaW50ZXJmYWNlJywgW10pLmZhY3RvcnkoJ01hcmtlckludGVyZmFjZScsIG1hcmtlckludGVyZmFjZSk7XHJcbmFuZ3VsYXIubW9kdWxlKCdkZWZhdWx0LW1hcmtlcicsIFtdKS5mYWN0b3J5KCdEZWZhdWx0TWFya2VyJywgZGVmYXVsdE1hcmtlcik7XHJcbmFuZ3VsYXIubW9kdWxlKCdkb20tbWFya2VyJywgW10pLmZhY3RvcnkoJ0RPTU1hcmtlcicsIGRvbU1hcmtlcik7XHJcbmFuZ3VsYXIubW9kdWxlKCdzdmctbWFya2VyJywgW10pLmZhY3RvcnkoJ1NWR01hcmtlcicsIHN2Z01hcmtlcik7XHJcblxyXG5hbmd1bGFyLm1vZHVsZSgnbWFya2Vycy1zZXJ2aWNlJywgW10pLnNlcnZpY2UoJ01hcmtlcnNTZXJ2aWNlJywgbWFya2Vyc1NlcnZpY2UpO1xyXG5cclxudmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLW1vZHVsZScsIFtcclxuXHQnbWFya2VyLWludGVyZmFjZScsXHJcbiAgICAnZGVmYXVsdC1tYXJrZXInLFxyXG4gICAgJ2RvbS1tYXJrZXInLFxyXG4gICAgJ21hcmtlcnMtc2VydmljZScsXHJcbiAgICAnc3ZnLW1hcmtlcidcclxuXSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFwcDsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKERlZmF1bHRNYXJrZXIsIERPTU1hcmtlciwgU1ZHTWFya2VyLCBDT05TVFMpIHtcclxuXHJcbiAgICB2YXIgTUFSS0VSX1RZUEVTID0gQ09OU1RTLk1BUktFUl9UWVBFUztcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGFkZE1hcmtlcnNUb01hcDogYWRkTWFya2Vyc1RvTWFwLFxyXG4gICAgICAgIGFkZFVzZXJNYXJrZXI6IGFkZFVzZXJNYXJrZXIsXHJcbiAgICAgICAgdXBkYXRlTWFya2VyczogdXBkYXRlTWFya2VycyxcclxuICAgICAgICBpc01hcmtlckluc3RhbmNlOiBpc01hcmtlckluc3RhbmNlXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpIHtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0IGluc3RhbmNlb2YgSC5tYXAuTWFya2VyIHx8IHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLkRvbU1hcmtlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRVc2VyTWFya2VyKG1hcCwgcGxhY2UpIHtcclxuICAgICAgICBwbGFjZS5tYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjM1cHhcIiBoZWlnaHQ9XCIzNXB4XCIgdmlld0JveD1cIjAgMCA5MCA5MFwiIHZlcnNpb249XCIxLjFcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+JyArXHJcbiAgICAgICAgICAgICc8ZGVmcz48Y2lyY2xlIGlkPVwicGF0aC0xXCIgY3g9XCIzMDJcIiBjeT1cIjgwMlwiIHI9XCIxNVwiPjwvY2lyY2xlPicgK1xyXG4gICAgICAgICAgICAnPG1hc2sgaWQ9XCJtYXNrLTJcIiBtYXNrQ29udGVudFVuaXRzPVwidXNlclNwYWNlT25Vc2VcIiBtYXNrVW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHg9XCItMzBcIiB5PVwiLTMwXCIgd2lkdGg9XCI5MFwiIGhlaWdodD1cIjkwXCI+JyArXHJcbiAgICAgICAgICAgICc8cmVjdCB4PVwiMjU3XCIgeT1cIjc1N1wiIHdpZHRoPVwiOTBcIiBoZWlnaHQ9XCI5MFwiIGZpbGw9XCJ3aGl0ZVwiPjwvcmVjdD48dXNlIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCIgZmlsbD1cImJsYWNrXCI+PC91c2U+JyArXHJcbiAgICAgICAgICAgICc8L21hc2s+PC9kZWZzPjxnIGlkPVwiUGFnZS0xXCIgc3Ryb2tlPVwibm9uZVwiIHN0cm9rZS13aWR0aD1cIjFcIiBmaWxsPVwibm9uZVwiIGZpbGwtcnVsZT1cImV2ZW5vZGRcIj4nICtcclxuICAgICAgICAgICAgJzxnIGlkPVwiU2VydmljZS1PcHRpb25zLS0tZGlyZWN0aW9ucy0tLW1hcFwiIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSgtMjU3LjAwMDAwMCwgLTc1Ny4wMDAwMDApXCI+PGcgaWQ9XCJPdmFsLTE1XCI+JyArXHJcbiAgICAgICAgICAgICc8dXNlIGZpbGw9XCIjRkZGRkZGXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+JyArXHJcbiAgICAgICAgICAgICc8dXNlIHN0cm9rZS1vcGFjaXR5PVwiMC4yOTYxMzkwNFwiIHN0cm9rZT1cIiMzRjM0QTBcIiBtYXNrPVwidXJsKCNtYXNrLTIpXCIgc3Ryb2tlLXdpZHRoPVwiNjBcIiB4bGluazpocmVmPVwiI3BhdGgtMVwiPjwvdXNlPicgK1xyXG4gICAgICAgICAgICAnPHVzZSBzdHJva2U9XCIjM0YzNEEwXCIgc3Ryb2tlLXdpZHRoPVwiNVwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+PC9nPjwvZz48L2c+PC9zdmc+JztcclxuXHJcbiAgICAgICAgdmFyIG1hcmtlciA9IG5ldyBTVkdNYXJrZXIocGxhY2UpLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkTWFya2Vyc1RvTWFwKG1hcCwgcGxhY2VzKSB7XHJcbiAgICAgICAgaWYgKCFwbGFjZXMgfHwgIXBsYWNlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgaWYgKCEobWFwIGluc3RhbmNlb2YgSC5NYXApKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG1hcCBpbnN0YW5jZScpO1xyXG5cclxuICAgICAgICBpZiAoIW1hcC5tYXJrZXJzR3JvdXApXHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKTtcclxuXHJcbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24ocGxhY2UsIGkpIHtcclxuICAgICAgICAgICAgdmFyIGNyZWF0b3IgPSBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSksXHJcbiAgICAgICAgICAgICAgICBtYXJrZXIgPSBwbGFjZS5kcmFnZ2FibGUgPyBfZHJhZ2dhYmxlTWFya2VyTWl4aW4oY3JlYXRvci5jcmVhdGUoKSkgOiBjcmVhdG9yLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChtYXAubWFya2Vyc0dyb3VwKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB1cGRhdGVNYXJrZXJzKG1hcCwgcGxhY2VzKSB7XHJcbiAgICAgICAgaWYgKG1hcC5tYXJrZXJzR3JvdXApIHtcclxuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cC5yZW1vdmVBbGwoKTtcclxuICAgICAgICAgICAgbWFwLnJlbW92ZU9iamVjdChtYXAubWFya2Vyc0dyb3VwKTtcclxuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cCA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhZGRNYXJrZXJzVG9NYXAuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSkge1xyXG4gICAgICAgIHZhciBDb25jcmV0ZU1hcmtlcixcclxuICAgICAgICAgICAgdHlwZSA9IHBsYWNlLnR5cGUgPyBwbGFjZS50eXBlLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBTVkdNYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRGVmYXVsdE1hcmtlcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcclxuICAgICAgICBtYXJrZXIuZHJhZ2dhYmxlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gU1ZHTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gU1ZHTWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gU1ZHTWFya2VyO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5nZXRJY29uID0gZ2V0SWNvbjtcclxuICAgIFxyXG4gICAgcmV0dXJuIFNWR01hcmtlcjtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XHJcbiAgICAgICAgdmFyIG1hcmtlciA9IG5ldyBILm1hcC5NYXJrZXIodGhpcy5jb29yZHMsIHtcclxuICAgICAgICAgICAgaWNvbjogdGhpcy5nZXRJY29uKCksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0SWNvbigpe1xyXG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5tYXJrdXA7XHJcbiAgICAgICAgIGlmKCFpY29uKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcmt1cCBtaXNzZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5JY29uKGljb24pO1xyXG4gICAgfVxyXG59Il19
