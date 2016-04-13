/**
 * Created by Dmytro on 4/11/2016.
 */
var tpl = require('./heremaps.tpl.html');

module.exports = function(
    $rootScope,
    $window,
    $timeout,
    // APIService
    // APIProvider,
    // UtilsService,
    CONSTS) {
    return {
        restrict: 'EA',
        template: tpl,
        replace: true,
        controller: function($scope, $element, $attrs) {
            $scope.options = {
                controls: !!$attrs.$attr.controls
            };
            //TODO
            // LoadApiCore
            
            console.log($scope);            
            
            var config = APIProvider.getConfig();
            
            APIProvider.subscribe($scope, APIProvider.CORE_READY, _apiReadyHandler);
            
            if($scope.options.controls)
                APIProvider.subscribe($scope, APIProvider.UI_READY, _uiReadyHandler);
            
            _setMapSize();

            $window.addEventListener('resize', UtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT))

            function _apiReadyHandler() {
                if ($element.html())
                    $element.empty();
                    
                
                var platform = new H.service.Platform({
                    'app_id': config.app_id,
                    'app_code': config.app_code
                });

                var defaultLayers = platform.createDefaultLayers();

                var map = new H.Map(
                    $element[0],
                    defaultLayers.normal.transit,
                    {
                        zoom: 10,
                        center: { lat: 52.5, lng: 13.4 }
                    });
                    
                var ui = H.ui.UI.createDefault(map, defaultLayers);
            }
            
            function _uiReadyHandler(){
                
            }

            function _resizeHandler() {
                _setMapSize()
                _apiReadyHandler();
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