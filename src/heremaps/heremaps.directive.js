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