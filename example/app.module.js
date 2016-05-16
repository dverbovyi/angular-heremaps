
(function() {

    'use strict';

    angular
        .module('exampleModule', ['heremaps'])
        .config(["HereMapsConfigProvider", function(HereMapsConfigProvider) {
            HereMapsConfigProvider.setOptions({
                'app_id': 'wMHJuLgCQzkfbhzXIwRF',
                'app_code': 'WLIc7QzoO8irv7lurUt1qA',
                'useHTTPS': true
            });
        }]);

    angular.module('exampleModule')
        .controller('AppCtrl', ['$scope', AppController]);

    function AppController($scope) {
        
        $scope.mapOptions = {
            resize: true,
            zoom: 15,
            draggable: true,
        };

        $scope.onMapReady = function(map) {
            $scope.map = map;
            
            // $scope.map.setCenter({
            //     lat: 52.508249, lng: 13.33893
            // });
            
            $scope.map.calculateRoute('pedestrian', {
                from: {
                    lat: 52.508249, lng: 13.338931
                },
                to: {
                    lat: 52.506682, lng: 13.332107
                }
            })
        };
        
        $scope.markers = [
            {
                pos: { lat: 52.508249, lng: 13.338931 },
                draggable: true
            },
            {
                pos: { lat: 52.503730, lng: 13.331678 },
                type: 'DOM',
                markup: '<div style="width: 35px; height: 20px; background-color: red">DOM</div>',
            },
            {
                pos: { lat: 52.531, lng: 13.380 }
            }
        ]
    }
})();


