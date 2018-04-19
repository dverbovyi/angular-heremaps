
(function () {

    'use strict';

    angular
        .module('demoModule', ['heremaps'])
        .config(["HereMapsConfigProvider", function (HereMapsConfigProvider) {
            HereMapsConfigProvider.setOptions({
                'app_id': 'DemoAppId01082013GAL',
                'app_code': 'AJKnXv84fjrb0KIHawS0Tg',
                'useHTTPS': true,
                'useCIT': true,
                'mapTileConfig': {
                    metadataQueryParams: {
                        'lg2': 'ara'
                    }
                }
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
                markup: './marker.svg'
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