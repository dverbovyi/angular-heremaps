/**
 * Created by Dmytro on 4/11/2016.
 */
var tpl = require('./heremaps.tpl.html');

module.exports = function($rootScope, $window, $timeout, APIProvider) {
    return {
        restrict: 'EA',
        template: tpl,
        replace: true,
        controller: function($scope, $element, $attrs) {
            console.log($attrs)
            var height = $attrs.height || 480,
                width = $attrs.width || 640;

            height = $window.innerHeight;
            width = $window.innerWidth;
            
            $scope.height = height + 'px';
            $scope.width = width + 'px';

            var config = APIProvider.getConfig();

            var apiReadySubscribe = $rootScope.$on('HEREMAPS_API_READY', _apiReadyHandler);
            
            var timeout = null;

            $scope.$on('$destroy', apiReadySubscribe);
            
            $window.addEventListener('resize', _resizeHandler)
            

            function _apiReadyHandler() {
                console.log('ready')
                if($element.html())
                    $element.empty();
                    
                var platform = new H.service.Platform({
                    'app_id': config.app_id,
                    'app_code': config.app_code
                });

                // Obtain the default map types from the platform object:
                var defaultLayers = platform.createDefaultLayers();
                
                console.log(defaultLayers)

                var map = new H.Map(
                    $element[0],
                    defaultLayers.satellite.map,
                    {
                        zoom: 10,
                        center: { lat: 52.5, lng: 13.4 }
                    });
            }
            
            function _resizeHandler(){
                console.log('resize')
                
                $scope.height = $window.innerHeight + 'px';
                $scope.width = $window.innerWidth + 'px';
                
                console.log($scope.height, $scope.width)
                
                $scope.$digest();
                if(timeout)
                    $timeout.cancel(timeout);
                    
                timeout = $timeout(_apiReadyHandler, 500);
            }
            
        },
        link: function(scope) { }
    }
};