
(function () {

    'use strict';

    angular
        .module('demoModule', ['heremaps'])
        .config(["HereMapsConfigProvider", function (HereMapsConfigProvider) {
            HereMapsConfigProvider.setOptions({
                'app_id': 'DemoAppId01082013GAL',
                'app_code': 'AJKnXv84fjrb0KIHawS0Tg',
                'useHTTPS': true,
                'useCIT': true
            });
        }]);

    angular.module('demoModule')
        .controller('DemoCtrl', ['$scope', DemoCtrl]);

    function DemoCtrl($scope) {
        $scope.mapOptions = {
            height: 640,
            width: 480,
            zoom: 13,
            draggable: true,
            resize: true,
            coords: {
                longitude: 55.1021576,
                latitude: 25.064732
            }
        };

        $scope.onMapReady = function (heremaps) {
            $scope.heremaps = heremaps;

            heremaps.setCenter({
                lat: 25.1075831, lng: 55.159061
            });

            heremaps.setZoom(13);

            heremaps.calculateRoute('car', {
                mode: 'fastest',
                waypoints: [
                    { lat: 25.1075831, lng: 55.1461 },
                    { lat: 25.1075831, lng: 55.179061 }
                ]
            }).then(function(result){
                if(!result.response)
                    return;

                heremaps.addRouteToMap({
                    zoomToBounds: false,
                    route: result.response.route[0],
                    style: {
                        lineWidth: 5,
                        color: 'rgba(0, 128, 255, 1)'
                    }
                });
            }).catch(handleError);
        };

        $scope.markers = [
            {
                pos: { lat: 25.1075831, lng: 55.1461 },
                popup: {
                    display: 'onHover',
                    markup: '<div>Default Marker</div>'
                }
            },
            {
                pos: { lat: 25.1075831, lng: 55.179061 }
            },
            {
                pos: { lat: 25.1075831, lng: 55.079061 },
                type: 'DOM',
                markup: '<div class="dom-marker"><h3>DOM Marker</h3><h5>(Click me)</h5></div>',
                popup: {
                    display: 'onClick',
                    markup: '<a class="github-link" target="_black" href="https://github.com/dverbovyi/angular-heremaps">View on GitHub</a>'
                }
            },
            {
                pos: { lat: 25.1075831, lng: 55.2 },
                type: 'SVG',
                draggable: true,
                markup: '<svg height="100" width="70" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 56"><defs><filter height="200%" width="200%" y="-50%" x="-50%" id="filter-1"><feOffset result="shadowOffset1" in="SourceAlpha" dy="5" dx="0" /><feGaussianBlur result="shadowBlur1" in="shadowOffset1" stdDeviation="5" /><feColorMatrix result="shadowMatrix1" in="shadowBlur1" type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.22 0" />  <feMerge><feMergeNode in="shadowMatrix1" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><path filter="url(#filter-1)" fill="red" fill-rule="evenodd" d="M 20 48 C 20 48 4 24.48 4 15.77 C 4 7.06 11.16 0 20 0 C 28.84 0 36 7.06 36 15.77 C 36 24.48 20 48 20 48 Z M 20 6.84 C 15.01 6.84 10.97 10.83 10.97 15.75 C 10.97 20.67 15.01 24.66 20 24.66 C 24.99 24.66 29.03 20.67 29.03 15.75 C 29.03 10.83 24.99 6.84 20 6.84 Z" /><path fill="#ffffff" fill-rule="evenodd" d="M 20 7 C 24.97 7 29 11.03 29 16 C 29 20.97 24.97 25 20 25 C 15.03 25 11 20.97 11 16 C 11 11.03 15.03 7 20 7 Z" /><text font-weight="900" y="18" x="50%" font-family="Arial" font-size="8" fill="#000"><tspan text-anchor="middle" alignment-baseline="middle">SVG</tspan><tspan text-anchor="middle" y="30" x="20" alignment-baseline="middle">drag me</tspan></text></svg>'
            }
        ];

        $scope.listeners = {
            'click': function () {
                console.info('click');
            },
            'mapviewchangeend': function () {
                console.info('mapviewchangeend');
            }
        };

        function handleError(e) {
            console.error(e);
        }
    }
})();