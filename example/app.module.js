
(function () {

    'use strict';

    angular
        .module('exampleModule', ['heremaps'])
        .config(["HereMapsConfigProvider", function (HereMapsConfigProvider) {
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
            height: 640,
            width: 960,
            draggable: true,
            coords: {
                longitude: 13.338931,
                latitude: 52.508249
            }
        };

        $scope.onMapReady = function (map) {
            $scope.map = map;

            $scope.map.setCenter({
                lat: 52.508249, lng: 13.33893
            });

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
                pos: { lat: "52.531", lng: "13.380" },
                type: 'SVG',
                markup:'<svg height="100" width="70" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 56"><defs><filter height="200%" width="200%" y="-50%" x="-50%" id="filter-1"><feOffset result="shadowOffset1" in="SourceAlpha" dy="5" dx="0" /><feGaussianBlur result="shadowBlur1" in="shadowOffset1" stdDeviation="5" /><feColorMatrix result="shadowMatrix1" in="shadowBlur1" type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.22 0" />  <feMerge><feMergeNode in="shadowMatrix1" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><path filter="url(#filter-1)" fill="red" fill-rule="evenodd" d="M 20 48 C 20 48 4 24.48 4 15.77 C 4 7.06 11.16 0 20 0 C 28.84 0 36 7.06 36 15.77 C 36 24.48 20 48 20 48 Z M 20 6.84 C 15.01 6.84 10.97 10.83 10.97 15.75 C 10.97 20.67 15.01 24.66 20 24.66 C 24.99 24.66 29.03 20.67 29.03 15.75 C 29.03 10.83 24.99 6.84 20 6.84 Z" /><path fill="#ffffff" fill-rule="evenodd" d="M 20 7 C 24.97 7 29 11.03 29 16 C 29 20.97 24.97 25 20 25 C 15.03 25 11 20.97 11 16 C 11 11.03 15.03 7 20 7 Z" /><text font-weight="900" y="18" x="50%" font-family="Arial" font-size="8" fill="#000"><tspan text-anchor="middle" alignment-baseline="middle">SVG</tspan></text></svg>'
            }
        ]
    }
})();


